from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import chess

from neurochess.data.database import (
    execute_sqlite_write_with_retry,
    get_connection,
)
from neurochess.metrics.try_move import TRY_MOVE_MODEL_VERSION, evaluate_try_move_attempt
from neurochess.review_service import (
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
    ReviewService,
)


PRACTICE_SESSION_SCHEMA_VERSION = "review_practice_session_v2"
PRACTICE_DEFAULT_SCOPE = "top_priority"
PRACTICE_DEFAULT_MAX_ITEMS = 5
PRACTICE_MAX_ITEMS_LIMIT = 20

PRACTICE_ALLOWED_POVS = {"user", "white", "black", "both"}
PRACTICE_ALLOWED_SCOPES = {"top_priority", "all_to_review", "retry_failed"}
PRACTICE_ALLOWED_RESULTS = {
    "best",
    "very_good",
    "acceptable",
    "wrong",
    "illegal",
    "skipped",
    "revealed",
}
PRACTICE_FAILED_RETRY_RESULTS = {"wrong", "illegal", "revealed", "skipped"}
PRACTICE_SUCCESS_RESULTS = {"best", "very_good", "acceptable"}
PRACTICE_DUE_REVIEW_SCOPE = "due_review"
LEARNING_LOOP_SUMMARY_SCHEMA_VERSION = "learning_loop_v1"

PRACTICE_PRIMARY_PRIORITY = {
    "decisive": 0,
    "critical": 0,
    "to_review": 5,
    "inexact": 6,
}
PRACTICE_TAG_PRIORITY = {
    "missed_opportunity": 1,
    "conversion_issue": 2,
    "defensive_resource_missed": 3,
    "persistent_loss": 4,
    "cluster": 4,
}
PRACTICE_ELIGIBLE_PRIMARY = {
    "critical",
    "decisive",
    "to_review",
    "inexact",
}
PRACTICE_ELIGIBLE_TAGS = set(PRACTICE_TAG_PRIORITY)


