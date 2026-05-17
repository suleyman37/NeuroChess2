from __future__ import annotations

import inspect
import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app  # noqa: E402
from neurochess.api import game_routes  # noqa: E402
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_repository  # noqa: E402
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess import review_practice_service as practice_module  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class ExerciseDetailReadOnlyRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-a205-exercise-detail-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_get_exercise_detail_does_not_mutate_protected_learning_state(self) -> None:
        game_id = self._create_finished_game()
        session_id = self._seed_stored_exercise_session(game_id)
        self._seed_attempt(session_id, game_id)
        before = self._protected_snapshot()

        with patch.object(
            ReviewPracticeService,
            "build_review_practice_items",
            side_effect=AssertionError("GET detail must use stored items without rebuilding"),
        ):
            first = self.client.get(f"/review/practice/sessions/{session_id}")
            second = self.client.get(f"/review/practice/sessions/{session_id}")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        payload = second.json()
        self.assertEqual(payload["session_id"], session_id)
        self.assertEqual(payload["game_id"], game_id)
        self.assertEqual(payload["status"], "running")
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["item_id"], f"review:{game_id}:ply:1")
        self.assertEqual(len(payload["attempts"]), 1)
        self.assertEqual(payload["attempts"][0]["due_at"], "2026-05-15T00:00:00+00:00")
        self.assertEqual(payload["summary"]["attempt_count"], 1)
        self.assertEqual(self._protected_snapshot(), before)

    def test_static_guard_keeps_exercise_detail_get_away_from_write_paths(self) -> None:
        combined = "\n".join(
            (
                inspect.getsource(game_routes.get_review_practice_session),
                inspect.getsource(ReviewPracticeService.get_session),
                inspect.getsource(ReviewPracticeService._session_payload),
                inspect.getsource(practice_module._items_from_session_row),
            )
        ).casefold()

        forbidden_fragments = (
            "insert into",
            "update ",
            "delete from",
            "ensure_training_items_for_game",
            "create_session_from_training_items",
            "record_attempt",
            "abandon_session",
            "retry_failed_session",
            "complete_session",
            "daily_plan",
            "execute_sqlite_write_with_retry",
        )
        for fragment in forbidden_fragments:
            self.assertNotIn(fragment, combined)

    def _create_finished_game(self) -> int:
        game_id = self.repository.create_game("classic")
        self.repository.finish_game(
            game_id,
            result="1-0",
            pgn='[White "A20.5"]\n[Black "ReadOnly"]\n[Result "1-0"]\n\n1. e4 1-0\n',
        )
        return game_id

    def _seed_stored_exercise_session(self, game_id: int) -> int:
        item = {
            "item_id": f"review:{game_id}:ply:1",
            "game_id": game_id,
            "ply": 1,
            "move_number": 1,
            "color": "white",
            "san": "e4",
            "uci": "e2e4",
            "fen_before": START_FEN,
            "best_move_uci": "e2e4",
            "best_move_san": "e4",
            "result": "to_review",
            "primary_category": "critical",
            "tags": ["missed_opportunity"],
            "try_move_supported": True,
        }
        with closing(sqlite3.connect(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO review_practice_sessions (
                    game_id,
                    review_id,
                    pov,
                    status,
                    item_count,
                    created_at,
                    schema_version,
                    scope,
                    items_json
                )
                VALUES (?, NULL, 'white', 'running', 1, '2026-05-14T00:00:00+00:00', 'test', 'top_priority', ?)
                """,
                (game_id, json.dumps([item], sort_keys=True)),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def _seed_attempt(self, session_id: int, game_id: int) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
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
                    created_at,
                    item_id,
                    source_context,
                    due_at
                )
                VALUES (?, ?, 1, 'white', 'e2e4', 'e4', 'e2e4', 'best', 1, '{}', '2026-05-14T00:05:00+00:00', ?, 'review_practice', '2026-05-15T00:00:00+00:00')
                """,
                (session_id, game_id, f"review:{game_id}:ply:1"),
            )
            connection.commit()

    def _protected_snapshot(self) -> dict[str, Any]:
        with closing(sqlite3.connect(self.db_path)) as connection:
            counts = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in (
                    "training_items",
                    "review_practice_sessions",
                    "review_practice_attempts",
                    "daily_plan_items",
                    "game_reviews",
                    "review_moments",
                )
            }
            attempts = [
                tuple(row)
                for row in connection.execute(
                    """
                    SELECT id, session_id, game_id, ply, result, due_at
                    FROM review_practice_attempts
                    ORDER BY id
                    """
                ).fetchall()
            ]
            sessions = [
                tuple(row)
                for row in connection.execute(
                    """
                    SELECT id, game_id, status, item_count, completed_at
                    FROM review_practice_sessions
                    ORDER BY id
                    """
                ).fetchall()
            ]
        return {"counts": counts, "attempts": attempts, "sessions": sessions}


if __name__ == "__main__":
    unittest.main()
