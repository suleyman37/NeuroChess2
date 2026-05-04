from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from neurochess.data.database import (
    execute_sqlite_write_with_retry,
    get_connection,
)
from neurochess.training_item_service import (
    TrainingItemService,
    training_item_to_practice_item,
)


DAILY_PLAN_SCHEMA_VERSION = "daily_plan_v1"
DAILY_PLAN_DEFAULT_USER_ID = "local"
DAILY_PLAN_DEFAULT_MAX_ITEMS = 6
DAILY_PLAN_TARGET_MIN_READY_ITEMS = 3
DAILY_PLAN_ESTIMATED_MINUTES_PER_ITEM = 2

FAILED_RECENT_RESULTS = {"wrong", "illegal", "revealed", "failed"}
BUCKET_PRIORITY = {
    "due": 0,
    "failed_recent": 1,
    "recent_critical": 2,
    "diversity_fill": 3,
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _today() -> str:
    return date.today().isoformat()


def _row_to_dict(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    if isinstance(row, dict):
        return dict(row)
    return {key: row[key] for key in row.keys()}


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = datetime.strptime(value.strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _float_or_zero(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_max_items(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = DAILY_PLAN_DEFAULT_MAX_ITEMS
    return max(1, min(parsed, 12))


def _timestamp_value(value: Any) -> float:
    parsed = _parse_datetime(value)
    return parsed.timestamp() if parsed is not None else 0.0


def _attempt_item_keys(item: dict[str, Any]) -> set[str]:
    return {
        f"training_item:{int(item['id'])}",
        f"review:{int(item['source_game_id'])}:ply:{int(item['source_ply'])}",
    }


def _candidate_payload(
    item: dict[str, Any],
    *,
    bucket: str,
    selection_reason: str,
    selection_score: float,
    due_at: str | None = None,
    latest_attempt_at: str | None = None,
) -> dict[str, Any]:
    return {
        "item": item,
        "item_id": int(item["id"]),
        "bucket": bucket,
        "selection_reason": selection_reason,
        "selection_score": round(float(selection_score), 3),
        "due_at": due_at,
        "latest_attempt_at": latest_attempt_at,
    }


class DailyPlanService:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path
        self.training_items = TrainingItemService(db_path)

    def get_today_plan(
        self,
        *,
        user_id: str = DAILY_PLAN_DEFAULT_USER_ID,
        plan_date: str | None = None,
    ) -> dict[str, Any]:
        return self._plan_payload(
            user_id=user_id,
            plan_date=plan_date or _today(),
            create_if_missing=False,
            max_items=DAILY_PLAN_DEFAULT_MAX_ITEMS,
        )

    def create_or_get_today_plan(
        self,
        *,
        user_id: str = DAILY_PLAN_DEFAULT_USER_ID,
        plan_date: str | None = None,
        max_items: int = DAILY_PLAN_DEFAULT_MAX_ITEMS,
        duration_preference: str | None = None,
    ) -> dict[str, Any]:
        _ = duration_preference
        return self._plan_payload(
            user_id=user_id,
            plan_date=plan_date or _today(),
            create_if_missing=True,
            max_items=max_items,
        )

    def create_plan_practice_items(
        self,
        *,
        user_id: str = DAILY_PLAN_DEFAULT_USER_ID,
        plan_date: str | None = None,
        max_items: int = DAILY_PLAN_DEFAULT_MAX_ITEMS,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        plan = self.create_or_get_today_plan(
            user_id=user_id,
            plan_date=plan_date,
            max_items=max_items,
        )
        training_item_ids = [
            int(item["item_id"])
            for item in plan.get("items", [])
            if isinstance(item, dict) and item.get("item_id") is not None
        ]
        training_rows = self.training_items.get_items_by_ids(training_item_ids)
        return [training_item_to_practice_item(row) for row in training_rows], plan

    def _plan_payload(
        self,
        *,
        user_id: str,
        plan_date: str,
        create_if_missing: bool,
        max_items: int,
    ) -> dict[str, Any]:
        max_count = _normalize_max_items(max_items)
        with closing(get_connection(self.db_path)) as connection:
            existing = self._existing_plan_rows(connection, user_id, plan_date)
        if existing:
            return self._payload_from_rows(user_id, plan_date, existing, target=max_count)
        if not create_if_missing:
            return self._empty_payload(
                user_id=user_id,
                plan_date=plan_date,
                target=max_count,
                status="empty",
                reason="Aucun plan du jour n'a encore ete cree.",
            )
        selected = self._select_candidates(max_count=max_count)
        if not selected:
            return self._empty_payload(
                user_id=user_id,
                plan_date=plan_date,
                target=max_count,
                status="empty",
                reason=(
                    "Profil en construction - importe quelques parties et termine "
                    "des sessions pour obtenir un plan fiable."
                ),
            )

        def write_plan() -> list[dict[str, Any]]:
            with closing(get_connection(self.db_path)) as connection:
                try:
                    connection.execute("BEGIN")
                    existing_after_lock = self._existing_plan_rows(
                        connection,
                        user_id,
                        plan_date,
                    )
                    if existing_after_lock:
                        connection.commit()
                        return existing_after_lock
                    now = _utc_now()
                    for index, candidate in enumerate(selected):
                        connection.execute(
                            """
                            INSERT INTO daily_plan_items (
                                user_id,
                                plan_date,
                                item_id,
                                order_index,
                                selection_reason,
                                selection_score,
                                source_bucket,
                                created_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                user_id,
                                plan_date,
                                candidate["item_id"],
                                index,
                                candidate["selection_reason"],
                                candidate["selection_score"],
                                candidate["bucket"],
                                now,
                            ),
                        )
                    connection.commit()
                    return self._existing_plan_rows(connection, user_id, plan_date)
                except Exception:
                    connection.rollback()
                    raise

        rows = execute_sqlite_write_with_retry(write_plan)
        return self._payload_from_rows(user_id, plan_date, rows, target=max_count)

    def _select_candidates(self, *, max_count: int) -> list[dict[str, Any]]:
        items = self.training_items.list_active_items()
        if not items:
            return []
        attempts_by_item = self._latest_attempts_by_item(items)
        now = datetime.now(timezone.utc)
        candidates: list[dict[str, Any]] = []
        item_by_id = {int(item["id"]): item for item in items}

        for item in items:
            latest = attempts_by_item.get(int(item["id"]))
            due_at = latest.get("due_at") if latest else None
            due_dt = _parse_datetime(due_at)
            if due_dt is not None and due_dt <= now:
                candidates.append(
                    _candidate_payload(
                        item,
                        bucket="due",
                        selection_reason="revision_due_simple_v1",
                        selection_score=1000.0 + _float_or_zero(item["criticality_score"]),
                        due_at=due_at,
                        latest_attempt_at=latest.get("created_at") if latest else None,
                    )
                )

        for item in items:
            latest = attempts_by_item.get(int(item["id"]))
            if not latest:
                continue
            result = str(latest.get("result") or "")
            if result in FAILED_RECENT_RESULTS:
                candidates.append(
                    _candidate_payload(
                        item,
                        bucket="failed_recent",
                        selection_reason="recent_failed_practice",
                        selection_score=700.0 + _float_or_zero(item["criticality_score"]),
                        due_at=latest.get("due_at"),
                        latest_attempt_at=latest.get("created_at"),
                    )
                )

        for item in items:
            candidates.append(
                _candidate_payload(
                    item,
                    bucket="recent_critical",
                    selection_reason="recent_high_criticality",
                    selection_score=500.0 + _float_or_zero(item["criticality_score"]),
                )
            )

        for item in items:
            candidates.append(
                _candidate_payload(
                    item,
                    bucket="diversity_fill",
                    selection_reason="tag_diversity_fill",
                    selection_score=300.0 + _float_or_zero(item["criticality_score"]),
                )
            )

        candidates.sort(key=self._candidate_sort_key)
        selected: list[dict[str, Any]] = []
        seen_item_ids: set[int] = set()
        seen_sources: set[tuple[int, int]] = set()
        tag_counts: dict[str, int] = {}

        def can_add(candidate: dict[str, Any], *, strict_tag_limit: bool) -> bool:
            item = item_by_id[int(candidate["item_id"])]
            item_id = int(item["id"])
            source = (int(item["source_game_id"]), int(item["source_ply"]))
            if item_id in seen_item_ids or source in seen_sources:
                return False
            if not strict_tag_limit:
                return True
            tag = str(item.get("primary_tag") or "unknown")
            if tag_counts.get(tag, 0) < 2:
                return True
            return not self._has_alternative_tag(
                candidates,
                seen_item_ids,
                seen_sources,
                tag_counts,
                blocked_tag=tag,
            )

        for strict in (True, False):
            for candidate in candidates:
                if len(selected) >= max_count:
                    return selected
                if not can_add(candidate, strict_tag_limit=strict):
                    continue
                item = item_by_id[int(candidate["item_id"])]
                selected.append(candidate)
                seen_item_ids.add(int(item["id"]))
                seen_sources.add((int(item["source_game_id"]), int(item["source_ply"])))
                tag = str(item.get("primary_tag") or "unknown")
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        return selected

    def _latest_attempts_by_item(
        self,
        items: list[dict[str, Any]],
    ) -> dict[int, dict[str, Any]]:
        item_ids_by_key: dict[str, int] = {}
        for item in items:
            for key in _attempt_item_keys(item):
                item_ids_by_key[key] = int(item["id"])
        if not item_ids_by_key:
            return {}
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM review_practice_attempts
                WHERE item_id IS NOT NULL
                ORDER BY created_at DESC, id DESC
                """
            ).fetchall()
        latest: dict[int, dict[str, Any]] = {}
        for row in rows:
            payload = _row_to_dict(row)
            item_id = item_ids_by_key.get(str(payload.get("item_id") or ""))
            if item_id is None or item_id in latest:
                continue
            latest[item_id] = payload
        return latest

    def _candidate_sort_key(self, candidate: dict[str, Any]) -> tuple[Any, ...]:
        item = candidate["item"]
        bucket = candidate["bucket"]
        due_at = candidate.get("due_at") or "9999-12-31T23:59:59+00:00"
        return (
            BUCKET_PRIORITY.get(bucket, 99),
            due_at if bucket == "due" else "",
            -float(candidate["selection_score"]),
            -_timestamp_value(candidate.get("latest_attempt_at"))
            if bucket == "failed_recent"
            else 0.0,
            -_timestamp_value(item.get("created_at")),
            int(item["id"]),
        )

    def _has_alternative_tag(
        self,
        candidates: list[dict[str, Any]],
        seen_item_ids: set[int],
        seen_sources: set[tuple[int, int]],
        tag_counts: dict[str, int],
        *,
        blocked_tag: str,
    ) -> bool:
        for candidate in candidates:
            item = candidate["item"]
            item_id = int(item["id"])
            source = (int(item["source_game_id"]), int(item["source_ply"]))
            tag = str(item.get("primary_tag") or "unknown")
            if item_id in seen_item_ids or source in seen_sources:
                continue
            if tag == blocked_tag:
                continue
            if tag_counts.get(tag, 0) < 2:
                return True
        return False

    def _existing_plan_rows(
        self,
        connection: sqlite3.Connection,
        user_id: str,
        plan_date: str,
    ) -> list[dict[str, Any]]:
        rows = connection.execute(
            """
            SELECT
                daily_plan_items.*,
                training_items.source_game_id,
                training_items.source_ply,
                training_items.primary_tag,
                training_items.domain,
                training_items.criticality_score
            FROM daily_plan_items
            JOIN training_items ON training_items.id = daily_plan_items.item_id
            WHERE daily_plan_items.user_id = ? AND daily_plan_items.plan_date = ?
            ORDER BY daily_plan_items.order_index, daily_plan_items.id
            """,
            (user_id, plan_date),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]

    def _payload_from_rows(
        self,
        user_id: str,
        plan_date: str,
        rows: list[dict[str, Any]],
        *,
        target: int,
    ) -> dict[str, Any]:
        item_count = len(rows)
        if item_count <= 0:
            return self._empty_payload(
                user_id=user_id,
                plan_date=plan_date,
                target=target,
                status="empty",
                reason="Aucun item exploitable pour le plan du jour.",
            )
        status = "ready" if item_count >= DAILY_PLAN_TARGET_MIN_READY_ITEMS else "partial"
        message = (
            "Plan du jour pret."
            if status == "ready"
            else (
                "Profil en construction - le plan contient moins de 3 positions "
                "pour l'instant."
            )
        )
        return {
            "schema_version": DAILY_PLAN_SCHEMA_VERSION,
            "user_id": user_id,
            "plan_date": plan_date,
            "status": status,
            "item_count": item_count,
            "target_item_count": target,
            "estimated_minutes": item_count * DAILY_PLAN_ESTIMATED_MINUTES_PER_ITEM,
            "empty_reason": None if status == "ready" else message,
            "message": message,
            "items": [self._plan_item_payload(row) for row in rows],
        }

    def _empty_payload(
        self,
        *,
        user_id: str,
        plan_date: str,
        target: int,
        status: str,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "schema_version": DAILY_PLAN_SCHEMA_VERSION,
            "user_id": user_id,
            "plan_date": plan_date,
            "status": status,
            "item_count": 0,
            "target_item_count": target,
            "estimated_minutes": 0,
            "empty_reason": reason,
            "message": reason,
            "items": [],
        }

    def _plan_item_payload(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "plan_item_id": int(row["id"]),
            "item_id": int(row["item_id"]),
            "order_index": int(row["order_index"]),
            "source_bucket": row["source_bucket"],
            "selection_reason": row["selection_reason"],
            "source_game_id": row.get("source_game_id"),
            "source_ply": row.get("source_ply"),
            "primary_tag": row.get("primary_tag"),
            "domain": row.get("domain"),
            "created_at": row.get("created_at"),
        }
