from __future__ import annotations

import json
import sqlite3
import time
import uuid
from hashlib import sha256
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neurochess.analysis_service import AnalysisService, ENGINE_ANALYSIS_SCHEMA_VERSION
from neurochess.data.database import (
    execute_with_retry,
    get_connection,
    is_sqlite_locked_error,
)
from neurochess.review_service import (
    MIN_HALF_MOVES_FOR_REVIEW,
    REVIEW_PIPELINE_VERSION,
    ReviewService,
    ReviewServiceError,
    _build_move_contexts,
    _current_coverage_details,
    _deep_latest_analysis,
    _get_game,
    _get_moves,
    compute_review_per_position_time_ms,
    compute_review_total_budget_seconds,
    coverage_is_complete,
    normalize_review_analysis_profile,
    required_review_fens_for_contexts,
)


REVIEW_JOB_STATUSES = {
    "queued",
    "running",
    "finalizing",
    "completed",
    "failed",
    "cancelled",
    "incomplete",
    "stalled",
}
ACTIVE_REVIEW_JOB_STATUSES = {"queued", "running", "finalizing"}
HEAVY_REVIEW_PROFILES = {"standard", "deep"}
SQLITE_LOCK_FAILED_REASON = "sqlite_locked"
SQLITE_LOCK_USER_MESSAGE = (
    "Analyse interrompue par un verrou temporaire de la base locale."
)
STALLED_FAILED_REASON = "watchdog_stalled"
ENGINE_TIMEOUT_FAILED_REASON = "engine_hard_timeout"
STALLED_USER_MESSAGE = "Analyse bloquee temporairement."
ENGINE_TIMEOUT_USER_MESSAGE = (
    "Stockfish n'a pas repondu sur une position. Vous pouvez reprendre l'analyse."
)
FINALIZING_TIMEOUT_SECONDS = 60
MAX_POSITION_HARD_TIMEOUT_SECONDS = 180
MIN_POSITION_HARD_TIMEOUT_SECONDS = 60


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _serialize_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _parse_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


