from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neurochess.data.database import (
    execute_sqlite_write_with_retry,
    get_connection,
)


TRAINING_ITEM_SCHEMA_VERSION = "training_item_v1"
TRAINING_ITEM_SOURCE_TYPE = "review_moment"
TRAINING_ITEM_DEFAULT_MAX_PER_REVIEW = 5


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_dict(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    if isinstance(row, dict):
        return dict(row)
    return {key: row[key] for key in row.keys()}


def _json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float_or_zero(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _side_to_move_from_fen(fen: str) -> str:
    parts = str(fen or "").split()
    if len(parts) >= 2:
        return "white" if parts[1] == "w" else "black"
    return "unknown"


def _annotation_by_ply(review_payload: dict[str, Any] | None) -> dict[int, dict[str, Any]]:
    if not isinstance(review_payload, dict):
        return {}
    annotations = review_payload.get("move_annotations") or []
    result: dict[int, dict[str, Any]] = {}
    for annotation in annotations:
        if not isinstance(annotation, dict):
            continue
        ply = _int_or_none(annotation.get("ply"))
        if ply is None:
            continue
        result[ply] = annotation
    return result


def _accepted_moves(annotation: dict[str, Any], best_move: str) -> list[str]:
    accepted: list[str] = []
    for move in annotation.get("acceptable_moves") or []:
        if isinstance(move, dict):
            uci = move.get("uci")
        else:
            uci = move
        if isinstance(uci, str) and uci and uci not in accepted:
            accepted.append(uci)
    if best_move and best_move not in accepted:
        accepted.insert(0, best_move)
    return accepted


def _secondary_tags(annotation: dict[str, Any], primary_tag: str) -> list[str]:
    tags: list[str] = []
    for tag in annotation.get("tags") or []:
        if not isinstance(tag, str) or not tag or tag == primary_tag:
            continue
        if tag not in tags:
            tags.append(tag)
    return tags


def _text_from_explanation(value: Any, *keys: str) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        text = value.get(key)
        if isinstance(text, str) and text.strip():
            return text.strip()
    return None


def _training_item_payload(
    row: sqlite3.Row,
    annotation: dict[str, Any] | None,
) -> dict[str, Any] | None:
    payload = _row_to_dict(row)
    annotation = annotation or {}
    if annotation.get("is_training_recommended") is False:
        return None
    best_move = str(
        annotation.get("best_move_uci")
        or payload.get("best_move_uci")
        or ""
    ).strip()
    if not best_move:
        return None
    fen = str(annotation.get("fen_before") or payload.get("fen_before") or "").strip()
    if not fen:
        return None
    side_to_move = str(
        annotation.get("side")
        or annotation.get("color")
        or payload.get("side_to_move_before")
        or _side_to_move_from_fen(fen)
    )
    primary_tag = str(
        annotation.get("primary_category")
        or annotation.get("moment_type")
        or "unknown"
    )
    pedagogical = annotation.get("pedagogical_explanation") or {}
    contrast = annotation.get("contrast_coach_explanation") or {}
    explanation_short = (
        _text_from_explanation(pedagogical, "main_message", "short_message")
        or _text_from_explanation(contrast, "main_message", "headline")
        or annotation.get("compact_label")
    )
    takeaway = (
        _text_from_explanation(pedagogical, "why_best_move_good", "takeaway")
        or _text_from_explanation(contrast, "takeaway", "main_point")
    )
    criticality = _float_or_zero(
        annotation.get("criticality_score")
        if annotation.get("criticality_score") is not None
        else payload.get("importance_score")
    )
    difficulty_proxy = annotation.get("move_accuracy")
    if difficulty_proxy is None:
        difficulty_proxy = annotation.get("win_loss")

    return {
        "source_type": TRAINING_ITEM_SOURCE_TYPE,
        "source_game_id": int(payload["game_id"]),
        "source_ply": int(payload["ply"]),
        "source_moment_id": int(payload["id"]),
        "fen": fen,
        "side_to_move": side_to_move,
        "best_move": best_move,
        "accepted_moves": _accepted_moves(annotation, best_move),
        "domain": str(
            _text_from_explanation(pedagogical, "error_type")
            or primary_tag
            or "unknown"
        ),
        "primary_tag": primary_tag or "unknown",
        "secondary_tags": _secondary_tags(annotation, primary_tag),
        "difficulty_proxy": (
            _float_or_zero(difficulty_proxy) if difficulty_proxy is not None else None
        ),
        "criticality_score": criticality,
        "explanation_short": (
            str(explanation_short).strip() if explanation_short else None
        ),
        "takeaway": str(takeaway).strip() if takeaway else None,
        "status": "active",
    }


def training_item_to_practice_item(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = _row_to_dict(row)
    training_item_id = int(item["id"])
    ply = int(item["source_ply"])
    accepted_moves = [
        {"uci": move, "quality": "best" if move == item["best_move"] else "acceptable"}
        for move in _json_list(item.get("accepted_moves_json"))
        if isinstance(move, str) and move
    ]
    if not accepted_moves:
        accepted_moves = [{"uci": item["best_move"], "quality": "best"}]
    secondary_tags = [
        tag for tag in _json_list(item.get("secondary_tags_json")) if isinstance(tag, str)
    ]
    tags = [str(item.get("primary_tag") or "unknown"), *secondary_tags]
    return {
        "item_id": f"training_item:{training_item_id}",
        "training_item_id": training_item_id,
        "source_context": "daily_plan",
        "game_id": int(item["source_game_id"]),
        "ply": ply,
        "move_number": (ply + 1) // 2 if ply > 0 else 0,
        "color": item.get("side_to_move") or "unknown",
        "side": item.get("side_to_move") or "unknown",
        "san": None,
        "uci": None,
        "fen_before": item.get("fen"),
        "fen_after": None,
        "best_move_uci": item.get("best_move"),
        "best_move_san": None,
        "acceptable_moves": accepted_moves,
        "candidate_moves": accepted_moves,
        "top_moves": [],
        "pedagogical_explanation": {
            "main_message": item.get("explanation_short"),
            "why_best_move_good": item.get("takeaway"),
        },
        "contrast_coach_explanation": {},
        "impact_label": None,
        "move_quality_label": None,
        "primary_category": item.get("primary_tag") or "unknown",
        "category_label": item.get("primary_tag") or "unknown",
        "tags": tags,
        "tag_labels": tags,
        "pv_line": [],
        "pv_line_available": False,
        "pv_line_message": None,
        "pv_contrast_evidence": None,
        "try_move_supported": True,
        "criticality_score": item.get("criticality_score"),
        "win_loss": None,
        "move_accuracy": item.get("difficulty_proxy"),
        "coach_priority_rank": None,
        "compact_label": item.get("explanation_short"),
        "coach_card_title": item.get("takeaway") or item.get("explanation_short"),
    }


class TrainingItemService:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path

    def ensure_training_items_for_game(
        self,
        game_id: int,
        *,
        review_payload: dict[str, Any] | None = None,
        max_items: int = TRAINING_ITEM_DEFAULT_MAX_PER_REVIEW,
    ) -> list[dict[str, Any]]:
        annotations = _annotation_by_ply(review_payload)

        def operation() -> list[dict[str, Any]]:
            with closing(get_connection(self.db_path)) as connection:
                rows = self._review_moment_rows(connection, game_id)
                selected = self._select_rows(rows, annotations, max_items=max_items)
                if not selected:
                    return self.list_items_for_game(game_id)
                now = _utc_now()
                with connection:
                    for payload in selected:
                        self._upsert_training_item(connection, payload, now=now)
                return self.list_items_for_game(game_id)

        return execute_sqlite_write_with_retry(operation)

    def list_items_for_game(self, game_id: int) -> list[dict[str, Any]]:
        with closing(get_connection(self.db_path)) as connection:
            return [
                _row_to_dict(row)
                for row in connection.execute(
                    """
                    SELECT *
                    FROM training_items
                    WHERE source_game_id = ? AND status = 'active'
                    ORDER BY criticality_score DESC, source_ply, id
                    """,
                    (int(game_id),),
                ).fetchall()
            ]

    def list_active_items(self) -> list[dict[str, Any]]:
        with closing(get_connection(self.db_path)) as connection:
            return [
                _row_to_dict(row)
                for row in connection.execute(
                    """
                    SELECT *
                    FROM training_items
                    WHERE status = 'active'
                    ORDER BY created_at DESC, id DESC
                    """
                ).fetchall()
            ]

    def get_items_by_ids(self, item_ids: list[int]) -> list[dict[str, Any]]:
        if not item_ids:
            return []
        placeholders = ", ".join("?" for _ in item_ids)
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                f"""
                SELECT *
                FROM training_items
                WHERE id IN ({placeholders}) AND status = 'active'
                """,
                tuple(int(item_id) for item_id in item_ids),
            ).fetchall()
        by_id = {int(row["id"]): _row_to_dict(row) for row in rows}
        return [by_id[item_id] for item_id in item_ids if item_id in by_id]

    def _review_moment_rows(
        self,
        connection: sqlite3.Connection,
        game_id: int,
    ) -> list[sqlite3.Row]:
        review_row = connection.execute(
            """
            SELECT id
            FROM game_reviews
            WHERE game_id = ? AND status IN ('done', 'partial')
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (int(game_id),),
        ).fetchone()
        if review_row is None:
            return []
        return connection.execute(
            """
            SELECT *
            FROM review_moments
            WHERE game_id = ? AND review_id = ?
            ORDER BY importance_score DESC, cp_loss DESC, ply, id
            """,
            (int(game_id), int(review_row["id"])),
        ).fetchall()

    def _select_rows(
        self,
        rows: list[sqlite3.Row],
        annotations: dict[int, dict[str, Any]],
        *,
        max_items: int,
    ) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for row in rows:
            ply = int(row["ply"])
            payload = _training_item_payload(row, annotations.get(ply))
            if payload is None:
                continue
            candidates.append(payload)
        candidates.sort(
            key=lambda item: (
                -_float_or_zero(item.get("criticality_score")),
                -_float_or_zero(item.get("difficulty_proxy")),
                int(item.get("source_ply") or 0),
                int(item.get("source_moment_id") or 0),
            )
        )
        seen: set[tuple[int, int]] = set()
        selected: list[dict[str, Any]] = []
        for item in candidates:
            key = (int(item["source_game_id"]), int(item["source_ply"]))
            if key in seen:
                continue
            seen.add(key)
            selected.append(item)
            if len(selected) >= max(1, min(int(max_items), TRAINING_ITEM_DEFAULT_MAX_PER_REVIEW)):
                break
        return selected

    def _upsert_training_item(
        self,
        connection: sqlite3.Connection,
        payload: dict[str, Any],
        *,
        now: str,
    ) -> None:
        existing = connection.execute(
            """
            SELECT id, created_at
            FROM training_items
            WHERE source_game_id = ? AND source_ply = ?
            """,
            (payload["source_game_id"], payload["source_ply"]),
        ).fetchone()
        values = (
            payload["source_type"],
            payload["source_game_id"],
            payload["source_ply"],
            payload["source_moment_id"],
            payload["fen"],
            payload["side_to_move"],
            payload["best_move"],
            json.dumps(payload["accepted_moves"], ensure_ascii=False, sort_keys=True),
            payload["domain"],
            payload["primary_tag"],
            json.dumps(payload["secondary_tags"], ensure_ascii=False, sort_keys=True),
            payload["difficulty_proxy"],
            payload["criticality_score"],
            payload["explanation_short"],
            payload["takeaway"],
            payload["status"],
        )
        if existing is None:
            connection.execute(
                """
                INSERT INTO training_items (
                    source_type,
                    source_game_id,
                    source_ply,
                    source_moment_id,
                    fen,
                    side_to_move,
                    best_move,
                    accepted_moves_json,
                    domain,
                    primary_tag,
                    secondary_tags_json,
                    difficulty_proxy,
                    criticality_score,
                    explanation_short,
                    takeaway,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (*values, now),
            )
            return

        connection.execute(
            """
            UPDATE training_items
            SET source_type = ?,
                source_game_id = ?,
                source_ply = ?,
                source_moment_id = ?,
                fen = ?,
                side_to_move = ?,
                best_move = ?,
                accepted_moves_json = ?,
                domain = ?,
                primary_tag = ?,
                secondary_tags_json = ?,
                difficulty_proxy = ?,
                criticality_score = ?,
                explanation_short = ?,
                takeaway = ?,
                status = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (*values, now, int(existing["id"])),
        )
