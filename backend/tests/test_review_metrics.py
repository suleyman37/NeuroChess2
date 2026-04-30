from __future__ import annotations

import inspect
import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.metrics.review_metrics import (
    GAME_ACCURACY_FORMULA_VERSION,
    MOVE_ACCURACY_FORMULA_VERSION,
    NEURO_SCORE_FORMULA_VERSION,
    lichess_like_game_accuracy,
    move_accuracy_from_win_loss,
    neuro_diagnostic_score,
    player_percent_from_white_percent,
    review_metric_bundle,
    white_percent_from_eval,
)
from neurochess.review_service import build_review_evidence_for_move


class ReviewMetricWinPercentTests(unittest.TestCase):
    def test_white_percent_from_eval_uses_canonical_curve_and_mates(self) -> None:
        self.assertAlmostEqual(white_percent_from_eval(0, None), 50.0, places=3)
        self.assertGreater(white_percent_from_eval(150, None), 50.0)
        self.assertLess(white_percent_from_eval(-150, None), 50.0)
        self.assertEqual(white_percent_from_eval(None, 3), 100.0)
        self.assertEqual(white_percent_from_eval(None, -2), 0.0)

    def test_player_percent_uses_player_pov(self) -> None:
        self.assertEqual(player_percent_from_white_percent(63.0, "white"), 63.0)
        self.assertEqual(player_percent_from_white_percent(63.0, "black"), 37.0)


class ReviewMetricMoveAccuracyTests(unittest.TestCase):
    def test_move_accuracy_formula_is_versioned_and_clamped(self) -> None:
        self.assertEqual(MOVE_ACCURACY_FORMULA_VERSION, "lichess_exp_uncertainty_v1")
        self.assertAlmostEqual(move_accuracy_from_win_loss(0), 100.0, places=3)
        moderate = move_accuracy_from_win_loss(10)
        strong = move_accuracy_from_win_loss(35)
        huge = move_accuracy_from_win_loss(1000)

        self.assertGreater(moderate, strong)
        self.assertGreater(moderate, 60.0)
        self.assertLess(strong, 25.0)
        self.assertEqual(huge, 0.0)
        for value in (moderate, strong, huge):
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)


class ReviewMetricGameAccuracyTests(unittest.TestCase):
    def test_lichess_like_game_accuracy_uses_weighted_and_harmonic_means(self) -> None:
        moves = [
            self._move(50.0, 50.0, 0.0),
            self._move(50.0, 49.0, 1.0),
            self._move(49.0, 49.0, 0.0),
            self._move(49.0, 48.0, 1.0),
            self._move(48.0, 48.0, 0.0),
            self._move(48.0, 13.0, 35.0),
        ]

        payload = lichess_like_game_accuracy(moves)

        self.assertEqual(GAME_ACCURACY_FORMULA_VERSION, "lichess_weighted_harmonic_v1")
        self.assertIsNotNone(payload["score"])
        simple_mean = sum(float(move["move_accuracy"]) for move in moves) / len(moves)
        self.assertLess(payload["harmonic_mean"], simple_mean)
        self.assertAlmostEqual(
            payload["score"],
            (payload["weighted_mean"] + payload["harmonic_mean"]) / 2,
            places=2,
        )
        self.assertTrue(all(0.5 <= weight <= 12.0 for weight in payload["volatility_weights"]))

    def test_lichess_like_game_accuracy_does_not_use_neuro_penalties(self) -> None:
        source = inspect.getsource(lichess_like_game_accuracy)

        self.assertNotIn("criticality", source)
        self.assertNotIn("persistence", source)
        self.assertNotIn("cluster", source)
        self.assertNotIn("worst_tail", source)
        self.assertNotIn("score_cap", source)

    def _move(self, before: float, after: float, win_loss: float) -> dict[str, float | int | str]:
        return {
            "ply": 1,
            "side": "white",
            "uci": "e2e4",
            "player_percent_before": before,
            "player_percent_after": after,
            "white_percent_after": after,
            "win_loss": win_loss,
            "move_accuracy": move_accuracy_from_win_loss(win_loss),
        }


