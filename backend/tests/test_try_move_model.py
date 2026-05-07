from __future__ import annotations

import json
import sys
import tempfile
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
    quality_from_best_delta,
)
from neurochess.data.database import init_db  # noqa: E402
from neurochess.review_try_move_stabilization import (  # noqa: E402
    enrich_annotation_with_stable_attempt_evaluation,
)


FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
FEN_BXF7 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"


class TryMoveModelTests(unittest.TestCase):
    def test_best_very_good_acceptable_playable_and_imprecise_candidates(self) -> None:
        payload = build_try_move_payload(
            fen_before=FEN,
            side="white",
            best_move_uci="e2e4",
            top_moves=[
                {"uci": "e2e4", "eval_cp": 100, "mate_in": None},
                {"uci": "d2d4", "eval_cp": 90, "mate_in": None},
                {"uci": "g1f3", "eval_cp": 50, "mate_in": None},
                {"uci": "c2c4", "eval_cp": 20, "mate_in": None},
                {"uci": "b1c3", "eval_cp": -20, "mate_in": None},
                {"uci": "a2a3", "eval_cp": -200, "mate_in": None},
            ],
        )

        annotation = {"fen_before": FEN, "best_move_uci": "e2e4", **payload}
        qualities = {move["uci"]: move["quality"] for move in payload["candidate_moves"]}

        self.assertTrue(payload["try_move_supported"])
        self.assertEqual(payload["try_move_model_version"], TRY_MOVE_MODEL_VERSION)
        self.assertEqual(qualities["e2e4"], "best")
        self.assertEqual(qualities["d2d4"], "very_good")
        self.assertEqual(qualities["g1f3"], "acceptable")
        self.assertEqual(qualities["c2c4"], "playable")
        self.assertEqual(qualities["b1c3"], "imprecise")
        self.assertNotIn("a2a3", qualities)
        self.assertEqual(evaluate_try_move_attempt("e2e4", annotation)["result"], "best")
        self.assertEqual(
            evaluate_try_move_attempt("d2d4", annotation)["result"],
            "very_good",
        )
        self.assertEqual(
            evaluate_try_move_attempt("g1f3", annotation)["result"],
            "acceptable",
        )
        self.assertEqual(evaluate_try_move_attempt("c2c4", annotation)["result"], "playable")
        self.assertEqual(evaluate_try_move_attempt("b1c3", annotation)["result"], "imprecise")
        self.assertEqual(
            evaluate_try_move_attempt("a2a3", annotation)["result"],
            "needs_rebuild",
        )
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

    def test_quality_bands_are_conservative_and_attempt_only(self) -> None:
        self.assertEqual(quality_from_best_delta(0.0), "very_good")
        self.assertEqual(quality_from_best_delta(2.01), "acceptable")
        self.assertEqual(quality_from_best_delta(5.01), "playable")
        self.assertEqual(quality_from_best_delta(8.01), "imprecise")
        self.assertEqual(quality_from_best_delta(14.01), "wrong")

    def test_out_of_list_stable_eval_classifies_playable_imprecise_wrong(self) -> None:
        base_annotation = {
            "fen_before": FEN,
            "best_move_uci": "e2e4",
            "top_moves": [{"uci": "e2e4", "eval_cp": 100, "mate_in": None}],
            "acceptable_moves": [{"uci": "e2e4", "quality": "best"}],
        }

        playable = evaluate_try_move_attempt(
            "a3",
            {
                **base_annotation,
                "stable_attempt_evaluation": {
                    "uci": "a2a3",
                    "eval_cp": 20,
                    "mate_in": None,
                    "source_kind": "unit_stable_eval",
                },
            },
        )
        imprecise = evaluate_try_move_attempt(
            "a3",
            {
                **base_annotation,
                "stable_attempt_evaluation": {
                    "uci": "a2a3",
                    "eval_cp": -20,
                    "mate_in": None,
                    "source_kind": "unit_stable_eval",
                },
            },
        )
        wrong = evaluate_try_move_attempt(
            "a3",
            {
                **base_annotation,
                "stable_attempt_evaluation": {
                    "uci": "a2a3",
                    "eval_cp": -80,
                    "mate_in": None,
                    "source_kind": "unit_stable_eval",
                },
            },
        )

        self.assertEqual(playable["result"], "playable")
        self.assertFalse(playable["show_best_move"])
        self.assertEqual(playable["reason_code"], "stable_attempt_eval_loss_band")
        self.assertEqual(imprecise["result"], "imprecise")
        self.assertTrue(imprecise["show_best_move"])
        self.assertEqual(wrong["result"], "wrong")
        self.assertTrue(wrong["show_best_move"])

    def test_out_of_list_without_stable_eval_is_needs_rebuild_not_wrong(self) -> None:
        feedback = evaluate_try_move_attempt(
            "a3",
            {
                "fen_before": FEN,
                "best_move_uci": "e2e4",
                "top_moves": [{"uci": "e2e4", "eval_cp": 100, "mate_in": None}],
            },
        )

        self.assertEqual(feedback["result"], "needs_rebuild")
        self.assertFalse(feedback["show_best_move"])
        self.assertEqual(
            feedback["reason_code"],
            "stable_evaluation_required_for_legal_out_of_list",
        )

    def test_out_of_list_attempt_can_be_enriched_by_bounded_stable_eval(self) -> None:
        class FakeAnalysisService:
            def __init__(self, db_path: Path) -> None:
                self.db_path = db_path
                self.calls: list[dict[str, object]] = []

            def get_or_create_analysis(self, **kwargs: object) -> dict[str, object]:
                self.calls.append(kwargs)
                return {"id": 42, "status": "pending"}

            def run_analysis(self, analysis_id: int) -> dict[str, object]:
                return {
                    "id": analysis_id,
                    "status": "done",
                    "analysis_json": {
                        "stabilized_eval": {
                            "final_eval_cp": 20,
                            "final_mate_in": None,
                            "reliability_score": 0.9,
                            "reliability_label": "stable",
                        }
                    },
                }

        with tempfile.TemporaryDirectory(prefix="try-move-stable-") as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            init_db(db_path)
            service = FakeAnalysisService(db_path)
            annotation = {
                "fen_before": FEN,
                "best_move_uci": "e2e4",
                "top_moves": [{"uci": "e2e4", "eval_cp": 100, "mate_in": None}],
            }

            enriched = enrich_annotation_with_stable_attempt_evaluation(
                annotation,
                "a2a3",
                service,  # type: ignore[arg-type]
            )
            feedback = evaluate_try_move_attempt("a3", enriched)

        self.assertEqual(enriched["stable_attempt_evaluation"]["uci"], "a2a3")
        self.assertEqual(enriched["stable_attempt_evaluation"]["eval_cp"], 20)
        self.assertEqual(service.calls[0]["requested_multipv"], 1)
        self.assertEqual(service.calls[0]["requested_time_ms"], 1200)
        self.assertEqual(feedback["result"], "playable")

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

        self.assertEqual(wrong["result"], "needs_rebuild")
        self.assertFalse(wrong["show_best_move"])
        self.assertEqual(illegal["result"], "illegal")
        self.assertFalse(illegal["show_best_move"])
        self.assertEqual(missing_best["result"], "needs_rebuild")
        self.assertEqual(bad_fen["result"], "needs_rebuild")


if __name__ == "__main__":
    unittest.main()
