from __future__ import annotations

import json
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from math import ceil, exp
from pathlib import Path
from typing import Any, Callable

import chess

from neurochess.analysis_service import (
    ENGINE_ANALYSIS_SCHEMA_VERSION,
    AnalysisService,
)
from neurochess.core.stabilized_eval import REVIEW_STABILIZED_EVAL_SOURCE_KIND
from neurochess.core.evaluation_display import (
    LICHESS_WIN_PERCENT_COEFFICIENT,
    format_eval_label,
)
from neurochess.data.database import get_connection
from neurochess.data.database import execute_sqlite_write_with_retry
from neurochess.engines.engine_profiles import (
    engine_profile_for_name,
    review_hash_for_profile,
    review_multipv_for_profile,
    review_threads_for_profile,
)
from neurochess.metrics.review_metrics import (
    DUAL_REVIEW_SCORE_FORMULA_VERSION,
    GAME_ACCURACY_FORMULA_VERSION,
    HEADLINE_SCORE_FORMULA_VERSION,
    MOVE_ACCURACY_FORMULA_VERSION,
    NEURO_SCORE_FORMULA_VERSION,
    headline_neurochess_score,
    lichess_like_game_accuracy,
    move_accuracy_from_win_loss as metric_move_accuracy_from_win_loss,
    mover_win_percent_loss as metric_mover_win_percent_loss,
    neuro_diagnostic_score,
    player_percent_from_eval as metric_player_percent_from_eval,
    player_percent_from_white_percent as metric_player_percent_from_white_percent,
    review_metric_bundle,
    white_percent_from_eval as metric_white_percent_from_eval,
)
from neurochess.metrics.move_categories import (
    MOVE_CATEGORY_FORMULA_VERSION,
    REVIEW_SECTIONS_VERSION,
    build_review_sections,
    categorize_review_move,
)
from neurochess.metrics.review_moment_importance import (
    REVIEW_MOMENT_IMPORTANCE_VERSION,
    classify_review_moment_importance,
    no_major_moment_payload,
)
from neurochess.metrics.opening_reality import (
    OPENING_REALITY_EVIDENCE_VERSION,
    build_opening_reality_evidence,
)
from neurochess.metrics.pedagogy import (
    CONTRAST_COACH_EXPLANATION_VERSION,
    PEDAGOGICAL_EXPLANATION_VERSION,
    build_contrast_coach_explanation,
    build_pedagogical_explanation,
    coach_card_title,
    compact_label,
    impact_label,
    move_quality_label,
)
from neurochess.metrics.pv_contrast import (
    PV_CONTRAST_EVIDENCE_VERSION,
    build_pv_contrast_evidence,
)
from neurochess.metrics.try_move import (
    TRY_MOVE_MODEL_VERSION,
    build_try_move_payload,
)


REVIEW_SCHEMA_VERSION = "post_game_review_v1"
SELECTION_ALGORITHM_VERSION = "moment_selection_criticality_v5_trust_gate"
REVIEW_SCORE_FORMULA_VERSION = DUAL_REVIEW_SCORE_FORMULA_VERSION
REVIEW_SCORE_CACHE_SCHEMA_VERSION = "review_dual_score_cache_v1"
REVIEW_EVIDENCE_SCHEMA_VERSION = "review_evidence_v1"
REVIEW_PIPELINE_VERSION = "v5_3_a4c_pv5_trust_gate_review_v1"
PUBLIC_NEURO_SCORE_FORMULA_VERSION = "public_neuro_score_lichess_like_v1"
COACH_NEURO_SCORE_FORMULA_VERSION = "coach_neuro_score_v1"
QUALITATIVE_GAME_LABEL_VERSION = "qualitative_game_label_v1"
MIN_ANALYZED_MOVES_FOR_REVIEW_SCORE = 5
REVIEW_ANALYSIS_DEFAULT_PROFILE = "standard"
REVIEW_ANALYSIS_PROFILES = {"cached", "quick", "standard", "deep"}
REVIEW_ANALYSIS_PROFILE_RANK = {
    None: 0,
    "legacy": 0,
    "cached": 0,
    "live_continuous": 0,
    "quick": 1,
    "standard": 2,
    "deep": 3,
}
REVIEW_ANALYSIS_MULTIPV = 5
REVIEW_ANALYSIS_TIME_ONLY_DEPTH_SENTINELS = {
    "quick": 801,
    "standard": 802,
    "deep": 803,
}

MIN_CP_LOSS_FOR_MOMENT = 50
CRITICALITY_THRESHOLD = 10.0
MIN_KEY_MOMENT_WIN_LOSS = CRITICALITY_THRESHOLD
MIN_SIGNIFICANT_WIN_LOSS = MIN_KEY_MOMENT_WIN_LOSS

REVIEW_FULL_COVERAGE_THRESHOLD = 0.95
REVIEW_PARTIAL_COVERAGE_THRESHOLD = 0.70

IMPORTANCE_CP_LOSS_CAP = 1000

MAX_REVIEW_MOMENTS = 5
MIN_HALF_MOVES_FOR_REVIEW = 10

TOP_MOVES_SNAPSHOT_LIMIT = 5
PV_SNAPSHOT_LIMIT = 5
PERSISTENCE_WINDOW_PLIES = 10
NMS_WINDOW_PLIES = 2
NMS_OVERRIDE_RATIO = 1.5
LOW_IMPACT_OPENING_MAX_PLY = 8
LOW_IMPACT_OPENING_WIN_LOSS_MAX = 8.0
LOW_IMPACT_OPENING_CRITICALITY_MAX = 14.0
LOW_IMPACT_OPENING_BALANCED_MIN = 38.0
LOW_IMPACT_OPENING_BALANCED_MAX = 62.0

NO_MAJOR_MOMENTS_MESSAGE = (
    "Aucun moment majeur détecté : la partie est restée trop équilibrée "
    "pour générer une review utile."
)
SHORT_GAME_REVIEW_MESSAGE = "Partie trop courte pour générer une review fiable."
STALLED_REVIEW_MESSAGE = (
    "L’analyse approfondie n’a pas pu être lancée. Réessayez plus tard."
)
FAILED_DEEP_REVIEW_MESSAGE = (
    "L’analyse approfondie a échoué sur une ou plusieurs positions."
)


def coverage_is_complete(coverage: dict[str, Any] | None) -> bool:
    if not coverage:
        return False
    try:
        total = int(coverage.get("total_required_deep_count") or 0)
        analyzed = int(coverage.get("analyzed_deep_count") or 0)
        missing = int(coverage.get("missing_deep_count") or 0)
        failed = int(coverage.get("failed_deep_count") or 0)
    except (TypeError, ValueError):
        return False
    return total > 0 and analyzed == total and missing == 0 and failed == 0


def _not_reviewable_payload(game_id: int, actual_half_moves: int) -> dict[str, Any]:
    payload = {
        "game_id": game_id,
        "status": "not_reviewable",
        "reason": "game_too_short",
        "empty_reason": "game_too_short",
        "min_half_moves": MIN_HALF_MOVES_FOR_REVIEW,
        "actual_half_moves": actual_half_moves,
        "half_moves_count": actual_half_moves,
        "min_half_moves_for_review": MIN_HALF_MOVES_FOR_REVIEW,
        "reviewable": False,
        "message": SHORT_GAME_REVIEW_MESSAGE,
        "detail": "game_too_short_for_review",
        "review_schema_version": REVIEW_SCHEMA_VERSION,
        "selection_algorithm_version": SELECTION_ALGORITHM_VERSION,
        "review_pipeline_version": REVIEW_PIPELINE_VERSION,
        "coverage": 0.0,
        "missing_deep_count": 0,
        "analyzed_deep_count": 0,
        "total_required_deep_count": 0,
        "scheduled_deep_count": 0,
        "failed_deep_count": 0,
        "failed_deep_details": [],
        "review_work_active": False,
        "warnings": [],
        "moments": [],
    }
    payload.update(_empty_review_score_payload(deep_coverage=0.0))
    return payload


def _empty_review_score_payload(
    deep_coverage: float | None = None,
) -> dict[str, Any]:
    formula_versions = _review_score_formula_versions()
    return {
        "white_review_score": None,
        "black_review_score": None,
        "user_color": None,
        "user_review_score": None,
        "opponent_review_score": None,
        "white_lichess_like_accuracy": None,
        "black_lichess_like_accuracy": None,
        "user_lichess_like_accuracy": None,
        "opponent_lichess_like_accuracy": None,
        "white_public_neuro_score": None,
        "black_public_neuro_score": None,
        "user_public_neuro_score": None,
        "opponent_public_neuro_score": None,
        "public_neuro_score": None,
        "qualitative_game_label": "Partie à analyser",
        "qualitative_game_label_formula_version": QUALITATIVE_GAME_LABEL_VERSION,
        "white_coach_neuro_score": None,
        "black_coach_neuro_score": None,
        "user_coach_neuro_score": None,
        "opponent_coach_neuro_score": None,
        "coach_neuro_score": None,
        "coach_score_formula_version": COACH_NEURO_SCORE_FORMULA_VERSION,
        "white_neuro_score": None,
        "black_neuro_score": None,
        "user_neuro_score": None,
        "opponent_neuro_score": None,
        "white_diagnostic_gap": None,
        "black_diagnostic_gap": None,
        "user_diagnostic_gap": None,
        "opponent_diagnostic_gap": None,
        "white_headline_neurochess_score": None,
        "black_headline_neurochess_score": None,
        "user_headline_neurochess_score": None,
        "opponent_headline_neurochess_score": None,
        "headline_neurochess_score": None,
        "headline_score_subject": None,
        "review_summary_sentence": None,
        "score_availability": _empty_score_availability("missing_data"),
        "review_score_deprecated": True,
        "review_score_alias_of": "lichess_like_accuracy",
        "review_score_confidence": None,
        "score_formula_version": REVIEW_SCORE_FORMULA_VERSION,
        "move_accuracy_formula_version": MOVE_ACCURACY_FORMULA_VERSION,
        "game_accuracy_formula_version": GAME_ACCURACY_FORMULA_VERSION,
        "neuro_score_formula_version": NEURO_SCORE_FORMULA_VERSION,
        "public_score_formula_version": PUBLIC_NEURO_SCORE_FORMULA_VERSION,
        "headline_score_formula_version": HEADLINE_SCORE_FORMULA_VERSION,
        "formula_versions": formula_versions,
        "move_category_formula_version": MOVE_CATEGORY_FORMULA_VERSION,
        "review_moment_importance_version": REVIEW_MOMENT_IMPORTANCE_VERSION,
        "review_sections_version": REVIEW_SECTIONS_VERSION,
        "pedagogical_explanation_version": PEDAGOGICAL_EXPLANATION_VERSION,
        "contrast_coach_explanation_version": CONTRAST_COACH_EXPLANATION_VERSION,
        "pv_contrast_evidence_version": PV_CONTRAST_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
        "score_analyzed_moves_white": 0,
        "score_analyzed_moves_black": 0,
        "score_missing_moves_white": 0,
        "score_missing_moves_black": 0,
        "deep_coverage": deep_coverage,
        "required_position_count": 0,
        "deep_done_count": 0,
        "deep_missing_count": 0,
        "deep_failed_count": 0,
        "review_analysis_origin": "insufficient",
        "review_analysis_state": "insufficient",
        "review_analysis_quality": "cached",
        "review_analysis_profile": REVIEW_ANALYSIS_DEFAULT_PROFILE,
        "review_score_profile": REVIEW_ANALYSIS_DEFAULT_PROFILE,
        "analysis_profile_used": None,
        "required_position_count": 0,
        "completed_position_count": 0,
        "pending_position_count": 0,
        "failed_position_count": 0,
        "total_budget_seconds": 0,
        "elapsed_seconds": 0,
        "estimated_remaining_seconds": 0,
        "per_position_time_ms": 0,
        "analysis_limit_mode": None,
        "requested_multipv": REVIEW_ANALYSIS_MULTIPV,
        "analysis_threads": review_threads_for_profile(REVIEW_ANALYSIS_DEFAULT_PROFILE),
        "analysis_hash_mb": review_hash_for_profile(REVIEW_ANALYSIS_DEFAULT_PROFILE),
        "uci_analyse_mode": True,
        "uci_limit_strength": False,
        "skill_level": None,
        "syzygy_path_active": False,
        "average_depth_reached": None,
        "min_depth_reached": None,
        "max_depth_reached": None,
        "cache_hits": 0,
        "cache_misses": 0,
        "legacy_cache_ignored_count": 0,
        "number_of_moves_white": 0,
        "number_of_moves_black": 0,
        "white_score_debug": None,
        "black_score_debug": None,
        "review_score_audit_rows": [],
        "move_annotations": [],
        "review_sections": {
            "priority_training": [],
            "secondary_training": [],
            "micro_gaps": [],
            "good_decisions": [],
            "informational": [],
            "to_review": [],
            "strong_moves": [],
            "missed_opportunities": [],
            "all": [],
        },
        "moment_selection_summary": _moment_selection_summary({}),
        "opening_reality_evidence": {
            "schema_version": OPENING_REALITY_EVIDENCE_VERSION,
            "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
            "available": False,
            "status": "missing_data",
            "summary": "Données d'ouverture insuffisantes pour établir un diagnostic fiable.",
            "recommendation": "Relance la classification d'ouverture si tu veux ce diagnostic.",
            "confidence": "low",
            "missing_data": ["review_not_completed"],
        },
    }


def _review_score_formula_versions() -> dict[str, str]:
    return {
        "score_formula_version": REVIEW_SCORE_FORMULA_VERSION,
        "move_accuracy_formula_version": MOVE_ACCURACY_FORMULA_VERSION,
        "game_accuracy_formula_version": GAME_ACCURACY_FORMULA_VERSION,
        "neuro_score_formula_version": NEURO_SCORE_FORMULA_VERSION,
        "public_score_formula_version": PUBLIC_NEURO_SCORE_FORMULA_VERSION,
        "coach_score_formula_version": COACH_NEURO_SCORE_FORMULA_VERSION,
        "qualitative_game_label_formula_version": QUALITATIVE_GAME_LABEL_VERSION,
        "headline_score_formula_version": HEADLINE_SCORE_FORMULA_VERSION,
        "move_category_formula_version": MOVE_CATEGORY_FORMULA_VERSION,
        "review_moment_importance_version": REVIEW_MOMENT_IMPORTANCE_VERSION,
        "review_sections_version": REVIEW_SECTIONS_VERSION,
        "pedagogical_explanation_version": PEDAGOGICAL_EXPLANATION_VERSION,
        "contrast_coach_explanation_version": CONTRAST_COACH_EXPLANATION_VERSION,
        "pv_contrast_evidence_version": PV_CONTRAST_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
    }


def _empty_score_availability(reason: str) -> dict[str, Any]:
    return {
        "lichess_like": "missing_data",
        "neuro_score": "missing_data",
        "diagnostic_gap": "missing_dependency",
        "reason": reason,
        "white": _side_score_availability_empty(reason),
        "black": _side_score_availability_empty(reason),
    }


def _side_score_availability_empty(reason: str) -> dict[str, Any]:
    return {
        "lichess_like": "missing_data",
        "neuro_score": "missing_data",
        "diagnostic_gap": "missing_dependency",
        "reason": reason,
        "move_count_analyzed": 0,
    }


