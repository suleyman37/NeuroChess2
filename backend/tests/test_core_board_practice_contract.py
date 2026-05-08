from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.tests.test_review_practice_sessions import StaticReviewService  # noqa: E402
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import ReviewPracticeService  # noqa: E402
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
BLACK_TO_MOVE_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"


def interactive_review(game_id: int) -> dict[str, Any]:
    annotations = [
        {
            "game_id": game_id,
            "ply": 1,
            "move_number": 1,
            "color": "white",
            "side": "white",
            "san": "e4",
            "uci": "e2e4",
            "fen_before": START_FEN,
            "fen_after": BLACK_TO_MOVE_FEN,
            "primary_category": "critical",
            "category_label": "Critique",
            "tags": ["missed_opportunity"],
            "tag_labels": ["Opportunite manquee"],
            "win_loss": 25.0,
            "move_accuracy": 30.0,
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
            "pedagogical_explanation": {
                "error_type": "tactical",
                "main_message": "Tu as probablement rate une ressource tactique.",
                "why_best_move_good": "Le meilleur coup force la position.",
            },
            "pv_line": [],
            "pv_line_available": False,
            "coach_priority_rank": 1,
        },
        {
            "game_id": game_id,
            "ply": 2,
            "move_number": 1,
            "color": "black",
            "side": "black",
            "san": "e5",
            "uci": "e7e5",
            "fen_before": BLACK_TO_MOVE_FEN,
            "fen_after": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
            "primary_category": "inexact",
            "category_label": "Imprecis",
            "tags": ["cluster"],
            "win_loss": 9.0,
            "move_accuracy": 58.0,
            "best_move_uci": "e7e5",
            "best_move_san": "e5",
            "try_move_supported": True,
            "acceptable_moves": [
                {
                    "uci": "e7e5",
                    "san": "e5",
                    "quality": "best",
                    "delta_from_best_win_percent": 0.0,
                }
            ],
            "pedagogical_explanation": {"error_type": "cluster"},
            "pv_line": [],
            "pv_line_available": False,
            "coach_priority_rank": 2,
        },
    ]
    return {
        "game_id": game_id,
        "status": "done",
        "user_color": "white",
        "coverage": 1.0,
        "move_annotations": annotations,
        "review_sections": {
            "to_review": annotations,
            "strong_moves": [],
            "missed_opportunities": [annotations[0]],
            "all": annotations,
        },
    }


class CoreBoardPracticeContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-core-board-"))
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
            review_service=StaticReviewService(interactive_review(self.game_id)),  # type: ignore[arg-type]
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_practice_session_items_have_legal_fen_and_best_move(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)

        self.assertEqual(session["status"], "running")
        self.assertEqual(len(session["items"]), 2)
        for item in session["items"]:
            board = chess.Board(str(item["fen_before"]))
            best_move = chess.Move.from_uci(str(item["best_move_uci"]))
            self.assertIn(best_move, board.legal_moves)
            self.assertEqual(board.turn, chess.WHITE if item["color"] == "white" else chess.BLACK)

    def test_correct_wrong_and_illegal_board_attempts_persist_enriched_fields(self) -> None:
        session = self.service.create_session(self.game_id, pov="both", max_items=5)
        session_id = int(session["session_id"])

        correct = self.service.record_attempt(
            session_id,
            ply=1,
            attempted_uci="e2e4",
            time_spent_ms=1234,
            hint_used=False,
            reveal_used=False,
            source_context="review_practice",
        )
        wrong = self.service.record_attempt(
            session_id,
            ply=1,
            attempted_uci="d2d4",
            time_spent_ms=1500,
            hint_used=True,
            reveal_used=False,
            source_context="review_practice",
        )
        illegal = self.service.record_attempt(
            session_id,
            ply=1,
            attempted_uci="e2e5",
            time_spent_ms=1750,
            hint_used=False,
            reveal_used=False,
            source_context="review_practice",
        )

        self.assertEqual(correct["attempt_feedback"]["result"], "best")
        self.assertEqual(correct["latest_attempt"]["result"], "best")
        self.assertEqual(correct["latest_attempt"]["move_played"] if "move_played" in correct["latest_attempt"] else correct["latest_attempt"]["attempted_uci"], "e2e4")
        self.assertEqual(correct["latest_attempt"]["time_spent_ms"], 1234)
        self.assertFalse(correct["latest_attempt"]["hint_used"])
        self.assertFalse(correct["latest_attempt"]["reveal_used"])
        self.assertIsNotNone(correct["latest_attempt"]["due_at"])

        self.assertEqual(wrong["attempt_feedback"]["result"], "needs_rebuild")
        self.assertEqual(wrong["latest_attempt"]["result"], "needs_rebuild")
        self.assertTrue(wrong["latest_attempt"]["hint_used"])
        self.assertIsNone(wrong["latest_attempt"]["due_at"])

        self.assertEqual(illegal["attempt_feedback"]["result"], "illegal")
        self.assertEqual(illegal["latest_attempt"]["result"], "illegal")
        self.assertEqual(illegal["latest_attempt"]["attempted_uci"], "e2e5")
        self.assertIsNone(illegal["latest_attempt"]["attempted_san"])
        self.assertIsNotNone(illegal["latest_attempt"]["due_at"])

        detail = self.service.get_session(session_id)
        self.assertEqual(len(detail["attempts"]), 3)
        self.assertEqual(detail["summary"]["attempt_count"], 3)
        self.assertEqual(detail["summary"]["positions_worked_count"], 1)
        self.assertEqual(detail["summary"]["illegal_count"], 1)
        self.assertEqual(detail["summary"]["result_by_ply"]["1"], "illegal")

        with closing(sqlite3.connect(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT attempted_uci, result, time_spent_ms, hint_used, reveal_used,
                       source_context, due_at
                FROM review_practice_attempts
                ORDER BY id
                """
            ).fetchall()
        self.assertEqual([row[1] for row in rows], ["best", "needs_rebuild", "illegal"])
        self.assertEqual([row[0] for row in rows], ["e2e4", "d2d4", "e2e5"])
        self.assertTrue(rows[0][6])
        self.assertFalse(rows[1][6])
        self.assertTrue(rows[2][6])


if __name__ == "__main__":
    unittest.main()
