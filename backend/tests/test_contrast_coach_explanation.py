from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.pedagogy import (  # noqa: E402
    CONTRAST_COACH_EXPLANATION_VERSION,
    build_contrast_coach_explanation,
)


def annotation(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "ply": 17,
        "san": "Qxb7",
        "best_move_san": "Bxf7+",
        "pedagogical_explanation": {
            "training_takeaway": "Verifie les coups forcing avant de prendre du materiel.",
            "confidence": "medium",
        },
        "pv_contrast_evidence": {
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
                    "Le meilleur coup est plus forcing que le coup joue."
                ],
            },
        },
    }
    payload.update(overrides)
    return payload


class ContrastCoachExplanationTests(unittest.TestCase):
    def test_opponent_reply_and_forcing_sentence_are_used(self) -> None:
        result = build_contrast_coach_explanation(annotation())

        self.assertEqual(
            result["contrast_coach_explanation_version"],
            CONTRAST_COACH_EXPLANATION_VERSION,
        )
        self.assertIn("Nxe4", result["what_happened_after_played"])
        self.assertIn("forcing", result["why_solution_is_better"])
        self.assertEqual(result["main_difference_type"], "forcing")
        self.assertIn("Bxf7+", result["line_explanation"])

    def test_conversion_defense_and_low_confidence_are_prudent(self) -> None:
        conversion = build_contrast_coach_explanation(
            annotation(
                pv_contrast_evidence={
                    "available": True,
                    "confidence": "medium",
                    "contrast": {"main_difference_type": "conversion"},
                }
            )
        )
        defense = build_contrast_coach_explanation(
            annotation(
                pv_contrast_evidence={
                    "available": True,
                    "confidence": "medium",
                    "contrast": {"main_difference_type": "defense"},
                }
            )
        )
        low = build_contrast_coach_explanation(
            annotation(
                pv_contrast_evidence={
                    "available": True,
                    "confidence": "low",
                    "contrast": {"main_difference_type": "unknown"},
                }
            )
        )

        self.assertIn("conversion", conversion["why_solution_is_better"])
        self.assertIn("resistance", defense["why_solution_is_better"])
        self.assertIn("partielles", low["line_explanation"])

    def test_missing_evidence_falls_back_without_inventing_moves(self) -> None:
        result = build_contrast_coach_explanation(
            annotation(pv_contrast_evidence=None, best_move_san="Bxf7+")
        )

        self.assertFalse(result["available"])
        self.assertNotIn("Bxf7+", result["why_solution_is_better"])
        self.assertNotIn("Nxe4", result["what_happened_after_played"])
        self.assertEqual(result["confidence"], "medium")


if __name__ == "__main__":
    unittest.main()
