from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.pedagogy import (  # noqa: E402
    PEDAGOGICAL_EXPLANATION_VERSION,
    build_pedagogical_explanation,
    compact_label,
    impact_label,
    move_quality_label,
)


def annotation(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "ply": 17,
        "move_number": 9,
        "color": "white",
        "san": "Qxb7",
        "uci": "d1b7",
        "primary_category": "to_review",
        "category_label": "À revoir",
        "tags": [],
        "win_loss": 12.0,
        "move_accuracy": 58.0,
        "missed_gain": 0.0,
        "player_win_percent_before": 52.0,
        "player_win_percent_after": 40.0,
        "persistence_weight": 1.0,
        "cluster_weight": 1.0,
        "best_move_san": "Bxf7+",
    }
    payload.update(overrides)
    return payload


class PedagogicalExplanationTests(unittest.TestCase):
    def test_missed_opportunity_with_forcing_best_move_is_tactical(self) -> None:
        result = build_pedagogical_explanation(
            annotation(tags=["missed_opportunity"], best_move_san="Bxf7+")
        )

        self.assertEqual(result["error_type"], "tactical")
        self.assertIn("ressource tactique", result["main_message"])
        self.assertEqual(
            result["pedagogical_explanation_version"],
            PEDAGOGICAL_EXPLANATION_VERSION,
        )

    def test_conversion_defensive_cluster_and_positional_rules(self) -> None:
        self.assertEqual(
            build_pedagogical_explanation(
                annotation(tags=["conversion_issue"], player_win_percent_before=82.0)
            )["error_type"],
            "conversion",
        )
        self.assertEqual(
            build_pedagogical_explanation(
                annotation(
                    tags=["defensive_resource_missed"],
                    player_win_percent_before=30.0,
                    missed_gain=14.0,
                )
            )["error_type"],
            "defensive",
        )
        self.assertEqual(
            build_pedagogical_explanation(
                annotation(tags=["cluster"], cluster_weight=1.18)
            )["error_type"],
            "cluster",
        )
        self.assertEqual(
            build_pedagogical_explanation(
                annotation(
                    tags=["persistent_loss"],
                    persistence_weight=1.2,
                    best_move_san=None,
                )
            )["error_type"],
            "positional",
        )

    def test_strong_find_and_fallback(self) -> None:
        strong = build_pedagogical_explanation(
            annotation(
                primary_category="excellent",
                tags=["strong_find"],
                win_loss=1.0,
                move_accuracy=98.0,
            )
        )
        fallback = build_pedagogical_explanation(
            annotation(
                primary_category="unknown",
                tags=[],
                win_loss=None,
                move_accuracy=None,
                best_move_san=None,
            )
        )

        self.assertEqual(strong["error_type"], "strong_find")
        self.assertEqual(fallback["error_type"], "unknown")
        for key in (
            "main_message",
            "missed_idea",
            "why_played_move_bad",
            "why_best_move_good",
            "training_takeaway",
        ):
            self.assertIsInstance(fallback[key], str)
            self.assertTrue(fallback[key])

    def test_pv_contrast_improves_safe_template(self) -> None:
        result = build_pedagogical_explanation(
            annotation(
                pv_contrast_evidence={
                    "available": True,
                    "confidence": "high",
                    "played_branch": {
                        "opponent_best_reply_san": "Nxe4",
                        "pv": [{"san": "Qxb7"}, {"san": "Nxe4"}],
                    },
                    "best_branch": {
                        "pv": [{"san": "Bxf7+"}, {"san": "Kxf7"}],
                    },
                    "contrast": {
                        "main_difference_type": "forcing",
                        "safe_explanation_bullets": [
                            "The best line is more forcing than the played line."
                        ],
                    },
                }
            )
        )

        self.assertIn("forcing", result["main_message"])
        self.assertIn("Nxe4", result["why_played_move_bad"])
        self.assertIn("Bxf7+", result["why_best_move_good"])

    def test_compact_labels_and_human_labels(self) -> None:
        payload = annotation()
        explanation = build_pedagogical_explanation(payload)

        self.assertEqual(impact_label(1.0), "négligeable")
        self.assertEqual(impact_label(8.0), "important")
        self.assertEqual(move_quality_label(97.0), "Excellente")
        self.assertIn("Coup 9", compact_label(payload, explanation))


if __name__ == "__main__":
    unittest.main()
