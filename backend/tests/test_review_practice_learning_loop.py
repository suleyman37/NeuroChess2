from __future__ import annotations

import shutil
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
import sys

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import (  # noqa: E402
    ReviewPracticeService,
    practice_revision_delay_days,
)

from backend.tests.test_review_practice_sessions import (  # noqa: E402
    StaticReviewService,
    practice_review,
)


class ReviewPracticeLearningLoopTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-learning-loop-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.game_id = self.repository.create_game("classic")
        self.repository.finish_game(self.game_id, result="*", pgn="[Result \"*\"]")
        self.service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(practice_review(self.game_id)),  # type: ignore[arg-type]
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_attempt_event_fields_feed_learning_summary(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)

        summary = self.service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="e2e4",
            time_spent_ms=12000,
            hint_used=True,
            source_context="review_practice",
        )
        latest_attempt = summary["latest_attempt"]

        self.assertEqual(latest_attempt["item_id"], f"review:{self.game_id}:ply:1")
        self.assertEqual(latest_attempt["time_spent_ms"], 12000)
        self.assertTrue(latest_attempt["hint_used"])
        self.assertFalse(latest_attempt["reveal_used"])
        self.assertEqual(latest_attempt["source_context"], "review_practice")
        self.assertIsNotNone(latest_attempt["due_at"])
        self.assertEqual(summary["success_with_hint_count"], 1)
        self.assertEqual(summary["scheduled_count"], 1)

        history = self.service.list_sessions_for_game(self.game_id)
        learning = history["learning_summary"]
        self.assertEqual(learning["schema_version"], "learning_loop_v1")
        self.assertEqual(learning["practice_event_count"], 1)
        self.assertEqual(learning["positions_worked_count"], 1)
        self.assertEqual(learning["week_positions_worked_count"], 1)
        self.assertEqual(learning["success_with_hint_count"], 1)
        self.assertEqual(learning["due_count"], 0)
        self.assertEqual(learning["scheduled_count"], 1)

    def test_revision_delay_rules_are_simple_v1(self) -> None:
        self.assertEqual(practice_revision_delay_days("wrong"), 1)
        self.assertEqual(practice_revision_delay_days("illegal"), 1)
        self.assertEqual(practice_revision_delay_days("revealed"), 1)
        self.assertEqual(practice_revision_delay_days("best", hint_used=True), 3)
        self.assertEqual(practice_revision_delay_days("very_good", hint_used=True), 3)
        self.assertEqual(practice_revision_delay_days("acceptable", hint_used=True), 3)
        self.assertEqual(practice_revision_delay_days("best"), 7)
        self.assertIsNone(practice_revision_delay_days("skipped"))

    def test_due_review_session_uses_only_due_positions(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)
        self.service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="d2d4",
        )
        self.service.record_attempt(
            int(session["session_id"]),
            ply=2,
            attempted_uci="e7e5",
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_practice_attempts
                SET due_at = datetime('now', '-1 day')
                WHERE ply = 1
                """
            )
            connection.commit()

        due_session = self.service.create_due_review_session(
            self.game_id,
            pov="both",
            max_items=5,
        )

        self.assertEqual(due_session["scope"], "due_review")
        self.assertEqual([item["ply"] for item in due_session["items"]], [1])

    def test_no_due_review_session_returns_learning_summary(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)
        self.service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="e2e4",
        )

        with self.assertRaises(Exception) as context:
            self.service.create_due_review_session(self.game_id, pov="both", max_items=5)

        payload: dict[str, Any] | None = getattr(context.exception, "payload", None)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["status"], "no_due_items")
        self.assertEqual(payload["learning_summary"]["scheduled_count"], 1)


if __name__ == "__main__":
    unittest.main()
