from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

import chess

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.analysis_service import AnalysisService
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository
from neurochess.review_job_service import ReviewJobService
from neurochess.review_service import REVIEW_PIPELINE_VERSION, ReviewService


REVIEWABLE_MOVES = [
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
    "f1e1",
]


class FastAnalysisService(AnalysisService):
    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.run_ids: list[int] = []

    def run_analysis(self, analysis_id: int, engine: object | None = None) -> dict | None:
        self.run_ids.append(analysis_id)
        row = self._get_analysis_row(analysis_id)
        if row is None:
            return None
        settings = json.loads(row["settings_json"] or "{}")
        payload = {
            "fen": row["fen"],
            "engine": row["engine"],
            "engine_version": "FastJobFake 1",
            "depth": 18,
            "achieved_depth": 18,
            "nodes": 1000,
            "nps": 1000,
            "multipv": row["multipv"],
            "analysis_kind": row["analysis_kind"],
            "analysis_profile": row["analysis_profile"],
            "requested_time_ms": row["requested_time_ms"],
            "actual_time_ms": 1,
            "analysis_limit_mode": row["analysis_limit_mode"],
            "limit_mode": row["analysis_limit_mode"],
            "requested_depth": row["requested_depth"],
            "requested_multipv": row["requested_multipv"],
            "settings_json": settings,
            "eval_cp": 0,
            "mate_in": None,
            "top_moves": [],
            "schema_version": row["schema_version"],
            "analysis_time_ms": 1,
        }
        self._mark_done(
            analysis_id=analysis_id,
            analysis_json=payload,
            reliability_score=0.95,
            reliability_label="high",
            analysis_time_ms=1,
        )
        return self._get_analysis_by_id(analysis_id)


class ReviewJobServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-review-jobs-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.analysis_service = FastAnalysisService(self.db_path)
        self.review_service = ReviewService(
            self.db_path,
            analysis_service=self.analysis_service,
        )
        self.job_service = ReviewJobService(
            self.db_path,
            review_service=self.review_service,
            analysis_service=self.analysis_service,
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_start_job_returns_job_id_and_progress_without_blocking(self) -> None:
        game_id, positions = self._create_finished_game()

        job = self.job_service.start_job(game_id, profile="standard")

        self.assertIn("job_id", job)
        self.assertIn(job["status"], {"queued", "running"})
        self.assertEqual(job["required_position_count"], len(positions))
        self.assertEqual(job["completed_position_count"], 0)
        self.assertTrue(job["can_cancel"])

    def test_start_job_reuses_active_job_for_same_game_and_profile(self) -> None:
        game_id, _positions = self._create_finished_game()

        first = self.job_service.start_job(game_id, profile="standard")
        second = self.job_service.start_job(game_id, profile="standard")

        self.assertEqual(second["job_id"], first["job_id"])
        self.assertIn(second["status"], {"queued", "running"})

    def test_force_reanalysis_cancels_active_job_and_creates_new_one(self) -> None:
        game_id, _positions = self._create_finished_game()

        first = self.job_service.start_job(game_id, profile="standard")
        forced = self.job_service.start_job(
            game_id,
            profile="standard",
            force_reanalysis=True,
        )
        old_job = self.job_service.get_job(first["job_id"])

        self.assertNotEqual(forced["job_id"], first["job_id"])
        self.assertEqual(old_job["status"], "cancelled")

    def test_run_job_completes_only_after_all_positions(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")

        self.job_service.run_job(job["job_id"])
        completed = self.job_service.get_job(job["job_id"])
        review = self.review_service.get_review(game_id)

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["completed_position_count"], len(positions))
        self.assertEqual(completed["percent"], 100)
        self.assertEqual(review["status"], "done")

    def test_run_job_finalizes_without_rerunning_stockfish_when_cache_is_complete(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions)

        self.job_service.run_job(job["job_id"])
        completed = self.job_service.get_job(job["job_id"])
        review = self.review_service.get_review(game_id)

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["completed_position_count"], len(positions))
        self.assertEqual(review["status"], "done")

    def test_finalize_review_job_is_idempotent(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions)

        first = self.job_service.finalize_review_job(job["job_id"])
        second = self.job_service.finalize_review_job(job["job_id"])

        with closing(sqlite3.connect(self.db_path)) as connection:
            review_count = connection.execute(
                "SELECT COUNT(*) FROM game_reviews WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]
            moment_count = connection.execute(
                "SELECT COUNT(*) FROM review_moments WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]

        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["status"], "completed")
        self.assertEqual(review_count, 1)
        self.assertEqual(moment_count, 0)

    def test_finalize_retries_transient_sqlite_lock(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions)
        failures = {"count": 0}

        def fail_once(stage: str) -> None:
            if stage == "after_moments_insert" and failures["count"] == 0:
                failures["count"] += 1
                raise sqlite3.OperationalError("database is locked")

        retrying_review_service = ReviewService(
            self.db_path,
            analysis_service=self.analysis_service,
            failure_hook=fail_once,
        )
        retrying_job_service = ReviewJobService(
            self.db_path,
            review_service=retrying_review_service,
            analysis_service=self.analysis_service,
        )

        completed = retrying_job_service.finalize_review_job(job["job_id"])

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(failures["count"], 1)

    def test_get_review_job_status_materializes_stale_job_as_recoverable(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(
            timespec="seconds"
        )

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_jobs
                SET status = 'running',
                    heartbeat_at = ?,
                    current_position_started_at = ?,
                    current_phase = 'analyzing_position'
                WHERE job_id = ?
                """,
                (stale, stale, job["job_id"]),
            )
            connection.commit()

        before = self._job_snapshot(job["job_id"])
        payload = self.job_service.get_job(job["job_id"])
        after = self._job_snapshot(job["job_id"])

        self.assertEqual(before["status"], "running")
        self.assertEqual(after["status"], "stalled")
        self.assertEqual(payload["status"], "stalled")
        self.assertTrue(payload["retryable"])
        self.assertEqual(payload["current_phase"], "stalled")
        self.assertEqual(payload["stalled_reason"], "position_timeout")
        self.assertTrue(payload["derived_is_stale"])
        self.assertFalse(payload["derived_needs_reconcile"])
        self.assertTrue(payload["can_reconcile"])
        self.assertIsNone(payload["derived_reconcile_reason"])

    def test_get_review_job_status_materializes_stale_queued_job_as_recoverable(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(
            timespec="seconds"
        )

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_jobs
                SET status = 'queued',
                    heartbeat_at = ?,
                    updated_at = ?,
                    current_phase = 'queued'
                WHERE job_id = ?
                """,
                (stale, stale, job["job_id"]),
            )
            connection.commit()

        before = self._job_snapshot(job["job_id"])
        payload = self.job_service.get_job(job["job_id"])
        after = self._job_snapshot(job["job_id"])

        self.assertEqual(before["status"], "queued")
        self.assertEqual(after["status"], "stalled")
        self.assertEqual(payload["status"], "stalled")
        self.assertTrue(payload["retryable"])
        self.assertEqual(payload["current_phase"], "stalled")
        self.assertEqual(payload["stalled_reason"], "heartbeat_timeout")
        self.assertTrue(payload["derived_is_stale"])
        self.assertFalse(payload["derived_needs_reconcile"])
        self.assertTrue(payload["can_reconcile"])

    def test_post_reconcile_mutates_stale_job(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(
            timespec="seconds"
        )

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_jobs
                SET status = 'running',
                    heartbeat_at = ?,
                    current_position_started_at = ?,
                    current_phase = 'analyzing_position'
                WHERE job_id = ?
                """,
                (stale, stale, job["job_id"]),
            )
            connection.commit()

        stalled = self.job_service.reconcile_review_job(job["job_id"])

        self.assertEqual(stalled["status"], "stalled")
        self.assertTrue(stalled["retryable"])
        self.assertIn("Stockfish", stalled["error_message"])
        self.assertEqual(stalled["current_phase"], "stalled")

    def test_reconcile_finalizes_when_cache_complete_but_job_counter_is_stale(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_jobs
                SET status = 'running',
                    completed_position_count = ?,
                    current_phase = 'analyzing_position'
                WHERE job_id = ?
                """,
                (len(positions) - 1, job["job_id"]),
            )
            connection.commit()

        reconciled = self.job_service.reconcile_review_job(job["job_id"])
        review = self.review_service.get_review(game_id)

        self.assertEqual(reconciled["status"], "completed")
        self.assertEqual(reconciled["completed_position_count"], len(positions))
        self.assertEqual(review["status"], "done")

    def test_run_job_stalls_when_only_running_analysis_remains(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        with closing(sqlite3.connect(self.db_path)) as connection:
            analysis_id = connection.execute(
                """
                SELECT id
                FROM position_analyses
                WHERE analysis_profile = 'standard'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()[0]
            connection.execute(
                """
                UPDATE position_analyses
                SET status = 'running'
                WHERE id = ?
                """,
                (analysis_id,),
            )
            connection.commit()

        self.job_service.run_job(job["job_id"])
        stalled = self.job_service.get_job(job["job_id"])

        self.assertEqual(stalled["status"], "stalled")
        self.assertTrue(stalled["retryable"])
        self.assertEqual(stalled["stalled_reason"], "no_pending_analysis_available")

    def test_resume_partial_cache_runs_only_missing_position(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions[:-1])
        self.analysis_service.run_ids.clear()

        self.job_service.run_job(job["job_id"])
        completed = self.job_service.get_job(job["job_id"])

        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["completed_position_count"], len(positions))
        self.assertEqual(len(self.analysis_service.run_ids), 1)

    def test_diagnostics_pack_reports_recalculated_counts(self) -> None:
        game_id, positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self._insert_done_standard_cache(positions[:-1])

        diagnostics = self.job_service.get_job_diagnostics(job["job_id"])

        self.assertEqual(diagnostics["job_id"], job["job_id"])
        self.assertEqual(diagnostics["game_id"], game_id)
        self.assertEqual(diagnostics["valid_analysis_count"], len(positions) - 1)
        self.assertEqual(diagnostics["pending_fens_count"], 1)
        self.assertEqual(diagnostics["missing_fens_count"], 0)
        self.assertIn("cache_quality_gate_summary", diagnostics)
        self.assertIn("engine_settings", diagnostics)

    def test_get_review_job_diagnostics_is_read_only(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(
            timespec="seconds"
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE review_jobs
                SET status = 'running',
                    heartbeat_at = ?,
                    current_position_started_at = ?,
                    current_phase = 'analyzing_position'
                WHERE job_id = ?
                """,
                (stale, stale, job["job_id"]),
            )
            connection.commit()

        before = self._job_snapshot(job["job_id"])
        diagnostics = self.job_service.get_job_diagnostics(job["job_id"])
        after = self._job_snapshot(job["job_id"])

        self.assertEqual(after, before)
        self.assertTrue(diagnostics["derived_is_stale"])
        self.assertTrue(diagnostics["derived_needs_reconcile"])
        self.assertTrue(diagnostics["can_reconcile"])

    def test_cancelled_job_does_not_produce_final_review(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")

        cancelled = self.job_service.cancel_job(job["job_id"])
        self.job_service.run_job(job["job_id"])
        review = self.review_service.get_review(game_id)

        self.assertEqual(cancelled["status"], "cancelled")
        self.assertNotEqual(review["status"], "done")
        self.assertEqual(review["moments"], [])

    def test_database_locked_failure_is_retryable_and_sanitized(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")

        self.job_service._mark_job_failed(
            job["job_id"],
            "OperationalError('database is locked')",
        )
        failed = self.job_service.get_job(job["job_id"])
        review = self.review_service.get_review(game_id)

        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["failed_reason"], "sqlite_locked")
        self.assertTrue(failed["retryable"])
        self.assertIn("verrou temporaire", failed["error_message"])
        self.assertIn("database is locked", failed["last_error"])
        self.assertNotEqual(review["status"], "done")

    def test_resume_after_retryable_failure_creates_new_job_without_force(self) -> None:
        game_id, _positions = self._create_finished_game()
        job = self.job_service.start_job(game_id, profile="standard")
        self.job_service._mark_job_failed(job["job_id"], "analysis_failed")

        resumed = self.job_service.start_job(game_id, profile="standard")

        self.assertNotEqual(resumed["job_id"], job["job_id"])
        self.assertIn(resumed["status"], {"queued", "running"})

    def test_force_reanalysis_resets_current_profile_cache(self) -> None:
        game_id, positions = self._create_finished_game()
        self._insert_done_standard_cache(positions)

        cached = self.job_service.start_job(game_id, profile="standard")
        forced = self.job_service.start_job(
            game_id,
            profile="standard",
            force_reanalysis=True,
        )

        self.assertEqual(cached["status"], "completed")
        self.assertIn(forced["status"], {"queued", "running"})
        self.assertEqual(forced["completed_position_count"], 0)
        with closing(sqlite3.connect(self.db_path)) as connection:
            pending = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_profile = 'standard'
                  AND status = 'pending'
                """
            ).fetchone()[0]
        self.assertGreater(pending, 0)

    def _job_snapshot(self, job_id: str) -> dict[str, object]:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT status,
                       heartbeat_at,
                       last_progress_at,
                       current_phase,
                       retryable,
                       stalled_reason,
                       error_message,
                       failed_reason,
                       last_error,
                       completed_position_count,
                       failed_position_count,
                       updated_at
                FROM review_jobs
                WHERE job_id = ?
                """,
                (job_id,),
            ).fetchone()
        self.assertIsNotNone(row)
        return dict(row)

    def _create_finished_game(self) -> tuple[int, list[str]]:
        game_id = self.repository.create_game("classic")
        board = chess.Board()
        positions = [board.fen()]
        for ply, uci in enumerate(REVIEWABLE_MOVES, start=1):
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
        self.repository.finish_game(game_id, result="*", pgn='[Result "*"]')
        return game_id, positions

    def _insert_done_standard_cache(self, positions: list[str]) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            for fen in positions:
                settings = {
                    "analysis_profile": "standard",
                    "review_pipeline_version": REVIEW_PIPELINE_VERSION,
                    "requested_time_ms": 10000,
                    "analysis_limit_mode": "time",
                    "requested_multipv": 3,
                }
                payload = {
                    "fen": fen,
                    "engine": "stockfish",
                    "engine_version": "FastJobFake 1",
                    "depth": 18,
                    "achieved_depth": 18,
                    "multipv": 3,
                    "analysis_kind": "deep",
                    "analysis_profile": "standard",
                    "requested_time_ms": 10000,
                    "analysis_limit_mode": "time",
                    "requested_multipv": 3,
                    "settings_json": settings,
                    "eval_cp": 0,
                    "mate_in": None,
                    "top_moves": [],
                    "schema_version": "engine_analysis_v2",
                }
                connection.execute(
                    """
                    INSERT INTO position_analyses (
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
                    VALUES (?, ?, 'stockfish', 'FastJobFake 1', 802, 3, 'deep',
                            'engine_analysis_v2', 'done', datetime('now'),
                            datetime('now'), 0.95, 'high', 1, 'standard',
                            10000, NULL, 3, 'time', ?)
                    """,
                    (fen, json.dumps(payload), json.dumps(settings)),
                )
            connection.commit()


if __name__ == "__main__":
    unittest.main()
