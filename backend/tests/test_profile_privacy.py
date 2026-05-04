from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app  # noqa: E402
from neurochess.api.game_routes import (  # noqa: E402
    ACTIVE_SESSIONS,
    get_analysis_service,
    get_repository,
)
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)

from backend.tests.test_review_practice_sessions import (  # noqa: E402
    StaticReviewService,
    practice_review,
)


class ProfilePrivacyApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-profile-"))
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

    def test_export_empty_db_returns_stable_json_sections(self) -> None:
        response = self.client.get("/api/export")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload["metadata"]["schema_version"],
            "profile_privacy_export_v1",
        )
        self.assertEqual(payload["metadata"]["storage_model"], "local_first_v1")
        for section in (
            "games",
            "moves",
            "engine_analysis",
            "review_jobs",
            "review_summaries",
            "review_moments",
            "practice_sessions",
            "practice_session_items",
            "practice_attempts",
            "due_reviews",
            "daily_plan_items",
            "skilltrace_states",
            "telemetry_events",
            "user_settings",
            "local_profile",
        ):
            self.assertIn(section, payload)
            self.assertEqual(payload[section], [])

    def test_export_with_game_review_and_practice_data(self) -> None:
        game_id = self._seed_review_practice_data()

        response = self.client.get("/api/export")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["games"][0]["id"], game_id)
        self.assertIn("[Event", payload["games"][0]["pgn_raw"])
        self.assertGreaterEqual(len(payload["moves"]), 1)
        self.assertGreaterEqual(len(payload["engine_analysis"]), 1)
        self.assertGreaterEqual(len(payload["review_summaries"]), 1)
        self.assertGreaterEqual(len(payload["practice_sessions"]), 1)
        self.assertGreaterEqual(len(payload["practice_session_items"]), 1)
        self.assertGreaterEqual(len(payload["practice_attempts"]), 1)
        self.assertEqual(payload["practice_attempts"][0]["result"], "revealed")
        self.assertTrue(payload["practice_attempts"][0]["reveal_used"])
        self.assertIsNotNone(payload["practice_attempts"][0]["due_at"])
        self.assertEqual(len(payload["due_reviews"]), 1)

    def test_delete_without_confirmation_fails_and_keeps_data(self) -> None:
        self._seed_review_practice_data()

        response = self.client.delete("/api/user-data")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "confirmation_required")
        self.assertEqual(len(self.client.get("/api/export").json()["games"]), 1)

    def test_delete_with_wrong_confirmation_fails_and_keeps_data(self) -> None:
        self._seed_review_practice_data()

        response = self.client.delete(
            "/api/user-data",
            params={"confirm": "EFFACER"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "confirmation_required")
        self.assertEqual(len(self.client.get("/api/export").json()["games"]), 1)

    def test_delete_with_confirmation_removes_local_user_data(self) -> None:
        self._seed_review_practice_data()

        response = self.client.delete(
            "/api/user-data",
            params={"confirm": "SUPPRIMER"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["games_deleted"], 1)
        self.assertGreaterEqual(payload["moves_deleted"], 1)
        self.assertGreaterEqual(payload["engine_analysis_deleted"], 1)
        self.assertGreaterEqual(payload["reviews_deleted"], 1)
        self.assertGreaterEqual(payload["practice_sessions_deleted"], 1)
        self.assertGreaterEqual(payload["practice_attempts_deleted"], 1)
        self.assertGreaterEqual(payload["due_items_deleted"], 1)
        self.assertGreater(payload["total_deleted"], 0)
        self.assertEqual(self.client.get("/games").json(), [])

        export_payload = self.client.get("/api/export").json()
        self.assertEqual(export_payload["games"], [])
        self.assertEqual(export_payload["practice_attempts"], [])
        self.assertEqual(export_payload["due_reviews"], [])

    def test_delete_is_idempotent(self) -> None:
        self._seed_review_practice_data()
        first = self.client.delete(
            "/api/user-data",
            params={"confirm": "SUPPRIMER"},
        )
        second = self.client.delete(
            "/api/user-data",
            params={"confirm": "SUPPRIMER"},
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["total_deleted"], 0)

    def test_export_delete_do_not_use_analysis_or_stockfish_dependency(self) -> None:
        def fail_if_called() -> Any:
            raise AssertionError("export/delete must not request Stockfish analysis")

        app.dependency_overrides[get_analysis_service] = fail_if_called
        self._seed_review_practice_data()

        self.assertEqual(self.client.get("/api/export").status_code, 200)
        response = self.client.delete(
            "/api/user-data",
            params={"confirm": "SUPPRIMER"},
        )
        self.assertEqual(response.status_code, 200)

    def _seed_review_practice_data(self) -> int:
        game_id = self.repository.create_game("classic")
        self.repository.add_move(
            game_id=game_id,
            ply=1,
            fen_before="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            uci="e2e4",
            san="e4",
            is_player=True,
        )
        self.repository.save_position_analysis(
            fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            analysis_json={"eval_cp": 20, "top_moves": [{"uci": "e2e4"}]},
            engine="fakefish",
            depth=1,
            schema_version="test",
        )
        self.repository.finish_game(
            game_id,
            result="*",
            pgn='[Event "Profile Privacy"]\n[Result "*"]\n\n1. e4 *\n',
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'done', ?, ?, datetime('now'), datetime('now'), '[]')
                """,
                (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
            )
            connection.execute(
                """
                INSERT INTO user_aliases (
                    username,
                    username_normalized,
                    platform,
                    created_at,
                    updated_at
                )
                VALUES ('LocalPlayer', 'localplayer', 'lichess', datetime('now'), datetime('now'))
                """
            )
            connection.commit()

        service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(practice_review(game_id)),  # type: ignore[arg-type]
        )
        session = service.create_session(game_id, pov="both", max_items=5)
        service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci=None,
            result="revealed",
            reveal_used=True,
            time_spent_ms=8000,
            source_context="review_practice",
        )
        return game_id


if __name__ == "__main__":
    unittest.main()
