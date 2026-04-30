from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.core.analysis_reliability import (
    evaluate_analysis_reliability,
    to_json_safe,
)


class AnalysisReliabilityTests(unittest.TestCase):
    def test_missing_depth_is_less_reliable_than_depth_16(self) -> None:
        missing_depth = evaluate_analysis_reliability(
            depth=None,
            multipv=3,
            top_moves_count=3,
        )
        strong_depth = evaluate_analysis_reliability(
            depth=16,
            multipv=3,
            top_moves_count=3,
        )

        self.assertLess(
            missing_depth.reliability_score,
            strong_depth.reliability_score,
        )
        self.assertIn("missing_depth", missing_depth.warnings)

    def test_depth_4_is_low_reliability(self) -> None:
        reliability = evaluate_analysis_reliability(
            depth=4,
            multipv=1,
            top_moves_count=1,
        )

        self.assertTrue(
            reliability.label == "low" or reliability.reliability_score < 0.4
        )
        self.assertIn("very_low_depth", reliability.reasons)

    def test_strong_analysis_is_high_reliability(self) -> None:
        reliability = evaluate_analysis_reliability(
            depth=16,
            multipv=3,
            top_moves_count=3,
        )

        self.assertTrue(
            reliability.label == "high" or reliability.reliability_score >= 0.75
        )

    def test_illegal_pv_adds_warning_and_reduces_score(self) -> None:
        legal = evaluate_analysis_reliability(
            depth=16,
            multipv=3,
            top_moves_count=3,
            pv_legal=True,
        )
        illegal = evaluate_analysis_reliability(
            depth=16,
            multipv=3,
            top_moves_count=3,
            pv_legal=False,
        )

        self.assertIn("illegal_pv_detected", illegal.warnings)
        self.assertLessEqual(illegal.reliability_score, legal.reliability_score - 0.35)

    def test_score_is_always_between_zero_and_one(self) -> None:
        cases = [
            evaluate_analysis_reliability(depth=None, multipv=None),
            evaluate_analysis_reliability(depth=1, multipv=1, top_moves_count=0),
            evaluate_analysis_reliability(
                depth=99,
                multipv=10,
                top_moves_count=10,
                has_mate=True,
            ),
            evaluate_analysis_reliability(
                depth=1,
                multipv=None,
                top_moves_count=0,
                pv_legal=False,
            ),
        ]

        for reliability in cases:
            self.assertGreaterEqual(reliability.reliability_score, 0.0)
            self.assertLessEqual(reliability.reliability_score, 1.0)

    def test_two_top_moves_has_no_specific_adjustment(self) -> None:
        reliability = evaluate_analysis_reliability(
            depth=12,
            multipv=2,
            top_moves_count=2,
        )

        self.assertNotIn("no_top_moves", reliability.warnings)
        self.assertEqual(reliability.warnings, [])
        self.assertEqual(reliability.reasons, ["usable_depth"])

    def test_to_json_safe_is_json_serializable(self) -> None:
        reliability = evaluate_analysis_reliability(
            depth=16,
            multipv=3,
            top_moves_count=3,
        )

        json.dumps(to_json_safe(reliability))


if __name__ == "__main__":
    unittest.main()
