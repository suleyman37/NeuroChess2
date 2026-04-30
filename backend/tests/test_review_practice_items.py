from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.review_practice_service import (  # noqa: E402
    build_review_practice_items_from_review,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def annotation(
    ply: int,
    *,
    color: str,
    category: str,
    tags: list[str] | None = None,
    try_supported: bool = True,
    best_move: str | None = "e2e4",
    win_loss: float = 10.0,
) -> dict[str, object]:
    return {
        "ply": ply,
        "move_number": (ply + 1) // 2,
        "color": color,
        "side": color,
        "san": "e4" if color == "white" else "e5",
        "uci": "e2e4" if color == "white" else "e7e5",
        "fen_before": START_FEN,
        "fen_after": START_FEN,
        "primary_category": category,
        "category_label": category,
        "tags": tags or [],
        "tag_labels": tags or [],
        "win_loss": win_loss,
        "move_accuracy": 60.0,
        "best_move_uci": best_move,
        "best_move_san": "e4" if best_move else None,
        "try_move_supported": try_supported,
        "acceptable_moves": [
            {
                "uci": best_move,
                "san": "e4",
                "quality": "best",
                "delta_from_best_win_percent": 0.0,
            }
        ]
        if best_move
        else [],
        "pedagogical_explanation": {
            "error_type": "tactical",
            "main_message": "Tu as probablement rate une ressource tactique.",
        },
        "contrast_coach_explanation": {
            "what_happened_after_played": "Apres le coup joue, l'adversaire repond.",
            "why_solution_is_better": "La solution force une reponse.",
        },
        "pv_line": [],
        "pv_line_available": False,
        "pv_contrast_evidence": {
            "available": True,
            "played_branch": {"pv": [{"uci": "e2e4"}]},
            "best_branch": {"pv": [{"uci": "e2e4"}]},
            "contrast": {"main_difference_type": "forcing"},
        },
    }


class ReviewPracticeItemsTests(unittest.TestCase):
    def test_selects_top_five_without_duplicates_and_sorts_priority(self) -> None:
        duplicate = annotation(3, color="white", category="critical", win_loss=99)
        review = {
            "status": "done",
            "user_color": "white",
            "move_annotations": [
                annotation(9, color="white", category="inexact", win_loss=8),
                annotation(5, color="white", category="to_review", win_loss=15),
                annotation(7, color="white", category="good", tags=["missed_opportunity"], win_loss=12),
                annotation(3, color="white", category="critical", win_loss=30),
                duplicate,
                annotation(11, color="white", category="decisive", win_loss=40),
                annotation(13, color="white", category="playable", tags=["cluster"], win_loss=9),
            ],
        }

        items = build_review_practice_items_from_review(review, pov="white", max_items=5)

        self.assertEqual(len(items), 5)
        self.assertEqual([item["ply"] for item in items][:2], [11, 3])
        self.assertEqual(len({item["ply"] for item in items}), len(items))

    def test_respects_white_black_user_and_both_pov(self) -> None:
        review = {
            "status": "done",
            "user_color": "black",
            "move_annotations": [
                annotation(1, color="white", category="critical"),
                annotation(2, color="black", category="critical"),
            ],
        }

        self.assertEqual(
            [item["color"] for item in build_review_practice_items_from_review(review, pov="white")],
            ["white"],
        )
        self.assertEqual(
            [item["color"] for item in build_review_practice_items_from_review(review, pov="black")],
            ["black"],
        )
        self.assertEqual(
            [item["color"] for item in build_review_practice_items_from_review(review, pov="user")],
            ["black"],
        )
        self.assertEqual(
            {item["color"] for item in build_review_practice_items_from_review(review, pov="both")},
            {"white", "black"},
        )

    def test_excludes_items_without_try_move_or_best_move(self) -> None:
        review = {
            "status": "done",
            "move_annotations": [
                annotation(1, color="white", category="critical", try_supported=False),
                annotation(2, color="black", category="critical", best_move=None),
                annotation(3, color="white", category="critical"),
            ],
        }

        items = build_review_practice_items_from_review(review, pov="both")

        self.assertEqual([item["ply"] for item in items], [3])

    def test_practice_items_keep_contrast_evidence_for_feedback(self) -> None:
        review = {
            "status": "done",
            "move_annotations": [
                annotation(3, color="white", category="critical"),
            ],
        }

        item = build_review_practice_items_from_review(review, pov="both")[0]

        self.assertIn("contrast_coach_explanation", item)
        self.assertIn("pv_contrast_evidence", item)
        self.assertEqual(
            item["contrast_coach_explanation"]["why_solution_is_better"],
            "La solution force une reponse.",
        )


if __name__ == "__main__":
    unittest.main()
