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
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class NoEngineReviewService:
    def __init__(self, review: dict[str, Any]) -> None:
        self.review = review

    def get_review(self, game_id: int, profile: str = "standard") -> dict[str, Any]:
        _ = profile
        payload = dict(self.review)
        payload["game_id"] = game_id
        return payload

    def generate_review(self, *_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("Practice must not generate analysis")

    def rebuild_review_metrics_from_cached_analyses(self, *_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("Practice must not rebuild by calling engine paths")


class ReviewPracticeNoEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-practice-no-engine-"))
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

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_practice_flow_uses_review_payload_only(self) -> None:
        review = {
            "game_id": self.game_id,
            "status": "done",
            "user_color": "white",
            "move_annotations": [
                {
                    "ply": 1,
                    "move_number": 1,
                    "color": "white",
                    "side": "white",
                    "san": "e4",
                    "uci": "e2e4",
                    "fen_before": START_FEN,
                    "fen_after": START_FEN,
                    "primary_category": "critical",
                    "category_label": "Critique",
                    "tags": ["missed_opportunity"],
                    "win_loss": 20.0,
                    "move_accuracy": 35.0,
                    "best_move_uci": "e2e4",
                    "best_move_san": "e4",
                    "try_move_supported": True,
                    "acceptable_moves": [
                        {
                            "uci": "e2e4",
                            "san": "e4",
                            "quality": "best",
                            "delta_from_best_win_percent": 0.0,
                        }
                    ],
                    "pedagogical_explanation": {"error_type": "tactical"},
                    "pv_line": [],
                    "pv_line_available": False,
                }
            ],
            "review_sections": {
                "to_review": [],
                "strong_moves": [],
                "missed_opportunities": [],
                "all": [],
            },
        }
        service = ReviewPracticeService(
            self.db_path,
            review_service=NoEngineReviewService(review),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="user", max_items=5)
        summary = service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="e2e4",
            result="best",
        )

        self.assertEqual(summary["correct_count"], 1)

    def test_history_retry_failed_and_abandon_do_not_call_engine_paths(self) -> None:
        review = {
            "game_id": self.game_id,
            "status": "done",
            "user_color": "white",
            "move_annotations": [
                {
                    "ply": 1,
                    "move_number": 1,
                    "color": "white",
                    "side": "white",
                    "san": "e4",
                    "uci": "e2e4",
                    "fen_before": START_FEN,
                    "fen_after": START_FEN,
                    "primary_category": "critical",
                    "tags": ["missed_opportunity"],
                    "win_loss": 20.0,
                    "best_move_uci": "e2e4",
                    "best_move_san": "e4",
                    "try_move_supported": True,
                    "acceptable_moves": [],
                    "pedagogical_explanation": {"error_type": "tactical"},
                }
            ],
            "review_sections": {
                "to_review": [],
                "strong_moves": [],
                "missed_opportunities": [],
                "all": [],
            },
        }
        service = ReviewPracticeService(
            self.db_path,
            review_service=NoEngineReviewService(review),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="user", max_items=5)
        service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="d2d4",
            result="wrong",
        )
        retry = service.retry_failed_session(int(session["session_id"]))
        listed = service.list_sessions_for_game(self.game_id)
        abandoned = service.abandon_session(int(retry["session_id"]))

        self.assertEqual([item["ply"] for item in retry["items"]], [1])
        self.assertEqual(len(listed["sessions"]), 2)
        self.assertEqual(abandoned["status"], "abandoned")


if __name__ == "__main__":
    unittest.main()
