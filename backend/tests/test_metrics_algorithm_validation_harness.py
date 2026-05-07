from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.metrics.try_move import (  # noqa: E402
    build_try_move_payload,
    evaluate_try_move_attempt,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "metrics_algorithm_validation_cases.json"
)
START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


REQUIRED_CASE_IDS = {
    "pov_symmetry_white",
    "pov_symmetry_black",
    "near_equal_micro_drift",
    "opening_harmless_preference",
    "early_tactical_real_blunder",
    "legal_outside_list_playable",
    "legal_outside_list_imprecise",
    "legal_outside_list_wrong",
    "accepted_close_pv5_candidate",
    "pv5_candidate_not_close_enough",
    "stable_evaluation_unavailable",
    "meaningful_middlegame_mistake",
    "already_lost_small_further_loss",
    "winning_position_throws_win",
    "good_decision_non_trivial",
    "trivial_forced_recapture",
    "hard_only_move_defensive_resource",
    "clean_high_accuracy_no_major",
    "training_item_safety_non_training_categories",
    "daily_plan_safety_due_at_unchanged",
    "mate_terminal_edge_case",
}


REQUIRED_FIELDS = {
    "case_id",
    "description",
    "side_to_move",
    "player_color",
    "eval_before",
    "eval_after",
    "win_percent_before",
    "win_percent_after",
    "move_played",
    "best_move",
    "top_moves_json",
    "accepted_moves_json",
    "phase",
    "is_book",
    "expected_move_quality",
    "expected_moment_importance",
    "expected_training_item_recommended",
    "reason",
}


def load_cases() -> list[dict[str, object]]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def case_by_id(case_id: str) -> dict[str, object]:
    for case in load_cases():
        if case["case_id"] == case_id:
            return case
    raise AssertionError(f"Missing fixture case: {case_id}")


def annotation_for_case(case: dict[str, object]) -> dict[str, object]:
    payload = build_try_move_payload(
        fen_before=START_FEN,
        side=str(case["side_to_move"]),
        best_move_uci=str(case["best_move"]),
        top_moves=case["top_moves_json"],  # type: ignore[arg-type]
    )
    annotation: dict[str, object] = {
        "fen_before": START_FEN,
        "best_move_uci": case["best_move"],
        **payload,
    }
    stable = case.get("stable_attempt_evaluation")
    if isinstance(stable, dict):
        annotation["stable_attempt_evaluation"] = {
            **stable,
            "source_kind": "golden_fixture_stable_eval",
        }
    return annotation


class MetricsAlgorithmValidationHarnessTests(unittest.TestCase):
    def test_fixture_matrix_has_required_schema_and_cases(self) -> None:
        cases = load_cases()
        ids = {str(case["case_id"]) for case in cases}

        self.assertTrue(REQUIRED_CASE_IDS.issubset(ids))
        self.assertGreaterEqual(len(cases), 20)
        for case in cases:
            self.assertTrue(REQUIRED_FIELDS.issubset(case), case["case_id"])
            self.assertIsInstance(case["eval_before"], dict)
            self.assertIsInstance(case["eval_after"], dict)
            self.assertIsInstance(case["top_moves_json"], list)
            self.assertIsInstance(case["accepted_moves_json"], list)
            self.assertTrue(str(case["reason"]).strip())

    def test_legal_outside_list_stable_bands_are_not_auto_wrong(self) -> None:
        for case_id in (
            "legal_outside_list_playable",
            "legal_outside_list_imprecise",
            "legal_outside_list_wrong",
        ):
            with self.subTest(case_id=case_id):
                case = case_by_id(case_id)
                feedback = evaluate_try_move_attempt(
                    str(case["move_played"]),
                    annotation_for_case(case),
                )

                self.assertEqual(feedback["result"], case["expected_move_quality"])
                self.assertEqual(
                    feedback["reason_code"],
                    "stable_attempt_eval_loss_band",
                )
                self.assertNotEqual(feedback["result"], "needs_rebuild")

    def test_stable_unavailable_is_needs_rebuild_not_wrong(self) -> None:
        case = case_by_id("stable_evaluation_unavailable")

        feedback = evaluate_try_move_attempt(
            str(case["move_played"]),
            annotation_for_case(case),
        )

        self.assertEqual(feedback["result"], "needs_rebuild")
        self.assertFalse(feedback["show_best_move"])
        self.assertEqual(
            feedback["reason_code"],
            "stable_evaluation_required_for_legal_out_of_list",
        )

    def test_close_pv5_candidate_is_accepted_only_when_close(self) -> None:
        case = case_by_id("accepted_close_pv5_candidate")

        annotation = annotation_for_case(case)
        feedback = evaluate_try_move_attempt(str(case["move_played"]), annotation)

        self.assertEqual(feedback["result"], "acceptable")
        self.assertTrue(feedback["evidence"]["is_accepted"])
        self.assertIn("g1f3", feedback["evidence"]["accepted_moves_uci"])

    def test_far_pv5_candidate_is_not_accepted_automatically(self) -> None:
        case = case_by_id("pv5_candidate_not_close_enough")

        annotation = annotation_for_case(case)
        candidate_uci = str(case["move_played"])
        candidates = {
            str(move["uci"]): move
            for move in annotation["candidate_moves"]  # type: ignore[index]
        }
        accepted = {
            str(move["uci"]): move
            for move in annotation["acceptable_moves"]  # type: ignore[index]
        }
        feedback = evaluate_try_move_attempt(candidate_uci, annotation)

        self.assertNotIn(candidate_uci, candidates)
        self.assertNotIn(candidate_uci, accepted)
        self.assertEqual(feedback["result"], "needs_rebuild")

    def test_fixture_does_not_store_raw_training_priority_scores(self) -> None:
        forbidden = {
            "raw_wdl",
            "diagnostic_gap",
            "transfer_gap",
            "expected_training_value",
            "etv",
            "fsrs",
        }

        serialized = FIXTURE_PATH.read_text(encoding="utf-8").lower()

        for token in forbidden:
            self.assertNotIn(token, serialized)


if __name__ == "__main__":
    unittest.main()
