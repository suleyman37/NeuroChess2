from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.try_move import (  # noqa: E402
    TRY_MOVE_MODEL_VERSION,
    build_try_move_payload,
    build_pv_line,
    evaluate_try_move_attempt,
)


FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class TryMoveModelTests(unittest.TestCase):
    def test_best_very_good_acceptable_and_wrong_feedback(self) -> None:
        payload = build_try_move_payload(
            fen_before=FEN,
            side="white",
            best_move_uci="e2e4",
            top_moves=[
                {"uci": "e2e4", "eval_cp": 100, "mate_in": None},
                {"uci": "d2d4", "eval_cp": 90, "mate_in": None},
                {"uci": "g1f3", "eval_cp": 55, "mate_in": None},
                {"uci": "a2a3", "eval_cp": -200, "mate_in": None},
            ],
        )

        annotation = {"fen_before": FEN, "best_move_uci": "e2e4", **payload}

        self.assertTrue(payload["try_move_supported"])
        self.assertEqual(payload["try_move_model_version"], TRY_MOVE_MODEL_VERSION)
        self.assertEqual(evaluate_try_move_attempt("e2e4", annotation)["result"], "best")
        self.assertEqual(
            evaluate_try_move_attempt("d2d4", annotation)["result"],
            "very_good",
        )
        self.assertEqual(
            evaluate_try_move_attempt("g1f3", annotation)["result"],
            "acceptable",
        )
        self.assertEqual(evaluate_try_move_attempt("a2a3", annotation)["result"], "wrong")
        self.assertEqual(evaluate_try_move_attempt("e2e5", annotation)["result"], "illegal")

    def test_no_top_moves_accepts_only_best(self) -> None:
        payload = build_try_move_payload(
            fen_before=FEN,
            side="white",
            best_move_uci="e2e4",
            top_moves=[],
        )

        self.assertEqual([move["uci"] for move in payload["acceptable_moves"]], ["e2e4"])
        self.assertFalse(payload["pv_line_available"])

    def test_missing_best_move_disables_try_move(self) -> None:
        payload = build_try_move_payload(
            fen_before=FEN,
            side="white",
            best_move_uci=None,
            top_moves=[],
        )

        self.assertFalse(payload["try_move_supported"])
        self.assertEqual(payload["acceptable_moves"], [])

    def test_pv_line_is_limited_and_stops_on_illegal_move(self) -> None:
        line = build_pv_line(
            FEN,
            {"pv": ["e2e4", "e7e5", "g1f3", "a1a8", "d2d4"]},
        )

        self.assertEqual([move["uci"] for move in line], ["e2e4", "e7e5", "g1f3"])
        self.assertTrue(all("fen_after" in move for move in line))

    def test_pv_line_missing_is_empty(self) -> None:
        self.assertEqual(build_pv_line(FEN, {"uci": "e2e4"}), [])


if __name__ == "__main__":
    unittest.main()