class ReviewPracticeServiceError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        payload: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class ReviewPracticeService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        *,
        review_service: ReviewService | None = None,
    ) -> None:
        self.db_path = db_path
        self.review_service = review_service or ReviewService(db_path)

    def build_review_practice_items(
        self,
        game_id: int,
        pov: str = "user",
        scope: str = PRACTICE_DEFAULT_SCOPE,
        max_items: int = PRACTICE_DEFAULT_MAX_ITEMS,
    ) -> list[dict[str, Any]]:
        review = self.review_service.get_review(game_id)
        return build_review_practice_items_from_review(
            review,
            pov=pov,
            scope=scope,
            max_items=max_items,
        )

    def create_session(
        self,
        game_id: int,
        *,
        pov: str = "user",
        scope: str = PRACTICE_DEFAULT_SCOPE,
        max_items: int = PRACTICE_DEFAULT_MAX_ITEMS,
    ) -> dict[str, Any]:
        review = self.review_service.get_review(game_id)
        _ensure_review_completed(review)

        normalized_pov = _normalize_pov(pov)
        normalized_scope = _normalize_scope(scope)
        items = build_review_practice_items_from_review(
            review,
            pov=normalized_pov,
            scope=normalized_scope,
            max_items=max_items,
        )
        for item in items:
            item["game_id"] = game_id
        if not items:
            raise ReviewPracticeServiceError(
                "no eligible practice items",
                status_code=409,
                payload={
                    "status": "no_eligible_items",
                    "game_id": game_id,
                    "pov": normalized_pov,
                    "scope": normalized_scope,
                    "items": [],
                    "summary": _empty_summary(),
                },
            )

        with closing(get_connection(self.db_path)) as connection:
            review_id = _current_review_id(connection, game_id)

        return self._create_session_from_items(
            game_id,
            review_id=review_id,
            pov=normalized_pov,
            scope=normalized_scope,
            items=items,
        )

    def _create_session_from_items(
        self,
        game_id: int,
        *,
        review_id: int | None,
        pov: str,
        scope: str,
        items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        session_items = [dict(item, game_id=game_id) for item in items]
        items_json = json.dumps(session_items, ensure_ascii=False, sort_keys=True)

        def write_session() -> int:
            with closing(get_connection(self.db_path)) as connection:
                try:
                    connection.execute("BEGIN")
                    cursor = connection.execute(
                        """
                        INSERT INTO review_practice_sessions (
                            game_id,
                            review_id,
                            pov,
                            scope,
                            status,
                            item_count,
                            correct_count,
                            partial_count,
                            wrong_count,
                            revealed_count,
                            skipped_count,
                            items_json,
                            created_at,
                            completed_at,
                            schema_version
                        )
                        VALUES (?, ?, ?, ?, 'running', ?, 0, 0, 0, 0, 0, ?, ?, NULL, ?)
                        """,
                        (
                            game_id,
                            review_id,
                            pov,
                            scope,
                            len(session_items),
                            items_json,
                            _utc_now(),
                            PRACTICE_SESSION_SCHEMA_VERSION,
                        ),
                    )
                    connection.commit()
                    return int(cursor.lastrowid)
                except Exception:
                    connection.rollback()
                    raise

        session_id = execute_sqlite_write_with_retry(write_session)
        session_row = {
            "id": session_id,
            "game_id": game_id,
            "review_id": review_id,
            "pov": pov,
            "scope": scope,
            "status": "running",
            "item_count": len(session_items),
            "correct_count": 0,
            "partial_count": 0,
            "wrong_count": 0,
            "revealed_count": 0,
            "skipped_count": 0,
            "items_json": items_json,
            "completed_at": None,
            "schema_version": PRACTICE_SESSION_SCHEMA_VERSION,
        }
        return {
            "session_id": session_id,
            "game_id": game_id,
            "review_id": review_id,
            "pov": pov,
            "scope": scope,
            "status": "running",
            "schema_version": PRACTICE_SESSION_SCHEMA_VERSION,
            "item_count": len(session_items),
            "items": session_items,
            "summary": _summary_payload(session_row, [], session_items),
        }

    def record_attempt(
        self,
        session_id: int,
        *,
        ply: int,
        attempted_uci: str | None = None,
        result: str | None = None,
        time_spent_ms: int | None = None,
        hint_used: bool | None = None,
        reveal_used: bool | None = None,
        source_context: str | None = None,
    ) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            session = _session_row(connection, session_id)
            if session is None:
                raise ReviewPracticeServiceError(
                    "practice session not found",
                    status_code=404,
                )
            if str(session["status"]) != "running":
                raise ReviewPracticeServiceError(
                    "practice session is not running",
                    status_code=409,
                )
            items = self._items_for_session(session)
            item = _find_item_for_ply(items, ply)
            if item is None:
                raise ReviewPracticeServiceError(
                    "practice item not found for ply",
                    status_code=404,
                )
            attempt_number = _next_attempt_number(connection, session_id, ply)

        feedback = _practice_attempt_feedback(
            item,
            attempted_uci=attempted_uci,
            requested_result=result,
        )
        normalized_result = _normalize_result(feedback["result"])
        attempted_uci = feedback.get("attempted_uci")
        attempted_san = feedback.get("attempted_san")
        snapshot = _evidence_snapshot(item)
        created_at = _utc_now()
        normalized_hint_used = bool(hint_used)
        normalized_reveal_used = bool(reveal_used) or normalized_result == "revealed"
        normalized_time_spent_ms = _normalize_time_spent_ms(time_spent_ms)
        normalized_source_context = _normalize_source_context(source_context)
        item_id = _practice_item_id(int(session["game_id"]), int(ply))
        due_at = practice_revision_due_at(
            normalized_result,
            created_at,
            hint_used=normalized_hint_used,
            reveal_used=normalized_reveal_used,
        )

        def write_attempt() -> dict[str, Any]:
            with closing(get_connection(self.db_path)) as connection:
                try:
                    connection.execute("BEGIN")
                    connection.execute(
                        """
                        INSERT INTO review_practice_attempts (
                            session_id,
                            game_id,
                            ply,
                            color,
                            attempted_uci,
                            attempted_san,
                            expected_best_uci,
                            result,
                            attempt_number,
                            evidence_snapshot_json,
                            item_id,
                            time_spent_ms,
                            hint_used,
                            reveal_used,
                            source_context,
                            due_at,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            session_id,
                            int(session["game_id"]),
                            int(ply),
                            str(item.get("color") or ""),
                            attempted_uci,
                            attempted_san,
                            item.get("best_move_uci"),
                            normalized_result,
                            attempt_number,
                            json.dumps(snapshot, ensure_ascii=False, sort_keys=True),
                            item_id,
                            normalized_time_spent_ms,
                            1 if normalized_hint_used else 0,
                            1 if normalized_reveal_used else 0,
                            normalized_source_context,
                            due_at,
                            created_at,
                        ),
                    )
                    _increment_session_counts(connection, session_id, normalized_result)
                    connection.commit()
                except Exception:
                    connection.rollback()
                    raise
                summary = self.get_session_summary(session_id)
                summary["attempt_feedback"] = feedback
                summary["latest_attempt"] = {
                    "session_id": session_id,
                    "game_id": int(session["game_id"]),
                    "ply": int(ply),
                    "color": str(item.get("color") or ""),
                    "attempted_uci": attempted_uci,
                    "attempted_san": attempted_san,
                    "expected_best_uci": item.get("best_move_uci"),
                    "result": normalized_result,
                    "attempt_number": attempt_number,
                    "item_id": item_id,
                    "time_spent_ms": normalized_time_spent_ms,
                    "hint_used": normalized_hint_used,
                    "reveal_used": normalized_reveal_used,
                    "source_context": normalized_source_context,
                    "due_at": due_at,
                    "created_at": created_at,
                }
                return summary

        return execute_sqlite_write_with_retry(write_attempt)

    def complete_session(self, session_id: int) -> dict[str, Any]:
        def write_complete() -> dict[str, Any]:
            with closing(get_connection(self.db_path)) as connection:
                session = _session_row(connection, session_id)
                if session is None:
                    raise ReviewPracticeServiceError(
                        "practice session not found",
                        status_code=404,
                    )
                try:
                    connection.execute("BEGIN")
                    connection.execute(
                        """
                        UPDATE review_practice_sessions
                        SET status = 'completed',
                            completed_at = COALESCE(completed_at, ?)
                        WHERE id = ?
                        """,
                        (_utc_now(), session_id),
                    )
                    connection.commit()
                except Exception:
                    connection.rollback()
                    raise
                return self.get_session_summary(session_id)

        return execute_sqlite_write_with_retry(write_complete)

    def get_session_summary(self, session_id: int) -> dict[str, Any]:
        return self.build_practice_session_summary(session_id)

    def build_practice_session_summary(self, session_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            session = _session_row(connection, session_id)
            if session is None:
                raise ReviewPracticeServiceError(
                    "practice session not found",
                    status_code=404,
                )
            attempts = connection.execute(
                """
                SELECT *
                FROM review_practice_attempts
                WHERE session_id = ?
                ORDER BY id
                """,
                (session_id,),
            ).fetchall()
            items = self._items_for_session(session)
            return _summary_payload(session, attempts, items)

    def list_sessions_for_game(self, game_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM review_practice_sessions
                WHERE game_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (game_id,),
            ).fetchall()
            attempts = _game_practice_attempt_rows(connection, game_id)
            learning_summary = _learning_summary_payload(
                game_id,
                attempts,
                session_count=len(rows),
            )

        return {
            "game_id": game_id,
            "learning_summary": learning_summary,
            "sessions": [
                self._session_payload(row, include_items=False)
                for row in rows
            ],
        }

    def build_learning_summary_for_game(self, game_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            session_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM review_practice_sessions
                WHERE game_id = ?
                """,
                (game_id,),
            ).fetchone()[0]
            attempts = _game_practice_attempt_rows(connection, game_id)
        return _learning_summary_payload(
            game_id,
            attempts,
            session_count=int(session_count or 0),
        )

    def create_due_review_session(
        self,
        game_id: int,
        *,
        pov: str = "user",
        max_items: int = PRACTICE_DEFAULT_MAX_ITEMS,
    ) -> dict[str, Any]:
        review = self.review_service.get_review(game_id)
        _ensure_review_completed(review)
        normalized_pov = _normalize_pov(pov)
        max_count = _normalized_max_items(max_items)
        review_items = build_review_practice_items_from_review(
            review,
            pov=normalized_pov,
            scope="all_to_review",
            max_items=PRACTICE_MAX_ITEMS_LIMIT,
        )
        for item in review_items:
            item["game_id"] = game_id
        with closing(get_connection(self.db_path)) as connection:
            attempts = _game_practice_attempt_rows(connection, game_id)
            due_by_ply = _due_ply_map(attempts)
            review_id = _current_review_id(connection, game_id)
        due_items = [
            item
            for item in review_items
            if int(item.get("ply") or 0) in due_by_ply
        ]
        due_items.sort(
            key=lambda item: (
                due_by_ply.get(int(item.get("ply") or 0)) or "",
                int(item.get("ply") or 0),
            )
        )
        due_items = due_items[:max_count]
        if not due_items:
            raise ReviewPracticeServiceError(
                "no due review items",
                status_code=409,
                payload={
                    "status": "no_due_items",
                    "game_id": game_id,
                    "pov": normalized_pov,
                    "scope": PRACTICE_DUE_REVIEW_SCOPE,
                    "items": [],
                    "summary": _empty_summary(),
                    "learning_summary": self.build_learning_summary_for_game(game_id),
                },
            )
        return self._create_session_from_items(
            game_id,
            review_id=review_id,
            pov=normalized_pov,
            scope=PRACTICE_DUE_REVIEW_SCOPE,
            items=due_items,
        )

    def get_session(self, session_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            session = _session_row(connection, session_id)
            if session is None:
                raise ReviewPracticeServiceError(
                    "practice session not found",
                    status_code=404,
                )
        return self._session_payload(session, include_items=True)

    def abandon_session(self, session_id: int) -> dict[str, Any]:
        def write_abandon() -> dict[str, Any]:
            with closing(get_connection(self.db_path)) as connection:
                session = _session_row(connection, session_id)
                if session is None:
                    raise ReviewPracticeServiceError(
                        "practice session not found",
                        status_code=404,
                    )
                if str(session["status"]) == "running":
                    try:
                        connection.execute("BEGIN")
                        connection.execute(
                            """
                            UPDATE review_practice_sessions
                            SET status = 'abandoned',
                                completed_at = COALESCE(completed_at, ?)
                            WHERE id = ?
                            """,
                            (_utc_now(), session_id),
                        )
                        connection.commit()
                    except Exception:
                        connection.rollback()
                        raise
                return self.get_session_summary(session_id)

        return execute_sqlite_write_with_retry(write_abandon)

    def retry_failed_session(self, session_id: int) -> dict[str, Any]:
        detail = self.get_session(session_id)
        failed_plies = {
            int(ply)
            for ply in (detail.get("summary") or {}).get("failed_plies", [])
        }
        items = [
            item
            for item in detail.get("items", [])
            if int(item.get("ply") or 0) in failed_plies
        ]
        if not items:
            raise ReviewPracticeServiceError(
                "no failed practice items to retry",
                status_code=409,
                payload={
                    "status": "no_failed_items",
                    "session_id": session_id,
                    "summary": detail.get("summary") or _empty_summary(),
                },
            )
        return self._create_session_from_items(
            int(detail["game_id"]),
            review_id=detail.get("review_id"),
            pov=str(detail.get("pov") or "user"),
            scope="retry_failed",
            items=items,
        )

    def _items_for_session(
        self,
        session: sqlite3.Row | dict[str, Any],
    ) -> list[dict[str, Any]]:
        items = _items_from_session_row(session)
        if items is not None:
            return items
        try:
            item_count = int(_row_get(session, "item_count") or PRACTICE_MAX_ITEMS_LIMIT)
            return self.build_review_practice_items(
                int(_row_get(session, "game_id")),
                pov=str(_row_get(session, "pov") or "user"),
                scope=str(_row_get(session, "scope") or "top_priority"),
                max_items=max(item_count, PRACTICE_DEFAULT_MAX_ITEMS),
            )
        except ReviewPracticeServiceError:
            return []

    def _session_payload(
        self,
        session: sqlite3.Row,
        *,
        include_items: bool,
    ) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            attempts = connection.execute(
                """
                SELECT *
                FROM review_practice_attempts
                WHERE session_id = ?
                ORDER BY id
                """,
                (int(session["id"]),),
            ).fetchall()
        items = self._items_for_session(session)
        payload = {
            "session_id": int(session["id"]),
            "game_id": int(session["game_id"]),
            "review_id": _row_get(session, "review_id"),
            "pov": str(session["pov"]),
            "scope": str(_row_get(session, "scope") or "top_priority"),
            "status": str(session["status"]),
            "schema_version": _row_get(session, "schema_version"),
            "item_count": len(items) if items else int(session["item_count"] or 0),
            "summary": _summary_payload(session, attempts, items),
            "attempts": [_attempt_payload(row) for row in attempts],
        }
        if include_items:
            payload["items"] = items
        return payload


def build_review_practice_items_from_review(
    review: dict[str, Any],
    *,
    pov: str = "user",
    scope: str = PRACTICE_DEFAULT_SCOPE,
    max_items: int = PRACTICE_DEFAULT_MAX_ITEMS,
) -> list[dict[str, Any]]:
    _ensure_review_completed(review)
    normalized_pov = _normalize_pov(pov)
    normalized_scope = _normalize_scope(scope)
    target_color = _target_color_for_pov(normalized_pov, review.get("user_color"))
    max_count = _normalized_max_items(max_items)

    annotations = review.get("move_annotations") or []
    items: list[dict[str, Any]] = []
    seen_plies: set[int] = set()
    for annotation in annotations:
        if not isinstance(annotation, dict):
            continue
        if not _annotation_matches_color(annotation, target_color):
            continue
        if not _annotation_is_practice_eligible(annotation):
            continue
        ply = _int_or_none(annotation.get("ply"))
        if ply is None or ply in seen_plies:
            continue
        seen_plies.add(ply)
        items.append(_practice_item_from_annotation(annotation))

    items.sort(key=_practice_item_sort_key)
    if normalized_scope == "top_priority":
        return items[:max_count]
    return items[:max_count]


def _ensure_review_completed(review: dict[str, Any]) -> None:
    if review.get("status") not in {"done", "completed"}:
        raise ReviewPracticeServiceError(
            "review must be completed before practice",
            status_code=425,
        )


def _practice_item_from_annotation(annotation: dict[str, Any]) -> dict[str, Any]:
    return {
        "game_id": annotation.get("game_id"),
        "ply": int(annotation.get("ply") or 0),
        "move_number": annotation.get("move_number"),
        "color": annotation.get("color") or annotation.get("side"),
        "san": annotation.get("san"),
        "uci": annotation.get("uci"),
        "fen_before": annotation.get("fen_before"),
        "fen_after": annotation.get("fen_after"),
        "best_move_uci": annotation.get("best_move_uci"),
        "best_move_san": annotation.get("best_move_san"),
        "acceptable_moves": annotation.get("acceptable_moves") or [],
        "pedagogical_explanation": annotation.get("pedagogical_explanation") or {},
        "contrast_coach_explanation": annotation.get("contrast_coach_explanation") or {},
        "impact_label": annotation.get("impact_label"),
        "move_quality_label": annotation.get("move_quality_label"),
        "primary_category": annotation.get("primary_category"),
        "category_label": annotation.get("category_label"),
        "tags": annotation.get("tags") or [],
        "tag_labels": annotation.get("tag_labels") or [],
        "pv_line": annotation.get("pv_line") or [],
        "pv_line_available": bool(annotation.get("pv_line_available")),
        "pv_line_message": annotation.get("pv_line_message"),
        "pv_contrast_evidence": annotation.get("pv_contrast_evidence"),
        "try_move_supported": bool(annotation.get("try_move_supported")),
        "try_move_model_version": annotation.get("try_move_model_version"),
        "win_loss": annotation.get("win_loss"),
        "move_accuracy": annotation.get("move_accuracy"),
        "coach_priority_rank": annotation.get("coach_priority_rank"),
        "compact_label": annotation.get("compact_label"),
        "coach_card_title": annotation.get("coach_card_title"),
    }


def _annotation_is_practice_eligible(annotation: dict[str, Any]) -> bool:
    if not annotation.get("try_move_supported"):
        return False
    if not annotation.get("fen_before") or not annotation.get("best_move_uci"):
        return False
    primary = str(annotation.get("primary_category") or "")
    tags = {str(tag) for tag in (annotation.get("tags") or [])}
    return primary in PRACTICE_ELIGIBLE_PRIMARY or bool(tags & PRACTICE_ELIGIBLE_TAGS)


def _practice_item_sort_key(item: dict[str, Any]) -> tuple[float, float, int]:
    primary = str(item.get("primary_category") or "")
    tags = {str(tag) for tag in (item.get("tags") or [])}
    primary_rank = PRACTICE_PRIMARY_PRIORITY.get(primary, 9)
    tag_rank = min((PRACTICE_TAG_PRIORITY[tag] for tag in tags if tag in PRACTICE_TAG_PRIORITY), default=9)
    rank = item.get("coach_priority_rank")
    rank_value = float(rank) if isinstance(rank, (int, float)) else 99.0
    win_loss = _float_or_zero(item.get("win_loss"))
    return (min(primary_rank, tag_rank, rank_value), -win_loss, int(item.get("ply") or 0))


def _current_review_id(connection: sqlite3.Connection, game_id: int) -> int | None:
    row = connection.execute(
        """
        SELECT id
        FROM game_reviews
        WHERE game_id = ?
          AND review_schema_version = ?
          AND selection_algorithm_version = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
    ).fetchone()
    return int(row["id"]) if row is not None else None


def _session_row(connection: sqlite3.Connection, session_id: int) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT *
        FROM review_practice_sessions
        WHERE id = ?
        """,
        (session_id,),
    ).fetchone()


def _next_attempt_number(
    connection: sqlite3.Connection,
    session_id: int,
    ply: int,
) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM review_practice_attempts
        WHERE session_id = ?
          AND ply = ?
        """,
        (session_id, ply),
    ).fetchone()
    return int(row["count"] or 0) + 1


def _increment_session_counts(
    connection: sqlite3.Connection,
    session_id: int,
    result: str,
) -> None:
    if result == "best":
        column = "correct_count"
    elif result in {"very_good", "acceptable"}:
        column = "partial_count"
    elif result == "revealed":
        column = "revealed_count"
    elif result == "skipped":
        column = "skipped_count"
    else:
        column = "wrong_count"
    connection.execute(
        f"""
        UPDATE review_practice_sessions
        SET {column} = {column} + 1
        WHERE id = ?
        """,
        (session_id,),
    )


def _practice_attempt_feedback(
    item: dict[str, Any],
    *,
    attempted_uci: str | None,
    requested_result: str | None,
) -> dict[str, Any]:
    normalized_attempt_uci = str(attempted_uci).strip() if attempted_uci else None
    attempted_san = _attempted_san(item.get("fen_before"), normalized_attempt_uci)
    if normalized_attempt_uci:
        feedback = dict(evaluate_try_move_attempt(normalized_attempt_uci, item))
    else:
        feedback = _explicit_practice_action_feedback(requested_result)
    feedback["result"] = _normalize_result(str(feedback.get("result") or ""))
    feedback["attempted_uci"] = normalized_attempt_uci
    feedback["attempted_san"] = attempted_san
    feedback["best_move_uci"] = item.get("best_move_uci")
    feedback["best_move_san"] = item.get("best_move_san")
    feedback["try_move_model_version"] = (
        item.get("try_move_model_version") or TRY_MOVE_MODEL_VERSION
    )
    feedback["evidence"] = {
        "ply": item.get("ply"),
        "color": item.get("color"),
        "accepted_move_count": len(item.get("acceptable_moves") or []),
        "try_move_model_version": feedback["try_move_model_version"],
    }
    return feedback


def _explicit_practice_action_feedback(result: str | None) -> dict[str, Any]:
    normalized_result = _normalize_result(result)
    if normalized_result == "revealed":
        return {
            "result": "revealed",
            "message": "Solution révélée sans tentative.",
            "show_best_move": True,
        }
    if normalized_result == "skipped":
        return {
            "result": "skipped",
            "message": "Position passée.",
            "show_best_move": False,
        }
    raise ReviewPracticeServiceError(
        "practice result must be revealed or skipped without attempted move",
        status_code=400,
    )


def _summary_payload(
    session: sqlite3.Row | dict[str, Any],
    attempts: list[sqlite3.Row],
    items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    session_id = int(_row_get(session, "id"))
    item_count = len(items) if items is not None else int(_row_get(session, "item_count") or 0)
    latest_attempts = _latest_attempts_by_ply(attempts)
    counts = _result_counts(latest_attempts)
    failed_plies = sorted(
        ply
        for ply, row in latest_attempts.items()
        if str(row["result"]) in PRACTICE_FAILED_RETRY_RESULTS
    )
    learning_counts = _learning_counts_for_latest_attempts(latest_attempts)
    theme = _practice_theme(list(latest_attempts.values()), failed_plies=set(failed_plies))
    very_good_count = counts.get("very_good", 0)
    acceptable_count = counts.get("acceptable", 0)
    wrong_count = counts.get("wrong", 0)
    illegal_count = counts.get("illegal", 0)
    summary_sentence = _summary_message(
        item_count,
        counts.get("best", 0),
        very_good_count,
        acceptable_count,
        wrong_count,
        illegal_count,
        counts.get("revealed", 0),
        counts.get("skipped", 0),
        theme,
    )
    return {
        "session_id": session_id,
        "status": _row_get(session, "status"),
        "item_count": item_count,
        "positions_worked_count": len(latest_attempts),
        "best_count": counts.get("best", 0),
        "very_good_count": very_good_count,
        "acceptable_count": acceptable_count,
        "wrong_count": wrong_count,
        "illegal_count": illegal_count,
        "revealed_count": counts.get("revealed", 0),
        "skipped_count": counts.get("skipped", 0),
        "correct_count": counts.get("best", 0),
        "partial_count": very_good_count + acceptable_count,
        "attempt_count": len(attempts),
        "completed_at": _row_get(session, "completed_at"),
        "schema_version": _row_get(session, "schema_version"),
        "dominant_theme": theme,
        "dominant_theme_label": _theme_label(theme),
        "theme": theme,
        "summary_sentence": summary_sentence,
        "message": summary_sentence,
        "retry_failed_available": bool(failed_plies),
        "failed_plies": failed_plies,
        "failed_count": len(failed_plies),
        "success_without_help_count": learning_counts["success_without_help_count"],
        "success_with_hint_count": learning_counts["success_with_hint_count"],
        "due_count": learning_counts["due_count"],
        "scheduled_count": learning_counts["scheduled_count"],
        "next_due_at": learning_counts["next_due_at"],
        "result_by_ply": {
            str(ply): str(row["result"])
            for ply, row in sorted(latest_attempts.items())
        },
    }


def _empty_summary() -> dict[str, Any]:
    return {
        "item_count": 0,
        "positions_worked_count": 0,
        "best_count": 0,
        "very_good_count": 0,
        "acceptable_count": 0,
        "correct_count": 0,
        "partial_count": 0,
        "wrong_count": 0,
        "illegal_count": 0,
        "revealed_count": 0,
        "skipped_count": 0,
        "attempt_count": 0,
        "dominant_theme": "unknown",
        "dominant_theme_label": "Inconnu",
        "theme": "unknown",
        "summary_sentence": "Aucune position d'entrainement disponible.",
        "message": "Aucune position d'entrainement disponible.",
        "retry_failed_available": False,
        "failed_plies": [],
        "failed_count": 0,
        "success_without_help_count": 0,
        "success_with_hint_count": 0,
        "due_count": 0,
        "scheduled_count": 0,
        "next_due_at": None,
        "result_by_ply": {},
    }


def _summary_message(
    item_count: int,
    best_count: int,
    very_good_count: int,
    acceptable_count: int,
    wrong_count: int,
    illegal_count: int,
    revealed_count: int,
    skipped_count: int,
    theme: str,
) -> str:
    theme_label = _theme_label(theme)
    if item_count <= 0:
        return "Aucune position travaillee."
    success_count = best_count + very_good_count
    review_count = wrong_count + illegal_count + revealed_count + skipped_count
    if review_count == 0 and success_count >= max(1, item_count // 2):
        return "Bonne session : tu as trouve la majorite des coups critiques."
    if acceptable_count > best_count and review_count == 0:
        return "Tu as souvent trouve un coup jouable, mais pas toujours le plus precis."
    if theme == "conversion":
        return "Les positions de conversion restent le point prioritaire."
    if theme == "tactical":
        return "A revoir : les erreurs restantes concernent surtout les ressources tactiques."
    if theme == "defensive":
        return "A revoir : les ressources defensives ont coute le plus de points."
    if theme == "cluster":
        return "A revoir : les erreurs restantes viennent surtout d'enchainements difficiles."
    if theme == "positional":
        return "A revoir : les positions restantes demandent un meilleur plan."
    return f"Theme principal a revoir : {theme_label}."


def _practice_theme(
    attempts: list[sqlite3.Row],
    *,
    failed_plies: set[int] | None = None,
) -> str:
    counts: dict[str, int] = {}
    for row in attempts:
        if failed_plies is not None and int(row["ply"]) not in failed_plies:
            continue
        try:
            snapshot = json.loads(str(row["evidence_snapshot_json"] or "{}"))
        except (TypeError, ValueError):
            continue
        theme = _theme_from_snapshot(snapshot)
        if theme:
            counts[theme] = counts.get(theme, 0) + 1
    if not counts:
        return "unknown"
    return max(counts.items(), key=lambda item: item[1])[0]


def _theme_from_snapshot(snapshot: dict[str, Any]) -> str | None:
    explanation = snapshot.get("pedagogical_explanation")
    if isinstance(explanation, dict):
        normalized = _normalize_theme(explanation.get("error_type"))
        if normalized:
            return normalized
    for tag in snapshot.get("tags") or []:
        normalized = _normalize_theme(tag)
        if normalized:
            return normalized
    return _normalize_theme(snapshot.get("primary_category"))


def _normalize_theme(value: Any) -> str | None:
    theme = str(value or "").lower()
    mapping = {
        "tactical": "tactical",
        "missed_opportunity": "tactical",
        "conversion": "conversion",
        "conversion_issue": "conversion",
        "defensive": "defensive",
        "defensive_resource_missed": "defensive",
        "cluster": "cluster",
        "positional": "positional",
        "persistent_loss": "positional",
        "opening_transition": "opening",
        "book": "opening",
    }
    return mapping.get(theme)


def _theme_label(theme: str) -> str:
    labels = {
        "tactical": "Tactique",
        "conversion": "Conversion",
        "defensive": "Defense",
        "cluster": "Enchainement d'erreurs",
        "positional": "Plan positionnel",
        "opening": "Ouverture",
        "missed_opportunity": "opportunites tactiques",
        "conversion_issue": "conversion",
        "defensive_resource_missed": "defense",
        "persistent_loss": "perte persistante",
    }
    return labels.get(theme, "Inconnu")


def _latest_attempts_by_ply(
    attempts: list[sqlite3.Row],
) -> dict[int, sqlite3.Row]:
    latest: dict[int, sqlite3.Row] = {}
    for row in attempts:
        latest[int(row["ply"])] = row
    return latest


def _result_counts(attempts_by_ply: dict[int, sqlite3.Row]) -> dict[str, int]:
    counts = {result: 0 for result in PRACTICE_ALLOWED_RESULTS}
    for row in attempts_by_ply.values():
        result = str(row["result"])
        if result in counts:
            counts[result] += 1
    return counts


def _game_practice_attempt_rows(
    connection: sqlite3.Connection,
    game_id: int,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT *
        FROM review_practice_attempts
        WHERE game_id = ?
        ORDER BY id
        """,
        (game_id,),
    ).fetchall()


def _latest_learning_attempts_by_item(
    attempts: list[sqlite3.Row],
) -> dict[str, sqlite3.Row]:
    latest: dict[str, sqlite3.Row] = {}
    for row in attempts:
        item_id = str(_row_get(row, "item_id") or _practice_item_id(row["game_id"], row["ply"]))
        latest[item_id] = row
    return latest


def _learning_summary_payload(
    game_id: int,
    attempts: list[sqlite3.Row],
    *,
    session_count: int,
) -> dict[str, Any]:
    latest = _latest_learning_attempts_by_item(attempts)
    counts = _learning_counts_for_attempt_rows(list(latest.values()))
    now = _parse_utc_datetime(_utc_now())
    week_cutoff = now - timedelta(days=7)
    week_attempts = [
        row
        for row in attempts
        if _parse_utc_datetime(str(_row_get(row, "created_at") or _utc_now())) >= week_cutoff
    ]
    latest_week_attempts = _latest_learning_attempts_by_item(week_attempts)
    week_counts = _learning_counts_for_attempt_rows(list(latest_week_attempts.values()))
    return {
        "game_id": int(game_id),
        "schema_version": LEARNING_LOOP_SUMMARY_SCHEMA_VERSION,
        "session_count": int(session_count),
        "practice_event_count": len(attempts),
        "positions_worked_count": len(latest),
        "week_positions_worked_count": len(latest_week_attempts),
        "week_success_without_help_count": week_counts["success_without_help_count"],
        "week_success_with_hint_count": week_counts["success_with_hint_count"],
        "week_failed_count": week_counts["failed_count"],
        "week_revealed_count": week_counts["revealed_count"],
        **counts,
    }


def _learning_counts_for_latest_attempts(
    latest_attempts: dict[int, sqlite3.Row],
) -> dict[str, Any]:
    return _learning_counts_for_attempt_rows(list(latest_attempts.values()))


def _learning_counts_for_attempt_rows(attempts: list[sqlite3.Row]) -> dict[str, Any]:
    now = _parse_utc_datetime(_utc_now())
    success_without_help_count = 0
    success_with_hint_count = 0
    failed_count = 0
    revealed_count = 0
    due_count = 0
    scheduled_count = 0
    next_due_at: str | None = None
    for row in attempts:
        result = str(_row_get(row, "result") or "")
        hint_used = _bool_row_value(_row_get(row, "hint_used", 0))
        reveal_used = _bool_row_value(_row_get(row, "reveal_used", 0))
        if result in PRACTICE_SUCCESS_RESULTS:
            if hint_used:
                success_with_hint_count += 1
            elif not reveal_used:
                success_without_help_count += 1
        elif result in {"wrong", "illegal"}:
            failed_count += 1
        elif result == "revealed":
            revealed_count += 1

        due_at = _due_at_for_row(row)
        if not due_at:
            continue
        due_dt = _parse_utc_datetime(due_at)
        if due_dt <= now:
            due_count += 1
        else:
            scheduled_count += 1
            if next_due_at is None or due_dt < _parse_utc_datetime(next_due_at):
                next_due_at = due_at
    return {
        "success_without_help_count": success_without_help_count,
        "success_with_hint_count": success_with_hint_count,
        "failed_count": failed_count,
        "revealed_count": revealed_count,
        "due_count": due_count,
        "scheduled_count": scheduled_count,
        "next_due_at": next_due_at,
    }


def _due_ply_map(attempts: list[sqlite3.Row]) -> dict[int, str]:
    now = _parse_utc_datetime(_utc_now())
    due: dict[int, str] = {}
    for row in _latest_learning_attempts_by_item(attempts).values():
        due_at = _due_at_for_row(row)
        if not due_at:
            continue
        if _parse_utc_datetime(due_at) <= now:
            due[int(row["ply"])] = due_at
    return due


def practice_revision_delay_days(
    result: str,
    *,
    hint_used: bool = False,
    reveal_used: bool = False,
) -> int | None:
    normalized_result = str(result or "").lower()
    if normalized_result in {"wrong", "illegal", "revealed"} or reveal_used:
        return 1
    if normalized_result in PRACTICE_SUCCESS_RESULTS:
        return 3 if hint_used else 7
    if normalized_result == "skipped":
        return None
    return None


def practice_revision_due_at(
    result: str,
    attempted_at: str,
    *,
    hint_used: bool = False,
    reveal_used: bool = False,
) -> str | None:
    delay_days = practice_revision_delay_days(
        result,
        hint_used=hint_used,
        reveal_used=reveal_used,
    )
    if delay_days is None:
        return None
    due_dt = _parse_utc_datetime(attempted_at) + timedelta(days=delay_days)
    return due_dt.isoformat(timespec="seconds")


def _items_from_session_row(
    session: sqlite3.Row | dict[str, Any],
) -> list[dict[str, Any]] | None:
    raw = _row_get(session, "items_json")
    if not raw:
        return None
    try:
        parsed = json.loads(str(raw))
    except (TypeError, ValueError):
        return None
    if not isinstance(parsed, list):
        return None
    return [item for item in parsed if isinstance(item, dict)]


def _attempt_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "session_id": int(row["session_id"]),
        "game_id": int(row["game_id"]),
        "ply": int(row["ply"]),
        "color": row["color"],
        "attempted_uci": row["attempted_uci"],
        "attempted_san": row["attempted_san"],
        "expected_best_uci": row["expected_best_uci"],
        "result": row["result"],
        "attempt_number": int(row["attempt_number"]),
        "item_id": _row_get(row, "item_id") or _practice_item_id(row["game_id"], row["ply"]),
        "time_spent_ms": _row_get(row, "time_spent_ms"),
        "hint_used": _bool_row_value(_row_get(row, "hint_used", 0)),
        "reveal_used": _bool_row_value(_row_get(row, "reveal_used", 0)),
        "source_context": _row_get(row, "source_context") or "review_practice",
        "due_at": _due_at_for_row(row),
        "created_at": row["created_at"],
    }


