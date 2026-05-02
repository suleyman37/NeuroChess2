from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)

from backend.tests.test_review_practice_sessions import (  # noqa: E402
    START_FEN,
    StaticReviewService,
)

BLACK_TO_MOVE_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
WHITE_MOVE_OPTIONS = {
    "best": ("e2e4", "e4"),
    "very_good": ("d2d4", "d4"),
    "acceptable": ("g1f3", "Nf3"),
    "wrong": ("a2a3", "a3"),
}
BLACK_MOVE_OPTIONS = {
    "best": ("e7e5", "e5"),
    "very_good": ("d7d5", "d5"),
    "acceptable": ("g8f6", "Nf6"),
    "wrong": ("a7a6", "a6"),
}


def _practice_review_with_items(game_id: int, count: int = 6) -> dict[str, Any]:
    annotations: list[dict[str, Any]] = []
    themes = [
        ("critical", ["missed_opportunity"], "tactical"),
        ("critical", ["conversion_issue"], "conversion"),
        ("to_review", ["defensive_resource_missed"], "defensive"),
        ("critical", ["missed_opportunity"], "tactical"),
        ("inexact", ["cluster"], "cluster"),
        ("to_review", ["persistent_loss"], "positional"),
    ]
    for index in range(count):
        primary, tags, error_type = themes[index % len(themes)]
        ply = index + 1
        color = "white" if ply % 2 else "black"
        fen_before = START_FEN if color == "white" else BLACK_TO_MOVE_FEN
        move_options = WHITE_MOVE_OPTIONS if color == "white" else BLACK_MOVE_OPTIONS
        best_uci, best_san = move_options["best"]
        very_good_uci, very_good_san = move_options["very_good"]
        acceptable_uci, acceptable_san = move_options["acceptable"]
        annotations.append(
            {
                "ply": ply,
                "move_number": (ply + 1) // 2,
                "color": color,
                "side": color,
                "san": best_san,
                "uci": best_uci,
                "fen_before": fen_before,
                "fen_after": fen_before,
                "primary_category": primary,
                "category_label": "A revoir",
                "tags": tags,
                "tag_labels": tags,
                "win_loss": 20.0 - index,
                "move_accuracy": 40.0,
                "best_move_uci": best_uci,
                "best_move_san": best_san,
                "try_move_supported": True,
                "acceptable_moves": [
                    {
                        "uci": best_uci,
                        "san": best_san,
                        "quality": "best",
                        "delta_from_best_win_percent": 0.0,
                    },
                    {
                        "uci": very_good_uci,
                        "san": very_good_san,
                        "quality": "very_good",
                        "delta_from_best_win_percent": 1.5,
                    },
                    {
                        "uci": acceptable_uci,
                        "san": acceptable_san,
                        "quality": "acceptable",
                        "delta_from_best_win_percent": 4.0,
                    },
                ],
                "pedagogical_explanation": {
                    "error_type": error_type,
                    "training_takeaway": "Comparer le coup joue avec la solution.",
                },
                "pv_line": [],
                "pv_line_available": False,
                "coach_priority_rank": ply,
            }
        )
    return {
        "game_id": game_id,
        "status": "done",
        "user_color": "white",
        "move_annotations": annotations,
        "review_sections": {
            "to_review": annotations,
            "strong_moves": [],
            "missed_opportunities": annotations[:1],
            "all": annotations,
        },
    }


class ReviewPracticeSummaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-practice-d2-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.game_id = self.repository.create_game("classic")
        self.repository.finish_game(self.game_id, result="*", pgn="[Result \"*\"]")
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
                (self.game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
            )
            connection.commit()
        self.service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(_practice_review_with_items(self.game_id)),  # type: ignore[arg-type]
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_summary_counts_theme_and_retry_availability(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=6)
        session_id = int(session["session_id"])
        for ply, attempted_uci, result in [
            (1, "e2e4", "wrong"),
            (2, "d7d5", "best"),
            (3, "g1f3", None),
            (4, "a7a6", "best"),
            (5, None, "revealed"),
            (6, None, "skipped"),
        ]:
            self.service.record_attempt(
                session_id,
                ply=ply,
                attempted_uci=attempted_uci,
                result=result,
            )

        summary = self.service.build_practice_session_summary(session_id)

        self.assertEqual(summary["best_count"], 1)
        self.assertEqual(summary["very_good_count"], 1)
        self.assertEqual(summary["acceptable_count"], 1)
        self.assertEqual(summary["wrong_count"], 1)
        self.assertEqual(summary["revealed_count"], 1)
        self.assertEqual(summary["skipped_count"], 1)
        self.assertEqual(summary["dominant_theme"], "tactical")
        self.assertEqual(summary["dominant_theme_label"], "Tactique")
        self.assertTrue(summary["summary_sentence"])
        self.assertTrue(summary["retry_failed_available"])
        self.assertEqual(summary["failed_plies"], [4, 5, 6])

    def test_retry_failed_creates_session_with_only_failed_items(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=6)
        session_id = int(session["session_id"])
        for ply, attempted_uci, result in [
            (1, "e2e4", "wrong"),
            (2, "d7d5", "best"),
            (3, "g1f3", None),
            (4, "a7a6", "best"),
            (5, None, "revealed"),
            (6, None, "skipped"),
        ]:
            self.service.record_attempt(
                session_id,
                ply=ply,
                attempted_uci=attempted_uci,
                result=result,
            )

        retry = self.service.retry_failed_session(session_id)

        self.assertEqual(retry["scope"], "retry_failed")
        self.assertEqual([item["ply"] for item in retry["items"]], [4, 5, 6])
        self.assertNotIn(1, [item["ply"] for item in retry["items"]])
        self.assertNotIn(2, [item["ply"] for item in retry["items"]])
        self.assertNotIn(3, [item["ply"] for item in retry["items"]])

    def test_history_detail_and_abandon_preserve_attempts(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=6)
        session_id = int(session["session_id"])
        self.service.record_attempt(
            session_id,
            ply=1,
            attempted_uci="e2e4",
            result="best",
        )

        listed = self.service.list_sessions_for_game(self.game_id)
        detail = self.service.get_session(session_id)
        abandoned = self.service.abandon_session(session_id)
        after_abandon = self.service.get_session(session_id)

        self.assertEqual(len(listed["sessions"]), 1)
        self.assertEqual(detail["session_id"], session_id)
        self.assertEqual(len(detail["items"]), 6)
        self.assertEqual(len(detail["attempts"]), 1)
        self.assertEqual(abandoned["status"], "abandoned")
        self.assertEqual(after_abandon["summary"]["attempt_count"], 1)
        self.assertEqual(after_abandon["status"], "abandoned")


if __name__ == "__main__":
    unittest.main()
