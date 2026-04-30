from __future__ import annotations

import json
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chess

from neurochess.data.database import get_connection
from neurochess.opening_book_preparer import (
    DEFAULT_LICHESS_SOURCE_DIR,
    DEFAULT_OPENINGS_BOOK_PATH,
    LICHESS_INTERNAL_SOURCE,
    LICHESS_SOURCE_NAME,
    OPENINGS_BOOK_SCHEMA_VERSION,
    OpeningBookPreparationError,
    prepare_lichess_openings,
)


OPENINGS_SEED_SCHEMA_VERSION = "openings_seed_v1"
DEFAULT_OPENINGS_SEED_PATH = Path(__file__).resolve().parent / "data" / "openings_seed.json"


class OpeningServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class OpeningSeedLine:
    eco_code: str | None
    name: str
    variation: str | None
    color: str | None
    moves_uci: tuple[str, ...]
    target_depth_plies: int
    parent_line_name: str | None
    note: str | None
    source: str = "internal_seed"


@dataclass(frozen=True)
class GameMoveContext:
    ply: int
    fen_before: str
    fen_after: str
    side_to_move_before: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_fen_for_opening(fen: str) -> str:
    """Return the opening matching key without halfmove/fullmove counters."""
    board = chess.Board(fen)
    parts = board.fen().split()
    return " ".join(parts[:4])


