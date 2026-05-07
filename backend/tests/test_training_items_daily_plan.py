from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app  # noqa: E402
from backend.tests.test_review_practice_sessions import practice_review  # noqa: E402
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_repository  # noqa: E402
from neurochess.daily_plan_service import DailyPlanService  # noqa: E402
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import (  # noqa: E402
    ReviewPracticeService,
    practice_revision_delay_days,
)
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)
from neurochess.training_item_service import (  # noqa: E402
    TrainingItemService,
    training_item_to_practice_item,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class TrainingItemsDailyPlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-daily-plan-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        self.client = TestClient(app)
        self.game_id = self.repository.create_game("classic")
        self.repository.finish_game(
            self.game_id,
            result="*",
            pgn='[Event "Daily Plan"]\n[Result "*"]\n\n1. e4 *\n',
        )
        self.review_id = self._seed_review_moments(self.game_id)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_training_items_table_and_generation_are_durable_and_idempotent(self) -> None:
        service = TrainingItemService(self.db_path)

        first = service.ensure_training_items_for_game(
            self.game_id,
            review_payload=practice_review(self.game_id),
        )
        second = service.ensure_training_items_for_game(
            self.game_id,
            review_payload=practice_review(self.game_id),
        )

        self.assertEqual(len(first), 5)
        self.assertEqual([item["id"] for item in first], [item["id"] for item in second])
        self.assertEqual({item["source_game_id"] for item in first}, {self.game_id})
        self.assertLessEqual(len(first), 5)
        first_item = first[0]
        accepted = json.loads(first_item["accepted_moves_json"])
        self.assertIn(first_item["best_move"], accepted)
        self.assertIsNotNone(first_item["source_moment_id"])
        self.assertEqual(first_item["source_type"], "review_moment")

        with closing(sqlite3.connect(self.db_path)) as connection:
            table = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table' AND name = 'training_items'
                """
            ).fetchone()
            count = connection.execute(
                "SELECT COUNT(*) FROM training_items WHERE source_game_id = ?",
                (self.game_id,),
            ).fetchone()[0]
        self.assertIsNotNone(table)
        self.assertEqual(count, 5)

    def test_daily_plan_is_deterministic_and_uses_expected_buckets(self) -> None:
        training_service = TrainingItemService(self.db_path)
        items = training_service.ensure_training_items_for_game(
            self.game_id,
            review_payload=practice_review(self.game_id),
        )
        practice_service = ReviewPracticeService(self.db_path)
        practice_items = [training_item_to_practice_item(item) for item in items[:3]]
        session = practice_service.create_session_from_training_items(practice_items)
        practice_service.record_attempt(
            int(session["session_id"]),
            ply=int(items[0]["source_ply"]),
            attempted_uci=None,
            result="revealed",
            reveal_used=True,
            source_context="daily_plan",
        )
        practice_service.record_attempt(
            int(session["session_id"]),
            ply=int(items[1]["source_ply"]),
            attempted_uci="d7d5",
            result="wrong",
            source_context="daily_plan",
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_practice_attempts
                SET due_at = datetime('now', '-1 day')
                WHERE item_id = ?
                """,
                (f"training_item:{items[0]['id']}",),
            )
            connection.commit()

        service = DailyPlanService(self.db_path)
        first = service.create_or_get_today_plan(plan_date="2026-05-04", max_items=5)
        second = service.create_or_get_today_plan(plan_date="2026-05-04", max_items=5)

        self.assertEqual(first["schema_version"], "daily_plan_v1")
        self.assertEqual(first["status"], "ready")
        self.assertEqual(
            [item["item_id"] for item in first["items"]],
            [item["item_id"] for item in second["items"]],
        )
        self.assertEqual(first["items"][0]["source_bucket"], "due")
        self.assertIn(
            "failed_recent",
            {item["source_bucket"] for item in first["items"]},
        )
        self.assertNotIn("skilltrace", Path("backend/neurochess/daily_plan_service.py").read_text(encoding="utf-8").lower())

    def test_daily_plan_empty_state_does_not_fake_items(self) -> None:
        empty_temp = Path(tempfile.mkdtemp(prefix="neurochess2-daily-empty-"))
        try:
            db_path = empty_temp / "empty.db"
            init_db(db_path)
            service = DailyPlanService(db_path)

            payload = service.create_or_get_today_plan(
                plan_date="2026-05-04",
                max_items=6,
            )

            self.assertEqual(payload["status"], "empty")
            self.assertEqual(payload["item_count"], 0)
            self.assertEqual(payload["items"], [])
            self.assertIn("Profil en construction", payload["message"])
        finally:
            shutil.rmtree(empty_temp)

    def test_playable_and_imprecise_do_not_change_due_at_semantics_yet(self) -> None:
        self.assertIsNone(practice_revision_delay_days("playable"))
        self.assertIsNone(practice_revision_delay_days("imprecise"))
        self.assertIsNone(practice_revision_delay_days("needs_rebuild"))
        self.assertEqual(practice_revision_delay_days("wrong"), 1)
        self.assertEqual(practice_revision_delay_days("best"), 7)

    def test_daily_plan_limits_repeated_tags_when_alternatives_exist(self) -> None:
        diverse_temp = Path(tempfile.mkdtemp(prefix="neurochess2-daily-diverse-"))
        try:
            db_path = diverse_temp / "diverse.db"
            init_db(db_path)
            with closing(sqlite3.connect(db_path)) as connection:
                for index, tag in enumerate(
                    [
                        "tactic",
                        "tactic",
                        "tactic",
                        "tactic",
                        "defense",
                        "conversion",
                        "endgame",
                    ],
                    start=1,
                ):
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
                            created_at,
                            updated_at,
                            status
                        )
                        VALUES (
                            'review_moment',
                            1,
                            ?,
                            ?,
                            ?,
                            'white',
                            'e2e4',
                            '["e2e4"]',
                            ?,
                            ?,
                            '[]',
                            0.0,
                            ?,
                            NULL,
                            NULL,
                            datetime('now'),
                            NULL,
                            'active'
                        )
                        """,
                        (
                            index,
                            index,
                            START_FEN,
                            tag,
                            tag,
                            100.0 - index,
                        ),
                    )
                connection.commit()

            payload = DailyPlanService(db_path).create_or_get_today_plan(
                plan_date="2026-05-04",
                max_items=5,
            )
            tags = [item["primary_tag"] for item in payload["items"]]

            self.assertEqual(payload["item_count"], 5)
            self.assertLessEqual(tags.count("tactic"), 2)
            self.assertIn("defense", tags)
            self.assertIn("conversion", tags)
        finally:
            shutil.rmtree(diverse_temp)

    def test_daily_plan_api_starts_practice_and_saves_enriched_attempt(self) -> None:
        TrainingItemService(self.db_path).ensure_training_items_for_game(
            self.game_id,
            review_payload=practice_review(self.game_id),
        )

        plan_response = self.client.post(
            "/api/training/daily-plan",
            json={"max_items": 5},
        )
        self.assertEqual(plan_response.status_code, 200)
        self.assertGreaterEqual(plan_response.json()["item_count"], 3)

        session_response = self.client.post(
            "/api/training/daily-plan/practice",
            json={"max_items": 5},
        )
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()
        self.assertEqual(session_payload["scope"], "daily_plan")
        self.assertEqual(session_payload["items"][0]["source_context"], "daily_plan")

        first_item = session_payload["items"][0]
        attempt_response = self.client.post(
            f"/review/practice/sessions/{session_payload['session_id']}/attempts",
            json={
                "ply": first_item["ply"],
                "attempted_uci": None,
                "result": "revealed",
                "reveal_used": True,
                "time_spent_ms": 5000,
                "source_context": "daily_plan",
            },
        )

        self.assertEqual(attempt_response.status_code, 200)
        latest = attempt_response.json()["latest_attempt"]
        self.assertTrue(str(latest["item_id"]).startswith("training_item:"))
        self.assertEqual(latest["source_context"], "daily_plan")
        self.assertTrue(latest["reveal_used"])
        self.assertIsNotNone(latest["due_at"])

    def test_export_delete_include_training_items_and_daily_plan_items(self) -> None:
        TrainingItemService(self.db_path).ensure_training_items_for_game(
            self.game_id,
            review_payload=practice_review(self.game_id),
        )
        self.client.post("/api/training/daily-plan", json={"max_items": 5})

        export_payload = self.client.get("/api/export").json()
        self.assertGreaterEqual(len(export_payload["training_items"]), 1)
        self.assertGreaterEqual(len(export_payload["daily_plan_items"]), 1)

        delete_response = self.client.delete(
            "/api/user-data",
            params={"confirm": "SUPPRIMER"},
        )
        self.assertEqual(delete_response.status_code, 200)
        self.assertGreaterEqual(delete_response.json()["training_items_deleted"], 1)
        self.assertGreaterEqual(delete_response.json()["daily_plan_items_deleted"], 1)

        export_after_delete = self.client.get("/api/export").json()
        self.assertEqual(export_after_delete["training_items"], [])
        self.assertEqual(export_after_delete["daily_plan_items"], [])

    def _seed_review_moments(self, game_id: int) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            cursor = connection.execute(
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
            review_id = int(cursor.lastrowid)
            for index in range(6):
                ply = index + 1
                connection.execute(
                    """
                    INSERT INTO review_moments (
                        review_id,
                        game_id,
                        move_id,
                        ply,
                        played_by,
                        side_to_move_before,
                        fen_before,
                        fen_after,
                        played_uci,
                        played_san,
                        best_move_uci,
                        best_move_san,
                        eval_before_cp,
                        eval_after_cp,
                        mate_before,
                        mate_after,
                        cp_loss,
                        cp_loss_label,
                        importance_score,
                        reliability_score,
                        reliability_label,
                        top_moves_json,
                        review_type,
                        created_at
                    )
                    VALUES (
                        ?, ?, NULL, ?, 'white', 'white', ?, ?, 'd2d4', 'd4',
                        'e2e4', 'e4', 20, -120, NULL, NULL, ?, 'large',
                        ?, 1.0, 'stable', ?, 'player_loss', datetime('now')
                    )
                    """,
                    (
                        review_id,
                        game_id,
                        ply,
                        START_FEN,
                        START_FEN,
                        120 - index,
                        95.0 - index,
                        json.dumps([{"uci": "e2e4", "rank": 1}]),
                    ),
                )
            connection.commit()
        return review_id


if __name__ == "__main__":
    unittest.main()
