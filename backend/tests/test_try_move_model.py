from __future__ import annotations

import json
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
FEN_BXF7 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"


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

    def test_san_suffix_exact_best_is_success(self) -> None:
        feedback = evaluate_try_move_attempt(
            "Bxf7+",
            {
                "fen_before": FEN_BXF7,
                "best_move_san": "Bxf7+",
                "source_context": "review_practice",
            },
        )

        self.assertEqual(feedback["result"], "best")
        self.assertFalse(feedback["show_best_move"])
        self.assertEqual(feedback["reason_code"], "exact_best_move")
        self.assertEqual(feedback["evidence"]["user_move_uci"], "c4f7")
        self.assertEqual(feedback["evidence"]["best_move_uci"], "c4f7")
        self.assertTrue(feedback["evidence"]["is_exact_best"])

    def test_san_and_uci_normalization_are_equivalent(self) -> None:
        san_user_uci_best = evaluate_try_move_attempt(
            "Bxf7+",
            {"fen_before": FEN_BXF7, "best_move_uci": "c4f7"},
        )
        uci_user_san_best = evaluate_try_move_attempt(
            "c4f7",
            {"fen_before": FEN_BXF7, "best_move_san": "Bxf7+"},
        )

        self.assertEqual(san_user_uci_best["result"], "best")
        self.assertEqual(uci_user_san_best["result"], "best")
        self.assertEqual(san_user_uci_best["evidence"]["best_move_san"], "Bxf7+")
        self.assertEqual(uci_user_san_best["evidence"]["user_move_san"], "Bxf7+")

    def test_accepted_moves_json_is_respected(self) -> None:
        feedback = evaluate_try_move_attempt(
            "d4",
            {
                "fen_before": FEN,
                "best_move_uci": "e2e4",
                "accepted_moves_json": json.dumps(
                    [{"san": "d4", "quality": "acceptable"}]
                ),
            },
        )

        self.assertEqual(feedback["result"], "acceptable")
        self.assertFalse(feedback["show_best_move"])
        self.assertTrue(feedback["evidence"]["is_accepted"])
        self.assertIn("d2d4", feedback["evidence"]["accepted_moves_uci"])

    def test_missing_accepted_moves_still_accepts_exact_best(self) -> None:
        feedback = evaluate_try_move_attempt(
            "e4",
            {"fen_before": FEN, "best_move_uci": "e2e4", "acceptable_moves": []},
        )

        self.assertEqual(feedback["result"], "best")
        self.assertEqual(feedback["evidence"]["accepted_moves_uci"], ["e2e4"])

    def test_wrong_illegal_and_legacy_rebuild_are_never_false_success(self) -> None:
        wrong = evaluate_try_move_attempt(
            "a3",
            {"fen_before": FEN, "best_move_uci": "e2e4"},
        )
        illegal = evaluate_try_move_attempt(
            "e5",
            {"fen_before": FEN, "best_move_uci": "e2e4"},
        )
        missing_best = evaluate_try_move_attempt(
            "e4",
            {"fen_before": FEN},
        )
        bad_fen = evaluate_try_move_attempt(
            "e4",
            {"fen_before": "not-a-fen", "best_move_uci": "e2e4"},
        )

        self.assertEqual(wrong["result"], "wrong")
        self.assertTrue(wrong["show_best_move"])
        self.assertEqual(illegal["result"], "illegal")
        self.assertFalse(illegal["show_best_move"])
        self.assertEqual(missing_best["result"], "needs_rebuild")
        self.assertEqual(bad_fen["result"], "needs_rebuild")


if __name__ == "__main__":
    unittest.main()
