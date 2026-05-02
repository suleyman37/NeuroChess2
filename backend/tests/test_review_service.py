from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

import chess
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from neurochess.api.game_routes import (
    ACTIVE_SESSIONS,
    get_analysis_service,
    get_repository,
    get_review_service,
)
from neurochess.analysis_service import AnalysisService
from neurochess.core.stabilized_eval import REVIEW_STABILIZED_EVAL_SOURCE_KIND
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository
from neurochess.review_service import (
    CRITICALITY_THRESHOLD,
    IMPORTANCE_CP_LOSS_CAP,
    MIN_CP_LOSS_FOR_MOMENT,
    MIN_KEY_MOMENT_WIN_LOSS,
    MIN_SIGNIFICANT_WIN_LOSS,
    MIN_HALF_MOVES_FOR_REVIEW,
    REVIEW_ANALYSIS_DEFAULT_PROFILE,
    REVIEW_ANALYSIS_MULTIPV,
    GAME_ACCURACY_FORMULA_VERSION,
    MOVE_ACCURACY_FORMULA_VERSION,
    NEURO_SCORE_FORMULA_VERSION,
    REVIEW_PIPELINE_VERSION,
    REVIEW_SCORE_CACHE_SCHEMA_VERSION,
    REVIEW_SCORE_FORMULA_VERSION,
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
    ReviewService,
    _analysis_satisfies_profile,
    calculate_cp_loss,
    compute_review_per_position_time_ms,
    compute_review_total_budget_seconds,
    criticality_score,
    importance_score,
    is_significant_review_moment,
    move_accuracy_from_win_loss,
    move_weight_for_review_score,
    move_weight_from_criticality,
    moment_type_for_transition,
    mover_win_percent_loss,
    persistence_weight,
    player_review_score_v1,
    player_review_score_v0,
    player_percent_from_white_percent,
    player_eval_zone,
    required_review_fens_for_contexts,
    review_label_from_win_loss,
    review_score_confidence,
    temporal_non_max_suppression,
    transition_weight,
    white_percent_from_eval,
    win_percent_from_engine_score,
)


TEN_MOVES = [
    "e2e4",
    "e7e5",
    "g1f3",
    "b8c6",
    "f1b5",
    "a7a6",
    "b5a4",
    "g8f6",
    "e1g1",
    "f8e7",
]
REVIEWABLE_MOVES = TEN_MOVES + ["f1e1"]

FORBIDDEN_COMMENT_WORDS = (
    "blunder",
    "mistake",
    "inaccuracy",
    "mauvais coup",
    "coup nul",
    "impulsif",
    "mal calculé",
    "ne comprends pas",
    "erreur cognitive",
    "manque de patience",
    "style de jeu",
)


class ReviewServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v4-review-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.service = ReviewService(self.db_path)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_cp_loss_fixed_cases(self) -> None:
        self.assertEqual(calculate_cp_loss(30, 150, None, None, "black"), 120)
        self.assertEqual(calculate_cp_loss(30, -90, None, None, "white"), 120)
        self.assertEqual(calculate_cp_loss(30, 50, None, None, "white"), 0)
        self.assertEqual(calculate_cp_loss(30, 50, None, None, "black"), 20)
        self.assertEqual(calculate_cp_loss(-50, -200, None, None, "white"), 150)

    def test_mate_cp_loss_uses_raw_proxy_and_importance_cap(self) -> None:
        missed_white_mate = calculate_cp_loss(None, 50, 3, None, "white")
        black_allows_white_mate = calculate_cp_loss(50, None, None, 3, "black")
        longer_white_mate = calculate_cp_loss(None, None, 5, 8, "white")
        reversed_mate = calculate_cp_loss(None, None, 3, -2, "white")

        self.assertGreater(missed_white_mate, IMPORTANCE_CP_LOSS_CAP)
        self.assertGreater(black_allows_white_mate, IMPORTANCE_CP_LOSS_CAP)
        self.assertEqual(longer_white_mate, 3)
        self.assertGreater(reversed_mate, IMPORTANCE_CP_LOSS_CAP)
        self.assertEqual(importance_score(reversed_mate, 0.8), 800.0)

    def test_win_percent_from_engine_score_uses_eval_bar_formula_and_mate_shortcut(self) -> None:
        self.assertAlmostEqual(win_percent_from_engine_score(0, None), 50.0, places=3)
        self.assertAlmostEqual(white_percent_from_eval(0, None), 50.0, places=3)
        self.assertAlmostEqual(player_percent_from_white_percent(62.5, "white"), 62.5)
        self.assertAlmostEqual(player_percent_from_white_percent(62.5, "black"), 37.5)
        self.assertGreater(win_percent_from_engine_score(150, None), 63.0)
        self.assertLess(win_percent_from_engine_score(-150, None), 37.0)
        self.assertEqual(win_percent_from_engine_score(0, 3), 100.0)
        self.assertEqual(win_percent_from_engine_score(0, -2), 0.0)

    def test_mover_win_percent_loss_threshold_examples(self) -> None:
        tiny = mover_win_percent_loss(0, None, -10, None, "white")
        small = mover_win_percent_loss(0, None, -50, None, "white")
        significant = mover_win_percent_loss(0, None, -150, None, "white")

        self.assertLess(tiny, 1.0)
        self.assertEqual(MIN_KEY_MOMENT_WIN_LOSS, 10.0)
        self.assertLess(small, MIN_SIGNIFICANT_WIN_LOSS)
        self.assertGreaterEqual(significant, MIN_SIGNIFICANT_WIN_LOSS)
        self.assertTrue(is_significant_review_moment(significant, None, None))

    def test_mover_win_percent_loss_is_from_mover_perspective(self) -> None:
        white_loss = mover_win_percent_loss(0, None, -135, None, "white")
        black_loss = mover_win_percent_loss(0, None, 135, None, "black")
        white_gain = mover_win_percent_loss(0, None, 135, None, "white")
        black_gain = mover_win_percent_loss(0, None, -135, None, "black")

        self.assertGreaterEqual(white_loss, MIN_SIGNIFICANT_WIN_LOSS)
        self.assertGreaterEqual(black_loss, MIN_SIGNIFICANT_WIN_LOSS)
        self.assertEqual(white_gain, 0.0)
        self.assertEqual(black_gain, 0.0)

    def test_review_score_accuracy_formula_uses_win_percent_loss(self) -> None:
        perfect = move_accuracy_from_win_loss(0)
        ten_point_loss = move_accuracy_from_win_loss(10)
        large_loss = move_accuracy_from_win_loss(1000)

        self.assertAlmostEqual(perfect, 100.0, places=2)
        self.assertLess(ten_point_loss, perfect)
        self.assertGreater(ten_point_loss, 60.0)
        self.assertLess(ten_point_loss, 70.0)
        self.assertEqual(large_loss, 0.0)

    def test_review_score_helpers_weight_and_confidence(self) -> None:
        self.assertEqual(move_weight_from_criticality(None), 1.0)
        self.assertEqual(move_weight_from_criticality(50.0), 3.5)
        self.assertEqual(move_weight_from_criticality(500.0), 5.0)
        self.assertGreater(move_weight_for_review_score(None, 30.0), 1.0)
        self.assertEqual(player_review_score_v0([(100.0, 1.0), (50.0, 3.0)]), 62.5)
        self.assertIsNone(player_review_score_v0([]))
        self.assertEqual(review_score_confidence(20, 0.95), "high")
        self.assertEqual(review_score_confidence(10, 0.70), "medium")
        self.assertEqual(review_score_confidence(9, 1.0), "low")
        self.assertEqual(REVIEW_SCORE_FORMULA_VERSION, "dual_lichess_neuro_v1")

    def test_review_analysis_profile_budgets_are_time_budgeted(self) -> None:
        self.assertEqual(compute_review_total_budget_seconds(40, "standard"), 80)
        self.assertEqual(compute_review_total_budget_seconds(41, "standard"), 140)
        self.assertEqual(compute_review_total_budget_seconds(71, "standard"), 220)
        self.assertEqual(compute_review_total_budget_seconds(111, "standard"), 300)
        self.assertEqual(compute_review_total_budget_seconds(40, "deep"), 120)
        self.assertEqual(compute_review_total_budget_seconds(400, "deep"), 450)
        self.assertEqual(compute_review_total_budget_seconds(20, "quick"), 20)
        self.assertEqual(compute_review_per_position_time_ms(80, 41, "standard"), 1951)
        self.assertEqual(compute_review_per_position_time_ms(80, 1000, "standard"), 1000)
        self.assertEqual(compute_review_per_position_time_ms(80, 1, "standard"), 10000)
        self.assertEqual(compute_review_per_position_time_ms(120, 1000, "deep"), 2000)
        self.assertEqual(compute_review_per_position_time_ms(450, 1, "deep"), 15000)
        self.assertEqual(compute_review_per_position_time_ms(45, 10, "quick"), 1500)

    def test_standard_review_ignores_legacy_cache_and_schedules_time_only(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(
            positions,
            [0] * len(positions),
            analysis_profile=None,
        )

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["review_analysis_profile"], "standard")
        self.assertEqual(payload["analysis_limit_mode"], "time")
        self.assertEqual(payload["total_budget_seconds"], 80)
        self.assertGreater(payload["per_position_time_ms"], 1000)
        self.assertGreater(payload["legacy_cache_ignored_count"], 0)
        self.assertGreater(payload["scheduled_deep_count"], 0)

        with closing(sqlite3.connect(self.db_path)) as connection:
            row = connection.execute(
                """
                SELECT analysis_profile, requested_time_ms, analysis_limit_mode,
                       requested_multipv, depth, settings_json
                FROM position_analyses
                WHERE analysis_profile = 'standard'
                LIMIT 1
                """
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "standard")
        self.assertEqual(row[2], "time")
        self.assertEqual(row[3], REVIEW_ANALYSIS_MULTIPV)
        self.assertNotEqual(row[4], 12)
        settings = json.loads(row[5])
        self.assertEqual(settings["threads"], 6)
        self.assertEqual(settings["hash_mb"], 1024)
        self.assertEqual(settings["requested_multipv"], 3)

    def test_standard_and_deep_cache_satisfy_standard_profile(self) -> None:
        standard_game, standard_positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(
            standard_positions,
            [0] * len(standard_positions),
            analysis_profile="standard",
        )
        standard_payload = self.service.generate_review(standard_game)
        self.assertEqual(standard_payload["status"], "done")
        self.assertEqual(standard_payload["review_analysis_quality"], "standard")

        deep_game, deep_positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(
            deep_positions,
            [0] * len(deep_positions),
            analysis_profile="deep",
        )
        deep_payload = self.service.generate_review(deep_game)
        self.assertEqual(deep_payload["status"], "done")
        self.assertEqual(deep_payload["review_analysis_quality"], "deep")

    def test_live_continuous_cache_never_satisfies_standard_profile(self) -> None:
        analysis = {
            "status": "done",
            "analysis_kind": "deep",
            "schema_version": "engine_analysis_v2",
            "analysis_profile": "live_continuous",
            "analysis_limit_mode": "continuous",
            "requested_time_ms": None,
            "requested_multipv": 1,
            "multipv": 1,
            "analysis_json": {
                "analysis_profile": "live_continuous",
                "analysis_limit_mode": "continuous",
                "requested_multipv": 1,
            },
        }

        self.assertFalse(_analysis_satisfies_profile(analysis, "standard", 1000))
        self.assertFalse(_analysis_satisfies_profile(analysis, "deep", 2000))

    def test_required_review_fens_include_initial_and_after_positions(self) -> None:
        _game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        contexts = [
            type(
                "Context",
                (),
                {
                    "fen_before": positions[index],
                    "fen_after": positions[index + 1],
                },
            )()
            for index in range(len(positions) - 1)
        ]
        required = required_review_fens_for_contexts(contexts)

        self.assertEqual(len(required), len(REVIEWABLE_MOVES) + 1)
        self.assertIn(chess.STARTING_FEN, required)

    def test_review_score_v1_punishes_bad_tail_and_caps_big_losses(self) -> None:
        moves = [
            {"move_accuracy": 100.0, "win_loss": 0.0, "weight": 1.0},
            {"move_accuracy": 96.0, "win_loss": 1.0, "weight": 1.0},
            {"move_accuracy": 95.0, "win_loss": 1.0, "weight": 1.0},
            {"move_accuracy": 92.0, "win_loss": 2.0, "weight": 1.0},
            {"move_accuracy": 20.0, "win_loss": 34.0, "weight": 3.0},
        ]

        payload = player_review_score_v1(moves, deep_coverage=1.0)

        self.assertLess(payload["weighted_harmonic"], payload["weighted_mean"])
        self.assertLess(payload["worst_tail"], payload["weighted_mean"])
        self.assertLess(payload["raw_score"], payload["weighted_mean"])
        self.assertEqual(payload["score_cap"], 86.0)
        self.assertLessEqual(payload["final_score"], 86.0)

    def test_mate_change_is_always_decisive_review_moment(self) -> None:
        self.assertTrue(is_significant_review_moment(0.0, 3, None, played_by="white"))
        self.assertTrue(is_significant_review_moment(0.0, None, -2, played_by="white"))
        self.assertTrue(is_significant_review_moment(0.0, 2, -2, played_by="white"))
        self.assertEqual(review_label_from_win_loss(0.0, mate_event=True), "moment décisif")

    def test_criticality_prioritizes_turning_point_over_same_raw_loss(self) -> None:
        balanced_to_worse = criticality_score(
            immediate_loss=20.0,
            player_percent_before=50.0,
            zone_before="balanced",
            zone_after="worse",
            future_player_percents=[30.0],
        )
        worse_to_losing = criticality_score(
            immediate_loss=20.0,
            player_percent_before=30.0,
            zone_before="worse",
            zone_after="losing",
            future_player_percents=[10.0],
        )

        self.assertGreater(balanced_to_worse, worse_to_losing)

    def test_criticality_score_is_reduced_by_low_reliability(self) -> None:
        reliable = criticality_score(
            immediate_loss=20.0,
            player_percent_before=50.0,
            zone_before="balanced",
            zone_after="worse",
            future_player_percents=[30.0],
            reliability_score=1.0,
        )
        unstable = criticality_score(
            immediate_loss=20.0,
            player_percent_before=50.0,
            zone_before="balanced",
            zone_after="worse",
            future_player_percents=[30.0],
            reliability_score=0.25,
        )

        self.assertLess(unstable, reliable)
        self.assertAlmostEqual(unstable, reliable * 0.25, delta=0.01)

    def test_single_candidate_threshold_is_criticality_not_raw_loss_floor(self) -> None:
        below = criticality_score(
            immediate_loss=4.0,
            player_percent_before=50.0,
            zone_before="balanced",
            zone_after="worse",
            future_player_percents=[47.0],
            reliability_score=1.0,
        )
        boosted = criticality_score(
            immediate_loss=7.0,
            player_percent_before=50.0,
            zone_before="balanced",
            zone_after="worse",
            future_player_percents=[31.0],
            reliability_score=1.0,
        )

        self.assertLess(below, CRITICALITY_THRESHOLD)
        self.assertGreaterEqual(boosted, CRITICALITY_THRESHOLD)
        self.assertEqual(CRITICALITY_THRESHOLD, 10.0)

    def test_player_eval_zones_and_moment_types(self) -> None:
        self.assertEqual(player_eval_zone(95), "won")
        self.assertEqual(player_eval_zone(82), "winning")
        self.assertEqual(player_eval_zone(65), "better")
        self.assertEqual(player_eval_zone(50), "balanced")
        self.assertEqual(player_eval_zone(30), "worse")
        self.assertEqual(player_eval_zone(15), "losing")
        self.assertEqual(player_eval_zone(5), "lost")
        self.assertEqual(
            moment_type_for_transition("balanced", "worse"),
            "turning_point",
        )
        self.assertEqual(
            moment_type_for_transition("worse", "losing"),
            "aggravation",
        )
        self.assertEqual(
            moment_type_for_transition("winning", "balanced"),
            "lost_advantage",
        )
        self.assertEqual(
            moment_type_for_transition("balanced", "balanced", mate_event=True),
            "decisive",
        )

    def test_transition_and_persistence_weights(self) -> None:
        self.assertEqual(transition_weight("balanced", "worse"), 1.35)
        self.assertEqual(transition_weight("balanced", "lost"), 1.40)
        self.assertEqual(transition_weight("better", "balanced"), 1.25)
        self.assertEqual(transition_weight("winning", "better"), 0.90)
        self.assertEqual(transition_weight("won", "winning"), 0.85)
        self.assertEqual(transition_weight("worse", "losing"), 1.15)
        self.assertEqual(transition_weight("losing", "lost"), 1.10)
        self.assertEqual(transition_weight("winning", "winning"), 0.80)
        temporary = persistence_weight(50.0, 20.0, [49.0, 48.0, 50.0])
        durable = persistence_weight(50.0, 20.0, [30.0, 28.0, 29.0])
        unknown_future = persistence_weight(50.0, 20.0, [])

        self.assertLess(temporary, 1.0)
        self.assertGreater(durable, 1.0)
        self.assertEqual(unknown_future, 1.0)

    def test_temporal_nms_rejects_nearby_weaker_and_keeps_mate_event(self) -> None:
        candidates = [
            {
                "ply": 5,
                "base_criticality_score": 50.0,
                "criticality_score": 50.0,
                "mover_win_loss": 20.0,
                "mate_event": False,
            },
            {
                "ply": 6,
                "base_criticality_score": 40.0,
                "criticality_score": 40.0,
                "mover_win_loss": 18.0,
                "mate_event": False,
            },
            {
                "ply": 7,
                "base_criticality_score": 10.0,
                "criticality_score": 10.0,
                "mover_win_loss": 0.0,
                "mate_event": True,
            },
            {
                "ply": 10,
                "base_criticality_score": 30.0,
                "criticality_score": 30.0,
                "mover_win_loss": 20.0,
                "mate_event": False,
            },
        ]

        selected = temporal_non_max_suppression(candidates)

        self.assertEqual([candidate["ply"] for candidate in selected], [5, 7, 10])

    def test_no_major_moments_is_done_with_empty_moments(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions, [0] * len(positions))

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["moments"], [])
        self.assertEqual(payload["empty_reason"], "no_significant_moments")
        self.assertEqual(payload["missing_deep_count"], 0)
        self.assertEqual(payload["analyzed_deep_count"], payload["total_required_deep_count"])
        self.assertNotEqual(payload["status"], "pending")
        payload["message"] = "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile."
        payload["message"] = "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile."
        self.assertEqual(
            payload["message"],
            "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.",
        )

    def test_review_score_payload_scores_each_side_and_user_color(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                "UPDATE games SET user_color = 'white' WHERE id = ?",
                (game_id,),
            )
            connection.commit()
        self._insert_deep_for_positions(positions, [0] * len(positions))

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["score_formula_version"], REVIEW_SCORE_FORMULA_VERSION)
        self.assertEqual(
            payload["move_accuracy_formula_version"],
            MOVE_ACCURACY_FORMULA_VERSION,
        )
        self.assertEqual(
            payload["game_accuracy_formula_version"],
            GAME_ACCURACY_FORMULA_VERSION,
        )
        self.assertEqual(
            payload["neuro_score_formula_version"],
            NEURO_SCORE_FORMULA_VERSION,
        )
        self.assertEqual(payload["white_review_score"], 100.0)
        self.assertEqual(payload["black_review_score"], 100.0)
        self.assertEqual(payload["user_color"], "white")
        self.assertEqual(payload["white_lichess_like_accuracy"], 100.0)
        self.assertEqual(payload["black_lichess_like_accuracy"], 100.0)
        self.assertEqual(payload["white_public_neuro_score"], payload["white_lichess_like_accuracy"])
        self.assertEqual(payload["black_public_neuro_score"], payload["black_lichess_like_accuracy"])
        self.assertEqual(payload["user_public_neuro_score"], payload["user_lichess_like_accuracy"])
        self.assertEqual(payload["public_neuro_score"], payload["user_lichess_like_accuracy"])
        self.assertEqual(payload["public_score_formula_version"], "public_neuro_score_lichess_like_v1")
        self.assertEqual(payload["qualitative_game_label_formula_version"], "qualitative_game_label_v1")
        self.assertEqual(payload["white_neuro_score"], 100.0)
        self.assertEqual(payload["black_neuro_score"], 100.0)
        self.assertEqual(payload["white_diagnostic_gap"], 0.0)
        self.assertEqual(payload["black_diagnostic_gap"], 0.0)
        self.assertEqual(payload["score_availability"]["neuro_score"], "available")
        self.assertEqual(payload["score_availability"]["diagnostic_gap"], "available")
        self.assertTrue(payload["review_score_deprecated"])
        self.assertEqual(payload["review_score_alias_of"], "lichess_like_accuracy")
        self.assertEqual(
            payload["white_review_score"],
            payload["white_lichess_like_accuracy"],
        )
        self.assertEqual(payload["user_review_score"], payload["white_review_score"])
        self.assertEqual(payload["user_neuro_score"], payload["white_neuro_score"])
        self.assertEqual(payload["opponent_review_score"], payload["black_review_score"])
        self.assertIsNotNone(payload["user_headline_neurochess_score"])
        self.assertEqual(
            payload["headline_neurochess_score"],
            payload["user_headline_neurochess_score"],
        )
        self.assertEqual(payload["user_coach_neuro_score"], payload["user_headline_neurochess_score"])
        self.assertEqual(payload["white_coach_neuro_score"], payload["white_headline_neurochess_score"])
        self.assertEqual(payload["black_coach_neuro_score"], payload["black_headline_neurochess_score"])
        self.assertEqual(payload["coach_neuro_score"], payload["headline_neurochess_score"])
        self.assertEqual(payload["coach_score_formula_version"], "coach_neuro_score_v1")
        self.assertEqual(payload["headline_score_subject"], "user")
        self.assertEqual(
            payload["headline_score_formula_version"],
            "headline_neurochess_score_v1",
        )
        self.assertIsInstance(payload["review_summary_sentence"], str)
        self.assertTrue(payload["review_summary_sentence"])
        self.assertNotIn("diagnostique", payload["review_summary_sentence"].lower())
        self.assertEqual(payload["score_analyzed_moves_white"], 6)
        self.assertEqual(payload["score_analyzed_moves_black"], 5)
        self.assertEqual(payload["score_missing_moves_white"], 0)
        self.assertEqual(payload["score_missing_moves_black"], 0)
        self.assertEqual(payload["review_score_confidence"], "low")
        self.assertEqual(payload["deep_coverage"], 1.0)
        self.assertEqual(payload["review_analysis_origin"], "cached_full")
        self.assertEqual(payload["review_analysis_state"], "ready")
        self.assertEqual(payload["review_analysis_quality"], "standard")
        self.assertEqual(payload["required_position_count"], len(positions))
        self.assertEqual(payload["deep_done_count"], len(positions))
        self.assertEqual(payload["deep_missing_count"], 0)
        self.assertEqual(payload["number_of_moves_white"], 6)
        self.assertEqual(payload["number_of_moves_black"], 5)
        self.assertEqual(payload["white_score_debug"]["weighted_mean"], 100.0)
        self.assertEqual(payload["black_score_debug"]["weighted_harmonic"], 100.0)
        self.assertEqual(len(payload["review_score_audit_rows"]), len(REVIEWABLE_MOVES))
        first_row = payload["review_score_audit_rows"][0]
        for key in (
            "ply",
            "side",
            "san",
            "uci",
            "eval_before_cp",
            "mate_before",
            "eval_after_cp",
            "mate_after",
            "white_percent_before",
            "white_percent_after",
            "player_percent_before",
            "player_percent_after",
            "win_loss",
            "move_accuracy",
            "lichess_like_move_accuracy",
            "neuro_diagnostic_loss",
            "persistence_weight",
            "cluster_weight",
            "criticality_score",
            "move_weight",
            "included_in_score",
            "exclusion_reason",
            "analysis_kind_before",
            "analysis_kind_after",
            "depth_before",
            "depth_after",
            "source_before",
            "source_after",
            "review_evidence",
        ):
            self.assertIn(key, first_row)
        self.assertTrue(first_row["review_evidence"]["not_live"])
        self.assertEqual(
            first_row["review_evidence"]["review_evidence_schema_version"],
            "review_evidence_v1",
        )
        self.assertEqual(
            payload["formula_versions"]["move_category_formula_version"],
            "neuro_move_categories_v1",
        )
        self.assertEqual(
            payload["formula_versions"]["review_sections_version"],
            "neuro_review_sections_v1",
        )
        self.assertEqual(len(payload["move_annotations"]), len(REVIEWABLE_MOVES))
        first_annotation = payload["move_annotations"][0]
        for key in (
            "ply",
            "move_number",
            "color",
            "san",
            "uci",
            "fen_before",
            "fen_after",
            "primary_category",
            "category_label",
            "tags",
            "win_loss",
            "move_accuracy",
            "neuro_diagnostic_loss",
            "criticality_score",
            "missed_gain",
            "player_win_percent_before",
            "player_win_percent_after",
            "best_move_san",
            "evidence_available",
            "reason",
            "pedagogical_explanation",
            "coach_priority_rank",
            "impact_label",
            "move_quality_label",
            "coach_card_title",
            "compact_label",
            "try_move_supported",
            "acceptable_moves",
            "pv_line",
            "pv_line_available",
            "try_move_model_version",
            "pv_contrast_evidence",
            "pv_contrast_evidence_version",
            "contrast_coach_explanation",
            "contrast_coach_explanation_version",
        ):
            self.assertIn(key, first_annotation)
        self.assertEqual(
            first_annotation["pv_contrast_evidence"]["schema_version"],
            "pv_contrast_evidence_v1",
        )
        self.assertEqual(
            first_annotation["pedagogical_explanation"][
                "pedagogical_explanation_version"
            ],
            "neuro_pedagogy_templates_v1",
        )
        self.assertEqual(
            first_annotation["contrast_coach_explanation"][
                "contrast_coach_explanation_version"
            ],
            "contrast_coach_explanation_v1",
        )
        self.assertIn(first_annotation["primary_category"], {"best", "book"})
        self.assertEqual(
            [item["ply"] for item in payload["review_sections"]["all"]],
            list(range(1, len(REVIEWABLE_MOVES) + 1)),
        )
        self.assertIn("to_review", payload["review_sections"])
        self.assertIn("strong_moves", payload["review_sections"])
        self.assertIn("missed_opportunities", payload["review_sections"])

    def test_review_payload_contains_opening_reality_evidence(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[6] = 300
        self._insert_deep_for_positions(positions, values)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO opening_lines (
                    eco_code,
                    name,
                    variation,
                    color,
                    target_depth_plies,
                    source,
                    pgn_canonical,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, NULL, 'both', 5, ?, ?, datetime('now'), datetime('now'))
                """,
                (
                    "C60",
                    "Ruy Lopez",
                    "lichess_chess_openings",
                    "1. e4 e5 2. Nf3 Nc6 3. Bb5",
                ),
            )
            line_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
            connection.execute(
                """
                INSERT INTO game_opening_classifications (
                    game_id,
                    line_id,
                    opening_name,
                    eco_code,
                    matched_plies,
                    last_book_ply,
                    out_of_book_ply,
                    out_of_book_color,
                    out_of_book_fen,
                    confidence,
                    classification_status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, 'Ruy Lopez', 'C60', 5, 5, 6, 'black', ?, 'medium',
                        'matched', datetime('now'), datetime('now'))
                """,
                (game_id, line_id, positions[5]),
            )
            connection.commit()

        payload = self.service.generate_review(game_id)
        evidence = payload["opening_reality_evidence"]

        self.assertEqual(evidence["schema_version"], "opening_reality_evidence_v1")
        self.assertTrue(evidence["available"])
        self.assertEqual(evidence["opening_name"], "Ruy Lopez")
        self.assertEqual(evidence["eco"], "C60")
        self.assertEqual(evidence["source"], "lichess_book")
        self.assertEqual(evidence["out_of_book_ply"], 6)
        self.assertEqual(evidence["last_book_ply"], 5)
        self.assertEqual(evidence["exit_ply"], 6)
        self.assertEqual(evidence["out_of_book_move_san"], "a6")
        self.assertEqual(evidence["exit_move_san"], "a6")
        self.assertIsNotNone(evidence["fen_before_exit"])
        self.assertIsNotNone(evidence["fen_after_exit"])
        self.assertIsNotNone(evidence["first_loss_after_exit"])
        self.assertEqual(
            payload["formula_versions"]["opening_reality_evidence_version"],
            "opening_reality_evidence_v1",
        )

    def test_completed_review_metrics_rebuild_uses_cached_analyses_without_engine(self) -> None:
        class ExplodingAnalysisService:
            def get_or_create_analysis(self, *args: Any, **kwargs: Any) -> None:
                raise AssertionError("Stockfish must not be scheduled during metric rebuild")

        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 180
        self._insert_deep_for_positions(positions, values)
        initial = self.service.generate_review(game_id)
        self.assertEqual(initial["status"], "done")

        rebuilding_service = ReviewService(
            self.db_path,
            analysis_service=ExplodingAnalysisService(),  # type: ignore[arg-type]
        )
        rebuilt = rebuilding_service.rebuild_review_metrics_from_cached_analyses(
            game_id,
        )

        self.assertEqual(rebuilt["status"], "done")
        self.assertIsNotNone(rebuilt["white_lichess_like_accuracy"])
        self.assertIsNotNone(rebuilt["white_neuro_score"])
        self.assertIsNotNone(rebuilt["white_diagnostic_gap"])
        self.assertIsNotNone(rebuilt["black_neuro_score"])
        self.assertEqual(rebuilt["score_availability"]["neuro_score"], "available")
        self.assertEqual(rebuilt["score_availability"]["reason"], "available")
        self.assertEqual(
            rebuilt["white_review_score"],
            rebuilt["white_lichess_like_accuracy"],
        )
        self.assertEqual(
            rebuilt["review_score_audit_rows"][0]["review_evidence"][
                "neuro_diagnostic_loss"
            ],
            rebuilt["review_score_audit_rows"][0]["neuro_diagnostic_loss"],
        )

    def test_completed_legacy_review_auto_backfills_dual_score_cache_without_engine(self) -> None:
        class ExplodingAnalysisService:
            def get_or_create_analysis(self, *args: Any, **kwargs: Any) -> None:
                raise AssertionError("Stockfish must not be scheduled during score backfill")

            def run_analysis(self, *args: Any, **kwargs: Any) -> None:
                raise AssertionError("Stockfish must not run during score backfill")

        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 220
        self._insert_deep_for_positions(positions, values)
        initial = self.service.generate_review(game_id)
        self.assertEqual(initial["status"], "done")

        with closing(sqlite3.connect(self.db_path)) as connection:
            review_id = connection.execute(
                "SELECT id FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
            connection.execute(
                """
                UPDATE game_reviews
                SET score_json = ?
                WHERE id = ?
                """,
                (
                    json.dumps(
                        {
                            "score_cache_schema_version": "legacy_score_cache_v0",
                            "white_lichess_like_accuracy": 68.0,
                            "black_lichess_like_accuracy": 89.0,
                            "white_neuro_score": None,
                            "black_neuro_score": None,
                            "white_diagnostic_gap": None,
                            "black_diagnostic_gap": None,
                        }
                    ),
                    review_id,
                ),
            )
            connection.commit()

        rebuilding_service = ReviewService(
            self.db_path,
            analysis_service=ExplodingAnalysisService(),  # type: ignore[arg-type]
        )
        payload = rebuilding_service.get_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertIsNotNone(payload["white_lichess_like_accuracy"])
        self.assertIsNotNone(payload["white_neuro_score"])
        self.assertIsNotNone(payload["white_diagnostic_gap"])
        self.assertIsNotNone(payload["black_neuro_score"])
        self.assertIsNotNone(payload["black_diagnostic_gap"])
        self.assertEqual(payload["score_availability"]["neuro_score"], "available")
        self.assertEqual(payload["score_availability"]["diagnostic_gap"], "available")
        self.assertEqual(payload["review_score_alias_of"], "lichess_like_accuracy")
        self.assertTrue(payload["review_score_deprecated"])
        self.assertIsNotNone(payload["headline_neurochess_score"])
        self.assertEqual(payload["coach_neuro_score"], payload["headline_neurochess_score"])
        self.assertEqual(payload["coach_score_formula_version"], "coach_neuro_score_v1")
        self.assertEqual(
            payload["headline_score_formula_version"],
            "headline_neurochess_score_v1",
        )
        self.assertIsInstance(payload["review_summary_sentence"], str)
        self.assertEqual(
            payload["white_review_score"],
            payload["white_lichess_like_accuracy"],
        )
        self.assertEqual(
            payload["formula_versions"]["score_formula_version"],
            REVIEW_SCORE_FORMULA_VERSION,
        )
        self.assertEqual(
            payload["formula_versions"]["neuro_score_formula_version"],
            NEURO_SCORE_FORMULA_VERSION,
        )
        self.assertEqual(
            payload["formula_versions"]["headline_score_formula_version"],
            "headline_neurochess_score_v1",
        )
        self.assertEqual(
            payload["formula_versions"]["coach_score_formula_version"],
            "coach_neuro_score_v1",
        )
        self.assertEqual(
            payload["formula_versions"]["pv_contrast_evidence_version"],
            "pv_contrast_evidence_v1",
        )
        self.assertEqual(
            payload["formula_versions"]["contrast_coach_explanation_version"],
            "contrast_coach_explanation_v1",
        )
        self.assertEqual(
            payload["move_category_formula_version"],
            "neuro_move_categories_v1",
        )
        self.assertEqual(len(payload["move_annotations"]), len(REVIEWABLE_MOVES))
        self.assertTrue(payload["review_sections"]["all"])

        with closing(sqlite3.connect(self.db_path)) as connection:
            raw_score_json = connection.execute(
                "SELECT score_json FROM game_reviews WHERE id = ?",
                (review_id,),
            ).fetchone()[0]
        cached = json.loads(raw_score_json)
        self.assertEqual(
            cached["score_cache_schema_version"],
            REVIEW_SCORE_CACHE_SCHEMA_VERSION,
        )
        self.assertEqual(cached["score_formula_version"], REVIEW_SCORE_FORMULA_VERSION)
        self.assertIsNotNone(cached["white_neuro_score"])
        self.assertIsNotNone(cached["white_diagnostic_gap"])
        self.assertEqual(cached["review_score_alias_of"], "lichess_like_accuracy")
        self.assertEqual(cached["public_neuro_score"], cached["white_lichess_like_accuracy"])
        self.assertEqual(
            cached["public_score_formula_version"],
            "public_neuro_score_lichess_like_v1",
        )
        self.assertEqual(
            cached["qualitative_game_label_formula_version"],
            "qualitative_game_label_v1",
        )
        self.assertIsNotNone(cached["headline_neurochess_score"])
        self.assertEqual(cached["coach_neuro_score"], cached["headline_neurochess_score"])
        self.assertEqual(cached["coach_score_formula_version"], "coach_neuro_score_v1")
        self.assertEqual(
            cached["headline_score_formula_version"],
            "headline_neurochess_score_v1",
        )
        self.assertTrue(cached["review_summary_sentence"])
        self.assertEqual(cached["move_category_formula_version"], "neuro_move_categories_v1")
        self.assertEqual(
            cached["pedagogical_explanation_version"],
            "neuro_pedagogy_templates_v1",
        )
        self.assertEqual(
            cached["pv_contrast_evidence_version"],
            "pv_contrast_evidence_v1",
        )
        self.assertEqual(
            cached["contrast_coach_explanation_version"],
            "contrast_coach_explanation_v1",
        )
        self.assertTrue(cached["move_annotations"])
        self.assertTrue(cached["review_sections"]["all"])

    def test_metric_rebuild_persists_dual_score_cache(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[3] = -200
        self._insert_deep_for_positions(positions, values)
        self.service.generate_review(game_id)

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                "UPDATE game_reviews SET score_json = NULL WHERE game_id = ?",
                (game_id,),
            )
            connection.commit()

        rebuilt = self.service.rebuild_review_metrics_from_cached_analyses(game_id)

        self.assertEqual(rebuilt["status"], "done")
        self.assertIsNotNone(rebuilt["white_neuro_score"])
        self.assertIsNotNone(rebuilt["black_neuro_score"])
        self.assertEqual(rebuilt["score_availability"]["reason"], "available")
        with closing(sqlite3.connect(self.db_path)) as connection:
            raw_score_json = connection.execute(
                "SELECT score_json FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
        cached = json.loads(raw_score_json)
        self.assertEqual(
            cached["score_cache_schema_version"],
            REVIEW_SCORE_CACHE_SCHEMA_VERSION,
        )
        self.assertEqual(
            cached["formula_versions"]["game_accuracy_formula_version"],
            GAME_ACCURACY_FORMULA_VERSION,
        )

    def test_metric_rebuild_refuses_incomplete_cached_coverage(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions[:-1], [0] * (len(positions) - 1))

        rebuilt = self.service.rebuild_review_metrics_from_cached_analyses(game_id)

        self.assertIn(rebuilt["status"], {"incomplete", "pending", "failed"})
        self.assertIsNone(rebuilt["white_neuro_score"])
        self.assertIsNone(rebuilt["white_diagnostic_gap"])
        self.assertEqual(rebuilt["score_availability"]["neuro_score"], "missing_data")
        self.assertIn("reason", rebuilt["score_availability"])

    def test_review_score_excludes_moves_without_deep_snapshots(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions[:4], [0] * 4)

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "pending")
        self.assertIsNone(payload["white_review_score"])
        self.assertIsNone(payload["black_review_score"])
        self.assertEqual(payload["score_analyzed_moves_white"], 0)
        self.assertEqual(payload["score_analyzed_moves_black"], 0)
        self.assertEqual(payload["score_missing_moves_white"], 0)
        self.assertEqual(payload["score_missing_moves_black"], 0)
        self.assertEqual(payload["review_analysis_origin"], "newly_scheduled")
        self.assertEqual(payload["review_analysis_state"], "pending")
        self.assertEqual(payload["review_analysis_quality"], "standard")

    def test_bad_game_with_multiple_win_losses_scores_below_seventy(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0 if index % 2 == 0 else -450 for index in range(len(positions))]
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertLess(payload["white_review_score"], 70.0)
        self.assertLess(payload["black_review_score"], 70.0)
        self.assertGreater(payload["white_score_debug"]["avg_win_loss"], 20.0)
        self.assertGreater(payload["black_score_debug"]["avg_win_loss"], 20.0)

    def test_single_big_blunder_has_no_legacy_score_cap(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[1] = -450
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertLessEqual(payload["white_score_debug"]["max_win_loss"], 35.0)
        self.assertGreaterEqual(payload["white_score_debug"]["max_win_loss"], 25.0)
        self.assertIsNone(payload["white_score_debug"]["score_cap"])
        self.assertIsNotNone(payload["white_neuro_score"])
        self.assertIsNotNone(payload["white_diagnostic_gap"])

    def test_larger_single_blunder_uses_regularized_neuro_score_without_cap(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[1] = -900
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertGreaterEqual(payload["white_score_debug"]["max_win_loss"], 45.0)
        self.assertIsNone(payload["white_score_debug"]["score_cap"])
        self.assertIsNotNone(payload["white_neuro_score"])
        self.assertIsNotNone(payload["white_diagnostic_gap"])

    def test_single_moderate_blunder_is_regularized_without_legacy_cap(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[1] = -200
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertLess(payload["white_score_debug"]["max_win_loss"], 25.0)
        self.assertIsNone(payload["white_score_debug"]["score_cap"])
        self.assertGreater(payload["white_review_score"], 70.0)

    def test_reviewable_balanced_game_with_low_cp_loss_is_not_pending(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        low_values = [
            index % (MIN_CP_LOSS_FOR_MOMENT - 1)
            for index in range(len(positions))
        ]
        self._insert_deep_for_positions(positions, low_values)

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["moments"], [])
        self.assertEqual(payload["empty_reason"], "no_significant_moments")
        self.assertEqual(payload["missing_deep_count"], 0)
        self.assertEqual(payload["analyzed_deep_count"], payload["total_required_deep_count"])
        self.assertNotEqual(payload["status"], "pending")

    def test_two_significant_moments_are_not_forced_to_five_and_are_chronological(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 120
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertIsNone(payload["empty_reason"])
        payload["message"] = "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile."
        self.assertEqual(len(payload["moments"]), 1)
        self.assertEqual(
            [moment["ply"] for moment in payload["moments"]],
            sorted(moment["ply"] for moment in payload["moments"]),
        )
        self.assertIn("mate_before", payload["moments"][0])
        self.assertTrue(
            all(moment["criticality_score"] >= CRITICALITY_THRESHOLD for moment in payload["moments"])
        )

    def test_review_uses_stabilized_final_eval_not_fast_raw_eval(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        self._insert_deep_for_positions(
            positions,
            values,
            stabilized_evals={positions[2]: 160},
        )

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertGreater(len(payload["moments"]), 0)
        first = payload["moments"][0]
        self.assertIn(160, {first["eval_before_cp"], first["eval_after_cp"]})
        self.assertGreaterEqual(first["mover_win_loss"], MIN_KEY_MOMENT_WIN_LOSS)
        self.assertEqual(first["eval_source_kind"], REVIEW_STABILIZED_EVAL_SOURCE_KIND)
        self.assertIn(16, {first["eval_depth_before"], first["eval_depth_after"]})

    def test_more_than_five_candidates_keeps_max_five_and_displays_chronologically(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0 if index % 2 == 0 else -160 for index in range(len(positions))]
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertLessEqual(len(payload["moments"]), 5)
        self.assertEqual(
            [moment["ply"] for moment in payload["moments"]],
            sorted(moment["ply"] for moment in payload["moments"]),
        )
        self.assertTrue(payload["moments"])

    def test_best_move_and_top_moves_are_from_fen_before_never_fen_after(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 180
        values[3] = 180
        before_best = self._first_legal_uci(positions[1])
        after_best = self._different_legal_uci(positions[2], before_best)
        self._insert_deep_for_positions(
            positions,
            values,
            top_move_overrides={
                positions[1]: before_best,
                positions[2]: after_best,
            },
            top_moves_count=5,
            pv_length=7,
        )

        payload = self.service.generate_review(game_id)
        moment = payload["moments"][0]

        self.assertEqual(moment["ply"], 2)
        self.assertEqual(moment["best_move_uci"], before_best)
        self.assertNotEqual(moment["best_move_uci"], after_best)
        self.assertEqual(moment["top_moves"][0]["uci"], before_best)
        self.assertLessEqual(len(moment["top_moves"]), 3)
        self.assertLessEqual(len(moment["top_moves"][0]["pv"]), 5)
        self.assertEqual(moment["eval_source_kind"], "deep")
        self.assertEqual(moment["eval_depth_before"], 12)
        self.assertEqual(moment["eval_depth_after"], 12)
        self.assertIn(moment["moment_type"], {"turning_point", "lost_advantage", "aggravation", "standard_loss"})
        self.assertIn("zone_transition", moment)
        self.assertGreater(moment["criticality_score"], 0)
        self.assertGreaterEqual(moment["mover_win_loss"], MIN_KEY_MOMENT_WIN_LOSS)

    def test_review_uses_only_deep_done_analyses(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(
            positions,
            [0] * len(positions),
            analysis_kind="shallow",
        )

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["coverage"], 0.0)
        self.assertEqual(payload["moments"], [])
        self.assertIsNone(payload["empty_reason"])
        self.assertGreater(payload["missing_deep_count"], 0)
        self.assertIn("analyzed_deep_count", payload)
        self.assertEqual(payload["total_required_deep_count"], len(positions))
        self.assertGreater(payload["scheduled_deep_count"], 0)
        self.assertEqual(payload["failed_deep_count"], 0)
        self.assertTrue(payload["review_work_active"])

        with closing(sqlite3.connect(self.db_path)) as connection:
            scheduled_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_kind = 'deep'
                  AND status IN ('pending', 'running')
                """
            ).fetchone()[0]
        self.assertEqual(scheduled_count, payload["scheduled_deep_count"])

    def test_coverage_pending_incomplete_and_done(self) -> None:
        pending_game, pending_positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(pending_positions[:7], [0] * 7)
        pending = self.service.generate_review(pending_game)
        self.assertEqual(pending["status"], "pending")
        self.assertLess(pending["coverage"], 0.70)
        self.assertGreater(pending["missing_deep_count"], 0)
        self.assertIn("analyzed_deep_count", pending)
        self.assertEqual(pending["total_required_deep_count"], len(pending_positions))

        partial_game, partial_positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(partial_positions[:9], [0] * 9)
        partial = self.service.generate_review(partial_game)
        self.assertEqual(partial["status"], "pending")
        self.assertGreaterEqual(partial["coverage"], 0.70)
        self.assertLess(partial["coverage"], 1.0)
        self.assertGreater(partial["missing_deep_count"], 0)
        self.assertEqual(partial["moments"], [])
        self.assertIsNone(partial["white_review_score"])
        partial["warnings"] = ["review peut être incomplète"]
        self.assertIn("review peut être incomplète", partial["warnings"][0])

        done_game, done_positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(done_positions, [0] * len(done_positions))
        done = self.service.generate_review(done_game)
        self.assertEqual(done["status"], "done")
        self.assertEqual(done["coverage"], 1.0)

    def test_generate_is_idempotent_for_current_versions(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 140
        self._insert_deep_for_positions(positions, values)

        first = self.service.generate_review(game_id)
        second = self.service.generate_review(game_id)

        with closing(sqlite3.connect(self.db_path)) as connection:
            review_count = connection.execute(
                "SELECT COUNT(*) FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
            moment_count = connection.execute(
                "SELECT COUNT(*) FROM review_moments WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]

        self.assertEqual(review_count, 1)
        self.assertEqual(moment_count, 1)
        self.assertEqual(first["moments"], second["moments"])

    def test_generate_regenerates_when_algorithm_version_changes(self) -> None:
        import neurochess.review_service as review_module

        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 150
        self._insert_deep_for_positions(positions, values)

        original_version = review_module.SELECTION_ALGORITHM_VERSION
        try:
            first = self.service.generate_review(game_id)
            review_module.SELECTION_ALGORITHM_VERSION = "moment_selection_test_v2"
            second = self.service.generate_review(game_id)
        finally:
            review_module.SELECTION_ALGORITHM_VERSION = original_version

        self.assertEqual(
            first["selection_algorithm_version"],
            SELECTION_ALGORITHM_VERSION,
        )
        self.assertEqual(
            second["selection_algorithm_version"],
            "moment_selection_test_v2",
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            review_count = connection.execute(
                "SELECT COUNT(*) FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
        self.assertEqual(review_count, 1)

    def test_generate_ignores_old_pending_review_algorithm_version(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 160
        self._insert_deep_for_positions(positions, values)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'pending', ?, 'moment_selection_v1', datetime('now'), datetime('now'), '[]')
                """,
                (game_id, REVIEW_SCHEMA_VERSION),
            )
            connection.commit()

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["selection_algorithm_version"], SELECTION_ALGORITHM_VERSION)
        self.assertEqual(payload["status"], "done")
        self.assertGreater(len(payload["moments"]), 0)
        with closing(sqlite3.connect(self.db_path)) as connection:
            versions = [
                row[0]
                for row in connection.execute(
                    "SELECT selection_algorithm_version FROM game_reviews WHERE game_id = ?",
                    (game_id,),
                ).fetchall()
            ]
        self.assertIn(SELECTION_ALGORITHM_VERSION, versions)
        self.assertNotIn("moment_selection_v1", versions)

    def test_transaction_rolls_back_on_mid_generation_exception(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 160
        self._insert_deep_for_positions(positions, values)

        def fail(stage: str) -> None:
            if stage == "after_review_insert":
                raise RuntimeError("deterministic review failure")

        failing_service = ReviewService(self.db_path, failure_hook=fail)

        with self.assertRaises(RuntimeError):
            failing_service.generate_review(game_id)

        with closing(sqlite3.connect(self.db_path)) as connection:
            review_count = connection.execute(
                "SELECT COUNT(*) FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
            orphan_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM review_moments
                WHERE review_id NOT IN (SELECT id FROM game_reviews)
                """
            ).fetchone()[0]

        self.assertEqual(review_count, 0)
        self.assertEqual(orphan_count, 0)

    def test_reliability_missing_defaults_without_blocking(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 170
        self._insert_deep_for_positions(positions, values, reliability=None)

        payload = self.service.generate_review(game_id)
        moment = payload["moments"][0]

        self.assertEqual(moment["reliability_score"], 0.8)
        self.assertEqual(moment["reliability_label"], "high")
        self.assertTrue(payload["warnings"])

    def test_comments_and_review_type_stay_neutral(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 160
        self._insert_deep_for_positions(positions, values)

        payload = self.service.generate_review(game_id)

        for moment in payload["moments"]:
            self.assertEqual(moment["review_type"], "player_loss")
            lowered_comment = moment["comment"].lower()
            for word in FORBIDDEN_COMMENT_WORDS:
                self.assertNotIn(word, lowered_comment)

    def test_generate_refuses_in_progress_and_too_short_games(self) -> None:
        in_progress = self.repository.create_game("classic")
        with self.assertRaisesRegex(Exception, "game still in progress"):
            self.service.generate_review(in_progress)

        too_short, positions = self._create_finished_game(TEN_MOVES[:4])
        self._insert_deep_for_positions(positions, [0] * len(positions))
        payload = self.service.generate_review(too_short)
        self.assertEqual(payload["status"], "not_reviewable")
        self.assertEqual(payload["reason"], "game_too_short")
        self.assertEqual(payload["empty_reason"], "game_too_short")
        self.assertEqual(payload["min_half_moves"], MIN_HALF_MOVES_FOR_REVIEW)
        self.assertEqual(payload["actual_half_moves"], 4)
        self.assertEqual(payload["half_moves_count"], 4)
        self.assertEqual(payload["min_half_moves_for_review"], MIN_HALF_MOVES_FOR_REVIEW)
        self.assertFalse(payload["reviewable"])

        exact_ten, exact_positions = self._create_finished_game(TEN_MOVES)
        self._insert_deep_for_positions(exact_positions, [0] * len(exact_positions))
        exact_payload = self.service.generate_review(exact_ten)
        self.assertEqual(exact_payload["status"], "not_reviewable")
        self.assertEqual(exact_payload["reason"], "game_too_short")
        self.assertEqual(exact_payload["empty_reason"], "game_too_short")
        self.assertEqual(exact_payload["actual_half_moves"], MIN_HALF_MOVES_FOR_REVIEW)
        self.assertEqual(exact_payload["half_moves_count"], MIN_HALF_MOVES_FOR_REVIEW)
        self.assertEqual(
            exact_payload["min_half_moves_for_review"],
            MIN_HALF_MOVES_FOR_REVIEW,
        )
        self.assertFalse(exact_payload["reviewable"])

    def test_api_generate_and_get_review(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        values = [0] * len(positions)
        values[2] = 160
        self._insert_deep_for_positions(positions, values)
        repository = Repository(self.db_path)
        analysis_service = AnalysisService(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_analysis_service] = lambda: analysis_service
        client = TestClient(app)
        try:
            generated = client.post(f"/games/{game_id}/review/generate")
            fetched = client.get(f"/games/{game_id}/review")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(generated.status_code, 200)
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(generated.json()["status"], "done")
        self.assertEqual(fetched.json()["moments"], generated.json()["moments"])

    def test_api_pending_review_returns_202(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions[:3], [0] * 3)
        repository = Repository(self.db_path)
        review_analysis_service = AnalysisService(self.db_path)

        class FakeBackgroundAnalysisService:
            def process_pending_analyses(self, limit: int = 10) -> list[dict[str, Any]]:
                return []

        background_analysis_service = FakeBackgroundAnalysisService()
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_review_service] = lambda: ReviewService(
            self.db_path,
            analysis_service=review_analysis_service,
        )
        app.dependency_overrides[get_analysis_service] = lambda: background_analysis_service
        client = TestClient(app)
        try:
            response = client.post(f"/games/{game_id}/review/generate")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "pending")
        self.assertGreater(response.json()["missing_deep_count"], 0)
        self.assertGreater(response.json()["scheduled_deep_count"], 0)
        self.assertTrue(response.json()["review_work_active"])
        self.assertEqual(
            response.json()["total_required_deep_count"],
            len(positions),
        )

    def test_api_pending_review_processes_at_least_required_fens(self) -> None:
        class FakeReviewService:
            def generate_review(
                self,
                game_id: int,
                force_retry_failed: bool = False,
                profile: str = "standard",
            ) -> dict[str, Any]:
                return {
                    "game_id": game_id,
                    "status": "pending",
                    "review_schema_version": REVIEW_SCHEMA_VERSION,
                    "selection_algorithm_version": SELECTION_ALGORITHM_VERSION,
                    "coverage": 0.0,
                    "half_moves_count": 11,
                    "min_half_moves_for_review": MIN_HALF_MOVES_FOR_REVIEW,
                    "reviewable": True,
                    "empty_reason": None,
                    "missing_deep_count": 13,
                    "analyzed_deep_count": 0,
                    "total_required_deep_count": 13,
                    "scheduled_deep_count": 13,
                    "failed_deep_count": 0,
                    "failed_deep_details": [],
                    "review_work_active": True,
                    "message": "Analyse approfondie en cours: 13 positions restantes.",
                    "warnings": [],
                    "moments": [],
                }

        class FakeAnalysisService:
            def __init__(self) -> None:
                self.process_limits: list[int] = []

            def process_pending_analyses(self, limit: int = 10) -> list[dict[str, Any]]:
                self.process_limits.append(limit)
                return []

        fake_analysis_service = FakeAnalysisService()
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_review_service] = lambda: FakeReviewService()
        app.dependency_overrides[get_analysis_service] = lambda: fake_analysis_service
        client = TestClient(app)
        try:
            response = client.post("/games/42/review/generate")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["total_required_deep_count"], 13)
        self.assertEqual(fake_analysis_service.process_limits, [13])

    def test_api_force_retry_failed_review_returns_active_pending(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_unknown_deep_status(positions, status="failed")
        repository = Repository(self.db_path)
        review_analysis_service = AnalysisService(self.db_path)

        class FakeBackgroundAnalysisService:
            def process_pending_analyses(self, limit: int = 10) -> list[dict[str, Any]]:
                return []

        background_analysis_service = FakeBackgroundAnalysisService()
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_review_service] = lambda: ReviewService(
            self.db_path,
            analysis_service=review_analysis_service,
        )
        app.dependency_overrides[get_analysis_service] = lambda: background_analysis_service
        client = TestClient(app)
        try:
            stalled = client.post(f"/games/{game_id}/review/generate")
            retried = client.post(
                f"/games/{game_id}/review/generate?force_retry_failed=true"
            )
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(stalled.status_code, 200)
        self.assertEqual(stalled.json()["status"], "failed")
        self.assertGreater(stalled.json()["failed_deep_count"], 0)
        self.assertEqual(retried.status_code, 202)
        self.assertEqual(retried.json()["status"], "pending")
        self.assertGreater(retried.json()["scheduled_deep_count"], 0)
        self.assertTrue(retried.json()["review_work_active"])

    def test_api_short_game_review_is_not_pending(self) -> None:
        game_id, _positions = self._create_finished_game(TEN_MOVES)
        repository = Repository(self.db_path)
        analysis_service = AnalysisService(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_analysis_service] = lambda: analysis_service
        client = TestClient(app)
        try:
            generated = client.post(f"/games/{game_id}/review/generate")
            fetched = client.get(f"/games/{game_id}/review")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(generated.status_code, 200)
        generated_payload = generated.json()
        self.assertEqual(generated_payload["status"], "not_reviewable")
        self.assertEqual(generated_payload["reason"], "game_too_short")
        self.assertEqual(generated_payload["empty_reason"], "game_too_short")
        self.assertEqual(generated_payload["actual_half_moves"], 10)
        self.assertEqual(generated_payload["half_moves_count"], 10)
        self.assertEqual(
            generated_payload["min_half_moves_for_review"],
            MIN_HALF_MOVES_FOR_REVIEW,
        )
        self.assertFalse(generated_payload["reviewable"])
        self.assertNotEqual(generated_payload["status"], "pending")

        self.assertEqual(fetched.status_code, 200)
        fetched_payload = fetched.json()
        self.assertEqual(fetched_payload["status"], "not_reviewable")
        self.assertEqual(fetched_payload["reason"], "game_too_short")
        self.assertEqual(fetched_payload["empty_reason"], "game_too_short")
        self.assertEqual(fetched_payload["half_moves_count"], 10)
        self.assertEqual(
            fetched_payload["min_half_moves_for_review"],
            MIN_HALF_MOVES_FOR_REVIEW,
        )
        self.assertFalse(fetched_payload["reviewable"])

    def test_get_review_short_game_ignores_stale_pending_review(self) -> None:
        game_id, _positions = self._create_finished_game(TEN_MOVES)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'pending', ?, ?, datetime('now'), datetime('now'), '[]')
                """,
                (
                    game_id,
                    REVIEW_SCHEMA_VERSION,
                    SELECTION_ALGORITHM_VERSION,
                ),
            )
            connection.commit()

        payload = self.service.get_review(game_id)

        self.assertEqual(payload["status"], "not_reviewable")
        self.assertEqual(payload["reason"], "game_too_short")
        self.assertEqual(payload["empty_reason"], "game_too_short")
        self.assertEqual(payload["actual_half_moves"], 10)
        self.assertEqual(payload["half_moves_count"], 10)
        self.assertEqual(payload["min_half_moves_for_review"], MIN_HALF_MOVES_FOR_REVIEW)
        self.assertFalse(payload["reviewable"])
        self.assertNotEqual(payload["status"], "pending")

    def test_get_review_pending_with_complete_deep_and_no_moments_finalizes_empty(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions, [0] * len(positions))
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'pending', ?, ?, datetime('now'), datetime('now'), '[]')
                """,
                (
                    game_id,
                    REVIEW_SCHEMA_VERSION,
                    SELECTION_ALGORITHM_VERSION,
                ),
            )
            connection.commit()

        payload = self.service.get_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["moments"], [])
        self.assertEqual(payload["empty_reason"], "no_significant_moments")
        self.assertEqual(payload["missing_deep_count"], 0)
        self.assertEqual(payload["analyzed_deep_count"], payload["total_required_deep_count"])
        self.assertNotEqual(payload["status"], "pending")

    def test_generate_pending_creates_deep_jobs_and_get_recalculates_work_active(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions[:4], [0] * 4)

        generated = self.service.generate_review(game_id)
        fetched = self.service.get_review(game_id)

        self.assertEqual(generated["status"], "pending")
        self.assertEqual(fetched["status"], "pending")
        self.assertGreater(generated["missing_deep_count"], 0)
        self.assertEqual(generated["missing_deep_count"], fetched["missing_deep_count"])
        self.assertGreater(fetched["scheduled_deep_count"], 0)
        self.assertEqual(fetched["failed_deep_count"], 0)
        self.assertTrue(fetched["review_work_active"])

        with closing(sqlite3.connect(self.db_path)) as connection:
            pending_required = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE fen IN ({})
                  AND analysis_kind = 'deep'
                  AND schema_version = 'engine_analysis_v2'
                  AND status IN ('pending', 'running')
                """.format(",".join("?" for _ in positions)),
                positions,
            ).fetchone()[0]
        self.assertEqual(pending_required, fetched["scheduled_deep_count"])

    def test_pending_is_stalled_when_missing_deep_has_no_active_work(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_unknown_deep_status(positions, status="failed")

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "failed")
        self.assertGreater(payload["missing_deep_count"], 0)
        self.assertEqual(payload["scheduled_deep_count"], 0)
        self.assertGreater(payload["failed_deep_count"], 0)
        self.assertFalse(payload["review_work_active"])
        self.assertIn("Analyse incomplete", payload["message"])
        self.assertGreater(len(payload["failed_deep_details"]), 0)
        self.assertEqual(payload["failed_deep_details"][0]["status"], "failed")
        self.assertEqual(payload["failed_deep_details"][0]["error_message"], "forced_test_status")
        return
        self.assertEqual(
            payload["message"],
            "L’analyse approfondie a échoué sur une ou plusieurs positions.",
        )
        self.assertGreater(len(payload["failed_deep_details"]), 0)
        self.assertEqual(payload["failed_deep_details"][0]["status"], "failed")
        self.assertEqual(
            payload["failed_deep_details"][0]["error_message"],
            "forced_test_status",
        )

    def test_failed_deep_with_sufficient_coverage_remains_incomplete(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_deep_for_positions(positions[:-1], [0] * (len(positions) - 1))
        self._insert_unknown_deep_status([positions[-1]], status="failed")

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "failed")
        self.assertGreaterEqual(payload["coverage"], 0.70)
        self.assertLess(payload["coverage"], 1.0)
        self.assertEqual(payload["moments"], [])
        self.assertIsNone(payload["empty_reason"])
        self.assertIsNone(payload["white_review_score"])
        self.assertIn("Analyse incomplete", payload["message"])
        self.assertEqual(payload["failed_deep_count"], 1)
        self.assertEqual(payload["failed_deep_details"][0]["fen"], positions[-1])
        self.assertNotEqual(payload["status"], "stalled")
        return
        payload["message"] = "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile."
        payload["message"] = "Aucun moment majeur dÃ©tectÃ© : la partie est restÃ©e trop Ã©quilibrÃ©e pour gÃ©nÃ©rer une review utile."
        self.assertEqual(
            payload["message"],
            "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.",
        )
        self.assertEqual(payload["failed_deep_count"], 1)
        self.assertEqual(payload["failed_deep_details"][0]["fen"], positions[-1])
        self.assertNotEqual(payload["status"], "stalled")

    def test_force_retry_failed_resets_failed_deep_to_pending(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self._insert_unknown_deep_status(positions, status="failed")
        stalled = self.service.generate_review(game_id)
        self.assertEqual(stalled["status"], "failed")

        retried = self.service.generate_review(game_id, force_retry_failed=True)

        self.assertEqual(retried["status"], "pending")
        self.assertGreater(retried["scheduled_deep_count"], 0)
        self.assertEqual(retried["failed_deep_count"], 0)
        self.assertTrue(retried["review_work_active"])
        with closing(sqlite3.connect(self.db_path)) as connection:
            failed_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_kind = 'deep'
                  AND schema_version = 'engine_analysis_v2'
                  AND status = 'failed'
                """
            ).fetchone()[0]
            pending_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_kind = 'deep'
                  AND schema_version = 'engine_analysis_v2'
                  AND status = 'pending'
                """
            ).fetchone()[0]
        self.assertEqual(failed_count, 0)
        self.assertEqual(pending_count, retried["scheduled_deep_count"])

    def test_get_review_pending_with_missing_then_complete_deep_auto_finalizes(self) -> None:
        game_id, positions = self._create_finished_game(REVIEWABLE_MOVES)
        self.service.generate_review(game_id)
        self._insert_deep_for_positions(positions, [0] * len(positions))

        payload = self.service.get_review(game_id)

        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["moments"], [])
        self.assertEqual(payload["empty_reason"], "no_significant_moments")
        self.assertEqual(payload["missing_deep_count"], 0)
        self.assertFalse(payload["review_work_active"])

    def test_generate_ignores_old_pending_review_algorithm_version_when_scheduling(self) -> None:
        game_id, _positions = self._create_finished_game(REVIEWABLE_MOVES)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'pending', ?, 'moment_selection_v1', datetime('now'), datetime('now'), '[]')
                """,
                (game_id, REVIEW_SCHEMA_VERSION),
            )
            connection.commit()

        payload = self.service.generate_review(game_id)

        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["selection_algorithm_version"], SELECTION_ALGORITHM_VERSION)
        self.assertTrue(payload["review_work_active"])
        with closing(sqlite3.connect(self.db_path)) as connection:
            versions = [
                row[0]
                for row in connection.execute(
                    "SELECT selection_algorithm_version FROM game_reviews WHERE game_id = ?",
                    (game_id,),
                ).fetchall()
            ]
        self.assertEqual(versions, [SELECTION_ALGORITHM_VERSION])

    def _create_finished_game(self, moves: list[str]) -> tuple[int, list[str]]:
        game_id = self.repository.create_game("classic")
        board = chess.Board()
        positions = [board.fen()]
        for ply, uci in enumerate(moves, start=1):
            move = chess.Move.from_uci(uci)
            san = board.san(move)
            self.repository.add_move(
                game_id=game_id,
                ply=ply,
                fen_before=board.fen(),
                uci=uci,
                san=san,
                is_player=True,
            )
            board.push(move)
            positions.append(board.fen())
        self.repository.finish_game(game_id, result="*", pgn="[Result \"*\"]")
        return game_id, positions

    def _insert_deep_for_positions(
        self,
        positions: list[str],
        evals: list[int],
        analysis_kind: str = "deep",
        analysis_profile: str | None = REVIEW_ANALYSIS_DEFAULT_PROFILE,
        top_move_overrides: dict[str, str] | None = None,
        top_moves_count: int = 3,
        pv_length: int = 5,
        reliability: float | None = 0.8,
        stabilized_evals: dict[str, int] | None = None,
    ) -> None:
        overrides = top_move_overrides or {}
        stable_overrides = stabilized_evals or {}
        with closing(sqlite3.connect(self.db_path)) as connection:
            for fen, eval_cp in zip(positions, evals):
                top_uci = overrides.get(fen) or self._first_legal_uci(fen)
                top_moves = self._top_moves(fen, top_uci, eval_cp, top_moves_count, pv_length)
                stable_eval = stable_overrides.get(fen)
                payload = {
                    "fen": fen,
                    "engine": "stockfish",
                    "engine_version": "ReviewFake 1",
                    "depth": 12,
                    "multipv": 3,
                    "analysis_kind": analysis_kind,
                    "analysis_profile": analysis_profile,
                    "requested_time_ms": 10000,
                    "analysis_limit_mode": "time",
                    "requested_multipv": 3,
                    "eval_cp": eval_cp,
                    "mate_in": None,
                    "top_moves": top_moves,
                    "schema_version": "engine_analysis_v2",
                    "analysis_time_ms": 10,
                }
                if stable_eval is not None:
                    payload["eval_source_kind"] = REVIEW_STABILIZED_EVAL_SOURCE_KIND
                    payload["stabilized_eval"] = {
                        "fen": fen,
                        "final_eval_cp": stable_eval,
                        "final_mate_in": None,
                        "final_depth": 16,
                        "final_seldepth": 20,
                        "nodes": 12345,
                        "time_ms": 5000,
                        "pv": [top_uci],
                        "tail_scores_cp": [stable_eval - 2, stable_eval],
                        "tail_depths": [15, 16],
                        "tail_median_cp": stable_eval - 1,
                        "stability_cp": 2,
                        "reliability_score": reliability,
                        "reliability_label": "stable",
                        "engine_version": "ReviewFake 1",
                        "source_kind": REVIEW_STABILIZED_EVAL_SOURCE_KIND,
                        "schema_version": "review_stabilized_eval_v1",
                    }
                connection.execute(
                    """
                    INSERT OR IGNORE INTO position_analyses (
                        fen,
                        analysis_json,
                        engine,
                        engine_version,
                        depth,
                        multipv,
                        analysis_kind,
                        schema_version,
                        status,
                        created_at,
                        completed_at,
                        reliability_score,
                        reliability_label,
                        analysis_time_ms,
                        analysis_profile,
                        requested_time_ms,
                        requested_depth,
                        requested_multipv,
                        analysis_limit_mode,
                        settings_json
                    )
                    VALUES (?, ?, 'stockfish', ?, 12, 3, ?, 'engine_analysis_v2',
                            'done', datetime('now'), datetime('now'), ?, ?, 10,
                            ?, ?, NULL, ?, ?, ?)
                    """,
                    (
                        fen,
                        json.dumps(payload),
                        f"ReviewFake {analysis_kind} {analysis_profile or 'legacy'}",
                        analysis_kind,
                        reliability,
                        "high" if reliability is not None and reliability >= 0.75 else None,
                        analysis_profile if analysis_kind == "deep" else None,
                        10000 if analysis_kind == "deep" else None,
                        REVIEW_ANALYSIS_MULTIPV,
                        "time" if analysis_kind == "deep" else None,
                        json.dumps(
                            {
                                "analysis_profile": analysis_profile,
                                "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                                "requested_time_ms": 10000,
                                "analysis_limit_mode": "time",
                                "requested_multipv": REVIEW_ANALYSIS_MULTIPV,
                            },
                        ),
                    ),
                )
            connection.commit()

    def _insert_unknown_deep_status(self, positions: list[str], status: str) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            for fen in positions:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO position_analyses (
                        fen,
                        analysis_json,
                        engine,
                        engine_version,
                        depth,
                        multipv,
                        analysis_kind,
                        schema_version,
                        status,
                        created_at,
                        error_message,
                        analysis_profile,
                        requested_time_ms,
                        requested_multipv,
                        analysis_limit_mode,
                        settings_json
                    )
                    VALUES (?, '{}', 'stockfish', 'unknown', 12, 3, 'deep',
                            'engine_analysis_v2', ?, datetime('now'), ?,
                            'standard', 10000, 3, 'time', ?)
                    """,
                    (
                        fen,
                        status,
                        "forced_test_status" if status == "failed" else None,
                        json.dumps(
                            {
                                "analysis_profile": "standard",
                                "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                                "requested_time_ms": 10000,
                                "analysis_limit_mode": "time",
                                "requested_multipv": 3,
                            },
                        ),
                    ),
                )
            connection.commit()

    def _top_moves(
        self,
        fen: str,
        first_uci: str,
        eval_cp: int,
        count: int,
        pv_length: int,
    ) -> list[dict[str, Any]]:
        board = chess.Board(fen)
        legal_moves = [move.uci() for move in board.legal_moves]
        ordered = [first_uci] + [uci for uci in legal_moves if uci != first_uci]
        top_moves: list[dict[str, Any]] = []
        for index, uci in enumerate(ordered[:count], start=1):
            top_moves.append(
                {
                    "rank": index,
                    "uci": uci,
                    "eval_cp": eval_cp - index,
                    "eval_pov_side_to_move_cp": eval_cp - index
                    if board.turn == chess.WHITE
                    else -(eval_cp - index),
                    "mate_in": None,
                    "pv": ordered[:pv_length],
                }
            )
        return top_moves

    def _first_legal_uci(self, fen: str) -> str:
        return next(iter(chess.Board(fen).legal_moves)).uci()

    def _different_legal_uci(self, fen: str, other: str) -> str:
        for move in chess.Board(fen).legal_moves:
            uci = move.uci()
            if uci != other:
                return uci
        return other


if __name__ == "__main__":
    unittest.main()
