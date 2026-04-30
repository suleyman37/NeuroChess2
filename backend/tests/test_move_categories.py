from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.move_categories import (  # noqa: E402
    MOVE_CATEGORY_FORMULA_VERSION,
    REVIEW_SECTIONS_VERSION,
    build_review_sections,
    categorize_review_move,
)


def metric_move(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "ply": 1,
        "side": "white",
        "san": "Nf3",
        "uci": "g1f3",
        "win_loss": 0.0,
        "move_accuracy": 100.0,
        "player_percent_before": 50.0,
        "player_percent_after": 50.0,
        "criticality_score": 0.0,
        "persistence_weight": 1.0,
        "cluster_weight": 1.0,
        "review_evidence": {"top_moves": []},
    }
    payload.update(overrides)
    return payload


class MoveCategoryTests(unittest.TestCase):
    def test_zero_win_loss_is_best(self) -> None:
        result = categorize_review_move(metric_move(win_loss=0.0, move_accuracy=100.0))

        self.assertEqual(result["primary_category"], "best")
        self.assertEqual(result["move_category_formula_version"], MOVE_CATEGORY_FORMULA_VERSION)

    def test_low_loss_categories_are_excellent_and_very_good(self) -> None:
        excellent = categorize_review_move(metric_move(win_loss=1.5, move_accuracy=96.0))
        very_good = categorize_review_move(metric_move(win_loss=3.5, move_accuracy=91.0))

        self.assertEqual(excellent["primary_category"], "excellent")
        self.assertEqual(very_good["primary_category"], "very_good")

    def test_medium_and_high_losses_are_training_categories(self) -> None:
        playable = categorize_review_move(metric_move(win_loss=10.0, move_accuracy=70.0))
        inexact = categorize_review_move(metric_move(win_loss=18.0, move_accuracy=50.0))
        critical = categorize_review_move(metric_move(win_loss=42.0, move_accuracy=20.0))

        self.assertEqual(playable["primary_category"], "playable")
        self.assertEqual(inexact["primary_category"], "inexact")
        self.assertEqual(critical["primary_category"], "critical")

    def test_book_move_is_book_by_default(self) -> None:
        result = categorize_review_move(metric_move(is_book=True, win_loss=0.1))

        self.assertEqual(result["primary_category"], "book")
        self.assertIn("book", result["tags"])

    def test_missed_opportunity_uses_top_move_gain(self) -> None:
        result = categorize_review_move(
            metric_move(
                uci="g1f3",
                win_loss=16.0,
                move_accuracy=55.0,
                player_percent_after=40.0,
                review_evidence={
                    "top_moves": [
                        {"uci": "e2e4", "eval_cp": 220, "mate_in": None},
                    ],
                },
            )
        )

        self.assertIn("missed_opportunity", result["tags"])
        self.assertGreaterEqual(result["missed_gain"], 10.0)

    def test_conversion_and_defensive_tags_are_independent(self) -> None:
        conversion = categorize_review_move(
            metric_move(
                player_percent_before=82.0,
                player_percent_after=65.0,
                win_loss=17.0,
                move_accuracy=50.0,
            )
        )
        defensive = categorize_review_move(
            metric_move(
                player_percent_before=30.0,
                player_percent_after=28.0,
                win_loss=2.0,
                move_accuracy=80.0,
                review_evidence={
                    "top_moves": [
                        {"uci": "e2e4", "eval_cp": 120, "mate_in": None},
                    ],
                },
            )
        )

        self.assertIn("conversion_issue", conversion["tags"])
        self.assertIn("defensive_resource_missed", defensive["tags"])

    def test_persistence_and_cluster_tags(self) -> None:
        result = categorize_review_move(
            metric_move(persistence_weight=1.2, cluster_weight=1.18)
        )

        self.assertIn("persistent_loss", result["tags"])
        self.assertIn("cluster", result["tags"])

    def test_missing_data_is_unknown_without_crashing(self) -> None:
        result = categorize_review_move(
            metric_move(win_loss=None, move_accuracy=None, review_evidence={})
        )

        self.assertEqual(result["primary_category"], "unknown")


class ReviewSectionTests(unittest.TestCase):
    def test_sections_group_annotations(self) -> None:
        critical = {
            **categorize_review_move(metric_move(ply=5, win_loss=40.0, move_accuracy=20.0)),
            "ply": 5,
            "move_accuracy": 20.0,
            "criticality_score": 30.0,
        }
        strong = {
            **categorize_review_move(
                metric_move(
                    ply=3,
                    win_loss=1.0,
                    move_accuracy=98.0,
                    player_percent_before=50.0,
                )
            ),
            "ply": 3,
            "move_accuracy": 98.0,
            "criticality_score": 0.0,
        }
        missed = {
            **categorize_review_move(
                metric_move(
                    ply=7,
                    win_loss=15.0,
                    move_accuracy=55.0,
                    player_percent_after=40.0,
                    review_evidence={
                        "top_moves": [
                            {"uci": "e2e4", "eval_cp": 220, "mate_in": None},
                        ],
                    },
                )
            ),
            "ply": 7,
            "move_accuracy": 55.0,
            "criticality_score": 12.0,
        }

        sections = build_review_sections([missed, critical, strong])

        self.assertEqual(REVIEW_SECTIONS_VERSION, "neuro_review_sections_v1")
        self.assertEqual(sections["to_review"][0]["ply"], 5)
        self.assertEqual(sections["strong_moves"][0]["ply"], 3)
        self.assertEqual(sections["missed_opportunities"][0]["ply"], 7)
        self.assertEqual([item["ply"] for item in sections["all"]], [3, 5, 7])


if __name__ == "__main__":
    unittest.main()