class ReviewJobService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        review_service: ReviewService | None = None,
        analysis_service: AnalysisService | None = None,
    ) -> None:
        self.db_path = db_path
        self.analysis_service = analysis_service or AnalysisService(db_path)
        self.review_service = review_service or ReviewService(
            db_path,
            analysis_service=self.analysis_service,
        )

    def start_job(
        self,
        game_id: int,
        profile: str = "standard",
        force_reanalysis: bool = False,
    ) -> dict[str, Any]:
        requested_profile = normalize_review_analysis_profile(profile)
        if requested_profile == "cached":
            requested_profile = "standard"

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
                raise ReviewServiceError(
                    "game too short for review",
                    status_code=400,
                )
            contexts = _build_move_contexts(moves)
            required_fens = required_review_fens_for_contexts(contexts)
            total_budget_seconds = compute_review_total_budget_seconds(
                len(moves),
                requested_profile,
            )
            per_position_time_ms = compute_review_per_position_time_ms(
                total_budget_seconds,
                len(required_fens),
                requested_profile,
            )
            if not force_reanalysis:
                active_job = self._active_job_for_game(
                    connection,
                    game_id,
                    requested_profile,
                )
                if active_job is not None:
                    return self.get_job(str(active_job["job_id"]))
                execute_with_retry(
                    lambda: (
                        self._reset_running_review_analyses_for_fens(
                            connection,
                            required_fens,
                            requested_profile,
                        ),
                        connection.commit(),
                    )
                )

            if force_reanalysis:
                def reset_forced_job() -> None:
                    self._cancel_active_jobs_for_game(
                        connection,
                        game_id,
                        requested_profile,
                    )
                    self._reset_review_cache_for_fens(
                        connection,
                        game_id,
                        required_fens,
                        requested_profile,
                    )
                    connection.commit()

                execute_with_retry(reset_forced_job)

            job_id = uuid.uuid4().hex
            now = _utc_now()
            def insert_job() -> None:
                connection.execute(
                    """
                    INSERT INTO review_jobs (
                        job_id,
                        game_id,
                        profile,
                        status,
                        force_reanalysis,
                        required_position_count,
                        completed_position_count,
                        failed_position_count,
                        current_fen_index,
                        total_budget_seconds,
                        per_position_time_ms,
                        elapsed_seconds,
                        estimated_remaining_seconds,
                        can_cancel,
                        cancellation_requested,
                        heartbeat_at,
                        last_progress_at,
                        current_phase,
                        created_at,
                        updated_at,
                        settings_json
                    )
                    VALUES (?, ?, ?, 'queued', ?, ?, 0, 0, 0, ?, ?, 0, ?, 1, 0, ?, ?, 'queued', ?, ?, ?)
                    """,
                    (
                        job_id,
                        game_id,
                        requested_profile,
                        1 if force_reanalysis else 0,
                        len(required_fens),
                        total_budget_seconds,
                        per_position_time_ms,
                        int(round(len(required_fens) * per_position_time_ms / 1000)),
                        now,
                        now,
                        now,
                        now,
                        _serialize_json(
                            {
                                "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                                "profile": requested_profile,
                                "total_budget_seconds": total_budget_seconds,
                                "per_position_time_ms": per_position_time_ms,
                                "required_position_count": len(required_fens),
                            }
                        ),
                    ),
                )
                connection.commit()

            execute_with_retry(insert_job)

        try:
            prepared = self.review_service.generate_review(
                game_id,
                force_retry_failed=True,
                profile=requested_profile,
            )
        except ReviewServiceError:
            self._mark_job_failed(job_id, "review_prepare_failed")
            raise
        except Exception as exc:
            self._mark_job_failed(job_id, repr(exc))
            return self.get_job(job_id)

        with closing(get_connection(self.db_path)) as connection:
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=requested_profile,
            )
            status = "completed" if prepared.get("status") == "done" and coverage_is_complete(coverage) else "queued"
            execute_with_retry(
                lambda: self._update_job_from_coverage_and_commit(
                    connection,
                    job_id,
                    status=status,
                    coverage=coverage,
                )
            )
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> dict[str, Any]:
        should_finalize = False
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                raise ReviewServiceError("review job not found", status_code=404)
            status = str(row["status"])
            coverage = self._coverage_for_job_payload(connection, row)
            final_review_exists = (
                self._final_review_exists(
                    connection,
                    int(row["game_id"]),
                    str(row["profile"]),
                )
                if status == "completed"
                else None
            )
            watchdog_action = (
                self._watchdog_action(row, coverage)
                if status in {"queued", "running", "finalizing"} and coverage is not None
                else None
            )
            if watchdog_action == "finalize":
                should_finalize = True
            elif watchdog_action == "stalled":
                reason = self._stalled_reason(row)
                message = (
                    ENGINE_TIMEOUT_USER_MESSAGE
                    if reason in {"position_timeout", "engine_hard_timeout"}
                    else "Analyse bloquee temporairement. Vous pouvez reprendre l'analyse."
                )
                self._update_job_from_coverage(
                    connection,
                    job_id,
                    status="stalled",
                    coverage=coverage,
                    error_message=message,
                    failed_reason=STALLED_FAILED_REASON,
                    last_error=reason,
                    retryable=True,
                    current_phase="stalled",
                    stalled_reason=reason,
                )
                connection.commit()
                row = self._get_job_row(connection, job_id)
                if row is None:
                    raise ReviewServiceError("review job not found", status_code=404)
                status = str(row["status"])
            if not should_finalize:
                derived = self._derive_reconcile_state(
                    row,
                    coverage=coverage,
                    final_review_exists=final_review_exists,
                )
                return self._job_payload(row, coverage=coverage, derived=derived)
        return self.finalize_review_job(job_id)

    def get_job_diagnostics(self, job_id: str) -> dict[str, Any]:
        """Read-only diagnostic pack for copying a Review job state."""
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                raise ReviewServiceError("review job not found", status_code=404)
            game_id = int(row["game_id"])
            profile = str(row["profile"])
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=profile,
            )
            status_counts = self._analysis_status_breakdown(
                connection,
                coverage,
                profile,
            )
            settings = _parse_json(row["settings_json"])
            watchdog_action = (
                self._watchdog_action(row, coverage)
                if str(row["status"]) in {"queued", "running", "finalizing"}
                else None
            )
            final_review_exists = (
                self._final_review_exists(connection, game_id, profile)
                if str(row["status"]) == "completed"
                else None
            )
            derived = self._derive_reconcile_state(
                row,
                coverage=coverage,
                final_review_exists=final_review_exists,
            )
            return {
                "job_id": row["job_id"],
                "game_id": game_id,
                "status": row["status"],
                "profile": profile,
                "retryable": bool(_row_get(row, "retryable", 0)),
                "stalled_reason": _row_get(row, "stalled_reason"),
                "error_message": row["error_message"],
                "failed_reason": _row_get(row, "failed_reason"),
                "last_error": _row_get(row, "last_error"),
                "watchdog_action_if_checked": watchdog_action,
                **derived,
                "current_phase": _row_get(row, "current_phase"),
                "current_fen_key": _row_get(row, "current_fen_key"),
                "current_fen_index": int(row["current_fen_index"] or 0),
                "required_position_count": int(
                    coverage.get("total_required_deep_count") or 0
                ),
                "completed_position_count_stored": int(
                    row["completed_position_count"] or 0
                ),
                "valid_analysis_count": int(coverage.get("analyzed_deep_count") or 0),
                "missing_fens_count": status_counts["missing"],
                "failed_fens_count": status_counts["failed"],
                "running_fens_count": status_counts["running"],
                "pending_fens_count": status_counts["pending"],
                "done_fens_count": status_counts["done"],
                "heartbeat_at": _row_get(row, "heartbeat_at"),
                "last_progress_at": _row_get(row, "last_progress_at"),
                "current_position_started_at": _row_get(
                    row,
                    "current_position_started_at",
                ),
                "attempts_for_current_position": int(
                    _row_get(row, "attempts_for_current_position", 0) or 0
                ),
                "total_budget_seconds": int(row["total_budget_seconds"] or 0),
                "per_position_time_ms": int(row["per_position_time_ms"] or 0),
                "engine_settings": {
                    "analysis_profile": coverage.get("review_analysis_profile"),
                    "analysis_limit_mode": coverage.get("analysis_limit_mode"),
                    "requested_multipv": coverage.get("requested_multipv"),
                    "analysis_threads": coverage.get("analysis_threads"),
                    "analysis_hash_mb": coverage.get("analysis_hash_mb"),
                    "uci_analyse_mode": coverage.get("uci_analyse_mode"),
                    "uci_limit_strength": coverage.get("uci_limit_strength"),
                    "skill_level": coverage.get("skill_level"),
                    "syzygy_path_active": coverage.get("syzygy_path_active"),
                },
                "analysis_profile_expected": profile,
                "cache_quality_gate_summary": {
                    "cache_hits": coverage.get("cache_hits"),
                    "cache_misses": coverage.get("cache_misses"),
                    "legacy_cache_ignored_count": coverage.get(
                        "legacy_cache_ignored_count"
                    ),
                    "coverage": coverage.get("coverage"),
                    "complete": coverage_is_complete(coverage),
                    "status_counts": status_counts,
                },
                "settings": settings,
                "last_events": [],
            }

    def cancel_job(self, job_id: str) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                raise ReviewServiceError("review job not found", status_code=404)
            now = _utc_now()
            def cancel() -> None:
                connection.execute(
                    """
                    UPDATE review_jobs
                    SET status = CASE
                            WHEN status IN ('completed', 'failed', 'cancelled') THEN status
                            ELSE 'cancelled'
                        END,
                        cancellation_requested = 1,
                        can_cancel = 0,
                        completed_at = CASE
                            WHEN completed_at IS NULL THEN ?
                            ELSE completed_at
                        END,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (now, now, job_id),
                )
                connection.commit()

            execute_with_retry(cancel)
        return self.get_job(job_id)

    def run_job(self, job_id: str) -> None:
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None or row["status"] not in {"queued", "running", "finalizing"}:
                return
            if row["status"] == "finalizing":
                self.finalize_review_job(job_id)
                return
            now = _utc_now()
            def mark_running() -> None:
                connection.execute(
                    """
                    UPDATE review_jobs
                    SET status = 'running',
                        started_at = COALESCE(started_at, ?),
                        heartbeat_at = ?,
                        current_phase = 'queued',
                        updated_at = ?,
                        can_cancel = 1
                    WHERE job_id = ?
                    """,
                    (now, now, now, job_id),
                )
                connection.commit()

            execute_with_retry(mark_running)

        while True:
            with closing(get_connection(self.db_path)) as connection:
                row = self._get_job_row(connection, job_id)
                if row is None:
                    return
                if int(row["cancellation_requested"] or 0):
                    execute_with_retry(
                        lambda: self._mark_cancelled_and_commit(connection, job_id)
                    )
                    return
                game_id = int(row["game_id"])
                profile = str(row["profile"])
                coverage = _current_coverage_details(
                    connection,
                    game_id,
                    requested_profile=profile,
                )
                execute_with_retry(
                    lambda: self._update_job_from_coverage_and_commit(
                        connection,
                        job_id,
                        status="running",
                        coverage=coverage,
                    )
                )

                if coverage_is_complete(coverage):
                    break
                if int(coverage.get("failed_deep_count") or 0) > 0 and int(
                    coverage.get("scheduled_deep_count") or 0
                ) == 0:
                    self._mark_job_failed(job_id, "analysis_failed")
                    return
                next_id = self._next_pending_analysis_id(connection, coverage, profile)
                if next_id is None and int(coverage.get("scheduled_deep_count") or 0) > 0:
                    self._mark_job_stalled(
                        job_id,
                        coverage=coverage,
                        reason="no_pending_analysis_available",
                    )
                    return
                next_row = (
                    self._analysis_row_by_id(connection, next_id)
                    if next_id is not None
                    else None
                )
                if next_row is not None:
                    self._touch_current_position_and_commit(
                        connection,
                        job_id,
                        coverage,
                        fen=str(next_row["fen"]),
                        phase="analyzing_position",
                    )

            if next_id is None:
                try:
                    self.review_service.generate_review(
                        game_id,
                        force_retry_failed=True,
                        profile=profile,
                    )
                except Exception as exc:
                    self._mark_job_failed(job_id, repr(exc))
                    return
                time.sleep(0.05)
                continue

            try:
                self.analysis_service.run_analysis(next_id)
                with closing(get_connection(self.db_path)) as connection:
                    row = self._get_job_row(connection, job_id)
                    if row is not None and int(row["cancellation_requested"] or 0):
                        execute_with_retry(
                            lambda: self._mark_cancelled_and_commit(connection, job_id)
                        )
                        return
                    coverage = _current_coverage_details(
                        connection,
                        int(row["game_id"]) if row is not None else game_id,
                        requested_profile=profile,
                    )
                    self._touch_job_phase_and_commit(
                        connection,
                        job_id,
                        phase="writing_position",
                        coverage=coverage,
                    )
            except Exception as exc:
                self._mark_job_failed(job_id, repr(exc))
                return

        self.finalize_review_job(job_id)

    def finalize_review_job(self, job_id: str) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                raise ReviewServiceError("review job not found", status_code=404)
            game_id = int(row["game_id"])
            profile = str(row["profile"])
            if row["status"] == "completed" and self._final_review_exists(
                connection,
                game_id,
                profile,
            ):
                return self._job_payload(row)
            if int(row["cancellation_requested"] or 0):
                execute_with_retry(
                    lambda: self._mark_cancelled_and_commit(connection, job_id)
                )
                return self.get_job(job_id)
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=profile,
            )
            if not coverage_is_complete(coverage):
                next_status = "incomplete" if int(coverage.get("failed_deep_count") or 0) else "running"
                execute_with_retry(
                    lambda: self._update_job_from_coverage_and_commit(
                        connection,
                        job_id,
                        status=next_status,
                        coverage=coverage,
                    )
                )
                return self.get_job(job_id)
            execute_with_retry(
                lambda: self._update_job_from_coverage_and_commit(
                    connection,
                    job_id,
                    status="finalizing",
                    coverage=coverage,
                    current_phase="finalizing",
                )
            )

        try:
            self.review_service.generate_review(
                game_id,
                profile=profile,
            )
        except Exception as exc:
            self._mark_job_failed(job_id, repr(exc))
            return self.get_job(job_id)

        with closing(get_connection(self.db_path)) as connection:
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=profile,
            )
            execute_with_retry(
                lambda: self._update_job_from_coverage_and_commit(
                    connection,
                    job_id,
                    status="completed" if coverage_is_complete(coverage) else "incomplete",
                    coverage=coverage,
                )
            )
        return self.get_job(job_id)

    def _next_pending_analysis_id(
        self,
        connection: sqlite3.Connection,
        coverage: dict[str, Any],
        profile: str,
    ) -> int | None:
        per_position_time_ms = int(coverage.get("per_position_time_ms") or 0)
        for fen in coverage.get("required_fens") or []:
            latest = _deep_latest_analysis(
                connection,
                str(fen),
                requested_profile=profile,
                min_requested_time_ms=per_position_time_ms,
            )
            if latest is not None and latest["status"] == "pending":
                return int(latest["id"])
        return None

    def _analysis_status_breakdown(
        self,
        connection: sqlite3.Connection,
        coverage: dict[str, Any],
        profile: str,
    ) -> dict[str, int]:
        per_position_time_ms = int(coverage.get("per_position_time_ms") or 0)
        counts = {
            "done": 0,
            "pending": 0,
            "running": 0,
            "failed": 0,
            "missing": 0,
            "other": 0,
        }
        for fen in coverage.get("required_fens") or []:
            latest = _deep_latest_analysis(
                connection,
                str(fen),
                requested_profile=profile,
                min_requested_time_ms=per_position_time_ms,
            )
            if latest is None:
                counts["missing"] += 1
                continue
            status = str(latest.get("status") or "other")
            if status in counts:
                counts[status] += 1
            else:
                counts["other"] += 1
        return counts

    def _coverage_for_job_payload(
        self,
        connection: sqlite3.Connection,
        row: Any,
    ) -> dict[str, Any] | None:
        status = str(row["status"])
        if status == "cancelled":
            return None
        return _current_coverage_details(
            connection,
            int(row["game_id"]),
            requested_profile=str(row["profile"]),
        )

    def _derive_reconcile_state(
        self,
        row: Any,
        *,
        coverage: dict[str, Any] | None,
        final_review_exists: bool | None = None,
    ) -> dict[str, Any]:
        status = str(row["status"])
        derived_is_stale = status == "stalled"
        derived_needs_reconcile = False
        derived_reconcile_reason: str | None = None

        if status == "completed" and final_review_exists is False:
            derived_needs_reconcile = True
            derived_reconcile_reason = "completed_without_review"
        elif status == "completed" and coverage is not None and not coverage_is_complete(coverage):
            derived_needs_reconcile = True
            derived_reconcile_reason = "completed_without_full_coverage"
        elif status in {"queued", "running", "finalizing"} and coverage is not None:
            action = self._watchdog_action(row, coverage)
            if action == "finalize":
                derived_needs_reconcile = True
                derived_reconcile_reason = "coverage_complete"
            elif action == "stalled":
                derived_is_stale = True
                derived_needs_reconcile = True
                derived_reconcile_reason = self._stalled_reason(row)

        retryable = bool(_row_get(row, "retryable", 0))
        can_reconcile = derived_needs_reconcile or (
            status in {"failed", "incomplete", "stalled"} and retryable
        )
        return {
            "derived_is_stale": derived_is_stale,
            "derived_needs_reconcile": derived_needs_reconcile,
            "can_reconcile": can_reconcile,
            "derived_reconcile_reason": derived_reconcile_reason,
        }

    def reconcile_review_job(self, job_id: str) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                raise ReviewServiceError("review job not found", status_code=404)
            game_id = int(row["game_id"])
            profile = str(row["profile"])
            coverage = _current_coverage_details(
                connection,
                game_id,
                requested_profile=profile,
            )
            if coverage_is_complete(coverage):
                if row["status"] == "completed" and self._final_review_exists(
                    connection,
                    game_id,
                    profile,
                ):
                    return self._job_payload(row, coverage=coverage)
                return self.finalize_review_job(job_id)

            if row["status"] == "completed":
                execute_with_retry(
                    lambda: self._update_job_from_coverage_and_commit(
                        connection,
                        job_id,
                        status="incomplete",
                        coverage=coverage,
                        error_message="Analyse incomplete : positions manquantes.",
                        retryable=True,
                        current_phase="stalled",
                        stalled_reason="completed_without_full_coverage",
                    )
                )
                return self.get_job(job_id)

            if row["status"] in {"queued", "running", "finalizing"}:
                action = self._watchdog_action(row, coverage)
                if action == "stalled":
                    self._mark_job_stalled(
                        job_id,
                        coverage=coverage,
                        reason=self._stalled_reason(row),
                    )
                    return self.get_job(job_id)

            return self._job_payload(row, coverage=coverage)

    def _analysis_row_by_id(
        self,
        connection: sqlite3.Connection,
        analysis_id: int,
    ) -> Any | None:
        return connection.execute(
            "SELECT * FROM position_analyses WHERE id = ?",
            (analysis_id,),
        ).fetchone()

    def _touch_current_position_and_commit(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        coverage: dict[str, Any],
        *,
        fen: str,
        phase: str,
    ) -> None:
        required_fens = list(coverage.get("required_fens") or [])
        try:
            fen_index = required_fens.index(fen) + 1
        except ValueError:
            fen_index = int(coverage.get("analyzed_deep_count") or 0) + 1
        fen_key = _fen_key(fen)
        now = _utc_now()
        row = self._get_job_row(connection, job_id)
        previous_key = _row_get(row, "current_fen_key")
        attempts = int(_row_get(row, "attempts_for_current_position", 0) or 0)
        attempts = attempts + 1 if previous_key == fen_key else 1
        execute_with_retry(
            lambda: self._touch_current_position(
                connection,
                job_id,
                fen_index=fen_index,
                fen_key=fen_key,
                phase=phase,
                now=now,
                attempts=attempts,
            )
        )

    def _touch_current_position(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        *,
        fen_index: int,
        fen_key: str,
        phase: str,
        now: str,
        attempts: int,
    ) -> None:
        connection.execute(
            """
            UPDATE review_jobs
            SET current_fen_index = ?,
                current_fen_key = ?,
                current_phase = ?,
                heartbeat_at = ?,
                current_position_started_at = ?,
                attempts_for_current_position = ?,
                updated_at = ?
            WHERE job_id = ?
            """,
            (fen_index, fen_key, phase, now, now, attempts, now, job_id),
        )
        connection.commit()

    def _touch_job_phase_and_commit(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        *,
        phase: str,
        coverage: dict[str, Any] | None = None,
    ) -> None:
        now = _utc_now()
        completed = (
            int(coverage.get("analyzed_deep_count") or 0)
            if coverage is not None
            else None
        )
        def touch() -> None:
            if completed is None:
                connection.execute(
                    """
                    UPDATE review_jobs
                    SET current_phase = ?,
                        heartbeat_at = ?,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (phase, now, now, job_id),
                )
            else:
                connection.execute(
                    """
                    UPDATE review_jobs
                    SET current_phase = ?,
                        heartbeat_at = ?,
                        last_progress_at = CASE
                            WHEN completed_position_count <> ? THEN ?
                            ELSE COALESCE(last_progress_at, ?)
                        END,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (phase, now, completed, now, now, now, job_id),
                )
            connection.commit()

        execute_with_retry(touch)

    def _active_job_for_game(
        self,
        connection: sqlite3.Connection,
        game_id: int,
        profile: str,
    ) -> Any | None:
        return connection.execute(
            """
            SELECT *
            FROM review_jobs
            WHERE game_id = ?
              AND profile = ?
              AND status IN ('queued', 'running', 'finalizing')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (game_id, profile),
        ).fetchone()

    def _cancel_active_jobs_for_game(
        self,
        connection: sqlite3.Connection,
        game_id: int,
        profile: str,
    ) -> None:
        now = _utc_now()
        connection.execute(
            """
            UPDATE review_jobs
            SET status = 'cancelled',
                cancellation_requested = 1,
                can_cancel = 0,
                completed_at = COALESCE(completed_at, ?),
                updated_at = ?
            WHERE game_id = ?
              AND profile = ?
              AND status IN ('queued', 'running', 'finalizing')
            """,
            (now, now, game_id, profile),
        )

    def _reset_review_cache_for_fens(
        self,
        connection: sqlite3.Connection,
        game_id: int,
        fens: list[str],
        profile: str,
    ) -> None:
        rank = {"quick": 1, "standard": 2, "deep": 3}.get(profile, 2)
        allowed_profiles = {
            "quick": {"quick", "standard", "deep", None},
            "standard": {"standard", "deep"},
            "deep": {"deep"},
        }.get(profile, {"standard", "deep"})
        for fen in fens:
            placeholders = ",".join("?" for _ in allowed_profiles if _ is not None)
            non_null_profiles = [item for item in allowed_profiles if item is not None]
            if non_null_profiles:
                connection.execute(
                    f"""
                    UPDATE position_analyses
                    SET status = 'pending',
                        analysis_json = '{{}}',
                        reliability_score = NULL,
                        reliability_label = NULL,
                        analysis_time_ms = NULL,
                        error_message = NULL,
                        completed_at = NULL
                    WHERE fen = ?
                      AND analysis_kind = 'deep'
                      AND schema_version = ?
                      AND analysis_profile IN ({placeholders})
                    """,
                    (fen, ENGINE_ANALYSIS_SCHEMA_VERSION, *non_null_profiles),
                )
            if None in allowed_profiles:
                connection.execute(
                    """
                    UPDATE position_analyses
                    SET status = 'pending',
                        analysis_json = '{}',
                        reliability_score = NULL,
                        reliability_label = NULL,
                        analysis_time_ms = NULL,
                        error_message = NULL,
                        completed_at = NULL
                    WHERE fen = ?
                      AND analysis_kind = 'deep'
                      AND schema_version = ?
                      AND analysis_profile IS NULL
                    """,
                    (fen, ENGINE_ANALYSIS_SCHEMA_VERSION),
                )
        connection.execute("DELETE FROM game_reviews WHERE game_id = ?", (game_id,))
        _ = rank  # kept explicit for audit readability: force ignores profile rank caches.

    def _reset_running_review_analyses_for_fens(
        self,
        connection: sqlite3.Connection,
        fens: list[str],
        profile: str,
    ) -> int:
        reset_count = 0
        for fen in fens:
            cursor = connection.execute(
                """
                UPDATE position_analyses
                SET status = 'pending',
                    error_message = NULL,
                    completed_at = NULL
                WHERE fen = ?
                  AND analysis_kind = 'deep'
                  AND schema_version = ?
                  AND status = 'running'
                  AND (
                      COALESCE(analysis_profile, '') = COALESCE(?, '')
                      OR (? = 'standard' AND analysis_profile = 'deep')
                      OR (? = 'deep' AND analysis_profile = 'deep')
                  )
                """,
                (
                    fen,
                    ENGINE_ANALYSIS_SCHEMA_VERSION,
                    profile,
                    profile,
                    profile,
                ),
            )
            reset_count += int(cursor.rowcount)
        return reset_count

    def _final_review_exists(
        self,
        connection: sqlite3.Connection,
        game_id: int,
        profile: str,
    ) -> bool:
        _ = profile
        row = connection.execute(
            """
            SELECT id
            FROM game_reviews
            WHERE game_id = ?
              AND status = 'done'
            ORDER BY id DESC
            LIMIT 1
            """,
            (game_id,),
        ).fetchone()
        return row is not None

    def _watchdog_action(
        self,
        row: Any,
        coverage: dict[str, Any],
    ) -> str | None:
        if coverage_is_complete(coverage):
            return "finalize"
        status = str(row["status"])
        now = datetime.now(timezone.utc)
        heartbeat_at = _parse_datetime(_row_get(row, "heartbeat_at"))
        if heartbeat_at is None:
            heartbeat_at = _parse_datetime(_row_get(row, "updated_at"))
        current_position_started_at = _parse_datetime(
            _row_get(row, "current_position_started_at")
        )
        if status == "finalizing":
            started = heartbeat_at or _parse_datetime(_row_get(row, "updated_at"))
            if started is not None and (now - started).total_seconds() > FINALIZING_TIMEOUT_SECONDS:
                return "stalled"
            return None
        per_position_time_ms = int(row["per_position_time_ms"] or 0)
        timeout_seconds = _position_hard_timeout_seconds(per_position_time_ms)
        started = current_position_started_at or heartbeat_at
        if started is not None and (now - started).total_seconds() > timeout_seconds:
            return "stalled"
        if heartbeat_at is not None and (now - heartbeat_at).total_seconds() > timeout_seconds:
            return "stalled"
        return None

    def _stalled_reason(self, row: Any) -> str:
        phase = str(_row_get(row, "current_phase", "") or "")
        if phase == "finalizing":
            return "finalizing_timeout"
        if phase == "analyzing_position":
            return "position_timeout"
        return "heartbeat_timeout"

    def _mark_job_stalled(
        self,
        job_id: str,
        *,
        coverage: dict[str, Any],
        reason: str,
    ) -> None:
        message = (
            ENGINE_TIMEOUT_USER_MESSAGE
            if reason in {"position_timeout", "engine_hard_timeout"}
            else "Analyse bloquee temporairement. Vous pouvez reprendre l'analyse."
        )
        execute_with_retry(
            lambda: self._mark_job_stalled_with_connection(
                job_id,
                coverage=coverage,
                reason=reason,
                message=message,
            )
        )

    def _mark_job_stalled_with_connection(
        self,
        job_id: str,
        *,
        coverage: dict[str, Any],
        reason: str,
        message: str,
    ) -> None:
        with closing(get_connection(self.db_path)) as connection:
            self._update_job_from_coverage(
                connection,
                job_id,
                status="stalled",
                coverage=coverage,
                error_message=message,
                failed_reason=STALLED_FAILED_REASON,
                last_error=reason,
                retryable=True,
                current_phase="stalled",
                stalled_reason=reason,
            )
            connection.commit()

    def _get_job_row(self, connection: sqlite3.Connection, job_id: str) -> Any | None:
        return connection.execute(
            "SELECT * FROM review_jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()

    def _update_job_from_coverage(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        status: str,
        coverage: dict[str, Any],
        error_message: str | None = None,
        failed_reason: str | None = None,
        last_error: str | None = None,
        retryable: bool | None = None,
        current_phase: str | None = None,
        stalled_reason: str | None = None,
    ) -> None:
        if status not in REVIEW_JOB_STATUSES:
            status = "failed"
        completed = int(coverage.get("analyzed_deep_count") or 0)
        required = int(coverage.get("total_required_deep_count") or 0)
        failed = int(coverage.get("failed_deep_count") or 0)
        percent = int(round((completed / required) * 100)) if required else 0
        row = self._get_job_row(connection, job_id)
        started_at = row["started_at"] if row is not None else None
        created_at = row["created_at"] if row is not None else None
        elapsed = _elapsed_seconds(started_at or created_at)
        previous_completed = int(row["completed_position_count"] or 0) if row is not None else 0
        previous_status = str(row["status"]) if row is not None else None
        last_progress_at = _row_get(row, "last_progress_at") if row is not None else None
        per_position_time_ms = int(coverage.get("per_position_time_ms") or 0)
        remaining_positions = max(0, required - completed)
        estimated_remaining = int(round(remaining_positions * per_position_time_ms / 1000))
        now = _utc_now()
        if completed != previous_completed or status != previous_status:
            last_progress_at = now
        if not last_progress_at:
            last_progress_at = now
        terminal = status in {"completed", "failed", "cancelled", "stalled", "incomplete"}
        can_cancel = 0 if terminal or status == "finalizing" else 1
        phase = current_phase or (
            "completed" if status == "completed"
            else "failed" if status == "failed"
            else "cancelled" if status == "cancelled"
            else "stalled" if status == "stalled"
            else "finalizing" if status == "finalizing"
            else "analyzing_position" if status == "running"
            else status
        )
        connection.execute(
            """
            UPDATE review_jobs
            SET status = ?,
                required_position_count = ?,
                completed_position_count = ?,
                failed_position_count = ?,
                current_fen_index = ?,
                total_budget_seconds = ?,
                per_position_time_ms = ?,
                elapsed_seconds = ?,
                estimated_remaining_seconds = ?,
                can_cancel = ?,
                error_message = COALESCE(?, error_message),
                failed_reason = COALESCE(?, failed_reason),
                last_error = COALESCE(?, last_error),
                retryable = CASE WHEN ? IS NULL THEN retryable ELSE ? END,
                heartbeat_at = ?,
                last_progress_at = ?,
                current_phase = ?,
                stalled_reason = COALESCE(?, stalled_reason),
                completed_at = CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END,
                updated_at = ?,
                settings_json = ?
            WHERE job_id = ?
            """,
            (
                status,
                required,
                completed,
                failed,
                min(completed + 1, required) if status == "running" else completed,
                int(coverage.get("total_budget_seconds") or 0),
                per_position_time_ms,
                elapsed,
                estimated_remaining,
                can_cancel,
                error_message,
                failed_reason,
                last_error,
                None if retryable is None else (1 if retryable else 0),
                0 if retryable is None else (1 if retryable else 0),
                now,
                last_progress_at,
                phase,
                stalled_reason,
                1 if terminal else 0,
                now,
                now,
                _serialize_json(
                    {
                        "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                        "analysis_profile": coverage.get("review_analysis_profile"),
                        "analysis_limit_mode": coverage.get("analysis_limit_mode"),
                        "requested_multipv": coverage.get("requested_multipv"),
                        "analysis_threads": coverage.get("analysis_threads"),
                        "analysis_hash_mb": coverage.get("analysis_hash_mb"),
                        "total_budget_seconds": coverage.get("total_budget_seconds"),
                        "per_position_time_ms": coverage.get("per_position_time_ms"),
                        "legacy_cache_ignored_count": coverage.get(
                            "legacy_cache_ignored_count"
                        ),
                    }
                ),
                job_id,
            ),
        )

    def _update_job_from_coverage_and_commit(
        self,
        connection: sqlite3.Connection,
        job_id: str,
        status: str,
        coverage: dict[str, Any],
        error_message: str | None = None,
        failed_reason: str | None = None,
        last_error: str | None = None,
        retryable: bool | None = None,
        current_phase: str | None = None,
        stalled_reason: str | None = None,
    ) -> None:
        self._update_job_from_coverage(
            connection,
            job_id,
            status=status,
            coverage=coverage,
            error_message=error_message,
            failed_reason=failed_reason,
            last_error=last_error,
            retryable=retryable,
            current_phase=current_phase,
            stalled_reason=stalled_reason,
        )
        connection.commit()

    def _mark_job_failed(self, job_id: str, error_message: str) -> None:
        with closing(get_connection(self.db_path)) as connection:
            row = self._get_job_row(connection, job_id)
            if row is None:
                return
            coverage = _current_coverage_details(
                connection,
                int(row["game_id"]),
                requested_profile=str(row["profile"]),
            )
            user_message, failed_reason, retryable = _friendly_failure(error_message)
            execute_with_retry(
                lambda: self._update_job_from_coverage_and_commit(
                    connection,
                    job_id,
                    status="failed",
                    coverage=coverage,
                    error_message=user_message,
                    failed_reason=failed_reason,
                    last_error=error_message,
                    retryable=retryable,
                    current_phase="failed",
                    stalled_reason=failed_reason if retryable else None,
                )
            )

    def _mark_cancelled(self, connection: sqlite3.Connection, job_id: str) -> None:
        now = _utc_now()
        connection.execute(
            """
            UPDATE review_jobs
            SET status = 'cancelled',
                can_cancel = 0,
                completed_at = COALESCE(completed_at, ?),
                updated_at = ?
            WHERE job_id = ?
            """,
            (now, now, job_id),
        )

    def _mark_cancelled_and_commit(
        self,
        connection: sqlite3.Connection,
        job_id: str,
    ) -> None:
        self._mark_cancelled(connection, job_id)
        connection.commit()

    def _job_payload(
        self,
        row: Any,
        coverage: dict[str, Any] | None = None,
        derived: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        required_value = (
            coverage.get("total_required_deep_count")
            if coverage is not None
            else row["required_position_count"]
        )
        completed_value = (
            coverage.get("analyzed_deep_count")
            if coverage is not None
            else row["completed_position_count"]
        )
        failed_value = (
            coverage.get("failed_deep_count")
            if coverage is not None
            else row["failed_position_count"]
        )
        required = int(required_value or 0)
        completed = int(completed_value or 0)
        failed = int(failed_value or 0)
        percent = int(round((completed / required) * 100)) if required else 0
        settings = _parse_json(row["settings_json"])
        payload = {
            "job_id": row["job_id"],
            "game_id": int(row["game_id"]),
            "status": row["status"],
            "profile": row["profile"],
            "required_position_count": required,
            "completed_position_count": completed,
            "failed_position_count": failed,
            "percent": max(0, min(100, percent)),
            "current_fen_index": int(row["current_fen_index"] or 0),
            "total_budget_seconds": int(row["total_budget_seconds"] or 0),
            "per_position_time_ms": int(row["per_position_time_ms"] or 0),
            "elapsed_seconds": _job_elapsed_seconds(row),
            "estimated_remaining_seconds": int(row["estimated_remaining_seconds"] or 0),
            "can_cancel": bool(row["can_cancel"]),
            "force_reanalysis": bool(row["force_reanalysis"]),
            "error_message": row["error_message"],
            "failed_reason": _row_get(row, "failed_reason"),
            "last_error": _row_get(row, "last_error"),
            "retryable": bool(_row_get(row, "retryable", 0)),
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "heartbeat_at": _row_get(row, "heartbeat_at"),
            "last_progress_at": _row_get(row, "last_progress_at"),
            "current_fen_key": _row_get(row, "current_fen_key"),
            "current_phase": _row_get(row, "current_phase"),
            "stalled_reason": _row_get(row, "stalled_reason"),
            "current_position_started_at": _row_get(
                row,
                "current_position_started_at",
            ),
            "attempts_for_current_position": int(
                _row_get(row, "attempts_for_current_position", 0) or 0
            ),
            "settings": settings,
            "review_pipeline_version": settings.get(
                "review_pipeline_version",
                REVIEW_PIPELINE_VERSION,
            ),
        }
        if derived is None:
            payload.update(
                {
                    "derived_is_stale": False,
                    "derived_needs_reconcile": False,
                    "can_reconcile": bool(
                        row["status"] in {"failed", "incomplete", "stalled"}
                        and bool(_row_get(row, "retryable", 0))
                    ),
                    "derived_reconcile_reason": None,
                }
            )
        else:
            payload.update(derived)
        return payload


def _elapsed_seconds(started_at: str | None) -> int:
    if not started_at:
        return 0
    try:
        parsed = datetime.fromisoformat(started_at)
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - parsed).total_seconds()))


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _fen_key(fen: str) -> str:
    return sha256(fen.encode("utf-8")).hexdigest()[:16]


