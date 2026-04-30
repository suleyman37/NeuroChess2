from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.core.rating_math import (
    confidence_label,
    expected_score,
    explain_rating_limitations,
    format_rating_estimate,
    rating_difference_from_expected_score,
    rating_uncertainty_estimate,
)


class RatingMathTests(unittest.TestCase):
    def test_equal_ratings_expected_score_is_half(self) -> None:
        self.assertAlmostEqual(expected_score(1600, 1600), 0.5)

    def test_plus_400_rating_expected_score_is_above_point_nine(self) -> None:
        self.assertGreater(expected_score(2000, 1600), 0.9)

    def test_minus_400_rating_expected_score_is_below_point_one(self) -> None:
        self.assertLess(expected_score(1200, 1600), 0.1)

    def test_rating_difference_from_half_is_zero(self) -> None:
        self.assertAlmostEqual(rating_difference_from_expected_score(0.5), 0.0)

    def test_rating_difference_from_zero_does_not_crash(self) -> None:
        result = rating_difference_from_expected_score(0.0)

        self.assertTrue(math.isfinite(result))
        self.assertLess(result, 0.0)

    def test_rating_difference_from_one_does_not_crash(self) -> None:
        result = rating_difference_from_expected_score(1.0)

        self.assertTrue(math.isfinite(result))
        self.assertGreater(result, 0.0)

    def test_confidence_label_very_low(self) -> None:
        self.assertEqual(confidence_label(2), "very_low")

    def test_confidence_label_low(self) -> None:
        self.assertEqual(confidence_label(5), "low")

    def test_confidence_label_medium(self) -> None:
        self.assertEqual(confidence_label(12), "medium")

    def test_confidence_label_high(self) -> None:
        self.assertEqual(confidence_label(25), "high")

    def test_uncertainty_decreases_as_games_increase(self) -> None:
        estimates = [
            rating_uncertainty_estimate(0),
            rating_uncertainty_estimate(1),
            rating_uncertainty_estimate(3),
            rating_uncertainty_estimate(8),
            rating_uncertainty_estimate(20),
        ]

        self.assertEqual(estimates, sorted(estimates, reverse=True))

    def test_format_rating_estimate(self) -> None:
        self.assertEqual(format_rating_estimate(1600, 250), "1600 ± 250")

    def test_explain_rating_limitations_returns_non_empty_string(self) -> None:
        for num_games in (0, 5, 12, 25):
            self.assertTrue(explain_rating_limitations(num_games))

    def test_functions_are_deterministic(self) -> None:
        self.assertEqual(expected_score(1700, 1600), expected_score(1700, 1600))
        self.assertEqual(
            rating_difference_from_expected_score(0.7),
            rating_difference_from_expected_score(0.7),
        )
        self.assertEqual(confidence_label(12), confidence_label(12))
        self.assertEqual(
            rating_uncertainty_estimate(12),
            rating_uncertainty_estimate(12),
        )
        self.assertEqual(
            format_rating_estimate(1600, 250),
            format_rating_estimate(1600, 250),
        )
        self.assertEqual(
            explain_rating_limitations(12),
            explain_rating_limitations(12),
        )


if __name__ == "__main__":
    unittest.main()