def _incomplete_review_payload(game_id: int, coverage: dict[str, Any]) -> dict[str, Any]:
    completed = int(coverage.get("analyzed_deep_count") or 0)
    required = int(coverage.get("total_required_deep_count") or 0)
    failed = int(coverage.get("failed_deep_count") or 0)
    scheduled = int(coverage.get("scheduled_deep_count") or 0)
    if scheduled > 0:
        status = "pending"
        state = "pending"
        message = f"Analyse {coverage.get('review_analysis_profile') or 'standard'} en cours : {completed}/{required} positions."
    elif failed > 0:
        status = "failed"
        state = "failed"
        message = f"Analyse incomplete : {completed}/{required} positions analysees."
    else:
        status = "incomplete"
        state = "incomplete"
        message = f"Analyse incomplete : {completed}/{required} positions analysees."

    payload = {
        "game_id": game_id,
        "status": status,
        "review_schema_version": REVIEW_SCHEMA_VERSION,
        "selection_algorithm_version": SELECTION_ALGORITHM_VERSION,
        "review_pipeline_version": REVIEW_PIPELINE_VERSION,
        "coverage": coverage.get("coverage") or 0.0,
        "half_moves_count": int(coverage.get("total_context_count") or 0),
        "min_half_moves_for_review": MIN_HALF_MOVES_FOR_REVIEW,
        "reviewable": True,
        "empty_reason": None,
        "message": message,
        "warnings": [],
        "moments": [],
    }
    payload.update(_empty_review_score_payload(deep_coverage=coverage.get("coverage")))
    payload["review_analysis_state"] = state
    for key in (
        "missing_deep_count",
        "analyzed_deep_count",
        "total_required_deep_count",
        "scheduled_deep_count",
        "failed_deep_count",
        "failed_deep_details",
        "review_work_active",
        "review_analysis_origin",
        "review_analysis_quality",
        "review_analysis_profile",
        "review_score_profile",
        "analysis_profile_used",
        "completed_position_count",
        "pending_position_count",
        "failed_position_count",
        "total_budget_seconds",
        "elapsed_seconds",
        "estimated_remaining_seconds",
        "per_position_time_ms",
        "analysis_limit_mode",
        "requested_multipv",
        "analysis_threads",
        "analysis_hash_mb",
        "uci_analyse_mode",
        "uci_limit_strength",
        "skill_level",
        "syzygy_path_active",
        "average_depth_reached",
        "min_depth_reached",
        "max_depth_reached",
        "cache_hits",
        "cache_misses",
        "legacy_cache_ignored_count",
    ):
        payload[key] = coverage.get(key)
    payload["review_analysis_origin"] = _review_analysis_origin(coverage)
    payload["review_analysis_quality"] = _review_analysis_quality(coverage)
    return payload


class ReviewServiceError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        payload: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class MoveContext:
    move_id: int
    ply: int
    fen_before: str
    fen_after: str
    played_uci: str
    played_san: str | None
    played_by: str
    side_to_move_before: str


def normalize_review_analysis_profile(profile: str | None) -> str:
    normalized = (profile or REVIEW_ANALYSIS_DEFAULT_PROFILE).lower()
    if normalized not in REVIEW_ANALYSIS_PROFILES:
        return REVIEW_ANALYSIS_DEFAULT_PROFILE
    return normalized


def compute_review_total_budget_seconds(
    half_moves_count: int,
    profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
) -> int:
    normalized = normalize_review_analysis_profile(profile)
    half_moves = max(0, int(half_moves_count))
    if normalized == "quick":
        return int(max(20, min(45, 0.7 * half_moves)))

    if half_moves <= 40:
        standard = 80
    elif half_moves <= 70:
        standard = 140
    elif half_moves <= 110:
        standard = 220
    else:
        standard = 300

    if normalized == "deep":
        return min(450, int(ceil(1.5 * standard)))
    return standard


def compute_review_per_position_time_ms(
    total_budget_seconds: int,
    position_count: int,
    profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
) -> int:
    count = max(1, int(position_count))
    raw_ms = int((max(0, total_budget_seconds) * 1000) // count)
    normalized = normalize_review_analysis_profile(profile)
    if normalized == "quick":
        return max(300, min(1500, raw_ms))
    if normalized == "deep":
        return max(2000, min(15000, raw_ms))
    return max(1000, min(10000, raw_ms))


def required_review_fens_for_contexts(contexts: list[MoveContext]) -> list[str]:
    required: set[str] = set()
    for context in contexts:
        required.add(context.fen_before)
        required.add(context.fen_after)
    return sorted(required)


def _review_analysis_storage_depth(profile: str, requested_time_ms: int) -> int:
    base = REVIEW_ANALYSIS_TIME_ONLY_DEPTH_SENTINELS.get(profile, 802)
    return base + max(0, int(requested_time_ms) // 1000)


class ReviewService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        analysis_service: AnalysisService | None = None,
        failure_hook: Callable[[str], None] | None = None,
    ) -> None:
        self.db_path = db_path
        self.analysis_service = analysis_service or AnalysisService(db_path)
        self.failure_hook = failure_hook

    def generate_review(
        self,
        game_id: int,
        force_retry_failed: bool = False,
        profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    ) -> dict[str, Any]:
        missing_fens: list[str] = []
        requested_profile = normalize_review_analysis_profile(profile)

        with closing(get_connection(self.db_path)) as connection:
            game = _get_game(connection, game_id)
            if game is None:
                raise ReviewServiceError("game not found", status_code=404)
            if not bool(game["completed"]):
                raise ReviewServiceError(
                    "review unavailable: game still in progress",
                    status_code=400,
                )

            moves = _get_moves(connection, game_id)
            if len(moves) <= MIN_HALF_MOVES_FOR_REVIEW:
                return _not_reviewable_payload(game_id, len(moves))

            contexts = _build_move_contexts(moves)
            coverage = _coverage_for_contexts(
                connection,
                contexts,
                requested_profile=requested_profile,
            )
            missing_fens = coverage["missing_fens"]
            existing = _get_current_review(connection, game_id)
            if (
                existing is not None
                and existing["status"] == "done"
                and coverage_is_complete(coverage)
            ):
                return _review_payload(
                    connection,
                    game_id,
                    existing["id"],
                    coverage_details=coverage,
                )

            if force_retry_failed and coverage["failed_deep_count"] > 0:
                failed_fens = {
                    str(item["fen"])
                    for item in coverage.get("failed_deep_details", [])
                    if item.get("fen")
                }
                review_id = self._reset_failed_and_upsert_pending(
                    connection,
                    game_id,
                    coverage["required_fens"],
                )
                missing_without_failed = [
                    fen for fen in missing_fens if fen not in failed_fens
                ]
                if missing_without_failed:
                    self._ensure_missing_deep_analyses(
                        missing_without_failed,
                        coverage,
                        requested_profile,
                    )
                return self._payload_for_current_review(
                    game_id,
                    review_id,
                    requested_profile=requested_profile,
                )

            if coverage_is_complete(coverage):
                return self._complete_review_from_coverage(
                    connection,
                    game_id,
                    coverage,
                )

            review_id = self._upsert_pending_review_with_retry(connection, game_id)
            if coverage["missing_deep_count"] > 0 and coverage["failed_deep_count"] == 0:
                self._ensure_missing_deep_analyses(
                    missing_fens,
                    coverage,
                    requested_profile,
                )
            return self._payload_for_current_review(
                game_id,
                review_id,
                requested_profile=requested_profile,
            )

    def _upsert_pending_review_with_retry(
        self,
        connection: Any,
        game_id: int,
    ) -> int:
        def write_pending() -> int:
            try:
                connection.execute("BEGIN")
                review_id = _upsert_pending_review(connection, game_id)
                connection.commit()
                return review_id
            except Exception:
                connection.rollback()
                raise

        return execute_sqlite_write_with_retry(write_pending)

    def _reset_failed_and_upsert_pending(
        self,
        connection: Any,
        game_id: int,
        required_fens: list[str],
    ) -> int:
        def reset_and_write() -> int:
            try:
                connection.execute("BEGIN")
                _reset_failed_deep_analyses(connection, required_fens)
                review_id = _upsert_pending_review(connection, game_id)
                connection.commit()
                return review_id
            except Exception:
                connection.rollback()
                raise

        return execute_sqlite_write_with_retry(reset_and_write)

    def rebuild_review_metrics_from_cached_analyses(
        self,
        game_id: int,
        profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    ) -> dict[str, Any]:
        requested_profile = normalize_review_analysis_profile(profile)
        with closing(get_connection(self.db_path)) as connection:
            game = _get_game(connection, game_id)
            if game is None:
                raise ReviewServiceError("game not found", status_code=404)

            moves = _get_moves(connection, game_id)
            if bool(game["completed"]) and len(moves) <= MIN_HALF_MOVES_FOR_REVIEW:
                return _not_reviewable_payload(game_id, len(moves))

            review = _get_current_review(connection, game_id)
            if review is None:
                coverage = _current_coverage_details(
                    connection,
                    game_id,
                    requested_profile=requested_profile,
                )
                if coverage_is_complete(coverage):
                    return self._complete_review_from_coverage(
                        connection,
                        game_id,
                        coverage,
                    )
                return _incomplete_review_payload(game_id, coverage)

            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=requested_profile,
            )
            if not coverage_is_complete(coverage):
                return _incomplete_review_payload(game_id, coverage)
            if review["status"] in {"pending", "partial"}:
                return self._complete_review_from_coverage(
                    connection,
                    game_id,
                    coverage,
                )
            return _review_payload(
                connection,
                game_id,
                int(review["id"]),
                coverage=coverage["coverage"],
                coverage_details=coverage,
            )

    def rebuild_review_metrics(
        self,
        game_id: int,
        profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    ) -> dict[str, Any]:
        return self.rebuild_review_metrics_from_cached_analyses(
            game_id,
            profile=profile,
        )

    def get_review(
        self,
        game_id: int,
        profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    ) -> dict[str, Any]:
        requested_profile = normalize_review_analysis_profile(profile)
        with closing(get_connection(self.db_path)) as connection:
            game = _get_game(connection, game_id)
            if game is None:
                raise ReviewServiceError("game not found", status_code=404)

            moves = _get_moves(connection, game_id)
            if bool(game["completed"]) and len(moves) <= MIN_HALF_MOVES_FOR_REVIEW:
                return _not_reviewable_payload(game_id, len(moves))

            review = _get_current_review(connection, game_id)
            if review is None:
                payload = {
                    "game_id": game_id,
                    "status": "not_generated",
                    "review_schema_version": REVIEW_SCHEMA_VERSION,
                    "selection_algorithm_version": SELECTION_ALGORITHM_VERSION,
                    "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                    "coverage": 0.0,
                    "half_moves_count": len(moves),
                    "min_half_moves_for_review": MIN_HALF_MOVES_FOR_REVIEW,
                    "reviewable": len(moves) > MIN_HALF_MOVES_FOR_REVIEW,
                    "empty_reason": None,
                    "missing_deep_count": 0,
                    "analyzed_deep_count": 0,
                    "total_required_deep_count": 0,
                    "scheduled_deep_count": 0,
                    "failed_deep_count": 0,
                    "failed_deep_details": [],
                    "review_work_active": False,
                    "message": None,
                    "warnings": [],
                    "moments": [],
                }
                payload.update(_empty_review_score_payload(deep_coverage=0.0))
                payload["user_color"] = _normalized_user_color(
                    _row_get(game, "user_color")
                )
                payload["review_analysis_profile"] = requested_profile
                payload["review_score_profile"] = requested_profile
                return payload

            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=requested_profile,
            )
            if (
                review["status"] in {"pending", "partial"}
                and coverage_is_complete(coverage)
            ):
                return self._complete_review_from_coverage(
                    connection,
                    game_id,
                    coverage,
                )

            return _review_payload(
                connection,
                game_id,
                review["id"],
                coverage=coverage["coverage"],
                coverage_details=coverage,
            )

    def _ensure_missing_deep_analyses(
        self,
        fens: list[str],
        coverage: dict[str, Any],
        requested_profile: str,
    ) -> None:
        per_position_time_ms = int(coverage.get("per_position_time_ms") or 1000)
        total_budget_seconds = int(coverage.get("total_budget_seconds") or 0)
        requested_multipv = review_multipv_for_profile(requested_profile)
        engine_profile = engine_profile_for_name(requested_profile)
        depth = _review_analysis_storage_depth(
            requested_profile,
            per_position_time_ms,
        )
        settings_json = {
            "review_pipeline_version": REVIEW_PIPELINE_VERSION,
            "review_analysis_profile": requested_profile,
            "analysis_profile": requested_profile,
            "total_budget_seconds": total_budget_seconds,
            "per_position_time_ms": per_position_time_ms,
            "analysis_limit_mode": "time",
            "limit_mode": "time",
            "requested_multipv": requested_multipv,
            "position_count": int(coverage.get("total_required_deep_count") or 0),
            "threads": engine_profile.threads,
            "hash_mb": engine_profile.hash_mb,
            "multipv": requested_multipv,
            "uci_analyse_mode": engine_profile.uci_analyse_mode,
            "uci_limit_strength": engine_profile.uci_limit_strength,
            "skill_level": "max",
            "syzygy_path_active": False,
        }
        for fen in sorted(set(fens)):
            try:
                self.analysis_service.get_or_create_analysis(
                    fen=fen,
                    depth=depth,
                    multipv=requested_multipv,
                    kind="deep",
                    analysis_profile=requested_profile,
                    requested_time_ms=per_position_time_ms,
                    requested_depth=None,
                    requested_multipv=requested_multipv,
                    analysis_limit_mode="time",
                    settings_json=settings_json,
                )
            except Exception:
                continue

    def _payload_for_current_review(
        self,
        game_id: int,
        fallback_review_id: int,
        requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    ) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            review = _get_current_review(connection, game_id)
            review_id = int(review["id"]) if review is not None else fallback_review_id
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=requested_profile,
            )
            return _review_payload(
                connection,
                game_id,
                review_id,
                coverage=coverage["coverage"],
                coverage_details=coverage,
            )

    def _complete_review_from_coverage(
        self,
        connection: Any,
        game_id: int,
        coverage: dict[str, Any],
    ) -> dict[str, Any]:
        if not coverage_is_complete(coverage):
            raise ReviewServiceError(
                "review analysis is incomplete",
                status_code=425,
                payload=_incomplete_review_payload(game_id, coverage),
            )

        moments, warnings = _select_review_moments(
            contexts=coverage["reviewable_contexts"],
            before_analyses=coverage["before_analyses"],
            after_analyses=coverage["after_analyses"],
        )
        if coverage["coverage"] < REVIEW_FULL_COVERAGE_THRESHOLD:
            missing_count = int(coverage["total_context_count"]) - int(
                coverage["reviewable_context_count"]
            )
            warnings.append(
                f"{missing_count} coups n'ont pas pu être analysés en profondeur. "
                "La review peut être incomplète."
            )
            status = "partial"
        else:
            status = "done"

        def write_completed_review() -> int:
            try:
                connection.execute("BEGIN")
                connection.execute("DELETE FROM game_reviews WHERE game_id = ?", (game_id,))
                review_id = _insert_review(connection, game_id, status="pending")
                self._fail_if_requested("after_review_insert")
                for moment in moments:
                    _insert_review_moment(connection, review_id, game_id, moment)
                self._fail_if_requested("after_moments_insert")
                _finish_review(connection, review_id, status=status, warnings=warnings)
                connection.commit()
                return review_id
            except Exception:
                connection.rollback()
                raise

        review_id = execute_sqlite_write_with_retry(write_completed_review)
        return _review_payload(
            connection,
            game_id,
            review_id,
            coverage=coverage["coverage"],
            coverage_details=coverage,
        )

    def _fail_if_requested(self, stage: str) -> None:
        if self.failure_hook is not None:
            self.failure_hook(stage)


def calculate_cp_loss(
    eval_before_cp: int | None,
    eval_after_cp: int | None,
    mate_before: int | None,
    mate_after: int | None,
    played_by: str,
) -> int:
    before = _analysis_value(eval_before_cp, mate_before)
    after = _analysis_value(eval_after_cp, mate_after)
    if before is None or after is None:
        return 0

    if played_by == "white":
        return max(0, before - after)
    if played_by == "black":
        return max(0, after - before)
    raise ValueError(f"Unsupported played_by: {played_by}")


def cp_loss_label(cp_loss: int, mate_event: bool = False) -> str:
    if cp_loss >= 1000 or mate_event:
        return "moment décisif selon l’analyse approfondie"
    if cp_loss >= 500:
        return "écart très important"
    if cp_loss >= 200:
        return "écart majeur"
    if cp_loss >= 100:
        return "écart important"
    return "écart notable"


def win_percent_from_engine_score(
    eval_cp: int | None,
    mate_in: int | None,
) -> float:
    return metric_white_percent_from_eval(eval_cp, mate_in)


def white_percent_from_eval(
    eval_cp: int | None,
    mate_in: int | None,
) -> float:
    return metric_white_percent_from_eval(eval_cp, mate_in)


def player_percent_from_score(
    eval_cp: int | None,
    mate_in: int | None,
    played_by: str,
) -> float:
    return metric_player_percent_from_eval(eval_cp, mate_in, played_by)


def player_percent_from_white_percent(
    white_percent: float,
    played_by: str,
) -> float:
    return metric_player_percent_from_white_percent(white_percent, played_by)


def mover_win_percent_loss(
    eval_before_cp: int | None,
    mate_before: int | None,
    eval_after_cp: int | None,
    mate_after: int | None,
    played_by: str,
) -> float:
    return metric_mover_win_percent_loss(
        eval_before_cp,
        mate_before,
        eval_after_cp,
        mate_after,
        played_by,
    )


def move_accuracy_from_win_loss(win_loss: float) -> float:
    return metric_move_accuracy_from_win_loss(win_loss)


