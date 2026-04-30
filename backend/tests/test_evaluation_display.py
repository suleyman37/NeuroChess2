from __future__ import annotations

import json
import sys
import unittest
from decimal import Decimal
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.core.evaluation_display import (
    classify_advantage,
    cp_to_white_percent,
    format_eval_label,
    make_evaluation_display,
    to_json_safe,
)


class EvaluationDisplayTests(unittest.TestCase):
    def test_zero_cp_is_equal(self) -> None:
        display = make_evaluation_display(0, None)

        self.assertEqual(display.white_percent, 50.0)
        self.assertEqual(display.black_percent, 50.0)

    def test_cp_100_uses_lichess_visual_curve(self) -> None:
        self.assertAlmostEqual(cp_to_white_percent(100), 59.1, places=1)

    def test_cp_300_uses_lichess_visual_curve(self) -> None:
        self.assertAlmostEqual(cp_to_white_percent(300), 75.1, places=1)

    def test_negative_cp_grows_black_segment(self) -> None:
        display = make_evaluation_display(-300, None)

        self.assertAlmostEqual(display.black_percent, 75.1, places=1)

    def test_large_white_advantage_is_near_top(self) -> None:
        self.assertGreater(cp_to_white_percent(3000), 99.0)

    def test_large_black_advantage_is_near_bottom(self) -> None:
        self.assertLess(cp_to_white_percent(-3000), 1.0)

    def test_white_mate_display(self) -> None:
        display = make_evaluation_display(mate_in=2)

        self.assertEqual(display.white_percent, 100.0)
        self.assertEqual(display.black_percent, 0.0)
        self.assertEqual(display.label, "M2")
        self.assertTrue(display.is_mate)

    def test_black_mate_display(self) -> None:
        display = make_evaluation_display(mate_in=-3)

        self.assertEqual(display.white_percent, 0.0)
        self.assertEqual(display.black_percent, 100.0)
        self.assertEqual(display.label, "-M3")
        self.assertTrue(display.is_mate)

    def test_mate_display_ignores_centipawn_sigmoid(self) -> None:
        white_mate = make_evaluation_display(eval_cp=-10_000, mate_in=2)
        black_mate = make_evaluation_display(eval_cp=10_000, mate_in=-3)

        self.assertEqual(white_mate.white_percent, 100.0)
        self.assertEqual(white_mate.black_percent, 0.0)
        self.assertEqual(black_mate.white_percent, 0.0)
        self.assertEqual(black_mate.black_percent, 100.0)

    def test_positive_label(self) -> None:
        self.assertEqual(format_eval_label(35), "+0.35")

    def test_negative_label(self) -> None:
        self.assertEqual(format_eval_label(-120), "-1.20")

    def test_none_label_is_equal(self) -> None:
        self.assertEqual(format_eval_label(None, None), "0.00")

    def test_zero_label_is_stable(self) -> None:
        self.assertEqual(format_eval_label(0, None), "0.00")

    def test_none_eval_display_is_equal(self) -> None:
        display = make_evaluation_display(None, None)

        self.assertEqual(display.white_percent, 50.0)
        self.assertEqual(display.black_percent, 50.0)
        self.assertEqual(display.advantage_side, "equal")
        self.assertEqual(display.magnitude, "equal")

    def test_classify_equal(self) -> None:
        self.assertEqual(classify_advantage(0, None), ("equal", "equal"))

    def test_classify_slight_white(self) -> None:
        self.assertEqual(classify_advantage(80, None), ("white", "slight"))

    def test_classify_clear_black(self) -> None:
        self.assertEqual(classify_advantage(-250, None), ("black", "clear"))

    def test_display_is_json_serializable(self) -> None:
        display = make_evaluation_display(35, None)

        json.dumps(to_json_safe(display))

    def test_percentages_are_clamped(self) -> None:
        for cp in (-1_000_000, -3000, 0, 3000, 1_000_000):
            display = make_evaluation_display(cp, None)

            self.assertGreaterEqual(display.white_percent, 0.0)
            self.assertLessEqual(display.white_percent, 100.0)
            self.assertGreaterEqual(display.black_percent, 0.0)
            self.assertLessEqual(display.black_percent, 100.0)

    def test_white_and_black_percent_sum_to_100_exactly(self) -> None:
        for cp in (-3000, -400, -300, -35, 0, 35, 100, 300, 400, 3000):
            display = make_evaluation_display(cp, None)

            self.assertEqual(
                display.white_percent + display.black_percent,
                100.0,
            )

    def test_percentages_have_one_decimal_place_at_most(self) -> None:
        for cp in (-3000, -400, -35, 0, 35, 400, 3000):
            display = make_evaluation_display(cp, None)

            for value in (display.white_percent, display.black_percent):
                decimal_value = Decimal(str(value))
                self.assertGreaterEqual(decimal_value.as_tuple().exponent, -1)

    def test_mate_percentages_sum_to_100_exactly(self) -> None:
        for mate_in in (3, -2):
            display = make_evaluation_display(None, mate_in)

            self.assertEqual(display.white_percent + display.black_percent, 100.0)

    def test_eval_pov_side_to_move_cp_is_not_part_of_display_api(self) -> None:
        display_payload = to_json_safe(make_evaluation_display(100, None))

        self.assertNotIn("eval_pov_side_to_move_cp", display_payload)


if __name__ == "__main__":
    unittest.main()
