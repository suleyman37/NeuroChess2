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


EXPORT_SCHEMA_VERSION = "profile_privacy_export_v1"
DELETE_CONFIRMATION_TEXT = "SUPPRIMER"


class UserDataConfirmationError(ValueError):
    """Raised when a destructive local-data request lacks explicit confirmation."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _json_loads_or_raw(value: Any) -> Any:
    if not isinstance(value, str) or not value.strip():
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


class UserDataService:
    """Local-first Profile/Privacy export and delete operations."""

    _export_tables: dict[str, str | None] = {
        "games": "games",
        "moves": "moves",
        "engine_analysis": "position_analyses",
        "review_jobs": "review_jobs",
        "review_summaries": "game_reviews",
        "review_moments": "review_moments",
        "practice_sessions": "review_practice_sessions",
        "practice_session_items": None,
        "practice_attempts": "review_practice_attempts",
        "due_reviews": None,
        "daily_plan_items": "daily_plan_items",
        "skilltrace_states": "skilltrace_states",
        "telemetry_events": "telemetry_events",
        "user_settings": "user_settings",
        "local_profile": "local_profile",
        "user_aliases": "user_aliases",
    }

    _delete_tables: tuple[tuple[str, str], ...] = (
        ("practice_attempts_deleted", "review_practice_attempts"),
        ("practice_sessions_deleted", "review_practice_sessions"),
        ("review_moments_deleted", "review_moments"),
        ("review_summaries_deleted", "game_reviews"),
        ("review_jobs_deleted", "review_jobs"),
        ("engine_analysis_deleted", "position_analyses"),
        ("moves_deleted", "moves"),
        ("game_opening_classifications_deleted", "game_opening_classifications"),
        ("games_deleted", "games"),
        ("telemetry_deleted", "telemetry_events"),
        ("daily_plan_items_deleted", "daily_plan_items"),
        ("skilltrace_states_deleted", "skilltrace_states"),
        ("user_settings_deleted", "user_settings"),
        ("local_profile_deleted", "local_profile"),
        ("user_aliases_deleted", "user_aliases"),
    )

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path

    def export_user_data(self) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            tables = self._table_names(connection)
            sections: dict[str, Any] = {}
            for section, table_name in self._export_tables.items():
                if table_name is None:
                    continue
                sections[section] = self._fetch_table(connection, table_name, tables)

            sections["practice_session_items"] = self._practice_session_items(
                sections.get("practice_sessions", [])
            )
            sections["due_reviews"] = [
                attempt
                for attempt in sections.get("practice_attempts", [])
                if attempt.get("due_at")
            ]

            return {
                "metadata": {
                    "app_name": "NeuroChess",
                    "schema_version": EXPORT_SCHEMA_VERSION,
                    "exported_at": _utc_now(),
                    "storage_model": "local_first_v1",
                    "warning": (
                        "Export local V1: ce fichier contient les parties, reviews, "
                        "entrainements et donnees locales disponibles."
                    ),
                },
                **sections,
            }

    def delete_user_data(self, confirm: str | None) -> dict[str, Any]:
        if confirm != DELETE_CONFIRMATION_TEXT:
            raise UserDataConfirmationError("confirmation_required")

        def operation() -> dict[str, Any]:
            with closing(get_connection(self.db_path)) as connection:
                tables = self._table_names(connection)
                counts: dict[str, int] = {}
                due_items_deleted = self._count_due_items(connection, tables)

                with connection:
                    for key, table_name in self._delete_tables:
                        counts[key] = self._delete_all(connection, table_name, tables)

                reviews_deleted = (
                    counts.get("review_jobs_deleted", 0)
                    + counts.get("review_summaries_deleted", 0)
                    + counts.get("review_moments_deleted", 0)
                )
                settings_deleted = (
                    counts.get("user_settings_deleted", 0)
                    + counts.get("local_profile_deleted", 0)
                    + counts.get("user_aliases_deleted", 0)
                )
                total_deleted = sum(counts.values())
                return {
                    "schema_version": "user_data_delete_v1",
                    "deleted_at": _utc_now(),
                    "games_deleted": counts.get("games_deleted", 0),
                    "moves_deleted": counts.get("moves_deleted", 0),
                    "engine_analysis_deleted": counts.get("engine_analysis_deleted", 0),
                    "reviews_deleted": reviews_deleted,
                    "review_jobs_deleted": counts.get("review_jobs_deleted", 0),
                    "review_summaries_deleted": counts.get("review_summaries_deleted", 0),
                    "review_moments_deleted": counts.get("review_moments_deleted", 0),
                    "practice_sessions_deleted": counts.get(
                        "practice_sessions_deleted", 0
                    ),
                    "practice_attempts_deleted": counts.get(
                        "practice_attempts_deleted", 0
                    ),
                    "due_items_deleted": due_items_deleted,
                    "telemetry_deleted": counts.get("telemetry_deleted", 0),
                    "daily_plan_items_deleted": counts.get("daily_plan_items_deleted", 0),
                    "skilltrace_states_deleted": counts.get("skilltrace_states_deleted", 0),
                    "settings_deleted": settings_deleted,
                    "user_aliases_deleted": counts.get("user_aliases_deleted", 0),
                    "total_deleted": total_deleted,
                }

        return execute_sqlite_write_with_retry(operation)

    def _table_names(self, connection: sqlite3.Connection) -> set[str]:
        rows = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
        return {str(row["name"]) for row in rows}

    def _fetch_table(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        tables: set[str],
    ) -> list[dict[str, Any]]:
        if table_name not in tables:
            return []
        rows = connection.execute(
            f'SELECT * FROM "{table_name}" ORDER BY rowid'
        ).fetchall()
        payloads = [_row_to_dict(row) for row in rows]
        if table_name == "games":
            for payload in payloads:
                payload["pgn_raw"] = payload.get("pgn")
        if table_name in {"position_analyses", "review_practice_attempts"}:
            for payload in payloads:
                for key in ("analysis_json", "evidence_snapshot_json"):
                    if key in payload:
                        payload[key] = _json_loads_or_raw(payload[key])
        if table_name == "review_practice_sessions":
            for payload in payloads:
                if "items_json" in payload:
                    payload["items_json"] = _json_loads_or_raw(payload["items_json"])
        return payloads

    def _practice_session_items(
        self,
        practice_sessions: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for session in practice_sessions:
            raw_items = session.get("items_json")
            if not isinstance(raw_items, list):
                continue
            for index, item in enumerate(raw_items):
                item_payload = dict(item) if isinstance(item, dict) else {"value": item}
                item_payload["session_id"] = session.get("id")
                item_payload["item_index"] = index
                items.append(item_payload)
        return items

    def _count_due_items(
        self,
        connection: sqlite3.Connection,
        tables: set[str],
    ) -> int:
        if "review_practice_attempts" not in tables:
            return 0
        row = connection.execute(
            """
            SELECT COUNT(*)
            FROM review_practice_attempts
            WHERE due_at IS NOT NULL AND due_at != ''
            """
        ).fetchone()
        return int(row[0] if row is not None else 0)

    def _delete_all(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        tables: set[str],
    ) -> int:
        if table_name not in tables:
            return 0
        row = connection.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()
        count = int(row[0] if row is not None else 0)
        connection.execute(f'DELETE FROM "{table_name}"')
        return count