def _evidence_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "ply": item.get("ply"),
        "color": item.get("color"),
        "san": item.get("san"),
        "fen_before": item.get("fen_before"),
        "best_move_uci": item.get("best_move_uci"),
        "best_move_san": item.get("best_move_san"),
        "acceptable_moves": item.get("acceptable_moves") or [],
        "pedagogical_explanation": item.get("pedagogical_explanation") or {},
        "contrast_coach_explanation": item.get("contrast_coach_explanation") or {},
        "primary_category": item.get("primary_category"),
        "tags": item.get("tags") or [],
        "impact_label": item.get("impact_label"),
        "move_quality_label": item.get("move_quality_label"),
        "pv_line": item.get("pv_line") or [],
        "pv_contrast_evidence": item.get("pv_contrast_evidence"),
        "try_move_model_version": item.get("try_move_model_version"),
    }


def _find_item_for_ply(
    items: list[dict[str, Any]],
    ply: int,
) -> dict[str, Any] | None:
    for item in items:
        if int(item.get("ply") or 0) == int(ply):
            return item
    return None


def _attempted_san(fen_before: Any, attempted_uci: str | None) -> str | None:
    if not fen_before or not attempted_uci:
        return None
    try:
        board = chess.Board(str(fen_before))
        move = chess.Move.from_uci(str(attempted_uci))
    except ValueError:
        return None
    if move not in board.legal_moves:
        return None
    return board.san(move)


