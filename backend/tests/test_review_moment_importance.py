from __future__ import annotations

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
    MICRO_GAP,
    NO_MAJOR_MOMENT,
    PRIORITY_TRAINING,
    SECONDARY_TRAINING,
    classify_review_moment_importance,
)
from neurochess.review_practice_service import (  # noqa: E402
    build_review_practice_items_from_review,
)
from neurochess.review_service import _moment_selection_summary  # noqa: E402


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def review_annotation(
    ply: int,
    *,
    primary_category: str,
    tags: list[str] | None = None,
    win_loss: float = 0.0,
    criticality_score: float = 0.0,
    move_accuracy: float = 70.0,
    best_move_uci: str | None = "e2e4",
    color: str = "white",
    player_before: float = 50.0,
    player_after: float = 50.0,
    is_book: bool = False,
) -> dict[str, object]:
    annotation: dict[str, object] = {
        "ply": ply,
        "move_number": (ply + 1) // 2,
        "color": color,
        "side": color,
        "san": "e4" if color == "white" else "e5",
        "uci": "e2e4" if color == "white" else "e7e5",
        "fen_before": START_FEN,
        "fen_after": START_FEN,
        "primary_category": primary_category,
        "category_label": primary_category,
        "tags": tags or [],
        "win_loss": win_loss,
        "criticality_score": criticality_score,
        "move_accuracy": move_accuracy,
        "player_percent_before": player_before,
        "player_percent_after": player_after,
        "best_move_uci": best_move_uci,
        "best_move_san": "e4" if best_move_uci else None,
        "try_move_supported": bool(best_move_uci),
        "acceptable_moves": [
            {
                "uci": best_move_uci,
                "san": "e4",
                "quality": "best",
                "delta_from_best_win_percent": 0.0,
            }
        ]
        if best_move_uci
        else [],
        "is_book": is_book,
    }
    annotation.update(classify_review_moment_importance(annotation))
    return annotation


class ReviewMomentImportanceTests(unittest.TestCase):
    def test_opening_negligible_move_is_micro_gap_not_priority(self) -> None:
        annotation = review_annotation(
            4,
            primary_category="book",
            tags=["book"],
            win_loss=1.5,
            criticality_score=3.0,
            is_book=True,
        )

        self.assertEqual(annotation["moment_importance"], MICRO_GAP)
        self.assertFalse(annotation["is_training_recommended"])

    def test_early_tactical_real_mistake_can_still_be_priority(self) -> None:
        annotation = review_annotation(
            5,
            primary_category="critical",
            tags=["missed_opportunity"],
            win_loss=24.0,
            criticality_score=24.0,
            player_before=57.0,
            player_after=33.0,
        )

        self.assertEqual(annotation["moment_importance"], PRIORITY_TRAINING)
        self.assertTrue(annotation["is_training_recommended"])

    def test_meaningful_middlegame_mistake_is_priority(self) -> None:
        annotation = review_annotation(
            24,
            primary_category="to_review",
            tags=["persistent_loss"],
            win_loss=18.0,
            criticality_score=20.0,
        )

        self.assertEqual(annotation["moment_importance"], PRIORITY_TRAINING)

    def test_small_real_mistake_is_secondary_not_forced(self) -> None:
        annotation = review_annotation(
            20,
            primary_category="inexact",
            tags=[],
            win_loss=9.0,
            criticality_score=11.0,
        )

        self.assertEqual(annotation["moment_importance"], SECONDARY_TRAINING)
        self.assertFalse(annotation["is_training_recommended"])

    def test_good_move_becomes_good_decision_without_positive_gain_field(self) -> None:
        annotation = review_annotation(
            18,
            primary_category="excellent",
            tags=[],
            win_loss=0.8,
            criticality_score=5.0,
            move_accuracy=98.0,
        )

        self.assertEqual(annotation["moment_importance"], GOOD_DECISION)
        self.assertTrue(annotation["is_good_decision"])

    def test_clean_review_summary_reports_no_major_moment(self) -> None:
        sections = build_review_sections(
            [
                review_annotation(
                    4,
                    primary_category="book",
                    tags=["book"],
                    win_loss=1.0,
                    criticality_score=2.0,
                    is_book=True,
                ),
                review_annotation(
                    10,
                    primary_category="excellent",
                    win_loss=0.5,
                    move_accuracy=99.0,
                ),
            ]
        )
        summary = _moment_selection_summary(sections)

        self.assertTrue(summary["no_major_moment"])
        self.assertEqual(summary["label"], "Aucun moment majeur")
        self.assertIn("micro_gaps", sections)
        self.assertEqual(summary["micro_gap_count"], 1)
        self.assertEqual(summary["good_decision_count"], 1)

    def test_practice_selection_keeps_priority_and_excludes_micro_or_good(self) -> None:
        priority = review_annotation(
            7,
            primary_category="critical",
            tags=["missed_opportunity"],
            win_loss=30.0,
            criticality_score=30.0,
        )
        micro = review_annotation(
            2,
            primary_category="book",
            tags=["book"],
            win_loss=1.0,
            is_book=True,
            color="black",
        )
        good = review_annotation(
            12,
            primary_category="excellent",
            win_loss=0.2,
            move_accuracy=99.0,
        )
        review = {
            "status": "done",
            "user_color": "white",
            "move_annotations": [micro, good, priority],
        }

        items = build_review_practice_items_from_review(review, pov="both")

        self.assertEqual([item["ply"] for item in items], [7])
        self.assertEqual(items[0]["moment_importance"], PRIORITY_TRAINING)


class NoMajorMomentPayloadTests(unittest.TestCase):
    def test_no_major_moment_constant_is_not_training_category(self) -> None:
        self.assertEqual(NO_MAJOR_MOMENT, "no_major_moment")


if __name__ == "__main__":
    unittest.main()
