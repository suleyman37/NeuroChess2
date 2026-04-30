from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chess


OPENINGS_BOOK_SCHEMA_VERSION = "openings_book_v1"
LICHESS_SOURCE_NAME = "lichess-org/chess-openings"
LICHESS_INTERNAL_SOURCE = "lichess_chess_openings"
DEFAULT_LICHESS_SOURCE_DIR = (
    Path(__file__).resolve().parent / "data" / "sources" / "lichess_chess_openings"
)
DEFAULT_OPENINGS_BOOK_PATH = Path(__file__).resolve().parent / "data" / "openings_book.json"
TSV_FILE_NAMES = ("a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv")


class OpeningBookPreparationError(Exception):
    pass


def prepare_lichess_openings(
    source_dir: str | Path | None = None,
    output_path: str | Path | None = None,
) -> dict[str, Any]:
    source_root = Path(source_dir) if source_dir is not None else DEFAULT_LICHESS_SOURCE_DIR
    target_path = Path(output_path) if output_path is not None else DEFAULT_OPENINGS_BOOK_PATH

    if not source_root.exists():
        raise OpeningBookPreparationError(f"lichess openings source not found: {source_root}")

    source_license = _detect_license(source_root)
    raw_rows = _read_source_rows(source_root)
    valid_rows: list[dict[str, Any]] = []
    skipped_invalid = 0

    for row in raw_rows:
        try:
            valid_rows.append(_convert_row(row))
        except Exception:
            skipped_invalid += 1

    duplicate_counts = Counter((row["name"], row["variation"]) for row in valid_rows)
    duplicate_extra = sum(count - 1 for count in duplicate_counts.values() if count > 1)
    duplicate_groups = sum(1 for count in duplicate_counts.values() if count > 1)
    lines = _disambiguate_and_sort_lines(valid_rows, duplicate_counts)

    payload = {
        "schema_version": OPENINGS_BOOK_SCHEMA_VERSION,
        "source": LICHESS_SOURCE_NAME,
        "source_license": source_license,
        "generated_at": _generated_at(target_path, lines, source_license),
        "lines": lines,
    }

    target_path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    output_written = not target_path.exists() or target_path.read_text(encoding="utf-8") != text
    if output_written:
        target_path.write_text(text, encoding="utf-8")

    return {
        "status": "ok",
        "source": LICHESS_SOURCE_NAME,
        "source_license": source_license,
        "files_read": len(TSV_FILE_NAMES),
        "lines_read": len(raw_rows),
        "lines_written": len(lines),
        "skipped_invalid": skipped_invalid,
        "duplicate_lines": duplicate_extra,
        "duplicate_name_variation_groups": duplicate_groups,
        "output_path": str(target_path),
        "output_written": output_written,
    }


def _read_source_rows(source_root: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    missing: list[str] = []
    for file_name in TSV_FILE_NAMES:
        path = source_root / file_name
        if not path.exists():
            missing.append(file_name)
            continue
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            if reader.fieldnames != ["eco", "name", "pgn"]:
                raise OpeningBookPreparationError(
                    f"unsupported TSV format in {path}: {reader.fieldnames}"
                )
            for index, row in enumerate(reader, start=2):
                item = {key: (value or "") for key, value in row.items()}
                item["_file"] = file_name
                item["_line"] = str(index)
                rows.append(item)
    if missing:
        raise OpeningBookPreparationError(
            f"missing lichess openings TSV files: {', '.join(missing)}"
        )
    return rows


def _convert_row(row: dict[str, str]) -> dict[str, Any]:
    full_name = row["name"].strip()
    if not full_name:
        raise OpeningBookPreparationError("opening row has no name")

    name, variation = _split_name(full_name)
    moves_uci, epd = _pgn_to_uci_and_epd(row["pgn"].strip())
    if not moves_uci:
        raise OpeningBookPreparationError(f"opening row has no moves: {full_name}")

    return {
        "eco_code": row["eco"].strip() or None,
        "name": name,
        "variation": variation,
        "color": "both",
        "moves_uci": moves_uci,
        "target_depth_plies": len(moves_uci),
        "epd": epd,
        "source": LICHESS_INTERNAL_SOURCE,
        "_source_name": full_name,
        "_sort_key": (
            row["eco"].strip(),
            name,
            variation or "",
            len(moves_uci),
            " ".join(moves_uci),
        ),
    }


def _split_name(full_name: str) -> tuple[str, str | None]:
    if ":" not in full_name:
        return full_name.strip(), None
    name, variation = full_name.split(":", 1)
    return name.strip(), variation.strip() or None


def _pgn_to_uci_and_epd(pgn: str) -> tuple[list[str], str]:
    board = chess.Board()
    moves: list[str] = []
    for token in pgn.replace("\n", " ").split():
        san = _clean_san_token(token)
        if not san:
            continue
        move = board.parse_san(san)
        moves.append(move.uci())
        board.push(move)
    return moves, board.epd()


def _clean_san_token(token: str) -> str:
    token = token.strip()
    if token in {"1-0", "0-1", "1/2-1/2", "*"}:
        return ""
    token = re.sub(r"^\d+\.(?:\.\.)?", "", token)
    token = token.strip()
    if not token or token in {"...", "."}:
        return ""
    return token.rstrip("!?")


def _disambiguate_and_sort_lines(
    rows: list[dict[str, Any]],
    duplicate_counts: Counter[tuple[str, str | None]],
) -> list[dict[str, Any]]:
    final_rows: list[dict[str, Any]] = []
    for row in rows:
        item = {key: value for key, value in row.items() if not key.startswith("_")}
        key = (row["name"], row["variation"])
        if duplicate_counts[key] > 1:
            item["variation"] = _variation_with_digest(
                row["variation"],
                row["moves_uci"],
            )
        final_rows.append(item)

    final_rows.sort(
        key=lambda item: (
            item["eco_code"] or "",
            item["name"],
            item["variation"] or "",
            item["target_depth_plies"],
            " ".join(item["moves_uci"]),
        )
    )
    return final_rows


def _variation_with_digest(variation: str | None, moves_uci: list[str]) -> str:
    digest = hashlib.sha1(" ".join(moves_uci).encode("utf-8")).hexdigest()[:8]
    suffix = f"line {digest}"
    return f"{variation} ({suffix})" if variation else suffix


def _detect_license(source_root: Path) -> str:
    readme = source_root / "README.md"
    copying = source_root / "COPYING.txt"
    text = ""
    if readme.exists():
        text += readme.read_text(encoding="utf-8", errors="ignore")
    if copying.exists():
        text += "\n" + copying.read_text(encoding="utf-8", errors="ignore")
    if "CC0" in text:
        return "CC0 1.0 Universal"
    return "unknown"


def _generated_at(target_path: Path, lines: list[dict[str, Any]], source_license: str) -> str:
    candidate = {
        "schema_version": OPENINGS_BOOK_SCHEMA_VERSION,
        "source": LICHESS_SOURCE_NAME,
        "source_license": source_license,
        "lines": lines,
    }
    if target_path.exists():
        try:
            existing = json.loads(target_path.read_text(encoding="utf-8"))
            existing_compare = dict(existing)
            existing_compare.pop("generated_at", None)
            if existing_compare == candidate and isinstance(existing.get("generated_at"), str):
                return existing["generated_at"]
        except Exception:
            pass
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