def _normalize_pov(value: str | None) -> str:
    normalized = str(value or "user").lower()
    return normalized if normalized in PRACTICE_ALLOWED_POVS else "user"


def _normalize_scope(value: str | None) -> str:
    normalized = str(value or PRACTICE_DEFAULT_SCOPE).lower()
    return normalized if normalized in PRACTICE_ALLOWED_SCOPES else PRACTICE_DEFAULT_SCOPE


def _normalize_result(value: str | None) -> str:
    normalized = str(value or "").lower()
    if normalized not in PRACTICE_ALLOWED_RESULTS:
        raise ReviewPracticeServiceError("invalid practice result", status_code=400)
    return normalized


def _normalize_time_spent_ms(value: int | None) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return min(parsed, 2 * 60 * 60 * 1000)


def _normalize_source_context(value: str | None) -> str:
    normalized = str(value or "review_practice").strip().lower()
    if not normalized:
        return "review_practice"
    return normalized[:80]


def _normalized_max_items(value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = PRACTICE_DEFAULT_MAX_ITEMS
    return max(1, min(PRACTICE_MAX_ITEMS_LIMIT, parsed))


def _target_color_for_pov(pov: str, user_color: Any) -> str:
    if pov == "white":
        return "white"
    if pov == "black":
        return "black"
    if pov == "user":
        return str(user_color) if user_color in {"white", "black"} else "both"
    return "both"


def _annotation_matches_color(annotation: dict[str, Any], target_color: str) -> bool:
    if target_color == "both":
        return True
    color = annotation.get("color") or annotation.get("side")
    return color == target_color


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


def _row_get(row: sqlite3.Row | dict[str, Any], key: str, default: Any = None) -> Any:
    if isinstance(row, dict):
        return row.get(key, default)
    return row[key] if key in row.keys() else default


def _practice_item_id(game_id: Any, ply: Any) -> str:
    return f"review:{int(game_id)}:ply:{int(ply)}"


def _bool_row_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    try:
        return int(value or 0) != 0
    except (TypeError, ValueError):
        return False


def _due_at_for_row(row: sqlite3.Row) -> str | None:
    due_at = _row_get(row, "due_at")
    if due_at:
        return str(due_at)
    return practice_revision_due_at(
        str(_row_get(row, "result") or ""),
        str(_row_get(row, "created_at") or _utc_now()),
        hint_used=_bool_row_value(_row_get(row, "hint_used", 0)),
        reveal_used=_bool_row_value(_row_get(row, "reveal_used", 0)),
    )


def _parse_utc_datetime(value: str) -> datetime:
    raw = str(value or _utc_now()).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
