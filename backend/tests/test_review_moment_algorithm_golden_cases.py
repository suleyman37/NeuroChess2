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

from neurochess.metrics.move_categories import build_review_sections  # noqa: E402
from neurochess.metrics.review_moment_importance import (  # noqa: E402
    GOOD_DECISION,
    INFORMATIONAL,
    MICRO_GAP,
    NO_MAJOR_MOMENT,
    PRIORITY_TRAINING,
    SECONDARY_TRAINING,
    classify_review_moment_importance,
    no_major_moment_payload,
)
from neurochess.review_practice_service import (  # noqa: E402
    build_review_practice_items_from_review,
    practice_revision_delay_days,
)
from neurochess.review_service import (  # noqa: E402
    _is_low_impact_opening_drift,
    _moment_selection_summary,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "metrics_algorithm_validation_cases.json"
)
START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def load_cases() -> dict[str, dict[str, object]]:
    return {
        str(case["case_id"]): case
        for case in json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    }


def annotation_from_case(case: dict[str, object]) -> dict[str, object]:
    metrics = dict(case["move_metrics"])  # type: ignore[arg-type]
    metrics.update(classify_review_moment_importance(metrics))
    best = str(metrics.get("best_move_uci") or case["best_move"])
    return {
        "ply": int(metrics.get("ply") or 1),
        "move_number": (int(metrics.get("ply") or 1) + 1) // 2,
        "color": case["player_color"],
        "side": case["player_color"],
        "san": "e4",
        "uci": str(case["move_played"]),
        "fen_before": START_FEN,
        "fen_after": START_FEN,
        "best_move_uci": best,
        "best_move_san": "e4",
        "try_move_supported": bool(best),
        "acceptable_moves": [{"uci": best, "san": "e4", "quality": "best"}],
        **metrics,
    }


class ReviewMomentAlgorithmGoldenCaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cases = load_cases()

    def test_required_moment_categories_match_golden_matrix(self) -> None:
        expected_cases = {
            "near_equal_micro_drift": MICRO_GAP,
            "opening_harmless_preference": MICRO_GAP,
            "early_tactical_real_blunder": PRIORITY_TRAINING,
            "meaningful_middlegame_mistake": PRIORITY_TRAINING,
            "already_lost_small_further_loss": SECONDARY_TRAINING,
            "winning_position_throws_win": PRIORITY_TRAINING,
            "good_decision_non_trivial": GOOD_DECISION,
            "trivial_forced_recapture": INFORMATIONAL,
            "hard_only_move_defensive_resource": GOOD_DECISION,
            "mate_terminal_edge_case": PRIORITY_TRAINING,
        }

        for case_id, expected in expected_cases.items():
            with self.subTest(case_id=case_id):
                case = self.cases[case_id]
                payload = classify_review_moment_importance(
                    case["move_metrics"]  # type: ignore[arg-type]
                )

                self.assertEqual(payload["moment_importance"], expected)
                self.assertEqual(payload["moment_importance"], case["expected_moment_importance"])
                self.assertEqual(
                    payload["is_training_recommended"],
                    bool(case["expected_training_item_recommended"]),
                )

    def test_opening_low_impact_gate_filters_harmless_but_not_tactical(self) -> None:
        harmless = self.cases["opening_harmless_preference"]
        harmless_metrics = harmless["move_metrics"]
        self.assertIsInstance(harmless_metrics, dict)

        self.assertTrue(
            _is_low_impact_opening_drift(
                ply=int(harmless_metrics["ply"]),
                mate_event=False,
                mover_win_loss=float(harmless_metrics["win_loss"]),
                criticality=float(harmless_metrics["criticality_score"]),
                player_percent_before=float(harmless_metrics["player_percent_before"]),
                player_percent_after=float(harmless_metrics["player_percent_after"]),
            )
        )

        tactical = self.cases["early_tactical_real_blunder"]
        tactical_metrics = tactical["move_metrics"]
        self.assertIsInstance(tactical_metrics, dict)

        self.assertFalse(
            _is_low_impact_opening_drift(
                ply=int(tactical_metrics["ply"]),
                mate_event=False,
                mover_win_loss=float(tactical_metrics["win_loss"]),
                criticality=float(tactical_metrics["criticality_score"]),
                player_percent_before=float(tactical_metrics["player_percent_before"]),
                player_percent_after=float(tactical_metrics["player_percent_after"]),
            )
        )

    def test_clean_high_accuracy_review_reports_no_major_moment(self) -> None:
        sections = build_review_sections(
            [
                annotation_from_case(self.cases["opening_harmless_preference"]),
                annotation_from_case(self.cases["good_decision_non_trivial"]),
            ]
        )
        summary = _moment_selection_summary(sections)

        self.assertEqual(no_major_moment_payload()["moment_importance"], NO_MAJOR_MOMENT)
        self.assertTrue(summary["no_major_moment"])
        self.assertEqual(summary["label"], "Aucun moment majeur")
        self.assertEqual(summary["priority_training_count"], 0)
        self.assertEqual(summary["micro_gap_count"], 1)
        self.assertEqual(summary["good_decision_count"], 1)

    def test_training_item_safety_excludes_non_training_categories(self) -> None:
        priority = annotation_from_case(self.cases["early_tactical_real_blunder"])
        micro = annotation_from_case(self.cases["opening_harmless_preference"])
        good = annotation_from_case(self.cases["good_decision_non_trivial"])
        informational = annotation_from_case(self.cases["trivial_forced_recapture"])
        review = {
            "status": "done",
            "user_color": "white",
            "move_annotations": [micro, good, informational, priority],
        }

        items = build_review_practice_items_from_review(review, pov="both")

        self.assertEqual([item["ply"] for item in items], [priority["ply"]])
        self.assertEqual(items[0]["moment_importance"], PRIORITY_TRAINING)

    def test_due_at_semantics_are_unchanged_by_soft_or_non_training_categories(self) -> None:
        self.assertIsNone(practice_revision_delay_days("playable"))
        self.assertIsNone(practice_revision_delay_days("imprecise"))
        self.assertIsNone(practice_revision_delay_days("needs_rebuild"))
        self.assertIsNone(practice_revision_delay_days("skipped"))
        self.assertEqual(practice_revision_delay_days("wrong"), 1)
        self.assertEqual(practice_revision_delay_days("illegal"), 1)
        self.assertEqual(practice_revision_delay_days("revealed"), 1)
        self.assertEqual(practice_revision_delay_days("best"), 7)
        self.assertEqual(practice_revision_delay_days("acceptable", hint_used=True), 3)

    def test_importance_payload_exposes_safe_labels_not_raw_scores(self) -> None:
        case = self.cases["winning_position_throws_win"]
        payload = classify_review_moment_importance(
            case["move_metrics"]  # type: ignore[arg-type]
        )

        self.assertIn("moment_label", payload)
        self.assertIn("moment_reason", payload)
        self.assertNotIn("criticality_score", payload)
        self.assertNotIn("priority_score", payload)
        self.assertNotIn("raw_wdl", payload)
        self.assertNotIn("diagnostic_gap", payload)


if __name__ == "__main__":
    unittest.main()