def move_weight_for_review_score(
    criticality: float | None,
    win_loss: float,
) -> float:
    if criticality is not None:
        return round(1.0 + min(4.0, max(0.0, float(criticality)) / 20.0), 3)
    return round(1.0 + min(2.0, max(0.0, float(win_loss)) / 15.0), 3)


def move_weight_from_criticality(criticality: float | None) -> float:
    return move_weight_for_review_score(criticality, 0.0)


def player_review_score_v0(
    weighted_accuracies: list[tuple[float, float]],
) -> float | None:
    total_weight = sum(weight for _, weight in weighted_accuracies)
    if total_weight <= 0:
        return None
    score = sum(accuracy * weight for accuracy, weight in weighted_accuracies)
    return round(_clamp(score / total_weight, 0.0, 100.0), 2)


def player_review_score_v1(
    scored_moves: list[dict[str, float]],
    missing_moves: int = 0,
    deep_coverage: float | None = None,
) -> dict[str, Any]:
    analyzed_moves = len(scored_moves)
    confidence = review_score_confidence(analyzed_moves, deep_coverage)
    if analyzed_moves < MIN_ANALYZED_MOVES_FOR_REVIEW_SCORE:
        return _review_score_debug_payload(
            analyzed_moves=analyzed_moves,
            missing_moves=missing_moves,
            confidence=confidence,
        )

    total_weight = sum(float(move["weight"]) for move in scored_moves)
    if total_weight <= 0:
        return _review_score_debug_payload(
            analyzed_moves=analyzed_moves,
            missing_moves=missing_moves,
            confidence=confidence,
        )

    weighted_mean = sum(
        float(move["weight"]) * float(move["move_accuracy"])
        for move in scored_moves
    ) / total_weight
    weighted_harmonic = total_weight / sum(
        float(move["weight"]) / max(float(move["move_accuracy"]), 5.0)
        for move in scored_moves
    )
    worst_count = max(1, ceil(0.15 * analyzed_moves))
    worst_moves = sorted(scored_moves, key=lambda move: float(move["move_accuracy"]))[
        :worst_count
    ]
    worst_tail = sum(float(move["move_accuracy"]) for move in worst_moves) / len(
        worst_moves
    )
    win_losses = [float(move["win_loss"]) for move in scored_moves]
    avg_win_loss = sum(win_losses) / analyzed_moves
    max_win_loss = max(win_losses)
    raw_score = (
        0.50 * weighted_mean
        + 0.30 * weighted_harmonic
        + 0.20 * worst_tail
    )
    score_cap = score_cap_from_max_win_loss(max_win_loss)
    final_score = min(raw_score, score_cap)

    return _review_score_debug_payload(
        analyzed_moves=analyzed_moves,
        missing_moves=missing_moves,
        avg_win_loss=avg_win_loss,
        max_win_loss=max_win_loss,
        weighted_mean=weighted_mean,
        weighted_harmonic=weighted_harmonic,
        worst_tail=worst_tail,
        score_cap=score_cap,
        raw_score=raw_score,
        final_score=final_score,
        confidence=confidence,
    )


def score_cap_from_max_win_loss(max_win_loss: float) -> float:
    if max_win_loss >= 60:
        return 60.0
    if max_win_loss >= 45:
        return 70.0
    if max_win_loss >= 35:
        return 78.0
    if max_win_loss >= 25:
        return 86.0
    return 100.0


def _review_score_debug_payload(
    analyzed_moves: int,
    missing_moves: int,
    confidence: str,
    avg_win_loss: float | None = None,
    max_win_loss: float | None = None,
    weighted_mean: float | None = None,
    weighted_harmonic: float | None = None,
    worst_tail: float | None = None,
    score_cap: float | None = None,
    raw_score: float | None = None,
    final_score: float | None = None,
) -> dict[str, Any]:
    return {
        "analyzed_moves": analyzed_moves,
        "missing_moves": missing_moves,
        "avg_win_loss": _round_optional(avg_win_loss),
        "max_win_loss": _round_optional(max_win_loss),
        "weighted_mean": _round_optional(weighted_mean),
        "weighted_harmonic": _round_optional(weighted_harmonic),
        "worst_tail": _round_optional(worst_tail),
        "score_cap": _round_optional(score_cap),
        "raw_score": _round_optional(raw_score),
        "final_score": _round_optional(final_score),
        "confidence": confidence,
        "depth_min": None,
        "depth_max": None,
        "depth_avg": None,
        "engine_versions": [],
    }


def review_score_confidence(
    analyzed_moves: int,
    deep_coverage: float | None,
) -> str:
    coverage = 0.0 if deep_coverage is None else float(deep_coverage)
    if analyzed_moves >= 20 and coverage >= 0.95:
        return "high"
    if analyzed_moves >= 10 and coverage >= 0.70:
        return "medium"
    return "low"


def is_significant_review_moment(
    mover_win_loss: float,
    mate_before: int | None,
    mate_after: int | None,
    played_by: str = "white",
) -> bool:
    return (
        mover_win_loss >= MIN_KEY_MOMENT_WIN_LOSS
        or _is_significant_mate_event(
            mate_before=mate_before,
            mate_after=mate_after,
            played_by=played_by,
        )
    )


def player_eval_zone(player_percent: float) -> str:
    if player_percent >= 90:
        return "won"
    if player_percent >= 75:
        return "winning"
    if player_percent >= 60:
        return "better"
    if player_percent >= 40:
        return "balanced"
    if player_percent >= 25:
        return "worse"
    if player_percent >= 10:
        return "losing"
    return "lost"


def leverage_weight(player_percent_before: float) -> float:
    return round(
        0.75 + 0.5 * (player_percent_before * (100.0 - player_percent_before) / 2500.0),
        4,
    )


def transition_weight(
    zone_before: str,
    zone_after: str,
    mate_event: bool = False,
) -> float:
    if mate_event:
        return 1.4
    favorable = {"won", "winning", "better"}
    bad = {"worse", "losing", "lost"}
    if zone_before == zone_after and zone_before in {"won", "winning", "lost"}:
        return 0.80
    if zone_before == "won" and zone_after == "winning":
        return 0.85
    if zone_before == "winning" and zone_after == "better":
        return 0.90
    if zone_before in favorable and zone_after in bad:
        return 1.4
    if zone_before == "balanced" and zone_after == "worse":
        return 1.35
    if zone_before == "balanced" and zone_after in {"losing", "lost"}:
        return 1.40
    if zone_before == "better" and zone_after == "balanced":
        return 1.25
    if zone_before == "worse" and zone_after == "losing":
        return 1.15
    if zone_before == "losing" and zone_after == "lost":
        return 1.10
    return 1.0


def persistence_weight(
    player_percent_before: float,
    immediate_loss: float,
    future_player_percents: list[float],
) -> float:
    if not future_player_percents:
        return 1.0
    future_avg = sum(future_player_percents) / len(future_player_percents)
    persistent_loss = max(0.0, player_percent_before - future_avg)
    ratio = _clamp(persistent_loss / max(immediate_loss, 1.0), 0.0, 1.0)
    return round(0.75 + 0.5 * ratio, 4)


def moment_type_for_transition(
    zone_before: str,
    zone_after: str,
    mate_event: bool = False,
) -> str:
    if mate_event:
        return "decisive"
    if zone_before in {"balanced", "better", "winning", "won"} and zone_after in {
        "worse",
        "losing",
        "lost",
    }:
        return "turning_point"
    if zone_before in {"better", "winning", "won"} and zone_after == "balanced":
        return "lost_advantage"
    if zone_before in {"worse", "losing"} and zone_after in {"losing", "lost"}:
        return "aggravation"
    return "standard_loss"


def review_label_from_moment_type(moment_type: str) -> str:
    return {
        "turning_point": "Tournant de partie",
        "lost_advantage": "Avantage laissé filer",
        "aggravation": "Aggravation",
        "decisive": "Moment décisif",
        "standard_loss": "Écart important",
    }.get(moment_type, "Écart important")


def criticality_score(
    immediate_loss: float,
    player_percent_before: float,
    zone_before: str,
    zone_after: str,
    future_player_percents: list[float],
    reliability_score: float = 1.0,
    novelty_weight: float = 1.0,
    mate_event: bool = False,
) -> float:
    return round(
        immediate_loss
        * reliability_score
        * leverage_weight(player_percent_before)
        * transition_weight(zone_before, zone_after, mate_event=mate_event)
        * persistence_weight(player_percent_before, immediate_loss, future_player_percents)
        * novelty_weight,
        3,
    )


def review_label_from_win_loss(
    mover_win_loss: float,
    mate_event: bool = False,
) -> str:
    if mate_event or mover_win_loss >= 35:
        return "moment décisif"
    if mover_win_loss >= 25:
        return "écart majeur"
    if mover_win_loss >= 15:
        return "écart important"
    return "écart notable"


def review_importance_score(
    mover_win_loss: float,
    reliability_score: float,
    context_weight: float = 1.0,
) -> float:
    return round(mover_win_loss * reliability_score * context_weight, 3)


def importance_score(cp_loss: int, reliability_score: float) -> float:
    return round(
        min(cp_loss, IMPORTANCE_CP_LOSS_CAP) * reliability_score * 1.0,
        3,
    )