def _position_hard_timeout_seconds(per_position_time_ms: int) -> int:
    return min(
        MAX_POSITION_HARD_TIMEOUT_SECONDS,
        max(MIN_POSITION_HARD_TIMEOUT_SECONDS, int(per_position_time_ms * 3 / 1000)),
    )


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except AttributeError:
        return default
    return row[key] if key in keys else default


def _job_elapsed_seconds(row: Any) -> int:
    stored = int(_row_get(row, "elapsed_seconds", 0) or 0)
    status = str(_row_get(row, "status", "") or "")
    if status in ACTIVE_REVIEW_JOB_STATUSES:
        stable_started_at = _row_get(row, "started_at") or _row_get(row, "created_at")
        return max(stored, _elapsed_seconds(stable_started_at))
    return stored


def _friendly_failure(error_message: str) -> tuple[str, str, bool]:
    try:
        locked = is_sqlite_locked_error(sqlite3.OperationalError(error_message))
    except Exception:
        locked = "database is locked" in error_message.lower()
    if locked:
        return SQLITE_LOCK_USER_MESSAGE, SQLITE_LOCK_FAILED_REASON, True
    if error_message == "analysis_failed":
        return (
            "Analyse incomplète : une ou plusieurs positions n'ont pas pu être analysées.",
            "analysis_failed",
            True,
        )
    if "engine_hard_timeout" in error_message or "time_budget_exceeded" in error_message:
        return (
            ENGINE_TIMEOUT_USER_MESSAGE,
            ENGINE_TIMEOUT_FAILED_REASON,
            True,
        )
    if error_message in {"no_pending_analysis_available", "heartbeat_timeout", "position_timeout"}:
        return (
            "Analyse bloquee temporairement. Vous pouvez reprendre l'analyse.",
            STALLED_FAILED_REASON,
            True,
        )
    if error_message == "review_prepare_failed":
        return (
            "La préparation de l'analyse Review a échoué.",
            "review_prepare_failed",
            True,
        )
    return "Analyse échouée.", "unknown", False