class OpeningService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        seed_path: str | Path | None = None,
        book_path: str | Path | None = None,
        lichess_source_dir: str | Path | None = None,
    ) -> None:
        self.db_path = db_path
        self.seed_path = Path(seed_path) if seed_path is not None else DEFAULT_OPENINGS_SEED_PATH
        self.book_path = Path(book_path) if book_path is not None else DEFAULT_OPENINGS_BOOK_PATH
        self.lichess_source_dir = (
            Path(lichess_source_dir)
            if lichess_source_dir is not None
            else DEFAULT_LICHESS_SOURCE_DIR
        )

    def import_opening_seed(self, seed_path: str | Path | None = None) -> dict[str, int | str]:
        source_path = Path(seed_path) if seed_path is not None else self.seed_path
        seed_lines = _load_and_validate_seed(source_path)
        counters = self._import_lines(seed_lines)
        counters["source"] = "internal_seed"
        return counters

    def import_opening_book(self, book_path: str | Path | None = None) -> dict[str, int | str]:
        source_path = Path(book_path) if book_path is not None else self.book_path
        book_lines, skipped_invalid, source_name = _load_and_validate_book(source_path)
        counters = self._import_lines(book_lines)
        counters["source"] = source_name
        counters["skipped_invalid"] = skipped_invalid
        return counters

    def ensure_opening_book_available(self) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            line_count = connection.execute(
                "SELECT COUNT(*) FROM opening_lines"
            ).fetchone()[0]
        if int(line_count) > 0:
            return {"status": "ok", "source": "existing", "imported": False}

        if self.book_path.exists():
            result = self.import_opening_book()
            result["imported"] = True
            return result

        if self.lichess_source_dir.exists():
            try:
                preparation = prepare_lichess_openings(
                    source_dir=self.lichess_source_dir,
                    output_path=self.book_path,
                )
            except OpeningBookPreparationError as exc:
                raise OpeningServiceError(str(exc)) from exc
            result = self.import_opening_book()
            result["imported"] = True
            result["prepared"] = preparation
            return result

        result = self.import_opening_seed()
        result["imported"] = True
        result["fallback"] = "internal_seed"
        return result

    def _import_lines(self, seed_lines: list[OpeningSeedLine]) -> dict[str, int | str]:
        counters = {
            "status": "ok",
            "created": 0,
            "updated": 0,
            "unchanged": 0,
            "kept_orphan": 0,
            "nodes_created": 0,
            "nodes_deleted": 0,
        }
        seed_keys = {(line.name, line.variation) for line in seed_lines}

        with closing(get_connection(self.db_path)) as connection:
            connection.execute("BEGIN")
            try:
                line_ids: dict[tuple[str, str | None], int] = {}
                for line in seed_lines:
                    existing = _find_opening_line(connection, line.name, line.variation)
                    generated_nodes = _generate_nodes(line)
                    pgn_canonical = _pgn_canonical(line.moves_uci)

                    if existing is None:
                        line_id = _insert_opening_line(connection, line, pgn_canonical)
                        _replace_nodes(connection, line_id, generated_nodes)
                        counters["created"] += 1
                        counters["nodes_created"] += len(generated_nodes)
                    else:
                        line_id = int(existing["id"])
                        existing_moves = _expected_moves_for_line(connection, line_id)
                        metadata_changed = _line_metadata_changed(existing, line, pgn_canonical)
                        sequence_changed = (
                            int(existing["target_depth_plies"]) != line.target_depth_plies
                            or existing_moves != list(line.moves_uci)
                        )

                        if metadata_changed or sequence_changed:
                            _update_opening_line(connection, line_id, line, pgn_canonical)
                            counters["updated"] += 1
                            if sequence_changed:
                                deleted = _delete_nodes(connection, line_id)
                                _replace_nodes(connection, line_id, generated_nodes)
                                counters["nodes_deleted"] += deleted
                                counters["nodes_created"] += len(generated_nodes)
                        else:
                            counters["unchanged"] += 1

                    line_ids[(line.name, line.variation)] = line_id

                _resolve_parent_lines(connection, seed_lines, line_ids)
                counters["kept_orphan"] = _count_orphan_lines(connection, seed_keys)
                connection.commit()
                return counters
            except Exception:
                connection.rollback()
                raise

    def classify_game_opening(self, game_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            game = connection.execute(
                "SELECT * FROM games WHERE id = ?",
                (game_id,),
            ).fetchone()
            if game is None:
                raise OpeningServiceError("game not found", status_code=404)

            initial_fen = _initial_fen_for_game(connection, game, game_id)
            if initial_fen != chess.STARTING_FEN:
                payload = _not_applicable_from_position_payload(game_id, initial_fen)
                _upsert_classification(connection, payload)
                connection.commit()
                return self.get_game_opening(game_id)

            line_count = connection.execute(
                "SELECT COUNT(*) FROM opening_lines"
            ).fetchone()[0]
            if int(line_count) == 0:
                self.ensure_opening_book_available()
                line_count = connection.execute(
                    "SELECT COUNT(*) FROM opening_lines"
                ).fetchone()[0]
                if int(line_count) == 0:
                    raise OpeningServiceError(
                        "opening book not available",
                        status_code=400,
                    )

            try:
                contexts = _game_move_contexts(connection, game_id)
                payload = _classify_from_contexts(connection, game_id, contexts)
                _upsert_classification(connection, payload)
                connection.commit()
                return self.get_game_opening(game_id)
            except Exception:
                connection.rollback()
                failed_payload = _failed_classification_payload(game_id)
                _upsert_failed_classification(self.db_path, failed_payload)
                return failed_payload

    def get_game_opening(self, game_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            game = connection.execute(
                "SELECT id FROM games WHERE id = ?",
                (game_id,),
            ).fetchone()
            if game is None:
                raise OpeningServiceError("game not found", status_code=404)

            row = connection.execute(
                """
                SELECT *
                FROM game_opening_classifications
                WHERE game_id = ?
                """,
                (game_id,),
            ).fetchone()
            if row is None:
                raise OpeningServiceError(
                    "opening classification not found",
                    status_code=404,
                )
            return _classification_row_to_payload(row)


def import_opening_seed(
    db_path: str | Path | None = None,
    seed_path: str | Path | None = None,
) -> dict[str, int | str]:
    return OpeningService(db_path=db_path, seed_path=seed_path).import_opening_seed()


def import_opening_book(
    db_path: str | Path | None = None,
    book_path: str | Path | None = None,
) -> dict[str, int | str]:
    return OpeningService(db_path=db_path, book_path=book_path).import_opening_book()


def classify_game_opening(
    game_id: int,
    db_path: str | Path | None = None,
) -> dict[str, Any]:
    return OpeningService(db_path=db_path).classify_game_opening(game_id)


def _load_and_validate_seed(path: Path) -> list[OpeningSeedLine]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise OpeningServiceError(f"opening seed not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise OpeningServiceError(f"invalid opening seed JSON: {exc}") from exc

    if payload.get("schema_version") != OPENINGS_SEED_SCHEMA_VERSION:
        raise OpeningServiceError("invalid openings seed schema_version")
    lines = payload.get("lines")
    if not isinstance(lines, list):
        raise OpeningServiceError("openings seed lines must be a list")

    parsed: list[OpeningSeedLine] = []
    seen_keys: set[tuple[str, str | None]] = set()
    for index, item in enumerate(lines, start=1):
        if not isinstance(item, dict):
            raise OpeningServiceError(f"opening line {index} must be an object")
        line = _parse_seed_line(item, index)
        key = (line.name, line.variation)
        if key in seen_keys:
            raise OpeningServiceError(f"duplicate opening seed line: {line.name} / {line.variation}")
        seen_keys.add(key)
        _generate_nodes(line)
        parsed.append(line)

    seed_names = {line.name for line in parsed}
    for line in parsed:
        if line.parent_line_name is not None and line.parent_line_name not in seed_names:
            raise OpeningServiceError(
                f"unknown parent_line_name for {line.name}: {line.parent_line_name}"
            )
    return parsed


def _load_and_validate_book(path: Path) -> tuple[list[OpeningSeedLine], int, str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise OpeningServiceError(f"opening book not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise OpeningServiceError(f"invalid opening book JSON: {exc}") from exc

    if payload.get("schema_version") != OPENINGS_BOOK_SCHEMA_VERSION:
        raise OpeningServiceError("invalid openings book schema_version")
    lines = payload.get("lines")
    if not isinstance(lines, list):
        raise OpeningServiceError("openings book lines must be a list")

    source_name = _optional_str(payload.get("source")) or LICHESS_SOURCE_NAME
    parsed: list[OpeningSeedLine] = []
    seen_keys: set[tuple[str, str | None]] = set()
    skipped_invalid = 0
    for index, item in enumerate(lines, start=1):
        if not isinstance(item, dict):
            skipped_invalid += 1
            continue
        try:
            line = _parse_book_line(item, index)
            key = (line.name, line.variation)
            if key in seen_keys:
                raise OpeningServiceError(
                    f"duplicate opening book line: {line.name} / {line.variation}"
                )
            seen_keys.add(key)
            _generate_nodes(line)
        except OpeningServiceError:
            skipped_invalid += 1
            continue
        parsed.append(line)

    if not parsed:
        raise OpeningServiceError("opening book contains no valid lines")
    return parsed, skipped_invalid, source_name


def _parse_seed_line(item: dict[str, Any], index: int) -> OpeningSeedLine:
    name = item.get("name")
    if not isinstance(name, str) or not name.strip():
        raise OpeningServiceError(f"opening line {index} has invalid name")
    moves = item.get("moves_uci")
    if not isinstance(moves, list) or not all(isinstance(move, str) for move in moves):
        raise OpeningServiceError(f"opening line {name} has invalid moves_uci")
    target_depth = item.get("target_depth_plies")
    if not isinstance(target_depth, int):
        raise OpeningServiceError(f"opening line {name} has invalid target_depth_plies")
    if target_depth != len(moves):
        raise OpeningServiceError(
            f"opening line {name} target_depth_plies must equal len(moves_uci)"
        )
    color = item.get("color")
    if color not in {"white", "black", "both", None}:
        raise OpeningServiceError(f"opening line {name} has invalid color")

    return OpeningSeedLine(
        eco_code=_optional_str(item.get("eco_code")),
        name=name.strip(),
        variation=_optional_str(item.get("variation")),
        color=color,
        moves_uci=tuple(moves),
        target_depth_plies=target_depth,
        parent_line_name=_optional_str(item.get("parent_line_name")),
        note=_optional_str(item.get("note")),
        source="internal_seed",
    )


def _parse_book_line(item: dict[str, Any], index: int) -> OpeningSeedLine:
    name = item.get("name")
    if not isinstance(name, str) or not name.strip():
        raise OpeningServiceError(f"opening book line {index} has invalid name")
    moves = item.get("moves_uci")
    if not isinstance(moves, list) or not all(isinstance(move, str) for move in moves):
        raise OpeningServiceError(f"opening book line {name} has invalid moves_uci")
    target_depth = item.get("target_depth_plies")
    if not isinstance(target_depth, int):
        raise OpeningServiceError(f"opening book line {name} has invalid target_depth_plies")
    if target_depth != len(moves):
        raise OpeningServiceError(
            f"opening book line {name} target_depth_plies must equal len(moves_uci)"
        )
    color = item.get("color")
    if color not in {"white", "black", "both", None}:
        raise OpeningServiceError(f"opening book line {name} has invalid color")
    source = _optional_str(item.get("source")) or LICHESS_INTERNAL_SOURCE

    return OpeningSeedLine(
        eco_code=_optional_str(item.get("eco_code")),
        name=name.strip(),
        variation=_optional_str(item.get("variation")),
        color=color,
        moves_uci=tuple(moves),
        target_depth_plies=target_depth,
        parent_line_name=None,
        note=None,
        source=source,
    )


def _generate_nodes(line: OpeningSeedLine) -> list[dict[str, Any]]:
    board = chess.Board()
    nodes: list[dict[str, Any]] = []
    moves = [chess.Move.from_uci(uci) for uci in line.moves_uci]

    for ply in range(line.target_depth_plies + 1):
        expected_uci: str | None = None
        expected_san: str | None = None
        if ply < len(moves):
            move = moves[ply]
            if move not in board.legal_moves:
                raise OpeningServiceError(
                    f"invalid UCI move in {line.name}: {move.uci()} at ply {ply + 1}"
                )
            expected_uci = move.uci()
            expected_san = board.san(move)

        nodes.append(
            {
                "ply": ply,
                "fen": board.fen(),
                "fen_key": normalize_fen_for_opening(board.fen()),
                "expected_move_uci": expected_uci,
                "expected_move_san": expected_san,
                "alternatives_json": "[]",
                "note": line.note if ply == 0 else None,
            }
        )

        if ply < len(moves):
            board.push(moves[ply])

    return nodes


def _pgn_canonical(moves_uci: tuple[str, ...]) -> str:
    board = chess.Board()
    san_moves: list[str] = []
    for uci in moves_uci:
        move = chess.Move.from_uci(uci)
        san_moves.append(board.san(move))
        board.push(move)
    return " ".join(san_moves)


def _find_opening_line(connection: Any, name: str, variation: str | None) -> Any | None:
    return connection.execute(
        """
        SELECT *
        FROM opening_lines
        WHERE name = ?
          AND (
            (variation IS NULL AND ? IS NULL)
            OR variation = ?
          )
        ORDER BY id
        LIMIT 1
        """,
        (name, variation, variation),
    ).fetchone()


def _insert_opening_line(
    connection: Any,
    line: OpeningSeedLine,
    pgn_canonical: str,
) -> int:
    now = _utc_now()
    cursor = connection.execute(
        """
        INSERT INTO opening_lines (
            eco_code,
            name,
            variation,
            color,
            parent_line_id,
            target_depth_plies,
            pgn_canonical,
            source,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
        """,
        (
            line.eco_code,
            line.name,
            line.variation,
            line.color,
            line.target_depth_plies,
            pgn_canonical,
            line.source,
            now,
            now,
        ),
    )
    return int(cursor.lastrowid)


def _update_opening_line(
    connection: Any,
    line_id: int,
    line: OpeningSeedLine,
    pgn_canonical: str,
) -> None:
    connection.execute(
        """
        UPDATE opening_lines
        SET eco_code = ?,
            name = ?,
            variation = ?,
            color = ?,
            target_depth_plies = ?,
            pgn_canonical = ?,
            source = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            line.eco_code,
            line.name,
            line.variation,
            line.color,
            line.target_depth_plies,
            pgn_canonical,
            line.source,
            _utc_now(),
            line_id,
        ),
    )


def _line_metadata_changed(row: Any, line: OpeningSeedLine, pgn_canonical: str) -> bool:
    return any(
        (
            row["eco_code"] != line.eco_code,
            row["name"] != line.name,
            row["variation"] != line.variation,
            row["color"] != line.color,
            row["pgn_canonical"] != pgn_canonical,
            row["source"] != line.source,
        )
    )


def _replace_nodes(connection: Any, line_id: int, nodes: list[dict[str, Any]]) -> None:
    now = _utc_now()
    for node in nodes:
        connection.execute(
            """
            INSERT INTO opening_line_nodes (
                line_id,
                ply,
                fen,
                fen_key,
                expected_move_uci,
                expected_move_san,
                alternatives_json,
                note,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                line_id,
                node["ply"],
                node["fen"],
                node["fen_key"],
                node["expected_move_uci"],
                node["expected_move_san"],
                node["alternatives_json"],
                node["note"],
                now,
            ),
        )


def _delete_nodes(connection: Any, line_id: int) -> int:
    deleted = connection.execute(
        "SELECT COUNT(*) FROM opening_line_nodes WHERE line_id = ?",
        (line_id,),
    ).fetchone()[0]
    connection.execute("DELETE FROM opening_line_nodes WHERE line_id = ?", (line_id,))
    return int(deleted)


def _expected_moves_for_line(connection: Any, line_id: int) -> list[str]:
    rows = connection.execute(
        """
        SELECT expected_move_uci
        FROM opening_line_nodes
        WHERE line_id = ?
          AND expected_move_uci IS NOT NULL
        ORDER BY ply
        """,
        (line_id,),
    ).fetchall()
    return [str(row["expected_move_uci"]) for row in rows]


def _resolve_parent_lines(
    connection: Any,
    seed_lines: list[OpeningSeedLine],
    line_ids: dict[tuple[str, str | None], int],
) -> None:
    name_counts: dict[str, int] = {}
    for line in seed_lines:
        name_counts[line.name] = name_counts.get(line.name, 0) + 1

    for line in seed_lines:
        line_id = line_ids[(line.name, line.variation)]
        parent_id: int | None = None
        if line.parent_line_name is not None:
            if name_counts.get(line.parent_line_name, 0) > 1:
                raise OpeningServiceError(
                    f"ambiguous parent_line_name: {line.parent_line_name}"
                )
            parent_key = next(
                (key for key in line_ids if key[0] == line.parent_line_name),
                None,
            )
            if parent_key is None:
                raise OpeningServiceError(
                    f"unknown parent_line_name: {line.parent_line_name}"
                )
            parent_id = line_ids[parent_key]

        current_parent = connection.execute(
            "SELECT parent_line_id FROM opening_lines WHERE id = ?",
            (line_id,),
        ).fetchone()
        if current_parent is None or current_parent["parent_line_id"] != parent_id:
            connection.execute(
                """
                UPDATE opening_lines
                SET parent_line_id = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (parent_id, _utc_now(), line_id),
            )


def _count_orphan_lines(
    connection: Any,
    seed_keys: set[tuple[str, str | None]],
) -> int:
    rows = connection.execute("SELECT name, variation FROM opening_lines").fetchall()
    return sum(
        1
        for row in rows
        if (row["name"], row["variation"]) not in seed_keys
    )


def _game_move_contexts(connection: Any, game_id: int) -> list[GameMoveContext]:
    rows = connection.execute(
        """
        SELECT *
        FROM moves
        WHERE game_id = ?
        ORDER BY ply, id
        """,
        (game_id,),
    ).fetchall()
    contexts: list[GameMoveContext] = []
    for row in rows:
        board = chess.Board(row["fen_before"])
        move = chess.Move.from_uci(row["uci"])
        if move not in board.legal_moves:
            raise OpeningServiceError(
                f"invalid move in game history at ply {row['ply']}: {row['uci']}"
            )
        side = "white" if board.turn == chess.WHITE else "black"
        next_board = board.copy()
        next_board.push(move)
        contexts.append(
            GameMoveContext(
                ply=int(row["ply"]),
                fen_before=row["fen_before"],
                fen_after=next_board.fen(),
                side_to_move_before=side,
            )
        )
    return contexts


def _classify_from_contexts(
    connection: Any,
    game_id: int,
    contexts: list[GameMoveContext],
) -> dict[str, Any]:
    positions = {0: contexts[0].fen_before if contexts else chess.STARTING_FEN}
    for context in contexts:
        positions[context.ply] = context.fen_after
    position_keys = {
        ply: normalize_fen_for_opening(fen)
        for ply, fen in positions.items()
    }

    lines = connection.execute(
        "SELECT * FROM opening_lines ORDER BY id"
    ).fetchall()
    candidates: list[tuple[Any, int]] = []
    for line in lines:
        matched = _matched_plies_for_line(connection, int(line["id"]), position_keys)
        if matched > 0:
            candidates.append((line, matched))

    if not candidates:
        return _classification_payload(
            game_id=game_id,
            line=None,
            matched_plies=0,
            contexts=contexts,
        )

    max_matched = max(matched for _, matched in candidates)
    tied = [(line, matched) for line, matched in candidates if matched == max_matched]
    selected_line, selected_matched = sorted(
        tied,
        key=lambda item: (
            abs(int(item[0]["target_depth_plies"]) - max_matched),
            0 if int(item[0]["target_depth_plies"]) >= max_matched else 1,
            int(item[0]["id"]),
        ),
    )[0]
    return _classification_payload(
        game_id=game_id,
        line=selected_line,
        matched_plies=selected_matched,
        contexts=contexts,
    )


def _matched_plies_for_line(
    connection: Any,
    line_id: int,
    position_keys: dict[int, str],
) -> int:
    rows = connection.execute(
        """
        SELECT ply, fen_key
        FROM opening_line_nodes
        WHERE line_id = ?
        ORDER BY ply
        """,
        (line_id,),
    ).fetchall()
    matched = 0
    for row in rows:
        ply = int(row["ply"])
        if ply not in position_keys:
            break
        if position_keys[ply] != row["fen_key"]:
            break
        matched = ply
    return matched


def _classification_payload(
    game_id: int,
    line: Any | None,
    matched_plies: int,
    contexts: list[GameMoveContext],
) -> dict[str, Any]:
    status = _classification_status(matched_plies)
    confidence = _confidence(matched_plies)
    last_book_ply = matched_plies if matched_plies > 0 else None
    out_of_book_context = next(
        (context for context in contexts if context.ply == matched_plies + 1),
        None,
    ) if matched_plies > 0 and len(contexts) > matched_plies else None

    return {
        "game_id": game_id,
        "line_id": int(line["id"]) if line is not None else None,
        "opening_name": line["name"] if line is not None else None,
        "eco_code": line["eco_code"] if line is not None else None,
        "matched_plies": matched_plies,
        "last_book_ply": last_book_ply,
        "out_of_book_ply": out_of_book_context.ply if out_of_book_context else None,
        "out_of_book_color": out_of_book_context.side_to_move_before
        if out_of_book_context
        else None,
        "out_of_book_fen": out_of_book_context.fen_before
        if out_of_book_context
        else None,
        "confidence": confidence,
        "classification_status": status,
    }


def _classification_status(matched_plies: int) -> str:
    if matched_plies >= 4:
        return "matched"
    if matched_plies > 0:
        return "partial"
    return "unknown"


def _confidence(matched_plies: int) -> str:
    if matched_plies >= 8:
        return "high"
    if matched_plies >= 4:
        return "medium"
    if matched_plies > 0:
        return "low"
    return "unknown"


def _upsert_classification(connection: Any, payload: dict[str, Any]) -> None:
    now = _utc_now()
    connection.execute(
        """
        INSERT INTO game_opening_classifications (
            game_id,
            line_id,
            opening_name,
            eco_code,
            matched_plies,
            last_book_ply,
            out_of_book_ply,
            out_of_book_color,
            out_of_book_fen,
            confidence,
            classification_status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
            line_id = excluded.line_id,
            opening_name = excluded.opening_name,
            eco_code = excluded.eco_code,
            matched_plies = excluded.matched_plies,
            last_book_ply = excluded.last_book_ply,
            out_of_book_ply = excluded.out_of_book_ply,
            out_of_book_color = excluded.out_of_book_color,
            out_of_book_fen = excluded.out_of_book_fen,
            confidence = excluded.confidence,
            classification_status = excluded.classification_status,
            updated_at = excluded.updated_at
        """,
        (
            payload["game_id"],
            payload["line_id"],
            payload["opening_name"],
            payload["eco_code"],
            payload["matched_plies"],
            payload["last_book_ply"],
            payload["out_of_book_ply"],
            payload["out_of_book_color"],
            payload["out_of_book_fen"],
            payload["confidence"],
            payload["classification_status"],
            now,
            now,
        ),
    )


def _failed_classification_payload(game_id: int) -> dict[str, Any]:
    return {
        "game_id": game_id,
        "line_id": None,
        "opening_name": None,
        "eco_code": None,
        "matched_plies": 0,
        "last_book_ply": None,
        "out_of_book_ply": None,
        "out_of_book_color": None,
        "out_of_book_fen": None,
        "confidence": "unknown",
        "classification_status": "failed",
    }


def _not_applicable_from_position_payload(game_id: int, initial_fen: str) -> dict[str, Any]:
    return {
        "game_id": game_id,
        "line_id": None,
        "opening_name": "Ouverture non applicable - position initiale spéciale",
        "eco_code": None,
        "matched_plies": 0,
        "last_book_ply": None,
        "out_of_book_ply": None,
        "out_of_book_color": None,
        "out_of_book_fen": initial_fen,
        "confidence": "not_applicable",
        "classification_status": "not_applicable_from_position",
    }


def _initial_fen_for_game(connection: Any, game: Any, game_id: int) -> str:
    try:
        columns = game.keys()
    except AttributeError:
        columns = ()
    initial_fen = game["initial_fen"] if "initial_fen" in columns else None
    if isinstance(initial_fen, str) and initial_fen.strip():
        return initial_fen.strip()
    first_move = connection.execute(
        """
        SELECT fen_before
        FROM moves
        WHERE game_id = ?
        ORDER BY ply, id
        LIMIT 1
        """,
        (game_id,),
    ).fetchone()
    if first_move is not None and first_move["fen_before"]:
        return str(first_move["fen_before"])
    return chess.STARTING_FEN


def _upsert_failed_classification(
    db_path: str | Path | None,
    payload: dict[str, Any],
) -> None:
    with closing(get_connection(db_path)) as connection:
        _upsert_classification(connection, payload)
        connection.commit()


def _classification_row_to_payload(row: Any) -> dict[str, Any]:
    return {
        "game_id": row["game_id"],
        "line_id": row["line_id"],
        "opening_name": row["opening_name"],
        "eco_code": row["eco_code"],
        "matched_plies": row["matched_plies"],
        "last_book_ply": row["last_book_ply"],
        "out_of_book_ply": row["out_of_book_ply"],
        "out_of_book_color": row["out_of_book_color"],
        "out_of_book_fen": row["out_of_book_fen"],
        "confidence": row["confidence"],
        "classification_status": row["classification_status"],
    }


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise OpeningServiceError("optional string field has invalid value")
    stripped = value.strip()
    return stripped if stripped else None