def _select_review_moments(
    contexts: list[MoveContext],
    before_analyses: dict[str, dict[str, Any]],
    after_analyses: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    candidates: list[dict[str, Any]] = []

    for index, context in enumerate(contexts):
        before = before_analyses[context.fen_before]
        after = after_analyses[context.fen_after]
        before_json = before["analysis_json"]
        after_json = after["analysis_json"]
        eval_before, mate_before = _stable_eval_from_analysis_json(before_json)
        eval_after, mate_after = _stable_eval_from_analysis_json(after_json)
        loss = calculate_cp_loss(
            eval_before_cp=eval_before,
            eval_after_cp=eval_after,
            mate_before=mate_before,
            mate_after=mate_after,
            played_by=context.played_by,
        )
        mover_win_loss = mover_win_percent_loss(
            eval_before_cp=eval_before,
            mate_before=mate_before,
            eval_after_cp=eval_after,
            mate_after=mate_after,
            played_by=context.played_by,
        )
        mate_event = _is_significant_mate_event(
            mate_before=mate_before,
            mate_after=mate_after,
            played_by=context.played_by,
        )

        reliability, reliability_warning = _moment_reliability(before, after)
        if reliability_warning is not None and reliability_warning not in warnings:
            warnings.append(reliability_warning)

        player_percent_before = player_percent_from_score(
            eval_before,
            mate_before,
            context.played_by,
        )
        player_percent_after = player_percent_from_score(
            eval_after,
            mate_after,
            context.played_by,
        )
        zone_before = player_eval_zone(player_percent_before)
        zone_after = player_eval_zone(player_percent_after)
        zone_transition = f"{zone_before}_to_{zone_after}"
        moment_type = moment_type_for_transition(
            zone_before,
            zone_after,
            mate_event=mate_event,
        )
        future_player_percents = _future_player_percents(
            contexts,
            after_analyses,
            start_index=index + 1,
            played_by=context.played_by,
        )
        top_moves = _top_moves_snapshot(before_json.get("top_moves"))
        best_move_uci = top_moves[0]["uci"] if top_moves else None
        best_move_san = _san_for_uci(context.fen_before, best_move_uci)
        label = review_label_from_moment_type(moment_type)
        base_criticality_score = criticality_score(
            immediate_loss=mover_win_loss,
            player_percent_before=player_percent_before,
            zone_before=zone_before,
            zone_after=zone_after,
            future_player_percents=future_player_percents,
            reliability_score=reliability,
            novelty_weight=1.0,
            mate_event=mate_event,
        )
        if mate_event:
            base_criticality_score = max(base_criticality_score, CRITICALITY_THRESHOLD)
        if _is_low_impact_opening_drift(
            ply=context.ply,
            mate_event=mate_event,
            mover_win_loss=mover_win_loss,
            criticality=base_criticality_score,
            player_percent_before=player_percent_before,
            player_percent_after=player_percent_after,
        ):
            continue
        if not mate_event and base_criticality_score < CRITICALITY_THRESHOLD:
            continue

        candidates.append(
            {
                "move_id": context.move_id,
                "ply": context.ply,
                "played_by": context.played_by,
                "side_to_move_before": context.side_to_move_before,
                "fen_before": context.fen_before,
                "fen_after": context.fen_after,
                "played_uci": context.played_uci,
                "played_san": context.played_san,
                "best_move_uci": best_move_uci,
                "best_move_san": best_move_san,
                "eval_before_cp": eval_before,
                "eval_after_cp": eval_after,
                "mate_before": mate_before,
                "mate_after": mate_after,
                "cp_loss": loss,
                "cp_loss_label": label,
                "importance_score": base_criticality_score,
                "reliability_score": reliability,
                "reliability_label": _reliability_label(reliability),
                "top_moves_json": top_moves,
                "review_type": "player_loss",
                "mover_win_loss": mover_win_loss,
                "criticality_score": base_criticality_score,
                "base_criticality_score": base_criticality_score,
                "leverage_weight": leverage_weight(player_percent_before),
                "transition_weight": transition_weight(
                    zone_before,
                    zone_after,
                    mate_event=mate_event,
                ),
                "persistence_weight": persistence_weight(
                    player_percent_before,
                    mover_win_loss,
                    future_player_percents,
                ),
                "novelty_weight": 1.0,
                "player_percent_before": round(player_percent_before, 3),
                "player_percent_after": round(player_percent_after, 3),
                "moment_type": moment_type,
                "zone_before": zone_before,
                "zone_after": zone_after,
                "zone_transition": zone_transition,
                "eval_source_kind": _eval_source_kind_for_analyses(before, after),
                "eval_depth_before": _eval_depth_for_analysis(before),
                "eval_depth_after": _eval_depth_for_analysis(after),
                "mate_event": mate_event,
            }
        )

    selected = temporal_non_max_suppression(candidates)
    return selected, warnings


def _is_low_impact_opening_drift(
    *,
    ply: int,
    mate_event: bool,
    mover_win_loss: float,
    criticality: float,
    player_percent_before: float,
    player_percent_after: float,
) -> bool:
    if mate_event:
        return False
    if int(ply) > LOW_IMPACT_OPENING_MAX_PLY:
        return False
    if float(mover_win_loss) > LOW_IMPACT_OPENING_WIN_LOSS_MAX:
        return False
    if float(criticality) > LOW_IMPACT_OPENING_CRITICALITY_MAX:
        return False
    return (
        LOW_IMPACT_OPENING_BALANCED_MIN
        <= float(player_percent_before)
        <= LOW_IMPACT_OPENING_BALANCED_MAX
        and LOW_IMPACT_OPENING_BALANCED_MIN
        <= float(player_percent_after)
        <= LOW_IMPACT_OPENING_BALANCED_MAX
    )


def _future_player_percents(
    contexts: list[MoveContext],
    after_analyses: dict[str, dict[str, Any]],
    start_index: int,
    played_by: str,
) -> list[float]:
    future_percents: list[float] = []
    end_index = min(len(contexts), start_index + PERSISTENCE_WINDOW_PLIES)
    for future_context in contexts[start_index:end_index]:
        analysis = after_analyses.get(future_context.fen_after)
        if analysis is None:
            continue
        analysis_json = analysis["analysis_json"]
        eval_cp, mate_in = _stable_eval_from_analysis_json(analysis_json)
        future_percents.append(
            player_percent_from_score(
                eval_cp,
                mate_in,
                played_by,
            )
        )
    return future_percents


def temporal_non_max_suppression(
    candidates: list[dict[str, Any]],
    window: int = NMS_WINDOW_PLIES,
    override_ratio: float = NMS_OVERRIDE_RATIO,
) -> list[dict[str, Any]]:
    ordered = sorted(
        candidates,
        key=lambda item: (-float(item["criticality_score"]), int(item["ply"])),
    )
    selected: list[dict[str, Any]] = []

    for candidate in ordered:
        nearby_selected = [
            moment
            for moment in selected
            if abs(int(moment["ply"]) - int(candidate["ply"])) <= window
        ]
        keep = not nearby_selected
        if nearby_selected:
            strongest_neighbor_score = max(
                float(moment["criticality_score"]) for moment in nearby_selected
            )
            keep = bool(candidate["mate_event"]) or (
                float(candidate["criticality_score"])
                >= override_ratio * strongest_neighbor_score
            )
        if not keep:
            continue

        selected.append(candidate)
        if len(selected) >= MAX_REVIEW_MOMENTS:
            break

    return sorted(selected, key=lambda item: int(item["ply"]))


def _apply_novelty_weights(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for candidate in candidates:
        candidate["novelty_weight"] = 1.0
        candidate["criticality_score"] = round(
            float(candidate["base_criticality_score"]),
            3,
        )
        candidate["importance_score"] = candidate["criticality_score"]
    return candidates


def _get_game(connection: Any, game_id: int) -> Any | None:
    return connection.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()


def _get_moves(connection: Any, game_id: int) -> list[Any]:
    return connection.execute(
        """
        SELECT *
        FROM moves
        WHERE game_id = ?
        ORDER BY ply, id
        """,
        (game_id,),
    ).fetchall()


def _build_move_contexts(moves: list[Any]) -> list[MoveContext]:
    contexts: list[MoveContext] = []
    for move_row in moves:
        fen_before = str(move_row["fen_before"])
        board = chess.Board(fen_before)
        move = chess.Move.from_uci(str(move_row["uci"]))
        side = "white" if board.turn == chess.WHITE else "black"
        try:
            played_san = board.san(move)
        except Exception:
            played_san = move_row["san"] if move_row["san"] else None

        next_board = board.copy()
        next_board.push(move)
        contexts.append(
            MoveContext(
                move_id=int(move_row["id"]),
                ply=int(move_row["ply"]),
                fen_before=fen_before,
                fen_after=next_board.fen(),
                played_uci=move.uci(),
                played_san=played_san,
                played_by=side,
                side_to_move_before=side,
            )
        )
    return contexts


def _coverage_for_contexts(
    connection: Any,
    contexts: list[MoveContext],
    requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
) -> dict[str, Any]:
    requested_profile = normalize_review_analysis_profile(requested_profile)
    before_analyses: dict[str, dict[str, Any]] = {}
    after_analyses: dict[str, dict[str, Any]] = {}
    reviewable_contexts: list[MoveContext] = []
    missing_fens: list[str] = []
    required_fens = set(required_review_fens_for_contexts(contexts))
    half_moves_count = len(contexts)
    total_budget_seconds = compute_review_total_budget_seconds(
        half_moves_count,
        requested_profile,
    )
    per_position_time_ms = compute_review_per_position_time_ms(
        total_budget_seconds,
        len(required_fens),
        requested_profile,
    )
    requested_multipv = review_multipv_for_profile(requested_profile)
    engine_profile = engine_profile_for_name(requested_profile)

    for context in contexts:
        before = _deep_done_analysis(
            connection,
            context.fen_before,
            requested_profile=requested_profile,
            min_requested_time_ms=per_position_time_ms,
        )
        after = _deep_done_analysis(
            connection,
            context.fen_after,
            requested_profile=requested_profile,
            min_requested_time_ms=per_position_time_ms,
        )
        if before is not None:
            before_analyses[context.fen_before] = before
        else:
            missing_fens.append(context.fen_before)

        if after is not None:
            after_analyses[context.fen_after] = after
        else:
            missing_fens.append(context.fen_after)

        if before is not None and after is not None:
            reviewable_contexts.append(context)

    coverage = len(reviewable_contexts) / len(contexts) if contexts else 0.0
    analysis_statuses = _deep_analysis_status_counts(
        connection,
        required_fens,
        requested_profile=requested_profile,
        min_requested_time_ms=per_position_time_ms,
    )
    depths = [
        depth
        for analysis in list(before_analyses.values()) + list(after_analyses.values())
        for depth in [_eval_depth_for_analysis(analysis)]
        if depth is not None
    ]
    used_profile = _coverage_analysis_profile_used(
        list(before_analyses.values()) + list(after_analyses.values()),
        requested_profile,
    )
    return {
        "coverage": round(coverage, 4),
        "requested_profile": requested_profile,
        "review_analysis_profile": requested_profile,
        "review_score_profile": requested_profile,
        "analysis_profile_used": used_profile if reviewable_contexts else None,
        "reviewable_contexts": reviewable_contexts,
        "reviewable_context_count": len(reviewable_contexts),
        "total_context_count": len(contexts),
        "before_analyses": before_analyses,
        "after_analyses": after_analyses,
        "missing_fens": sorted(set(missing_fens)),
        "required_fens": sorted(required_fens),
        "missing_deep_count": len(set(missing_fens)),
        "analyzed_deep_count": max(0, len(required_fens) - len(set(missing_fens))),
        "total_required_deep_count": len(required_fens),
        "scheduled_deep_count": analysis_statuses["scheduled_deep_count"],
        "failed_deep_count": analysis_statuses["failed_deep_count"],
        "failed_deep_details": analysis_statuses["failed_deep_details"],
        "review_work_active": analysis_statuses["review_work_active"],
        "completed_position_count": max(0, len(required_fens) - len(set(missing_fens))),
        "pending_position_count": analysis_statuses["scheduled_deep_count"],
        "failed_position_count": analysis_statuses["failed_deep_count"],
        "total_budget_seconds": total_budget_seconds,
        "elapsed_seconds": 0,
        "estimated_remaining_seconds": int(
            ceil(len(set(missing_fens)) * per_position_time_ms / 1000)
        ),
        "per_position_time_ms": per_position_time_ms,
        "analysis_limit_mode": "time"
        if requested_profile in {"quick", "standard", "deep"}
        else None,
        "requested_multipv": requested_multipv,
        "analysis_threads": engine_profile.threads,
        "analysis_hash_mb": engine_profile.hash_mb,
        "uci_analyse_mode": engine_profile.uci_analyse_mode,
        "uci_limit_strength": engine_profile.uci_limit_strength,
        "skill_level": "max",
        "syzygy_path_active": False,
        "average_depth_reached": round(sum(depths) / len(depths), 2)
        if depths
        else None,
        "min_depth_reached": min(depths) if depths else None,
        "max_depth_reached": max(depths) if depths else None,
        "cache_hits": max(0, len(required_fens) - len(set(missing_fens))),
        "cache_misses": len(set(missing_fens)),
        "legacy_cache_ignored_count": analysis_statuses[
            "legacy_cache_ignored_count"
        ],
    }


def _current_coverage_details(
    connection: Any,
    game_id: int,
    requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
) -> dict[str, Any]:
    moves = _get_moves(connection, game_id)
    if not moves:
        profile = normalize_review_analysis_profile(requested_profile)
        engine_profile = engine_profile_for_name(profile)
        return {
            "coverage": 0.0,
            "requested_profile": profile,
            "review_analysis_profile": profile,
            "review_score_profile": profile,
            "analysis_profile_used": None,
            "reviewable_contexts": [],
            "reviewable_context_count": 0,
            "total_context_count": 0,
            "before_analyses": {},
            "after_analyses": {},
            "missing_fens": [],
            "required_fens": [],
            "missing_deep_count": 0,
            "analyzed_deep_count": 0,
            "total_required_deep_count": 0,
            "scheduled_deep_count": 0,
            "failed_deep_count": 0,
            "failed_deep_details": [],
            "review_work_active": False,
            "completed_position_count": 0,
            "pending_position_count": 0,
            "failed_position_count": 0,
            "total_budget_seconds": 0,
            "elapsed_seconds": 0,
            "estimated_remaining_seconds": 0,
            "per_position_time_ms": 0,
            "analysis_limit_mode": None,
            "requested_multipv": review_multipv_for_profile(profile),
            "analysis_threads": engine_profile.threads,
            "analysis_hash_mb": engine_profile.hash_mb,
            "uci_analyse_mode": engine_profile.uci_analyse_mode,
            "uci_limit_strength": engine_profile.uci_limit_strength,
            "skill_level": "max",
            "syzygy_path_active": False,
            "average_depth_reached": None,
            "min_depth_reached": None,
            "max_depth_reached": None,
            "cache_hits": 0,
            "cache_misses": 0,
            "legacy_cache_ignored_count": 0,
        }
    contexts = _build_move_contexts(moves)
    return _coverage_for_contexts(
        connection,
        contexts,
        requested_profile=requested_profile,
    )


def _current_coverage(connection: Any, game_id: int) -> float:
    return float(_current_coverage_details(connection, game_id)["coverage"])


def _deep_done_analysis(
    connection: Any,
    fen: str,
    requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    min_requested_time_ms: int | None = None,
) -> dict[str, Any] | None:
    rows = connection.execute(
        """
        SELECT *
        FROM position_analyses
        WHERE fen = ?
          AND analysis_kind = 'deep'
          AND status = 'done'
          AND schema_version = ?
        ORDER BY id DESC
        """,
        (fen, ENGINE_ANALYSIS_SCHEMA_VERSION),
    ).fetchall()
    for row in rows:
        analysis = _analysis_row_to_dict(row)
        if _analysis_satisfies_profile(
            analysis,
            requested_profile,
            min_requested_time_ms=min_requested_time_ms,
        ):
            return analysis
    return None


def _deep_latest_analysis(
    connection: Any,
    fen: str,
    requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    min_requested_time_ms: int | None = None,
) -> dict[str, Any] | None:
    rows = connection.execute(
        """
        SELECT *
        FROM position_analyses
        WHERE fen = ?
          AND analysis_kind = 'deep'
          AND schema_version = ?
          AND (
              COALESCE(analysis_profile, '') = COALESCE(?, '')
              OR (? = 'standard' AND analysis_profile = 'deep')
              OR (? = 'quick' AND (analysis_profile IS NULL OR analysis_profile IN ('quick', 'standard', 'deep')))
              OR (? = 'deep' AND analysis_profile = 'deep')
              OR (? = 'cached')
          )
        ORDER BY
            CASE status
                WHEN 'done' THEN 0
                WHEN 'running' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'failed' THEN 3
                ELSE 4
            END,
            id DESC
        """,
        (
            fen,
            ENGINE_ANALYSIS_SCHEMA_VERSION,
            requested_profile,
            requested_profile,
            requested_profile,
            requested_profile,
            requested_profile,
        ),
    ).fetchall()
    for row in rows:
        latest = _analysis_row_to_dict(row)
        if latest["status"] != "done":
            return latest
        if _analysis_satisfies_profile(
            latest,
            requested_profile,
            min_requested_time_ms=min_requested_time_ms,
        ):
            return latest
    return None


def _deep_analysis_status_counts(
    connection: Any,
    required_fens: set[str],
    requested_profile: str = REVIEW_ANALYSIS_DEFAULT_PROFILE,
    min_requested_time_ms: int | None = None,
) -> dict[str, Any]:
    scheduled_count = 0
    failed_count = 0
    legacy_ignored_count = 0
    failed_details: list[dict[str, Any]] = []

    for fen in required_fens:
        if _has_ignored_legacy_cache(
            connection,
            fen,
            requested_profile,
            min_requested_time_ms=min_requested_time_ms,
        ):
            legacy_ignored_count += 1
        latest = _deep_latest_analysis(
            connection,
            fen,
            requested_profile=requested_profile,
            min_requested_time_ms=min_requested_time_ms,
        )
        if latest is None or latest["status"] == "done":
            continue
        if latest["status"] in {"pending", "running"}:
            scheduled_count += 1
        elif latest["status"] == "failed":
            failed_count += 1
            failed_details.append(_failed_deep_detail(latest))

    return {
        "scheduled_deep_count": scheduled_count,
        "failed_deep_count": failed_count,
        "failed_deep_details": sorted(
            failed_details,
            key=lambda item: str(item["fen"]),
        ),
        "review_work_active": scheduled_count > 0,
        "legacy_cache_ignored_count": legacy_ignored_count,
    }


def _failed_deep_detail(analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        "fen": analysis["fen"],
        "error_message": analysis.get("error_message"),
        "status": analysis["status"],
        "analysis_kind": analysis["analysis_kind"],
        "analysis_profile": analysis.get("analysis_profile"),
        "requested_time_ms": analysis.get("requested_time_ms"),
        "analysis_limit_mode": analysis.get("analysis_limit_mode"),
        "engine": analysis.get("engine"),
        "engine_version": analysis.get("engine_version"),
        "depth": analysis.get("depth"),
        "multipv": analysis.get("multipv"),
        "schema_version": analysis.get("schema_version"),
        "created_at": analysis.get("created_at"),
        "completed_at": analysis.get("completed_at"),
    }


def _reset_failed_deep_analyses(
    connection: Any,
    required_fens: list[str],
) -> int:
    reset_count = 0
    for fen in required_fens:
        latest = _deep_latest_analysis(connection, fen)
        if latest is None or latest["status"] != "failed":
            continue
        connection.execute(
            """
            UPDATE position_analyses
            SET status = 'pending',
                error_message = NULL,
                completed_at = NULL
            WHERE id = ?
            """,
            (latest["id"],),
        )
        reset_count += 1
    return reset_count


def _analysis_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fen": row["fen"],
        "analysis_json": _parse_json_object(row["analysis_json"]),
        "engine": row["engine"],
        "engine_version": row["engine_version"],
        "depth": row["depth"],
        "multipv": row["multipv"],
        "schema_version": row["schema_version"],
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
        "reliability_score": row["reliability_score"],
        "reliability_label": row["reliability_label"],
        "analysis_kind": row["analysis_kind"],
        "status": row["status"],
        "error_message": row["error_message"],
        "analysis_time_ms": _row_get(row, "analysis_time_ms"),
        "analysis_profile": _row_get(row, "analysis_profile"),
        "requested_time_ms": _row_get(row, "requested_time_ms"),
        "requested_depth": _row_get(row, "requested_depth"),
        "requested_multipv": _row_get(row, "requested_multipv"),
        "analysis_limit_mode": _row_get(row, "analysis_limit_mode"),
        "settings_json": _parse_json_object(_row_get(row, "settings_json")),
    }


def _analysis_profile(analysis: dict[str, Any] | None) -> str | None:
    if not analysis:
        return None
    profile = analysis.get("analysis_profile")
    if profile:
        return str(profile)
    analysis_json = analysis.get("analysis_json") or {}
    profile = analysis_json.get("analysis_profile")
    if profile is None:
        settings_json = analysis.get("settings_json") or {}
        profile = settings_json.get("analysis_profile") or settings_json.get(
            "review_analysis_profile"
        )
    return str(profile) if profile else None


def _analysis_limit_mode(analysis: dict[str, Any] | None) -> str | None:
    if not analysis:
        return None
    mode = analysis.get("analysis_limit_mode")
    if mode:
        return str(mode)
    analysis_json = analysis.get("analysis_json") or {}
    mode = analysis_json.get("analysis_limit_mode") or analysis_json.get("limit_mode")
    if mode is None:
        settings_json = analysis.get("settings_json") or {}
        mode = settings_json.get("analysis_limit_mode") or settings_json.get("limit_mode")
    return str(mode) if mode else None


def _analysis_requested_time_ms(analysis: dict[str, Any] | None) -> int | None:
    if not analysis:
        return None
    value = analysis.get("requested_time_ms")
    if value is None:
        analysis_json = analysis.get("analysis_json") or {}
        value = analysis_json.get("requested_time_ms")
    if value is None:
        settings_json = analysis.get("settings_json") or {}
        value = settings_json.get("requested_time_ms") or settings_json.get(
            "per_position_time_ms"
        )
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _analysis_requested_multipv(analysis: dict[str, Any] | None) -> int | None:
    if not analysis:
        return None
    value = analysis.get("requested_multipv") or analysis.get("multipv")
    if value is None:
        analysis_json = analysis.get("analysis_json") or {}
        value = analysis_json.get("requested_multipv") or analysis_json.get("multipv")
    if value is None:
        settings_json = analysis.get("settings_json") or {}
        value = settings_json.get("requested_multipv") or settings_json.get("multipv")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _analysis_pipeline_version(analysis: dict[str, Any] | None) -> str | None:
    if not analysis:
        return None
    settings_json = analysis.get("settings_json") or {}
    value = settings_json.get("review_pipeline_version")
    if value is None:
        analysis_json = analysis.get("analysis_json") or {}
        value = analysis_json.get("review_pipeline_version")
        nested_settings = analysis_json.get("settings_json") or {}
        if value is None and isinstance(nested_settings, dict):
            value = nested_settings.get("review_pipeline_version")
    return str(value) if value else None


def _analysis_satisfies_profile(
    analysis: dict[str, Any] | None,
    requested_profile: str,
    min_requested_time_ms: int | None = None,
) -> bool:
    if not analysis or analysis.get("status") != "done":
        return False
    if analysis.get("analysis_kind") != "deep":
        return False
    if analysis.get("schema_version") != ENGINE_ANALYSIS_SCHEMA_VERSION:
        return False

    profile = _analysis_profile(analysis)
    requested = normalize_review_analysis_profile(requested_profile)
    if requested == "cached":
        return True
    if requested == "quick" and profile is None:
        return True
    if profile == "live_continuous":
        return False

    profile_rank = REVIEW_ANALYSIS_PROFILE_RANK.get(profile, 0)
    requested_rank = REVIEW_ANALYSIS_PROFILE_RANK.get(requested, 2)
    if profile_rank < requested_rank:
        return False

    if requested in {"standard", "deep"}:
        if _analysis_pipeline_version(analysis) != REVIEW_PIPELINE_VERSION:
            return False
        limit_mode = _analysis_limit_mode(analysis)
        if limit_mode not in {"time", "time_with_max_depth", "terminal"}:
            return False
        requested_time = _analysis_requested_time_ms(analysis)
        if (
            limit_mode != "terminal"
            and
            min_requested_time_ms is not None
            and requested_time is not None
            and requested_time < min_requested_time_ms
        ):
            return False
        if limit_mode != "terminal" and requested_time is None:
            return False

    required_multipv = review_multipv_for_profile(requested)
    requested_multipv = _analysis_requested_multipv(analysis)
    if (
        _analysis_limit_mode(analysis) != "terminal"
        and requested_multipv is not None
        and requested_multipv < required_multipv
    ):
        return False
    return True


def _coverage_analysis_profile_used(
    analyses: list[dict[str, Any]],
    requested_profile: str,
) -> str | None:
    profiles = [
        _analysis_profile(analysis) or "cached"
        for analysis in analyses
        if analysis is not None
    ]
    if not profiles:
        return None
    min_rank = min(REVIEW_ANALYSIS_PROFILE_RANK.get(profile, 0) for profile in profiles)
    for profile, rank in REVIEW_ANALYSIS_PROFILE_RANK.items():
        if profile is not None and rank == min_rank:
            return str(profile)
    return normalize_review_analysis_profile(requested_profile)


def _has_ignored_legacy_cache(
    connection: Any,
    fen: str,
    requested_profile: str,
    min_requested_time_ms: int | None = None,
) -> bool:
    if normalize_review_analysis_profile(requested_profile) in {"cached", "quick"}:
        return False
    rows = connection.execute(
        """
        SELECT *
        FROM position_analyses
        WHERE fen = ?
          AND analysis_kind = 'deep'
          AND status = 'done'
          AND schema_version = ?
        ORDER BY id DESC
        """,
        (fen, ENGINE_ANALYSIS_SCHEMA_VERSION),
    ).fetchall()
    ignored = False
    for row in rows:
        analysis = _analysis_row_to_dict(row)
        if _analysis_satisfies_profile(
            analysis,
            requested_profile,
            min_requested_time_ms=min_requested_time_ms,
        ):
            return False
        ignored = True
    return ignored


def _get_current_review(connection: Any, game_id: int) -> Any | None:
    return connection.execute(
        """
        SELECT *
        FROM game_reviews
        WHERE game_id = ?
          AND review_schema_version = ?
          AND selection_algorithm_version = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
    ).fetchone()


def _insert_review(connection: Any, game_id: int, status: str) -> int:
    now = _utc_now()
    cursor = connection.execute(
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
        VALUES (?, ?, ?, ?, ?, ?, '[]')
        """,
        (
            game_id,
            status,
            REVIEW_SCHEMA_VERSION,
            SELECTION_ALGORITHM_VERSION,
            now,
            now,
        ),
    )
    return int(cursor.lastrowid)


def _upsert_pending_review(connection: Any, game_id: int) -> int:
    now = _utc_now()
    connection.execute(
        """
        DELETE FROM game_reviews
        WHERE game_id = ?
          AND (
              review_schema_version <> ?
              OR selection_algorithm_version <> ?
          )
        """,
        (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
    )
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
        VALUES (?, 'pending', ?, ?, ?, ?, '[]')
        ON CONFLICT(game_id, review_schema_version, selection_algorithm_version)
        DO UPDATE SET
            status = 'pending',
            updated_at = excluded.updated_at,
            warnings_json = '[]'
        """,
        (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION, now, now),
    )
    review = _get_current_review(connection, game_id)
    if review is None:
        raise RuntimeError("Unable to create pending review")
    return int(review["id"])


def _finish_review(
    connection: Any,
    review_id: int,
    status: str,
    warnings: list[str],
) -> None:
    connection.execute(
        """
        UPDATE game_reviews
        SET status = ?,
            warnings_json = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            status,
            json.dumps(warnings, ensure_ascii=False),
            _utc_now(),
            review_id,
        ),
    )