class ReviewMetricNeuroScoreTests(unittest.TestCase):
    def test_neuro_score_is_regularized_and_bounded(self) -> None:
        timeline = [
            self._move(1, 70.0, 50.0, 20.0),
            self._move(2, 50.0, 35.0, 15.0),
            self._move(3, 35.0, 20.0, 15.0),
            self._move(4, 20.0, 18.0, 2.0),
        ]
        lichess = lichess_like_game_accuracy(timeline)
        neuro = neuro_diagnostic_score(timeline, timeline=timeline)

        self.assertEqual(NEURO_SCORE_FORMULA_VERSION, "neuro_diagnostic_regularized_v1")
        self.assertGreaterEqual(neuro["score"], 0.0)
        self.assertLessEqual(neuro["score"], 100.0)
        self.assertLessEqual(neuro["score"], lichess["score"])
        for move in neuro["moves"]:
            self.assertGreaterEqual(move["omega"], 1.0)
            self.assertLessEqual(move["omega"], 1.75)

    def test_neuro_score_formula_does_not_use_forbidden_global_penalties(self) -> None:
        source = inspect.getsource(neuro_diagnostic_score)
        score_expression = source.split('score = clamp(100.0 * exp(-0.035 * z_value)', 1)[1]

        self.assertNotIn("criticality", score_expression)
        self.assertNotIn("sharpness", score_expression)
        self.assertNotIn("score_cap", score_expression)

    def test_review_metric_bundle_reports_diagnostic_gap(self) -> None:
        moves = [
            self._move(1, 60.0, 40.0, 20.0),
            self._move(2, 40.0, 35.0, 5.0),
            self._move(3, 35.0, 30.0, 5.0),
        ]

        payload = review_metric_bundle(moves, timeline=moves, coverage=1.0, confidence="low")

        self.assertIn("lichess_like_accuracy", payload)
        self.assertIn("neuro_score", payload)
        self.assertIn("diagnostic_gap", payload)
        self.assertIn("formula_versions", payload)

    def _move(self, ply: int, before: float, after: float, win_loss: float) -> dict[str, float | int | str]:
        return {
            "ply": ply,
            "side": "white",
            "uci": f"a{ply}a{ply + 1}",
            "player_percent_before": before,
            "player_percent_after": after,
            "white_percent_after": after,
            "win_loss": win_loss,
            "move_accuracy": move_accuracy_from_win_loss(win_loss),
        }


class ReviewEvidenceContractTests(unittest.TestCase):
    def test_review_evidence_contract_is_versioned_and_not_live(self) -> None:
        row = {
            "ply": 7,
            "san": "Nxe5",
            "uci": "f3e5",
            "side": "white",
            "fen_before": "fen-before",
            "fen_after": "fen-after",
            "eval_before_cp": 42,
            "eval_after_cp": -120,
            "mate_before": None,
            "mate_after": None,
            "white_percent_before": 54.0,
            "white_percent_after": 39.0,
            "player_percent_before": 54.0,
            "player_percent_after": 39.0,
            "win_loss": 15.0,
            "lichess_like_move_accuracy": move_accuracy_from_win_loss(15.0),
            "neuro_diagnostic_loss": 18.0,
            "criticality_score": 21.0,
            "persistence_weight": 1.1,
            "cluster_weight": 1.05,
            "analysis_profile_before": "standard",
            "analysis_profile_after": "standard",
            "engine_version_before": "FakeFish",
            "engine_version_after": "FakeFish",
            "depth_before": 18,
            "depth_after": 19,
        }

        evidence = build_review_evidence_for_move(
            game_id=123,
            row=row,
            top_moves=[{"uci": "e5c6", "pv": ["e5c6"]}],
            source="review_standard",
            reliability=0.92,
            nodes_before=1000,
            nodes_after=1200,
        )

        for key in (
            "review_evidence_schema_version",
            "game_id",
            "ply",
            "san",
            "uci",
            "player_color",
            "fen_before",
            "fen_after",
            "eval_before_cp",
            "eval_after_cp",
            "white_win_percent_before",
            "player_win_percent_after",
            "win_loss",
            "lichess_like_move_accuracy",
            "neuro_diagnostic_loss",
            "top_moves",
            "source",
            "not_live",
            "llm_instruction",
            "pv_contrast_evidence",
            "pv_contrast_evidence_version",
        ):
            self.assertIn(key, evidence)
        self.assertEqual(evidence["review_evidence_schema_version"], "review_evidence_v1")
        self.assertEqual(
            evidence["pv_contrast_evidence"]["schema_version"],
            "pv_contrast_evidence_v1",
        )
        self.assertTrue(evidence["not_live"])
        self.assertTrue(evidence["llm_instruction"]["must_not_invent"])
        self.assertTrue(evidence["llm_instruction"]["explain_uncertainty"])
        self.assertTrue(evidence["llm_instruction"]["avoid_claiming_human_intent"])


if __name__ == "__main__":
    unittest.main()
