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

from neurochess.metrics.review_metrics import (  # noqa: E402
    move_accuracy_from_win_loss,
    player_percent_from_eval,
    player_percent_from_white_percent,
    white_percent_from_eval,
    win_loss_from_player_percents,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "metrics_algorithm_validation_cases.json"
)


def load_cases() -> dict[str, dict[str, object]]:
    return {
        str(case["case_id"]): case
        for case in json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    }


class MetricPovAndWinLossContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cases = load_cases()

    def test_white_pov_case_uses_white_percent_directly(self) -> None:
        case = self.cases["pov_symmetry_white"]

        before = case["eval_before"]
        after = case["eval_after"]
        self.assertIsInstance(before, dict)
        self.assertIsInstance(after, dict)

        player_before = player_percent_from_eval(
            before["eval_cp"],
            before["mate_in"],
            str(case["player_color"]),
        )
        player_after = player_percent_from_eval(
            after["eval_cp"],
            after["mate_in"],
            str(case["player_color"]),
        )
        win_loss = win_loss_from_player_percents(player_before, player_after)

        self.assertAlmostEqual(player_before, float(case["win_percent_before"]), places=3)
        self.assertAlmostEqual(player_after, float(case["win_percent_after"]), places=3)
        self.assertAlmostEqual(win_loss, float(case["expected_win_loss"]), places=3)

    def test_black_pov_inverts_white_percent(self) -> None:
        case = self.cases["pov_symmetry_black"]

        before = case["eval_before"]
        after = case["eval_after"]
        self.assertIsInstance(before, dict)
        self.assertIsInstance(after, dict)

        white_before = white_percent_from_eval(before["eval_cp"], before["mate_in"])
        white_after = white_percent_from_eval(after["eval_cp"], after["mate_in"])
        player_before = player_percent_from_white_percent(white_before, "black")
        player_after = player_percent_from_white_percent(white_after, "black")
        win_loss = win_loss_from_player_percents(player_before, player_after)

        self.assertAlmostEqual(player_before, float(case["win_percent_before"]), places=3)
        self.assertAlmostEqual(player_after, float(case["win_percent_after"]), places=3)
        self.assertEqual(win_loss, float(case["expected_win_loss"]))
        self.assertGreater(player_after, player_before)

    def test_win_loss_is_percentage_points_and_move_accuracy_is_bounded(self) -> None:
        cases = [
            self.cases["near_equal_micro_drift"],
            self.cases["winning_position_throws_win"],
        ]

        near_loss = float(cases[0]["expected_win_loss"])
        large_loss = float(cases[1]["expected_win_loss"])
        near_accuracy = move_accuracy_from_win_loss(near_loss)
        large_accuracy = move_accuracy_from_win_loss(large_loss)

        self.assertGreater(near_loss, 0.0)
        self.assertLess(near_loss, 2.0)
        self.assertGreater(large_loss, 40.0)
        self.assertGreater(near_accuracy, large_accuracy)
        for value in (near_accuracy, large_accuracy):
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)

    def test_mate_terminal_edge_uses_mate_overrides_without_cp_crash(self) -> None:
        case = self.cases["mate_terminal_edge_case"]

        before = case["eval_before"]
        after = case["eval_after"]
        self.assertIsInstance(before, dict)
        self.assertIsInstance(after, dict)

        player_before = player_percent_from_eval(
            before["eval_cp"],
            before["mate_in"],
            str(case["player_color"]),
        )
        player_after = player_percent_from_eval(
            after["eval_cp"],
            after["mate_in"],
            str(case["player_color"]),
        )
        win_loss = win_loss_from_player_percents(player_before, player_after)

        self.assertEqual(player_before, 100.0)
        self.assertEqual(player_after, 0.0)
        self.assertEqual(win_loss, 100.0)


if __name__ == "__main__":
    unittest.main()