def _insert_review_moment(
    connection: Any,
    review_id: int,
    game_id: int,
    moment: dict[str, Any],
) -> None:
    connection.execute(
        """
        INSERT INTO review_moments (
            review_id,
            game_id,
            move_id,
            ply,
            played_by,
            side_to_move_before,
            fen_before,
            fen_after,
            played_uci,
            played_san,
            best_move_uci,
            best_move_san,
            eval_before_cp,
            eval_after_cp,
            mate_before,
            mate_after,
            cp_loss,
            cp_loss_label,
            importance_score,
            reliability_score,
            reliability_label,
            top_moves_json,
            review_type,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            review_id,
            game_id,
            moment["move_id"],
            moment["ply"],
            moment["played_by"],
            moment["side_to_move_before"],
            moment["fen_before"],
            moment["fen_after"],
            moment["played_uci"],
            moment["played_san"],
            moment["best_move_uci"],
            moment["best_move_san"],
            moment["eval_before_cp"],
            moment["eval_after_cp"],
            moment["mate_before"],
            moment["mate_after"],
            moment["cp_loss"],
            moment["cp_loss_label"],
            moment["importance_score"],
            moment["reliability_score"],
            moment["reliability_label"],
            json.dumps(moment["top_moves_json"], ensure_ascii=False, sort_keys=True),
            moment["review_type"],
            _utc_now(),
        ),
    )


def _review_payload(
    connection: Any,
    game_id: int,
    review_id: int,
    coverage: float | None = None,
    coverage_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    review = connection.execute(
        "SELECT * FROM game_reviews WHERE id = ?",
        (review_id,),
    ).fetchone()
    if review is None:
        raise RuntimeError("Review disappeared during payload construction")

    moments = _review_moment_payloads(connection, review_id)
    half_moves_count = len(_get_moves(connection, game_id))
    status = str(review["status"])
    if coverage_details is None:
        coverage_details = _current_coverage_details(connection, game_id)
    if not coverage_is_complete(coverage_details):
        return _incomplete_review_payload(game_id, coverage_details)
    empty_reason: str | None = None
    message = None
    if status in {"done", "partial"} and not moments:
        empty_reason = "no_significant_moments"
        message = NO_MAJOR_MOMENTS_MESSAGE
    if status == "pending" and coverage_details is not None:
        if (
            int(coverage_details["missing_deep_count"]) > 0
            and not bool(coverage_details["review_work_active"])
        ):
            status = "stalled"
            message = (
                FAILED_DEEP_REVIEW_MESSAGE
                if int(coverage_details["failed_deep_count"]) > 0
                else STALLED_REVIEW_MESSAGE
            )
        else:
            message = (
                "Analyse approfondie en cours: "
                f"{coverage_details['missing_deep_count']} positions restantes."
            )
            empty_reason = None
    payload = {
        "game_id": game_id,
        "status": status,
        "review_schema_version": review["review_schema_version"],
        "selection_algorithm_version": review["selection_algorithm_version"],
        "review_pipeline_version": REVIEW_PIPELINE_VERSION,
        "coverage": coverage_details["coverage"] if coverage is None else coverage,
        "half_moves_count": half_moves_count,
        "min_half_moves_for_review": MIN_HALF_MOVES_FOR_REVIEW,
        "reviewable": half_moves_count > MIN_HALF_MOVES_FOR_REVIEW,
        "empty_reason": empty_reason,
        "message": message,
        "warnings": _parse_json_list(review["warnings_json"]),
        "moments": moments,
    }
    payload.update(
        _review_score_payload(
            connection,
            game_id,
            review_id,
            coverage_details=coverage_details,
        )
    )
    if coverage_details is not None:
        payload["missing_deep_count"] = int(coverage_details["missing_deep_count"])
        payload["analyzed_deep_count"] = int(coverage_details["analyzed_deep_count"])
        payload["total_required_deep_count"] = int(
            coverage_details["total_required_deep_count"]
        )
        payload["scheduled_deep_count"] = int(coverage_details["scheduled_deep_count"])
        payload["failed_deep_count"] = int(coverage_details["failed_deep_count"])
        payload["failed_deep_details"] = list(
            coverage_details.get("failed_deep_details") or []
        )
        payload["review_work_active"] = bool(coverage_details["review_work_active"])
        for key in (
            "review_analysis_profile",
            "review_score_profile",
            "analysis_profile_used",
            "completed_position_count",
            "pending_position_count",
            "failed_position_count",
            "total_budget_seconds",
            "elapsed_seconds",
            "estimated_remaining_seconds",
            "per_position_time_ms",
            "analysis_limit_mode",
            "requested_multipv",
            "analysis_threads",
            "analysis_hash_mb",
            "uci_analyse_mode",
            "uci_limit_strength",
            "skill_level",
            "syzygy_path_active",
            "average_depth_reached",
            "min_depth_reached",
            "max_depth_reached",
            "cache_hits",
            "cache_misses",
            "legacy_cache_ignored_count",
        ):
            payload[key] = coverage_details.get(key)
    return payload


def _review_score_payload(
    connection: Any,
    game_id: int,
    review_id: int,
    coverage_details: dict[str, Any] | None,
) -> dict[str, Any]:
    if coverage_details is None:
        coverage_details = _current_coverage_details(connection, game_id)

    deep_coverage = _optional_float(coverage_details.get("coverage"))
    before_analyses = coverage_details.get("before_analyses") or {}
    after_analyses = coverage_details.get("after_analyses") or {}
    criticality_by_move_id = _review_criticality_by_move_id(connection, review_id)
    book_plies = _book_plies_for_game(connection, game_id)
    moves = _get_moves(connection, game_id)

    side_scores: dict[str, list[dict[str, Any]]] = {
        "white": [],
        "black": [],
    }
    timeline_scores: list[dict[str, Any]] = []
    missing_by_side = {"white": 0, "black": 0}
    total_by_side = {"white": 0, "black": 0}
    depths_by_side: dict[str, list[int]] = {"white": [], "black": []}
    engine_versions_by_side: dict[str, set[str]] = {"white": set(), "black": set()}
    audit_rows: list[dict[str, Any]] = []

    for context in _build_move_contexts(moves):
        side = context.played_by
        total_by_side[side] += 1
        before = before_analyses.get(context.fen_before)
        after = after_analyses.get(context.fen_after)
        before_score = _stable_score_for_analysis(before)
        after_score = _stable_score_for_analysis(after)
        audit_row = _review_score_audit_row(
            game_id=game_id,
            context=context,
            before=before,
            after=after,
            before_score=before_score,
            after_score=after_score,
            criticality=criticality_by_move_id.get(context.move_id),
        )
        audit_row["is_book"] = context.ply in book_plies
        audit_rows.append(audit_row)
        if audit_row.get("white_percent_after") is not None:
            timeline_scores.append(audit_row)
        if before_score is None or after_score is None:
            missing_by_side[side] += 1
            continue

        criticality = criticality_by_move_id.get(context.move_id)
        side_scores[side].append(
            {
                "ply": context.ply,
                "side": side,
                "uci": context.played_uci,
                "move_accuracy": float(audit_row["move_accuracy"]),
                "win_loss": float(audit_row["win_loss"]),
                "player_percent_before": float(audit_row["player_percent_before"]),
                "player_percent_after": float(audit_row["player_percent_after"]),
                "criticality_score": criticality if criticality is not None else 0.0,
            }
        )
        for depth in (_eval_depth_for_analysis(before), _eval_depth_for_analysis(after)):
            if depth is not None:
                depths_by_side[side].append(depth)
        for analysis in (before, after):
            engine_version = _analysis_engine_version(analysis)
            if engine_version is not None:
                engine_versions_by_side[side].add(engine_version)

    white_confidence = review_score_confidence(len(side_scores["white"]), deep_coverage)
    black_confidence = review_score_confidence(len(side_scores["black"]), deep_coverage)
    white_bundle = review_metric_bundle(
        side_scores["white"],
        timeline=timeline_scores,
        missing_moves=missing_by_side["white"],
        coverage=deep_coverage,
        confidence=white_confidence,
    )
    black_bundle = review_metric_bundle(
        side_scores["black"],
        timeline=timeline_scores,
        missing_moves=missing_by_side["black"],
        coverage=deep_coverage,
        confidence=black_confidence,
    )
    _apply_move_metric_details(audit_rows, white_bundle["moves"])
    _apply_move_metric_details(audit_rows, black_bundle["moves"])
    move_annotations = _review_move_annotations(audit_rows)
    review_sections = build_review_sections(move_annotations)
    _apply_coach_priority_ranks(move_annotations, review_sections)
    game = _get_game(connection, game_id)
    opening_reality_evidence = build_opening_reality_evidence(
        game=game,
        opening_classification=_opening_classification_for_game(connection, game_id),
        moves=moves,
        move_annotations=move_annotations,
    )
    white_debug = _review_score_debug_from_metric_bundle(white_bundle)
    black_debug = _review_score_debug_from_metric_bundle(black_bundle)
    _augment_score_debug_with_analysis_meta(
        white_debug,
        depths_by_side["white"],
        engine_versions_by_side["white"],
    )
    _augment_score_debug_with_analysis_meta(
        black_debug,
        depths_by_side["black"],
        engine_versions_by_side["black"],
    )
    white_score = white_bundle["lichess_like_accuracy"]
    black_score = black_bundle["lichess_like_accuracy"]
    white_neuro_score = white_bundle["neuro_score"]
    black_neuro_score = black_bundle["neuro_score"]
    white_gap = white_bundle["diagnostic_gap"]
    black_gap = black_bundle["diagnostic_gap"]
    white_headline = headline_neurochess_score(
        white_score,
        white_neuro_score,
        white_gap,
    )
    black_headline = headline_neurochess_score(
        black_score,
        black_neuro_score,
        black_gap,
    )
    score_availability = _score_availability_from_metric_bundles(
        white_bundle,
        black_bundle,
    )
    user_color = _normalized_user_color(_row_get(game, "user_color"))
    user_score = None
    opponent_score = None
    user_neuro_score = None
    opponent_neuro_score = None
    user_gap = None
    opponent_gap = None
    user_headline = None
    opponent_headline = None
    headline_score = None
    headline_subject = None
    if user_color == "white":
        user_score = white_score
        opponent_score = black_score
        user_neuro_score = white_neuro_score
        opponent_neuro_score = black_neuro_score
        user_gap = white_gap
        opponent_gap = black_gap
        user_headline = white_headline
        opponent_headline = black_headline
        headline_score = user_headline
        headline_subject = "user"
    elif user_color == "black":
        user_score = black_score
        opponent_score = white_score
        user_neuro_score = black_neuro_score
        opponent_neuro_score = white_neuro_score
        user_gap = black_gap
        opponent_gap = white_gap
        user_headline = black_headline
        opponent_headline = white_headline
        headline_score = user_headline
        headline_subject = "user"
    else:
        headline_score = white_headline if white_headline is not None else black_headline
        headline_subject = "white" if white_headline is not None else "black"

    white_confidence_payload = (
        str(white_debug["confidence"]) if white_score is not None else None
    )
    black_confidence_payload = (
        str(black_debug["confidence"]) if black_score is not None else None
    )
    payload_confidence = _payload_review_score_confidence(
        user_color,
        white_confidence_payload,
        black_confidence_payload,
    )
    public_score = user_score if user_color in {"white", "black"} else (
        white_score if white_score is not None else black_score
    )
    coach_score = headline_score
    qualitative_game_label = _qualitative_game_label(
        coach_score=coach_score,
        public_score=public_score,
        review_sections=review_sections,
        game=game,
        user_color=user_color,
    )
    review_summary_sentence = _build_review_summary_sentence(
        coach_score=coach_score,
        public_score=public_score,
        review_sections=review_sections,
        confidence=payload_confidence,
    )

    payload = {
        "white_review_score": white_score,
        "black_review_score": black_score,
        "user_color": user_color,
        "user_review_score": user_score,
        "opponent_review_score": opponent_score,
        "white_lichess_like_accuracy": white_score,
        "black_lichess_like_accuracy": black_score,
        "user_lichess_like_accuracy": user_score,
        "opponent_lichess_like_accuracy": opponent_score,
        "white_public_neuro_score": white_score,
        "black_public_neuro_score": black_score,
        "user_public_neuro_score": user_score,
        "opponent_public_neuro_score": opponent_score,
        "public_neuro_score": public_score,
        "public_score_formula_version": PUBLIC_NEURO_SCORE_FORMULA_VERSION,
        "qualitative_game_label": qualitative_game_label,
        "qualitative_game_label_formula_version": QUALITATIVE_GAME_LABEL_VERSION,
        "white_coach_neuro_score": white_headline,
        "black_coach_neuro_score": black_headline,
        "user_coach_neuro_score": user_headline,
        "opponent_coach_neuro_score": opponent_headline,
        "coach_neuro_score": coach_score,
        "coach_score_formula_version": COACH_NEURO_SCORE_FORMULA_VERSION,
        "white_neuro_score": white_neuro_score,
        "black_neuro_score": black_neuro_score,
        "user_neuro_score": user_neuro_score,
        "opponent_neuro_score": opponent_neuro_score,
        "white_diagnostic_gap": white_gap,
        "black_diagnostic_gap": black_gap,
        "user_diagnostic_gap": user_gap,
        "opponent_diagnostic_gap": opponent_gap,
        "white_headline_neurochess_score": white_headline,
        "black_headline_neurochess_score": black_headline,
        "user_headline_neurochess_score": user_headline,
        "opponent_headline_neurochess_score": opponent_headline,
        "headline_neurochess_score": headline_score,
        "headline_score_subject": headline_subject,
        "headline_score_formula_version": HEADLINE_SCORE_FORMULA_VERSION,
        "review_summary_sentence": review_summary_sentence,
        "score_availability": score_availability,
        "review_score_deprecated": True,
        "review_score_alias_of": "lichess_like_accuracy",
        "review_score_confidence": payload_confidence,
        "score_formula_version": REVIEW_SCORE_FORMULA_VERSION,
        "move_accuracy_formula_version": MOVE_ACCURACY_FORMULA_VERSION,
        "game_accuracy_formula_version": GAME_ACCURACY_FORMULA_VERSION,
        "neuro_score_formula_version": NEURO_SCORE_FORMULA_VERSION,
        "headline_score_formula_version": HEADLINE_SCORE_FORMULA_VERSION,
        "formula_versions": _review_score_formula_versions(),
        "move_category_formula_version": MOVE_CATEGORY_FORMULA_VERSION,
        "review_moment_importance_version": REVIEW_MOMENT_IMPORTANCE_VERSION,
        "review_sections_version": REVIEW_SECTIONS_VERSION,
        "pedagogical_explanation_version": PEDAGOGICAL_EXPLANATION_VERSION,
        "contrast_coach_explanation_version": CONTRAST_COACH_EXPLANATION_VERSION,
        "pv_contrast_evidence_version": PV_CONTRAST_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "score_analyzed_moves_white": len(side_scores["white"]),
        "score_analyzed_moves_black": len(side_scores["black"]),
        "score_missing_moves_white": missing_by_side["white"],
        "score_missing_moves_black": missing_by_side["black"],
        "deep_coverage": deep_coverage,
        "required_position_count": int(coverage_details["total_required_deep_count"]),
        "deep_done_count": int(coverage_details["analyzed_deep_count"]),
        "deep_missing_count": int(coverage_details["missing_deep_count"]),
        "deep_failed_count": int(coverage_details["failed_deep_count"]),
        "review_analysis_origin": _review_analysis_origin(coverage_details),
        "review_analysis_state": _review_analysis_state(coverage_details),
        "review_analysis_quality": _review_analysis_quality(coverage_details),
        "review_analysis_profile": coverage_details.get("review_analysis_profile"),
        "review_score_profile": coverage_details.get("review_score_profile"),
        "analysis_profile_used": coverage_details.get("analysis_profile_used"),
        "completed_position_count": coverage_details.get("completed_position_count"),
        "pending_position_count": coverage_details.get("pending_position_count"),
        "failed_position_count": coverage_details.get("failed_position_count"),
        "total_budget_seconds": coverage_details.get("total_budget_seconds"),
        "elapsed_seconds": coverage_details.get("elapsed_seconds"),
        "estimated_remaining_seconds": coverage_details.get(
            "estimated_remaining_seconds"
        ),
        "per_position_time_ms": coverage_details.get("per_position_time_ms"),
        "analysis_limit_mode": coverage_details.get("analysis_limit_mode"),
        "requested_multipv": coverage_details.get("requested_multipv"),
        "analysis_threads": coverage_details.get("analysis_threads"),
        "analysis_hash_mb": coverage_details.get("analysis_hash_mb"),
        "uci_analyse_mode": coverage_details.get("uci_analyse_mode"),
        "uci_limit_strength": coverage_details.get("uci_limit_strength"),
        "skill_level": coverage_details.get("skill_level"),
        "syzygy_path_active": coverage_details.get("syzygy_path_active"),
        "average_depth_reached": coverage_details.get("average_depth_reached"),
        "min_depth_reached": coverage_details.get("min_depth_reached"),
        "max_depth_reached": coverage_details.get("max_depth_reached"),
        "cache_hits": coverage_details.get("cache_hits"),
        "cache_misses": coverage_details.get("cache_misses"),
        "legacy_cache_ignored_count": coverage_details.get(
            "legacy_cache_ignored_count"
        ),
        "number_of_moves_white": total_by_side["white"],
        "number_of_moves_black": total_by_side["black"],
        "white_score_debug": white_debug,
        "black_score_debug": black_debug,
        "review_score_audit_rows": audit_rows,
        "move_annotations": move_annotations,
        "review_sections": review_sections,
        "moment_selection_summary": _moment_selection_summary(review_sections),
        "opening_reality_evidence": opening_reality_evidence,
    }
    _persist_review_score_cache_if_needed(connection, review_id, payload)
    return payload


def _persist_review_score_cache_if_needed(
    connection: Any,
    review_id: int,
    payload: dict[str, Any],
) -> None:
    if not _review_score_payload_is_cacheable(payload):
        return
    review = connection.execute(
        "SELECT score_json FROM game_reviews WHERE id = ?",
        (review_id,),
    ).fetchone()
    if review is None or not _score_cache_needs_update(
        _row_get(review, "score_json"),
        payload,
    ):
        return

    score_json = json.dumps(
        _score_cache_from_payload(payload),
        ensure_ascii=False,
        sort_keys=True,
    )

    def write_score_cache() -> None:
        try:
            connection.execute("BEGIN")
            connection.execute(
                """
                UPDATE game_reviews
                SET score_json = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (score_json, _utc_now(), review_id),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise

    execute_sqlite_write_with_retry(write_score_cache)


def _review_score_payload_is_cacheable(payload: dict[str, Any]) -> bool:
    required = int(payload.get("required_position_count") or 0)
    completed = int(payload.get("completed_position_count") or payload.get("deep_done_count") or 0)
    failed = int(payload.get("failed_position_count") or payload.get("deep_failed_count") or 0)
    coverage = _optional_float(payload.get("deep_coverage"))
    has_score = (
        payload.get("white_lichess_like_accuracy") is not None
        or payload.get("black_lichess_like_accuracy") is not None
    )
    return (
        required > 0
        and completed >= required
        and failed == 0
        and coverage is not None
        and coverage >= 1.0
        and has_score
    )


def _score_cache_needs_update(
    raw_cache: Any,
    fresh_payload: dict[str, Any],
) -> bool:
    if not raw_cache:
        return True
    try:
        cached = json.loads(str(raw_cache))
    except (TypeError, ValueError):
        return True
    if not isinstance(cached, dict):
        return True
    if cached.get("score_cache_schema_version") != REVIEW_SCORE_CACHE_SCHEMA_VERSION:
        return True
    if cached.get("score_formula_version") != REVIEW_SCORE_FORMULA_VERSION:
        return True
    if cached.get("formula_versions") != fresh_payload.get("formula_versions"):
        return True
    if cached.get("move_category_formula_version") != MOVE_CATEGORY_FORMULA_VERSION:
        return True
    if cached.get("review_moment_importance_version") != REVIEW_MOMENT_IMPORTANCE_VERSION:
        return True
    if cached.get("review_sections_version") != REVIEW_SECTIONS_VERSION:
        return True
    if cached.get("pedagogical_explanation_version") != PEDAGOGICAL_EXPLANATION_VERSION:
        return True
    if cached.get("contrast_coach_explanation_version") != CONTRAST_COACH_EXPLANATION_VERSION:
        return True
    if cached.get("pv_contrast_evidence_version") != PV_CONTRAST_EVIDENCE_VERSION:
        return True
    if cached.get("opening_reality_evidence_version") != OPENING_REALITY_EVIDENCE_VERSION:
        return True
    if cached.get("try_move_model_version") != TRY_MOVE_MODEL_VERSION:
        return True
    for key in (
        "white_neuro_score",
        "black_neuro_score",
        "white_diagnostic_gap",
        "black_diagnostic_gap",
        "white_public_neuro_score",
        "black_public_neuro_score",
        "user_public_neuro_score",
        "opponent_public_neuro_score",
        "public_neuro_score",
        "public_score_formula_version",
        "qualitative_game_label",
        "qualitative_game_label_formula_version",
        "white_coach_neuro_score",
        "black_coach_neuro_score",
        "user_coach_neuro_score",
        "opponent_coach_neuro_score",
        "coach_neuro_score",
        "coach_score_formula_version",
        "white_headline_neurochess_score",
        "black_headline_neurochess_score",
        "user_color",
        "user_headline_neurochess_score",
        "opponent_headline_neurochess_score",
        "headline_neurochess_score",
        "headline_score_subject",
        "headline_score_formula_version",
        "review_summary_sentence",
        "score_availability",
        "move_annotations",
        "review_sections",
        "moment_selection_summary",
        "opening_reality_evidence",
    ):
        if cached.get(key) != fresh_payload.get(key):
            return True
    return False


def _score_cache_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    score_keys = (
        "white_review_score",
        "black_review_score",
        "user_color",
        "user_review_score",
        "opponent_review_score",
        "white_lichess_like_accuracy",
        "black_lichess_like_accuracy",
        "user_lichess_like_accuracy",
        "opponent_lichess_like_accuracy",
        "white_public_neuro_score",
        "black_public_neuro_score",
        "user_public_neuro_score",
        "opponent_public_neuro_score",
        "public_neuro_score",
        "public_score_formula_version",
        "qualitative_game_label",
        "qualitative_game_label_formula_version",
        "white_coach_neuro_score",
        "black_coach_neuro_score",
        "user_coach_neuro_score",
        "opponent_coach_neuro_score",
        "coach_neuro_score",
        "coach_score_formula_version",
        "white_neuro_score",
        "black_neuro_score",
        "user_neuro_score",
        "opponent_neuro_score",
        "white_diagnostic_gap",
        "black_diagnostic_gap",
        "user_diagnostic_gap",
        "opponent_diagnostic_gap",
        "white_headline_neurochess_score",
        "black_headline_neurochess_score",
        "user_headline_neurochess_score",
        "opponent_headline_neurochess_score",
        "headline_neurochess_score",
        "headline_score_subject",
        "headline_score_formula_version",
        "review_summary_sentence",
        "score_availability",
        "review_score_deprecated",
        "review_score_alias_of",
        "review_score_confidence",
        "score_formula_version",
        "move_accuracy_formula_version",
        "game_accuracy_formula_version",
        "neuro_score_formula_version",
        "formula_versions",
        "move_category_formula_version",
        "review_moment_importance_version",
        "review_sections_version",
        "pedagogical_explanation_version",
        "contrast_coach_explanation_version",
        "pv_contrast_evidence_version",
        "opening_reality_evidence_version",
        "try_move_model_version",
        "score_analyzed_moves_white",
        "score_analyzed_moves_black",
        "score_missing_moves_white",
        "score_missing_moves_black",
        "deep_coverage",
        "required_position_count",
        "deep_done_count",
        "deep_missing_count",
        "deep_failed_count",
        "number_of_moves_white",
        "number_of_moves_black",
        "white_score_debug",
        "black_score_debug",
        "review_score_audit_rows",
        "move_annotations",
        "review_sections",
        "moment_selection_summary",
        "opening_reality_evidence",
    )
    cache = {
        "score_cache_schema_version": REVIEW_SCORE_CACHE_SCHEMA_VERSION,
        "rebuilt_at": _utc_now(),
    }
    for key in score_keys:
        cache[key] = payload.get(key)
    return cache


def _review_move_annotations(audit_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    annotations: list[dict[str, Any]] = []
    context_start_fen = str(audit_rows[0].get("fen_before") or "") if audit_rows else None
    previous_move_label: str | None = None
    for row in audit_rows:
        category = categorize_review_move(row)
        ply = int(row.get("ply") or 0)
        best_move_uci = category.get("best_move_uci")
        best_move_san = _san_for_uci(
            str(row.get("fen_before") or ""),
            str(best_move_uci) if best_move_uci else None,
        )
        annotation = {
            "ply": ply,
            "move_number": (ply + 1) // 2 if ply > 0 else 0,
            "color": row.get("side"),
            "side": row.get("side"),
            "san": row.get("san"),
            "uci": row.get("uci"),
            "fen_before": row.get("fen_before"),
            "fen_after": row.get("fen_after"),
            "primary_category": category["primary_category"],
            "category_label": category["category_label"],
            "tags": category["tags"],
            "tag_labels": category["tag_labels"],
            "reason": category["reason"],
            "win_loss": row.get("win_loss"),
            "move_accuracy": row.get("move_accuracy"),
            "lichess_like_move_accuracy": row.get("lichess_like_move_accuracy"),
            "neuro_diagnostic_loss": row.get("neuro_diagnostic_loss"),
            "criticality_score": row.get("criticality_score"),
            "missed_gain": category.get("missed_gain"),
            "player_win_percent_before": row.get("player_percent_before"),
            "player_win_percent_after": row.get("player_percent_after"),
            "player_percent_before": row.get("player_percent_before"),
            "player_percent_after": row.get("player_percent_after"),
            "best_move_uci": best_move_uci,
            "best_move_san": best_move_san,
            "persistence_weight": row.get("persistence_weight"),
            "cluster_weight": row.get("cluster_weight"),
            "evidence_available": isinstance(row.get("review_evidence"), dict),
            "included_in_score": row.get("included_in_score"),
            "exclusion_reason": row.get("exclusion_reason"),
            "section_priority": category.get("section_priority"),
            "move_category_formula_version": MOVE_CATEGORY_FORMULA_VERSION,
            "is_book": row.get("is_book"),
        }
        annotation.update(classify_review_moment_importance(annotation))
        review_evidence = (
            row.get("review_evidence")
            if isinstance(row.get("review_evidence"), dict)
            else {}
        )
        pv_contrast_evidence = (
            review_evidence.get("pv_contrast_evidence")
            if isinstance(review_evidence, dict)
            else None
        )
        annotation["pv_contrast_evidence"] = (
            pv_contrast_evidence if isinstance(pv_contrast_evidence, dict) else None
        )
        annotation["pv_contrast_evidence_version"] = PV_CONTRAST_EVIDENCE_VERSION
        explanation = build_pedagogical_explanation(
            annotation,
            {
                "context_previous_move": previous_move_label,
                "context_start_fen": context_start_fen,
            },
        )
        annotation["pedagogical_explanation"] = explanation
        annotation["pedagogical_explanation_version"] = PEDAGOGICAL_EXPLANATION_VERSION
        annotation["contrast_coach_explanation"] = build_contrast_coach_explanation(
            annotation
        )
        annotation["contrast_coach_explanation_version"] = (
            CONTRAST_COACH_EXPLANATION_VERSION
        )
        annotation["impact_label"] = impact_label(annotation.get("win_loss"))
        annotation["move_quality_label"] = move_quality_label(
            annotation.get("move_accuracy")
        )
        annotation["coach_card_title"] = coach_card_title(annotation)
        annotation["compact_label"] = compact_label(annotation, explanation)
        annotation["context_previous_move"] = previous_move_label
        annotation["context_start_fen"] = context_start_fen
        annotation["coach_priority_rank"] = None
        top_moves = (
            review_evidence.get("top_moves")
            if isinstance(review_evidence, dict)
            else []
        )
        annotation["top_moves"] = top_moves or []
        annotation.update(
            build_try_move_payload(
                fen_before=annotation.get("fen_before"),
                side=str(annotation.get("side") or annotation.get("color") or ""),
                best_move_uci=str(best_move_uci) if best_move_uci else None,
                top_moves=top_moves if isinstance(top_moves, list) else [],
            )
        )
        annotations.append(annotation)
        previous_move_label = str(row.get("san") or row.get("uci") or "")
    return annotations


def _apply_coach_priority_ranks(
    annotations: list[dict[str, Any]],
    review_sections: dict[str, list[dict[str, Any]]],
) -> None:
    for annotation in annotations:
        annotation["coach_priority_rank"] = None
    rank_source = review_sections.get("priority_training") or review_sections.get("to_review") or []
    for index, annotation in enumerate(rank_source, start=1):
        annotation["coach_priority_rank"] = index


def _moment_selection_summary(
    review_sections: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    priority_count = len(review_sections.get("priority_training") or [])
    secondary_count = len(review_sections.get("secondary_training") or [])
    micro_count = len(review_sections.get("micro_gaps") or [])
    good_count = len(review_sections.get("good_decisions") or [])
    informational_count = len(review_sections.get("informational") or [])
    no_major_payload = no_major_moment_payload()
    no_major = priority_count == 0
    return {
        "review_moment_importance_version": REVIEW_MOMENT_IMPORTANCE_VERSION,
        "priority_training_count": priority_count,
        "secondary_training_count": secondary_count,
        "micro_gap_count": micro_count,
        "good_decision_count": good_count,
        "informational_count": informational_count,
        "no_major_moment": no_major,
        "label": (
            no_major_payload["moment_label"]
            if no_major
            else "Moments prioritaires"
        ),
        "message": (
            no_major_payload["moment_reason"]
            if no_major
            else "Les moments prioritaires peuvent devenir des exercices utiles."
        ),
    }


def _book_plies_for_game(connection: Any, game_id: int) -> set[int]:
    row = connection.execute(
        """
        SELECT last_book_ply, classification_status
        FROM game_opening_classifications
        WHERE game_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (game_id,),
    ).fetchone()
    if row is None:
        return set()
    status = str(_row_get(row, "classification_status") or "")
    if status == "not_applicable_from_position":
        return set()
    last_book_ply = _optional_int(_row_get(row, "last_book_ply"))
    if last_book_ply is None or last_book_ply <= 0:
        return set()
    return set(range(1, last_book_ply + 1))


def _opening_classification_for_game(
    connection: Any,
    game_id: int,
) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT
            c.game_id,
            c.line_id,
            c.opening_name,
            c.eco_code,
            c.matched_plies,
            c.last_book_ply,
            c.out_of_book_ply,
            c.out_of_book_color,
            c.out_of_book_fen,
            c.confidence,
            c.classification_status,
            l.source
        FROM game_opening_classifications c
        LEFT JOIN opening_lines l ON l.id = c.line_id
        WHERE c.game_id = ?
        ORDER BY c.id DESC
        LIMIT 1
        """,
        (game_id,),
    ).fetchone()
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def _apply_move_metric_details(
    audit_rows: list[dict[str, Any]],
    enriched_moves: list[dict[str, Any]],
) -> None:
    by_key = {
        (int(move["ply"]), str(move["side"]), str(move["uci"])): move
        for move in enriched_moves
    }
    for row in audit_rows:
        key = (int(row["ply"]), str(row["side"]), str(row["uci"]))
        move = by_key.get(key)
        if move is None:
            continue
        row["persistence_weight"] = _round_optional(move.get("persistence_weight"))
        row["cluster_weight"] = _round_optional(move.get("cluster_weight"))
        row["omega_weight"] = _round_optional(move.get("omega"))
        row["neuro_diagnostic_loss"] = _round_optional(
            move.get("neuro_diagnostic_loss")
        )
        evidence = row.get("review_evidence")
        if isinstance(evidence, dict):
            evidence["persistence_weight"] = row["persistence_weight"]
            evidence["cluster_weight"] = row["cluster_weight"]
            evidence["neuro_diagnostic_loss"] = row["neuro_diagnostic_loss"]


def _review_score_debug_from_metric_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    return {
        "analyzed_moves": int(bundle["move_count_analyzed"]),
        "missing_moves": int(bundle["missing_moves"]),
        "avg_win_loss": _round_optional(bundle.get("mean_win_loss")),
        "max_win_loss": _round_optional(bundle.get("max_win_loss")),
        "weighted_mean": _round_optional(bundle.get("weighted_mean")),
        "weighted_harmonic": _round_optional(bundle.get("harmonic_mean")),
        "worst_tail": None,
        "score_cap": None,
        "raw_score": _round_optional(bundle.get("lichess_like_accuracy")),
        "final_score": _round_optional(bundle.get("lichess_like_accuracy")),
        "lichess_like_accuracy": _round_optional(bundle.get("lichess_like_accuracy")),
        "neuro_score": _round_optional(bundle.get("neuro_score")),
        "diagnostic_gap": _round_optional(bundle.get("diagnostic_gap")),
        "mean_win_loss": _round_optional(bundle.get("mean_win_loss")),
        "tail_win_loss": _round_optional(bundle.get("tail_win_loss")),
        "mean_diagnostic_loss": _round_optional(bundle.get("mean_diagnostic_loss")),
        "tail_diagnostic_loss": _round_optional(bundle.get("tail_diagnostic_loss")),
        "tail_count": bundle.get("tail_count"),
        "z_value": _round_optional(bundle.get("z_value")),
        "volatility_window_size": bundle.get("volatility_window_size"),
        "volatility_weights": bundle.get("volatility_weights", []),
        "formula_versions": bundle.get("formula_versions", {}),
        "confidence": bundle["confidence"],
        "depth_min": None,
        "depth_max": None,
        "depth_avg": None,
        "engine_versions": [],
    }


def _score_availability_from_metric_bundles(
    white_bundle: dict[str, Any],
    black_bundle: dict[str, Any],
) -> dict[str, Any]:
    by_side = {
        "white": _side_score_availability_from_metric_bundle(white_bundle),
        "black": _side_score_availability_from_metric_bundle(black_bundle),
    }
    active_sides = [
        side_payload
        for side_payload in by_side.values()
        if int(side_payload.get("move_count_analyzed") or 0) > 0
    ]
    if not active_sides:
        return _empty_score_availability("insufficient_moves")

    lichess_status = _aggregate_availability(active_sides, "lichess_like")
    neuro_status = _aggregate_availability(active_sides, "neuro_score")
    gap_status = _aggregate_availability(active_sides, "diagnostic_gap")
    reason = "available"
    if neuro_status != "available":
        reason = (
            "legacy_needs_rebuild"
            if neuro_status == "legacy_needs_rebuild"
            else "missing_data"
        )
    elif lichess_status != "available":
        reason = "missing_data"
    elif gap_status != "available":
        reason = "missing_dependency"
    return {
        "lichess_like": lichess_status,
        "neuro_score": neuro_status,
        "diagnostic_gap": gap_status,
        "reason": reason,
        **by_side,
    }


def _side_score_availability_from_metric_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    move_count = int(bundle.get("move_count_analyzed") or 0)
    if move_count < 1:
        return _side_score_availability_empty("insufficient_moves")

    lichess_available = bundle.get("lichess_like_accuracy") is not None
    neuro_available = bundle.get("neuro_score") is not None
    gap_available = bundle.get("diagnostic_gap") is not None
    neuro_status = "available"
    if not neuro_available:
        neuro_status = "legacy_needs_rebuild" if lichess_available else "missing_data"
    return {
        "lichess_like": "available" if lichess_available else "missing_data",
        "neuro_score": neuro_status,
        "diagnostic_gap": "available" if gap_available else "missing_dependency",
        "reason": (
            "available"
            if lichess_available and neuro_available and gap_available
            else neuro_status
        ),
        "move_count_analyzed": move_count,
    }


def _aggregate_availability(
    side_payloads: list[dict[str, Any]],
    key: str,
) -> str:
    statuses = [str(payload.get(key) or "missing_data") for payload in side_payloads]
    if all(status == "available" for status in statuses):
        return "available"
    if "legacy_needs_rebuild" in statuses:
        return "legacy_needs_rebuild"
    if "missing_dependency" in statuses:
        return "missing_dependency"
    if "insufficient_moves" in statuses:
        return "insufficient_moves"
    return "missing_data"


def _review_criticality_by_move_id(
    connection: Any,
    review_id: int,
) -> dict[int, float]:
    rows = connection.execute(
        """
        SELECT move_id, importance_score
        FROM review_moments
        WHERE review_id = ?
        """,
        (review_id,),
    ).fetchall()
    return {
        int(row["move_id"]): float(row["importance_score"])
        for row in rows
        if row["move_id"] is not None and row["importance_score"] is not None
    }


def _stable_score_for_analysis(
    analysis: dict[str, Any] | None,
) -> tuple[int | None, int | None] | None:
    if analysis is None:
        return None
    eval_cp, mate_in = _stable_eval_from_analysis_json(
        analysis.get("analysis_json") or {}
    )
    if eval_cp is None and mate_in is None:
        return None
    return eval_cp, mate_in


def _review_score_audit_row(
    game_id: int,
    context: MoveContext,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    before_score: tuple[int | None, int | None] | None,
    after_score: tuple[int | None, int | None] | None,
    criticality: float | None,
) -> dict[str, Any]:
    included = before_score is not None and after_score is not None
    eval_before = mate_before = eval_after = mate_after = None
    white_before = white_after = None
    player_before = player_after = None
    win_loss = move_accuracy = None

    if before_score is not None:
        eval_before, mate_before = before_score
        white_before = white_percent_from_eval(eval_before, mate_before)
        player_before = player_percent_from_white_percent(
            white_before,
            context.played_by,
        )
    if after_score is not None:
        eval_after, mate_after = after_score
        white_after = white_percent_from_eval(eval_after, mate_after)
        player_after = player_percent_from_white_percent(
            white_after,
            context.played_by,
        )
    if included:
        win_loss = mover_win_percent_loss(
            eval_before_cp=eval_before,
            mate_before=mate_before,
            eval_after_cp=eval_after,
            mate_after=mate_after,
            played_by=context.played_by,
        )
        move_accuracy = move_accuracy_from_win_loss(win_loss)
    row = {
        "ply": context.ply,
        "side": context.played_by,
        "san": context.played_san,
        "uci": context.played_uci,
        "fen_before": context.fen_before,
        "fen_after": context.fen_after,
        "eval_before_cp": eval_before,
        "mate_before": mate_before,
        "eval_after_cp": eval_after,
        "mate_after": mate_after,
        "white_percent_before": _round_optional(white_before),
        "white_percent_after": _round_optional(white_after),
        "player_percent_before": _round_optional(player_before),
        "player_percent_after": _round_optional(player_after),
        "win_loss": _round_optional(win_loss),
        "move_accuracy": _round_optional(move_accuracy),
        "lichess_like_move_accuracy": _round_optional(move_accuracy),
        "neuro_diagnostic_loss": None,
        "persistence_weight": None,
        "cluster_weight": None,
        "omega_weight": None,
        "criticality_score": _round_optional(criticality),
        "move_weight": None,
        "included_in_score": included,
        "exclusion_reason": None if included else _score_exclusion_reason(before, after, before_score, after_score),
        "analysis_kind_before": before.get("analysis_kind") if before else None,
        "analysis_kind_after": after.get("analysis_kind") if after else None,
        "depth_before": _eval_depth_for_analysis(before),
        "depth_after": _eval_depth_for_analysis(after),
        "source_before": _analysis_source_kind(before),
        "source_after": _analysis_source_kind(after),
        "analysis_profile_before": _analysis_profile(before),
        "analysis_profile_after": _analysis_profile(after),
        "requested_time_ms_before": _analysis_requested_time_ms(before),
        "requested_time_ms_after": _analysis_requested_time_ms(after),
        "analysis_limit_mode_before": _analysis_limit_mode(before),
        "analysis_limit_mode_after": _analysis_limit_mode(after),
        "engine_version_before": _analysis_engine_version(before),
        "engine_version_after": _analysis_engine_version(after),
    }
    row["review_evidence"] = build_review_evidence_for_move(
        game_id=game_id,
        row=row,
        top_moves=_top_moves_snapshot((before or {}).get("analysis_json", {}).get("top_moves")),
        analyses_by_fen={
            context.fen_before: before,
            context.fen_after: after,
        },
        source=_evidence_source(before, after),
        reliability=_evidence_reliability(before, after),
        nodes_before=_analysis_nodes(before),
        nodes_after=_analysis_nodes(after),
    )
    return row


def build_review_evidence_for_move(
    *,
    game_id: int,
    row: dict[str, Any],
    top_moves: list[dict[str, Any]] | None = None,
    analyses_by_fen: dict[str, dict[str, Any] | None] | None = None,
    source: str = "review_standard",
    reliability: float | None = None,
    nodes_before: int | None = None,
    nodes_after: int | None = None,
) -> dict[str, Any]:
    evidence = {
        "review_evidence_schema_version": REVIEW_EVIDENCE_SCHEMA_VERSION,
        "game_id": game_id,
        "ply": row.get("ply"),
        "san": row.get("san"),
        "uci": row.get("uci"),
        "player_color": row.get("side"),
        "fen_before": row.get("fen_before"),
        "fen_after": row.get("fen_after"),
        "eval_before_cp": row.get("eval_before_cp"),
        "eval_after_cp": row.get("eval_after_cp"),
        "mate_before": row.get("mate_before"),
        "mate_after": row.get("mate_after"),
        "white_win_percent_before": row.get("white_percent_before"),
        "white_win_percent_after": row.get("white_percent_after"),
        "player_win_percent_before": row.get("player_percent_before"),
        "player_win_percent_after": row.get("player_percent_after"),
        "win_loss": row.get("win_loss"),
        "lichess_like_move_accuracy": row.get("lichess_like_move_accuracy"),
        "neuro_diagnostic_loss": row.get("neuro_diagnostic_loss"),
        "criticality_score": row.get("criticality_score"),
        "zone_before": None,
        "zone_after": None,
        "transition": None,
        "persistence_weight": row.get("persistence_weight"),
        "cluster_weight": row.get("cluster_weight"),
        "top_moves": top_moves or [],
        "engine_profile": row.get("analysis_profile_before") or row.get("analysis_profile_after"),
        "engine_version": row.get("engine_version_before") or row.get("engine_version_after"),
        "depth_before": row.get("depth_before"),
        "depth_after": row.get("depth_after"),
        "nodes_before": nodes_before,
        "nodes_after": nodes_after,
        "reliability": reliability,
        "source": source,
        "not_live": True,
        "llm_instruction": {
            "must_not_invent": True,
            "explain_uncertainty": True,
            "avoid_claiming_human_intent": True,
        },
    }
    contrast_input = {
        **evidence,
        "best_move_uci": (top_moves or [{}])[0].get("uci") if top_moves else None,
        "best_move_san": _san_for_uci(
            str(row.get("fen_before") or ""),
            str((top_moves or [{}])[0].get("uci"))
            if top_moves and (top_moves or [{}])[0].get("uci")
            else None,
        ),
        "top_moves": top_moves or [],
    }
    cleaned_analyses = {
        fen: analysis
        for fen, analysis in (analyses_by_fen or {}).items()
        if fen and isinstance(analysis, dict)
    }
    evidence["pv_contrast_evidence"] = build_pv_contrast_evidence(
        contrast_input,
        cleaned_analyses,
        {"game_id": game_id},
    )
    evidence["pv_contrast_evidence_version"] = PV_CONTRAST_EVIDENCE_VERSION
    return evidence


def _evidence_source(
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> str:
    for analysis in (before, after):
        profile = _analysis_profile(analysis)
        if profile == "deep":
            return "review_deep"
        if profile == "standard":
            return "review_standard"
    return "review_standard"


def _evidence_reliability(
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> float | None:
    values = [
        _optional_float(analysis.get("reliability_score"))
        for analysis in (before, after)
        if analysis is not None and analysis.get("reliability_score") is not None
    ]
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def _analysis_nodes(analysis: dict[str, Any] | None) -> int | None:
    if not analysis:
        return None
    analysis_json = analysis.get("analysis_json") or {}
    return _optional_int(analysis_json.get("nodes"))


def _score_exclusion_reason(
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    before_score: tuple[int | None, int | None] | None,
    after_score: tuple[int | None, int | None] | None,
) -> str:
    if before is None:
        return "missing_deep_before"
    if after is None:
        return "missing_deep_after"
    if before_score is None:
        return "missing_eval_before"
    if after_score is None:
        return "missing_eval_after"
    return "unknown"


def _augment_score_debug_with_analysis_meta(
    debug: dict[str, Any],
    depths: list[int],
    engine_versions: set[str],
) -> None:
    if depths:
        debug["depth_min"] = min(depths)
        debug["depth_max"] = max(depths)
        debug["depth_avg"] = round(sum(depths) / len(depths), 2)
    debug["engine_versions"] = sorted(engine_versions)


def _analysis_engine_version(analysis: dict[str, Any] | None) -> str | None:
    if not analysis:
        return None
    analysis_json = analysis.get("analysis_json") or {}
    achieved_depth = _optional_int(analysis_json.get("achieved_depth"))
    if achieved_depth is not None:
        return achieved_depth
    stabilized_eval = analysis_json.get("stabilized_eval")
    if isinstance(stabilized_eval, dict):
        engine_version = stabilized_eval.get("engine_version")
        if engine_version:
            return str(engine_version)
    engine_version = analysis.get("engine_version") or analysis_json.get("engine_version")
    return str(engine_version) if engine_version else None


def _analysis_source_kind(analysis: dict[str, Any] | None) -> str | None:
    if not analysis:
        return None
    analysis_json = analysis.get("analysis_json") or {}
    if isinstance(analysis_json.get("stabilized_eval"), dict):
        return REVIEW_STABILIZED_EVAL_SOURCE_KIND
    if analysis_json.get("eval_source_kind") == REVIEW_STABILIZED_EVAL_SOURCE_KIND:
        return REVIEW_STABILIZED_EVAL_SOURCE_KIND
    return str(analysis.get("analysis_kind") or "deep")


def _review_analysis_origin(coverage_details: dict[str, Any]) -> str:
    coverage = float(coverage_details.get("coverage") or 0.0)
    missing = int(coverage_details.get("missing_deep_count") or 0)
    scheduled = int(coverage_details.get("scheduled_deep_count") or 0)
    failed = int(coverage_details.get("failed_deep_count") or 0)
    if missing == 0 and coverage >= REVIEW_FULL_COVERAGE_THRESHOLD:
        return "cached_full"
    if coverage >= REVIEW_PARTIAL_COVERAGE_THRESHOLD:
        return "cached_partial"
    if scheduled > 0:
        return "newly_scheduled"
    if failed > 0:
        return "failed"
    if missing > 0:
        return "insufficient"
    return "unknown"


def _review_analysis_quality(coverage_details: dict[str, Any]) -> str:
    profile = coverage_details.get("analysis_profile_used") or coverage_details.get(
        "review_analysis_profile"
    )
    if profile:
        return str(profile)
    origin = _review_analysis_origin(coverage_details)
    if origin in {"cached_full", "cached_partial"}:
        return "cached"
    return REVIEW_ANALYSIS_DEFAULT_PROFILE


def _review_analysis_state(coverage_details: dict[str, Any]) -> str:
    coverage = float(coverage_details.get("coverage") or 0.0)
    missing = int(coverage_details.get("missing_deep_count") or 0)
    scheduled = int(coverage_details.get("scheduled_deep_count") or 0)
    failed = int(coverage_details.get("failed_deep_count") or 0)
    if failed > 0 and coverage < REVIEW_PARTIAL_COVERAGE_THRESHOLD:
        return "failed"
    if scheduled > 0 and missing > 0:
        return "pending"
    if missing == 0 and coverage >= REVIEW_FULL_COVERAGE_THRESHOLD:
        return "ready"
    if coverage >= REVIEW_PARTIAL_COVERAGE_THRESHOLD:
        return "partial"
    return "insufficient"


def _max_gap(*gaps: float | None) -> float | None:
    known = [float(gap) for gap in gaps if gap is not None]
    return max(known) if known else None


def _qualitative_game_label(
    *,
    coach_score: float | None,
    public_score: float | None,
    review_sections: dict[str, list[dict[str, Any]]],
    game: Any | None,
    user_color: str | None,
) -> str:
    priority_moves = review_sections.get("to_review") or []
    tag_counts = _review_section_tag_counts(priority_moves)
    critical_count = _critical_or_decisive_count(priority_moves)
    score = float(coach_score) if coach_score is not None else (
        float(public_score) if public_score is not None else None
    )
    reference_score = float(public_score) if public_score is not None else None

    if score is None:
        return "Partie à analyser"
    if _user_result_is_win(game, user_color) and score < 65.0:
        return "Partie gagnée malgré erreurs"
    if critical_count >= 3 or tag_counts.get("cluster", 0) >= 2:
        return "Partie à bascule"
    if tag_counts.get("missed_opportunity", 0) >= 2 or tag_counts.get("tactical", 0) >= 2:
        return "Partie tactique"
    if tag_counts.get("conversion_issue", 0) >= 2:
        return "Partie mal convertie"
    if tag_counts.get("defensive_resource_missed", 0) >= 2:
        return "Partie défensive difficile"
    if reference_score is not None and reference_score >= 80.0 and score < 70.0:
        return "Partie à bascule"
    if score >= 80.0 and critical_count <= 1:
        return "Partie solide"
    if score >= 65.0:
        return "Partie irrégulière"
    return "Partie fragile"


def _review_section_tag_counts(
    annotations: list[dict[str, Any]],
) -> dict[str, int]:
    tag_counts: dict[str, int] = {}
    for annotation in annotations:
        for tag in annotation.get("tags") or []:
            tag_counts[str(tag)] = tag_counts.get(str(tag), 0) + 1
    return tag_counts


def _critical_or_decisive_count(annotations: list[dict[str, Any]]) -> int:
    count = 0
    for annotation in annotations:
        category = str(annotation.get("primary_category") or "").lower()
        win_loss = _optional_float(annotation.get("win_loss")) or 0.0
        if category in {"critical", "decisive"} or win_loss >= 15.0:
            count += 1
    return count


def _user_result_is_win(game: Any | None, user_color: str | None) -> bool:
    result = str(_row_get(game, "result") or "").strip()
    if user_color == "white":
        return result in {"1-0", "white", "white_won"}
    if user_color == "black":
        return result in {"0-1", "black", "black_won"}
    return False


def _build_review_summary_sentence(
    *,
    coach_score: float | None,
    public_score: float | None,
    review_sections: dict[str, list[dict[str, Any]]],
    confidence: str | None,
) -> str:
    priority_moves = review_sections.get("to_review") or []
    tag_counts = _review_section_tag_counts(priority_moves)
    score = float(coach_score) if coach_score is not None else (
        float(public_score) if public_score is not None else None
    )
    reference_score = float(public_score) if public_score is not None else None
    critical_count = _critical_or_decisive_count(priority_moves)
    prefix = "Score indicatif : " if confidence == "low" else ""

    if tag_counts.get("conversion_issue", 0) >= 2:
        return f"{prefix}La conversion des positions favorables a coûté cher."
    if tag_counts.get("cluster", 0) >= 2:
        return f"{prefix}La partie a basculé autour de plusieurs moments groupés."
    if tag_counts.get("missed_opportunity", 0) >= 2:
        return f"{prefix}Plusieurs opportunités tactiques ont été manquées."
    if tag_counts.get("defensive_resource_missed", 0) >= 2:
        return f"{prefix}Les ressources défensives sont un axe prioritaire."
    if tag_counts.get("opening", 0) >= 1:
        return f"{prefix}Un problème apparaît après la sortie d'ouverture."
    if reference_score is not None and reference_score >= 80.0 and score is not None and score < 70.0:
        return f"{prefix}La précision moyenne est correcte, mais certains moments critiques coûtent cher."
    if score is not None and score >= 80.0 and critical_count <= 1:
        return f"{prefix}Partie solide : peu d'erreurs importantes détectées."
    if score is not None and score < 60.0:
        return f"{prefix}Partie difficile : plusieurs coups importants sont à revoir."
    if priority_moves:
        return f"{prefix}Quelques moments prioritaires expliquent l'essentiel de la Review."
    return f"{prefix}Partie stable : la Review ne détecte pas de gros point d'alerte."


def _payload_review_score_confidence(
    user_color: str | None,
    white_confidence: str | None,
    black_confidence: str | None,
) -> str | None:
    if user_color == "white":
        return white_confidence
    if user_color == "black":
        return black_confidence
    return _lowest_review_score_confidence([white_confidence, black_confidence])


def _lowest_review_score_confidence(
    confidences: list[str | None],
) -> str | None:
    order = {"low": 0, "medium": 1, "high": 2}
    known = [confidence for confidence in confidences if confidence in order]
    if not known:
        return None
    return min(known, key=lambda confidence: order[confidence])


def _normalized_user_color(value: Any) -> str | None:
    color = str(value or "").strip().lower()
    return color if color in {"white", "black"} else None


def _row_get(row: Any | None, key: str) -> Any | None:
    if row is None:
        return None
    try:
        if key in row.keys():
            return row[key]
    except Exception:
        return None
    return None


def _review_moment_payloads(connection: Any, review_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM review_moments
        WHERE review_id = ?
        ORDER BY ply, id
        """,
        (review_id,),
    ).fetchall()
    payloads: list[dict[str, Any]] = []
    for row in rows:
        top_moves = _parse_json_list(row["top_moves_json"])
        best_move = row["best_move_san"] or row["best_move_uci"]
        enrichment = _review_moment_enrichment(connection, row)
        payload = {
            "id": row["id"],
            "ply": row["ply"],
            "played_by": row["played_by"],
            "played_san": row["played_san"],
            "played_uci": row["played_uci"],
            "best_move_uci": row["best_move_uci"],
            "best_move_san": row["best_move_san"],
            "eval_before_cp": row["eval_before_cp"],
            "eval_after_cp": row["eval_after_cp"],
            "eval_before_label": format_eval_label(
                row["eval_before_cp"],
                row["mate_before"],
            ),
            "eval_after_label": format_eval_label(
                row["eval_after_cp"],
                row["mate_after"],
            ),
            "mate_before": row["mate_before"],
            "mate_after": row["mate_after"],
            "cp_loss": row["cp_loss"],
            "cp_loss_label": row["cp_loss_label"],
            "importance_score": row["importance_score"],
            "reliability_score": row["reliability_score"],
            "reliability_label": row["reliability_label"],
            "review_type": row["review_type"],
            "comment": _moment_comment(best_move),
            "fen_before": row["fen_before"],
            "fen_after": row["fen_after"],
            "top_moves": top_moves,
        }
        payload.update(enrichment)
        payloads.append(payload)
    return payloads


def _review_moment_enrichment(connection: Any, row: Any) -> dict[str, Any]:
    played_by = str(row["played_by"])
    eval_before = _optional_int(row["eval_before_cp"])
    eval_after = _optional_int(row["eval_after_cp"])
    mate_before = _optional_int(row["mate_before"])
    mate_after = _optional_int(row["mate_after"])
    mover_loss = mover_win_percent_loss(
        eval_before,
        mate_before,
        eval_after,
        mate_after,
        played_by,
    )
    player_percent_before = player_percent_from_score(
        eval_before,
        mate_before,
        played_by,
    )
    player_percent_after = player_percent_from_score(
        eval_after,
        mate_after,
        played_by,
    )
    zone_before = player_eval_zone(player_percent_before)
    zone_after = player_eval_zone(player_percent_after)
    mate_event = _is_significant_mate_event(
        mate_before=mate_before,
        mate_after=mate_after,
        played_by=played_by,
    )
    before_analysis = _deep_done_analysis(connection, str(row["fen_before"]))
    after_analysis = _deep_done_analysis(connection, str(row["fen_after"]))
    return {
        "mover_win_loss": mover_loss,
        "criticality_score": float(row["importance_score"]),
        "moment_type": moment_type_for_transition(
            zone_before,
            zone_after,
            mate_event=mate_event,
        ),
        "zone_before": zone_before,
        "zone_after": zone_after,
        "zone_transition": f"{zone_before}_to_{zone_after}",
        "eval_source_kind": _eval_source_kind_for_analyses(
            before_analysis,
            after_analysis,
        ),
        "eval_depth_before": _eval_depth_for_analysis(before_analysis),
        "eval_depth_after": _eval_depth_for_analysis(after_analysis),
        "player_percent_before": round(player_percent_before, 3),
        "player_percent_after": round(player_percent_after, 3),
    }


def _moment_comment(best_move: str | None) -> str:
    if best_move:
        return f"Le moteur préférait {best_move}, qui conservait une meilleure évaluation."
    return "Après ce coup, l’évaluation baisse pour le camp qui vient de jouer."


def _top_moves_snapshot(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    snapshot: list[dict[str, Any]] = []
    for entry in value[:TOP_MOVES_SNAPSHOT_LIMIT]:
        if not isinstance(entry, dict):
            continue
        pv = entry.get("pv")
        snapshot.append(
            {
                "rank": _optional_int(entry.get("rank")),
                "uci": str(entry.get("uci")) if entry.get("uci") is not None else None,
                "eval_cp": _optional_int(entry.get("eval_cp")),
                "eval_pov_side_to_move_cp": _optional_int(
                    entry.get("eval_pov_side_to_move_cp")
                ),
                "mate_in": _optional_int(entry.get("mate_in")),
                "pv": [str(move) for move in pv[:PV_SNAPSHOT_LIMIT]]
                if isinstance(pv, list)
                else [],
            }
        )
    return snapshot


def _stable_eval_from_analysis_json(
    analysis_json: dict[str, Any],
) -> tuple[int | None, int | None]:
    stabilized_eval = analysis_json.get("stabilized_eval")
    if isinstance(stabilized_eval, dict):
        return (
            _optional_int(stabilized_eval.get("final_eval_cp")),
            _optional_int(stabilized_eval.get("final_mate_in")),
        )
    return (
        _optional_int(analysis_json.get("eval_cp")),
        _optional_int(analysis_json.get("mate_in")),
    )


def _eval_source_kind_for_analyses(
    before_analysis: dict[str, Any] | None,
    after_analysis: dict[str, Any] | None,
) -> str:
    for analysis in (before_analysis, after_analysis):
        if not analysis:
            continue
        analysis_json = analysis.get("analysis_json") or {}
        if isinstance(analysis_json.get("stabilized_eval"), dict):
            return REVIEW_STABILIZED_EVAL_SOURCE_KIND
        if analysis_json.get("eval_source_kind") == REVIEW_STABILIZED_EVAL_SOURCE_KIND:
            return REVIEW_STABILIZED_EVAL_SOURCE_KIND
    return "deep"


def _eval_depth_for_analysis(analysis: dict[str, Any] | None) -> int | None:
    if not analysis:
        return None
    analysis_json = analysis.get("analysis_json") or {}
    stabilized_eval = analysis_json.get("stabilized_eval")
    if isinstance(stabilized_eval, dict):
        final_depth = _optional_int(stabilized_eval.get("final_depth"))
        if final_depth is not None:
            return final_depth
    return _optional_int(analysis.get("depth"))


def _moment_reliability(
    before: dict[str, Any],
    after: dict[str, Any],
) -> tuple[float, str | None]:
    before_score = _optional_float(before.get("reliability_score"))
    after_score = _optional_float(after.get("reliability_score"))
    known_scores = [score for score in (before_score, after_score) if score is not None]
    if not known_scores:
        return 0.8, "Reliability manquante pour au moins un moment; valeur prudente utilisée."

    score = min(known_scores)
    if score < 0.75:
        return 0.7, None
    return 1.0, None


def _reliability_label(score: float) -> str:
    if score < 0.4:
        return "low"
    if score < 0.75:
        return "medium"
    return "high"


def _is_significant_mate_event(
    mate_before: int | None,
    mate_after: int | None,
    played_by: str,
) -> bool:
    before = _mate_for_mover(mate_before, played_by)
    after = _mate_for_mover(mate_after, played_by)
    if before is None and after is None:
        return False
    return _mate_state(before) != _mate_state(after)


def _mate_for_mover(mate_in: int | None, played_by: str) -> int | None:
    if mate_in is None:
        return None
    return mate_in if played_by == "white" else -mate_in


def _mate_state(mate_in: int | None) -> str:
    if mate_in is None:
        return "none"
    return "winning" if mate_in > 0 else "losing"


def _analysis_value(eval_cp: int | None, mate_in: int | None) -> int | None:
    if mate_in is not None:
        if mate_in > 0:
            return 10000 - mate_in
        if mate_in < 0:
            return -10000 + abs(mate_in)
        return 0
    return eval_cp


def _san_for_uci(fen: str, uci: str | None) -> str | None:
    if not uci:
        return None
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return None
        return board.san(move)
    except Exception:
        return None


def _parse_json_object(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    parsed = json.loads(value)
    return parsed if isinstance(parsed, dict) else {}


def _parse_json_list(value: str | None) -> list[Any]:
    if not value:
        return []
    parsed = json.loads(value)
    return parsed if isinstance(parsed, list) else []


def _optional_int(value: Any) -> int | None:
    return int(value) if value is not None else None


def _optional_float(value: Any) -> float | None:
    return float(value) if value is not None else None


def _round_optional(value: float | None, digits: int = 3) -> float | None:
    return round(float(value), digits) if value is not None else None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
