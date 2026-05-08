from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
import sys

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402

from backend.tests.test_review_practice_sessions import (  # noqa: E402
    StaticReviewService,
    practice_review,
)


class ReviewPracticeRevealSkipTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-practice-r1-"))
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

    def test_reveal_before_attempt_is_distinct_from_wrong(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)

        summary = self.service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci=None,
            result="revealed",
        )

        self.assertEqual(summary["revealed_count"], 1)
        self.assertEqual(summary["wrong_count"], 0)
        self.assertEqual(summary["skipped_count"], 0)
        self.assertEqual(summary["attempt_feedback"]["result"], "revealed")
        self.assertTrue(summary["attempt_feedback"]["show_best_move"])

    def test_skip_is_distinct_from_revealed_and_wrong(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)

        summary = self.service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci=None,
            result="skipped",
        )

        self.assertEqual(summary["skipped_count"], 1)
        self.assertEqual(summary["revealed_count"], 0)
        self.assertEqual(summary["wrong_count"], 0)
        self.assertEqual(summary["attempt_feedback"]["result"], "skipped")
        self.assertFalse(summary["attempt_feedback"]["show_best_move"])


if __name__ == "__main__":
    unittest.main()
