from __future__ import annotations

import inspect
import json
import os
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chess

from neurochess.core.analysis_reliability import evaluate_analysis_reliability
from neurochess.core.evaluation_display import (
    make_evaluation_display,
    to_json_safe as evaluation_display_to_json,
)
from neurochess.core.stabilized_eval import (
    REVIEW_STABILIZED_EVAL_SOURCE_KIND,
    build_stabilized_eval_from_final_analysis,
    stabilized_eval_to_dict,
)
from neurochess.data.database import execute_with_retry, get_connection
from neurochess.engines.fake_engine import FakeStockfishService
from neurochess.engines.stockfish_service import StockfishService, StockfishServiceError


ENGINE_ANALYSIS_SCHEMA_VERSION = "engine_analysis_v2"
TIME_BUDGET_MS_DEEP = 5000
TIME_BUDGET_MS_SHALLOW = 300
VALID_ANALYSIS_KINDS = {"shallow", "deep"}
VALID_ANALYSIS_PROFILES = {"quick", "standard", "deep", "live_continuous"}
VALID_ANALYSIS_LIMIT_MODES = {
    "depth",
    "time",
    "time_with_max_depth",
    "mixed",
    "continuous",
    "terminal",
}
MAX_ENGINE_HARD_TIMEOUT_MS = 180_000
MIN_ENGINE_HARD_TIMEOUT_MS = 60_000


class InvalidFenError(ValueError):
    """Raised when a FEN is not valid standard chess FEN."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _utc_now_log() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


def _serialize_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _parse_analysis_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}

    parsed = json.loads(value)
    return parsed if isinstance(parsed, dict) else {}


def _row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fen": row["fen"],
        "analysis_json": _parse_analysis_json(row["analysis_json"]),
        "engine": row["engine"],
        "depth": row["depth"],
        "schema_version": row["schema_version"],
        "created_at": row["created_at"],
        "engine_version": row["engine_version"],
        "multipv": row["multipv"],
        "analysis_time_ms": row["analysis_time_ms"],
        "reliability_score": row["reliability_score"],
        "reliability_label": row["reliability_label"],
        "status": row["status"],
        "error_message": row["error_message"],
        "completed_at": row["completed_at"],
        "analysis_kind": row["analysis_kind"],
        "analysis_profile": _row_get(row, "analysis_profile"),
        "requested_time_ms": _row_get(row, "requested_time_ms"),
        "requested_depth": _row_get(row, "requested_depth"),
        "requested_multipv": _row_get(row, "requested_multipv"),
        "analysis_limit_mode": _row_get(row, "analysis_limit_mode"),
        "settings_json": _parse_analysis_json(_row_get(row, "settings_json")),
    }


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except AttributeError:
        return default
    return row[key] if key in keys else default


class AnalysisService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        log_path: str | Path = Path("logs") / "analysis.log",
        engine_name: str = "stockfish",
    ) -> None:
        self.db_path = db_path
        self.log_path = Path(log_path)
        self.engine_name = engine_name

    def get_or_create_analysis(
        self,
        fen: str,
        depth: int = 12,
        multipv: int = 3,
        kind: str = "deep",
        engine_version: str = "unknown",
        schema_version: str = ENGINE_ANALYSIS_SCHEMA_VERSION,
        analysis_profile: str | None = None,
        requested_time_ms: int | None = None,
        requested_depth: int | None = None,
        requested_multipv: int | None = None,
        analysis_limit_mode: str | None = None,
        settings_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self._validate_fen(fen)
        self._validate_kind(kind)
        self._validate_profile(analysis_profile)
        self._validate_limit_mode(analysis_limit_mode)

        stored_settings = settings_json or {}
        stored_requested_multipv = requested_multipv if requested_multipv is not None else multipv

        with closing(get_connection(self.db_path)) as connection:
            def insert_pending() -> None:
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
                        analysis_profile,
                        requested_time_ms,
                        requested_depth,
                        requested_multipv,
                        analysis_limit_mode,
                        settings_json,
                        status,
                        created_at
                    )
                    SELECT ?, '{}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM position_analyses
                        WHERE fen = ?
                          AND engine = ?
                          AND depth = ?
                          AND multipv = ?
                          AND analysis_kind = ?
                          AND schema_version = ?
                          AND COALESCE(analysis_profile, '') = COALESCE(?, '')
                          AND COALESCE(requested_time_ms, -1) = COALESCE(?, -1)
                          AND COALESCE(analysis_limit_mode, '') = COALESCE(?, '')
                          AND (
                              engine_version = ?
                              OR (? = 'unknown' AND status = 'done')
                          )
                    )
                    """,
                    (
                        fen,
                        self.engine_name,
                        engine_version,
                        depth,
                        multipv,
                        kind,
                        schema_version,
                        analysis_profile,
                        requested_time_ms,
                        requested_depth,
                        stored_requested_multipv,
                        analysis_limit_mode,
                        _serialize_json(stored_settings),
                        _utc_now(),
                        fen,
                        self.engine_name,
                        depth,
                        multipv,
                        kind,
                        schema_version,
                        analysis_profile,
                        requested_time_ms,
                        analysis_limit_mode,
                        engine_version,
                        engine_version,
                    ),
                )
                connection.commit()

            execute_with_retry(insert_pending)

            row = connection.execute(
                """
                SELECT *
                FROM position_analyses
                WHERE fen = ?
                  AND engine = ?
                  AND depth = ?
                  AND multipv = ?
                  AND analysis_kind = ?
                  AND schema_version = ?
                  AND COALESCE(analysis_profile, '') = COALESCE(?, '')
                  AND COALESCE(requested_time_ms, -1) = COALESCE(?, -1)
                  AND COALESCE(analysis_limit_mode, '') = COALESCE(?, '')
                  AND (
                      engine_version = ?
                      OR (? = 'unknown' AND status = 'done')
                  )
                ORDER BY
                    CASE
                        WHEN ? = 'unknown'
                         AND status = 'done'
                         AND engine_version <> 'unknown' THEN 0
                        WHEN engine_version = ? THEN 1
                        ELSE 2
                    END,
                    id DESC
                LIMIT 1
                """,
                (
                    fen,
                    self.engine_name,
                    depth,
                    multipv,
                    kind,
                    schema_version,
                    analysis_profile,
                    requested_time_ms,
                    analysis_limit_mode,
                    engine_version,
                    engine_version,
                    engine_version,
                    engine_version,
                ),
            ).fetchone()

        if row is None:
            raise RuntimeError("Unable to create or load analysis row")

        return _row_to_dict(row)

    def run_analysis(
        self,
        analysis_id: int,
        engine: Any | None = None,
    ) -> dict[str, Any] | None:
        row = self._get_analysis_row(analysis_id)
        if row is None:
            return None

        self._mark_running(analysis_id)
        created_engine = engine is None
        engine_instance = engine if engine is not None else self._create_engine()
        start_time = time.monotonic()
        analysis_time_ms = 0
        status = "failed"
        top1_uci: str | None = None
        log_engine_version = row["engine_version"]

        try:
            self._validate_fen(row["fen"])
            budget_ms = self._time_budget_ms(row)
            settings_json = _parse_analysis_json(_row_get(row, "settings_json"))
            limit_mode = _row_get(row, "analysis_limit_mode") or "mixed"
            terminal_analysis = self._terminal_analysis_if_needed(row, budget_ms)
            if terminal_analysis is not None:
                raw_analysis = terminal_analysis
            else:
                effective_multipv = self._effective_multipv(row["fen"], row["multipv"])
                raw_analysis = self._call_engine_with_hard_timeout(
                    engine_instance,
                    fen=row["fen"],
                    depth=row["depth"],
                    multipv=effective_multipv,
                    time_budget_ms=budget_ms,
                    analysis_kind=row["analysis_kind"],
                    analysis_limit_mode=limit_mode,
                    analysis_profile=_row_get(row, "analysis_profile"),
                    settings_json=settings_json,
                    hard_timeout_ms=self._engine_hard_timeout_ms(
                        row,
                        budget_ms,
                        engine_instance,
                    ),
                )
            analysis_time_ms = int((time.monotonic() - start_time) * 1000)
            canonical = self._canonical_analysis_json(
                row=row,
                raw_analysis=raw_analysis,
                analysis_time_ms=analysis_time_ms,
            )
            log_engine_version = canonical["engine_version"]
            top_moves = canonical["top_moves"]
            top1_uci = top_moves[0]["uci"] if top_moves else None
            reliability_score, reliability_label = self._reliability_for_canonical(
                row=row,
                canonical=canonical,
                analysis_time_ms=analysis_time_ms,
                top_moves=top_moves,
            )
            self._mark_done(
                analysis_id=analysis_id,
                analysis_json=canonical,
                reliability_score=reliability_score,
                reliability_label=reliability_label,
                analysis_time_ms=analysis_time_ms,
            )
            status = "done"
        except TimeoutError:
            analysis_time_ms = int((time.monotonic() - start_time) * 1000)
            self._mark_failed(
                analysis_id,
                error_message="time_budget_exceeded",
                analysis_time_ms=analysis_time_ms,
            )
            status = "failed"
        except InvalidFenError:
            analysis_time_ms = int((time.monotonic() - start_time) * 1000)
            self._mark_failed(
                analysis_id,
                error_message="invalid_fen",
                analysis_time_ms=analysis_time_ms,
            )
            status = "failed"
        except Exception as exc:
            analysis_time_ms = int((time.monotonic() - start_time) * 1000)
            self._mark_failed(
                analysis_id,
                error_message=repr(exc),
                analysis_time_ms=analysis_time_ms,
            )
            status = "failed"
        finally:
            if created_engine:
                try:
                    engine_instance.close()
                except (AttributeError, StockfishServiceError):
                    pass

            self._append_log_line(
                row=row,
                analysis_time_ms=analysis_time_ms,
                status=status,
                top1_uci=top1_uci,
                engine_version=log_engine_version,
            )

        return self._get_analysis_by_id(analysis_id)

    def process_pending_analyses(
        self,
        limit: int = 10,
        engine: Any | None = None,
    ) -> list[dict[str, Any]]:
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT id
                FROM position_analyses
                WHERE status = 'pending'
                ORDER BY created_at, id
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        processed: list[dict[str, Any]] = []
        for row in rows:
            result = self.run_analysis(row["id"], engine=engine)
            if result is not None:
                processed.append(result)
        return processed

    def recover_pending_analyses(self) -> int:
        with closing(get_connection(self.db_path)) as connection:
            def update_running() -> int:
                cursor = connection.execute(
                    """
                    UPDATE position_analyses
                    SET status = 'pending'
                    WHERE status = 'running'
                    """
                )
                connection.commit()
                return int(cursor.rowcount)

            return execute_with_retry(update_running)

    def get_analysis_by_fen(
        self,
        fen: str,
        kind: str = "deep",
        schema_version: str = ENGINE_ANALYSIS_SCHEMA_VERSION,
    ) -> dict[str, Any] | None:
        self._validate_fen(fen)
        self._validate_kind(kind)

        with closing(get_connection(self.db_path)) as connection:
            row = connection.execute(
                """
                SELECT *
                FROM position_analyses
                WHERE fen = ?
                  AND analysis_kind = ?
                  AND schema_version = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (fen, kind, schema_version),
            ).fetchone()

        return _row_to_dict(row) if row is not None else None

    def get_game_deep_analyses(self, game_id: int) -> list[dict[str, Any]]:
        positions = self._positions_after_moves(game_id)
        analyses: list[dict[str, Any]] = []

        for ply, fen in positions:
            row = self.get_analysis_by_fen(fen, kind="deep")
            if row is not None:
                payload = dict(row)
                payload["ply"] = ply
                analyses.append(payload)

        return analyses

    def evaluate_calibration(
        self,
        fen: str,
        depth: int = 22,
        time: float = 30.0,
        nodes: int | None = None,
        multipv: int = 1,
    ) -> dict[str, Any]:
        self._validate_fen(fen)

        engine = StockfishService()
        try:
            raw_calibration = engine.evaluate_calibration(
                fen=fen,
                depth=depth,
                time_limit=time,
                nodes=nodes,
                multipv=multipv,
            )
        finally:
            try:
                engine.close()
            except StockfishServiceError:
                pass

        result = raw_calibration["result"]
        display = make_evaluation_display(
            eval_cp=result.get("eval_cp"),
            mate_in=result.get("mate_in"),
        )
        display_payload = evaluation_display_to_json(display)
        reliability = evaluate_analysis_reliability(
            depth=result.get("depth_reached"),
            multipv=multipv,
            time_ms=result.get("time_ms"),
            has_mate=result.get("mate_in") is not None,
            engine=self.engine_name,
            top_moves_count=1 if result.get("best_move_uci") else 0,
            pv_legal=self._all_pvs_are_legal(
                fen,
                [{"pv": result.get("pv") or []}],
            ),
        )

        engine_version = raw_calibration.get("engine_version") or "unknown"

        return {
            "fen": fen,
            "engine_version": engine_version,
            "engine_options_reported": raw_calibration[
                "engine_options_reported"
            ],
            "analysis_kind": "calibration",
            "limit_used": raw_calibration["limit_used"],
            "result": result,
            "evaluation_display": {
                "white_percent": display_payload["white_percent"],
                "black_percent": display_payload["black_percent"],
                "label": display_payload["label"],
                "reliability_label": reliability.label,
                "is_mate": display_payload["is_mate"],
            },
            "evaluation_source": {
                "kind": "calibration",
                "depth": result.get("depth_reached") or depth,
                "time_ms": result.get("time_ms"),
                "nodes": result.get("nodes"),
                "engine_version": engine_version,
            },
            "side_to_move": raw_calibration["side_to_move"],
            "schema_version": "calibration_v1",
        }

    def _get_analysis_row(self, analysis_id: int) -> Any | None:
        with closing(get_connection(self.db_path)) as connection:
            return connection.execute(
                "SELECT * FROM position_analyses WHERE id = ?",
                (analysis_id,),
            ).fetchone()

    def _get_analysis_by_id(self, analysis_id: int) -> dict[str, Any] | None:
        row = self._get_analysis_row(analysis_id)
        return _row_to_dict(row) if row is not None else None

    def _create_engine(self) -> Any:
        mode = os.environ.get("NEUROCHESS_ENGINE_MODE", "").strip().lower()
        if mode == "fake":
            return FakeStockfishService()
        return StockfishService()

    def _mark_running(self, analysis_id: int) -> None:
        with closing(get_connection(self.db_path)) as connection:
            def mark_running() -> None:
                connection.execute(
                    """
                    UPDATE position_analyses
                    SET status = 'running',
                        error_message = NULL
                    WHERE id = ?
                    """,
                    (analysis_id,),
                )
                connection.commit()

            execute_with_retry(mark_running)

    def _mark_done(
        self,
        analysis_id: int,
        analysis_json: dict[str, Any],
        reliability_score: float,
        reliability_label: str,
        analysis_time_ms: int,
    ) -> None:
        with closing(get_connection(self.db_path)) as connection:
            def mark_done() -> None:
                engine_version = str(analysis_json.get("engine_version") or "unknown")
                current = connection.execute(
                    "SELECT engine_version, analysis_limit_mode FROM position_analyses WHERE id = ?",
                    (analysis_id,),
                ).fetchone()
                settings_payload = analysis_json.get("settings_json") or {}
                should_update_engine_version = (
                    current is not None
                    and current["engine_version"] == "unknown"
                    and engine_version != "unknown"
                )

                try:
                    if should_update_engine_version:
                        connection.execute(
                            """
                            UPDATE position_analyses
                            SET analysis_json = ?,
                                engine_version = ?,
                                settings_json = ?,
                                reliability_score = ?,
                                reliability_label = ?,
                                completed_at = ?,
                                status = 'done',
                                analysis_limit_mode = ?,
                                analysis_time_ms = ?,
                                error_message = NULL
                            WHERE id = ?
                            """,
                            (
                                _serialize_json(analysis_json),
                                engine_version,
                                _serialize_json(settings_payload),
                                reliability_score,
                                reliability_label,
                                _utc_now(),
                                self._stored_limit_mode_for_done(
                                    current,
                                    analysis_json,
                                ),
                                analysis_time_ms,
                                analysis_id,
                            ),
                        )
                    else:
                        self._update_done_without_engine_version(
                            connection=connection,
                            analysis_id=analysis_id,
                            analysis_json=analysis_json,
                            reliability_score=reliability_score,
                            reliability_label=reliability_label,
                            analysis_time_ms=analysis_time_ms,
                        )
                except sqlite3.IntegrityError:
                    connection.rollback()
                    self._update_done_without_engine_version(
                        connection=connection,
                        analysis_id=analysis_id,
                        analysis_json=analysis_json,
                        reliability_score=reliability_score,
                        reliability_label=reliability_label,
                        analysis_time_ms=analysis_time_ms,
                    )
                connection.commit()

            execute_with_retry(mark_done)

    def _update_done_without_engine_version(
        self,
        connection: sqlite3.Connection,
        analysis_id: int,
        analysis_json: dict[str, Any],
        reliability_score: float,
        reliability_label: str,
        analysis_time_ms: int,
    ) -> None:
        connection.execute(
            """
            UPDATE position_analyses
            SET analysis_json = ?,
                settings_json = ?,
                reliability_score = ?,
                reliability_label = ?,
                completed_at = ?,
                status = 'done',
                analysis_limit_mode = ?,
                analysis_time_ms = ?,
                error_message = NULL
            WHERE id = ?
            """,
            (
                _serialize_json(analysis_json),
                _serialize_json(analysis_json.get("settings_json") or {}),
                reliability_score,
                reliability_label,
                _utc_now(),
                self._stored_limit_mode_for_done(
                    connection.execute(
                        "SELECT analysis_limit_mode FROM position_analyses WHERE id = ?",
                        (analysis_id,),
                    ).fetchone(),
                    analysis_json,
                ),
                analysis_time_ms,
                analysis_id,
            ),
        )

    def _stored_limit_mode_for_done(
        self,
        current: Any | None,
        analysis_json: dict[str, Any],
    ) -> str | None:
        if analysis_json.get("analysis_limit_mode") == "terminal":
            return "terminal"
        return _row_get(current, "analysis_limit_mode")

    def _mark_failed(
        self,
        analysis_id: int,
        error_message: str,
        analysis_time_ms: int,
    ) -> None:
        with closing(get_connection(self.db_path)) as connection:
            def mark_failed() -> None:
                connection.execute(
                    """
                    UPDATE position_analyses
                    SET status = 'failed',
                        error_message = ?,
                        analysis_time_ms = ?
                    WHERE id = ?
                    """,
                    (error_message, analysis_time_ms, analysis_id),
                )
                connection.commit()

            execute_with_retry(mark_failed)

    def _call_engine(
        self,
        engine: Any,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int,
        analysis_kind: str,
        analysis_limit_mode: str = "mixed",
        analysis_profile: str | None = None,
        settings_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if analysis_kind == "deep" and hasattr(engine, "analyze_stabilized_fen"):
            stabilized_method = engine.analyze_stabilized_fen
            signature = inspect.signature(stabilized_method)
            kwargs: dict[str, Any] = {"time_budget_sec": time_budget_ms / 1000.0}
            if "min_depth" in signature.parameters and analysis_limit_mode != "time":
                kwargs["min_depth"] = depth
            if "multipv" in signature.parameters:
                kwargs["multipv"] = multipv
            if "limit_mode" in signature.parameters:
                kwargs["limit_mode"] = analysis_limit_mode
            if "analysis_profile" in signature.parameters:
                kwargs["analysis_profile"] = analysis_profile
            return stabilized_method(fen, **kwargs)

        analyze_fen = engine.analyze_fen
        signature = inspect.signature(analyze_fen)
        kwargs: dict[str, Any] = {"depth": depth, "multipv": multipv}

        if "time_budget_ms" in signature.parameters:
            kwargs["time_budget_ms"] = time_budget_ms
        if "analysis_limit_mode" in signature.parameters:
            kwargs["analysis_limit_mode"] = analysis_limit_mode
        if "analysis_profile" in signature.parameters:
            kwargs["analysis_profile"] = analysis_profile

        raw_analysis = analyze_fen(fen, **kwargs)
        if analysis_kind == "deep":
            stabilized = build_stabilized_eval_from_final_analysis(
                fen=fen,
                raw_analysis=raw_analysis,
                analysis_time_ms=time_budget_ms,
            )
            raw_analysis = dict(raw_analysis)
            raw_analysis["stabilized_eval"] = stabilized.to_dict()
            raw_analysis["eval_source_kind"] = REVIEW_STABILIZED_EVAL_SOURCE_KIND
        raw_analysis = dict(raw_analysis)
        raw_analysis["analysis_limit_mode"] = analysis_limit_mode
        raw_analysis["requested_time_ms"] = time_budget_ms
        raw_analysis.setdefault("requested_depth", None if analysis_limit_mode == "time" else depth)
        raw_analysis.setdefault("actual_multipv", multipv)
        if analysis_profile is not None:
            raw_analysis.setdefault("analysis_profile", analysis_profile)
        if settings_json:
            raw_analysis.setdefault("requested_settings_json", settings_json)
        return raw_analysis

    def _call_engine_with_hard_timeout(
        self,
        engine: Any,
        *,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int,
        analysis_kind: str,
        analysis_limit_mode: str,
        analysis_profile: str | None,
        settings_json: dict[str, Any],
        hard_timeout_ms: int,
    ) -> dict[str, Any]:
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="review-engine")
        future = executor.submit(
            self._call_engine,
            engine,
            fen,
            depth,
            multipv,
            time_budget_ms,
            analysis_kind,
            analysis_limit_mode,
            analysis_profile,
            settings_json,
        )
        try:
            return future.result(timeout=max(0.001, hard_timeout_ms / 1000.0))
        except FutureTimeoutError as exc:
            self._terminate_engine(engine)
            future.cancel()
            raise TimeoutError(
                f"engine_hard_timeout:{hard_timeout_ms}ms"
            ) from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _engine_hard_timeout_ms(
        self,
        row: Any,
        time_budget_ms: int,
        engine: Any,
    ) -> int:
        override = getattr(engine, "analysis_hard_timeout_ms", None)
        if override is not None:
            return max(1, int(override))
        settings_json = _parse_analysis_json(_row_get(row, "settings_json"))
        settings_override = settings_json.get("hard_timeout_ms")
        if settings_override is not None:
            try:
                return max(1, int(settings_override))
            except (TypeError, ValueError):
                pass
        return min(
            MAX_ENGINE_HARD_TIMEOUT_MS,
            max(MIN_ENGINE_HARD_TIMEOUT_MS, int(time_budget_ms) * 3),
        )

    def _terminate_engine(self, engine: Any) -> None:
        for method_name in ("terminate", "close", "quit"):
            method = getattr(engine, method_name, None)
            if method is None:
                continue
            try:
                method()
                return
            except Exception:
                continue

    def _effective_multipv(self, fen: str, requested_multipv: int) -> int:
        board = chess.Board(fen)
        legal_moves_count = board.legal_moves.count()
        if legal_moves_count <= 0:
            return 1
        return max(1, min(int(requested_multipv), legal_moves_count))

    def _terminal_analysis_if_needed(
        self,
        row: Any,
        time_budget_ms: int,
    ) -> dict[str, Any] | None:
        board = chess.Board(row["fen"])
        legal_moves_count = board.legal_moves.count()
        is_draw_terminal = (
            board.is_stalemate()
            or board.is_insufficient_material()
            or board.is_game_over(claim_draw=True)
            and not board.is_checkmate()
        )
        if not board.is_checkmate() and not is_draw_terminal and legal_moves_count > 0:
            return None

        if board.is_checkmate():
            eval_cp = None
            mate_in = -1 if board.turn == chess.WHITE else 1
            terminal_reason = "checkmate"
        else:
            eval_cp = 0
            mate_in = None
            terminal_reason = "draw_or_no_legal_moves"

        settings_payload = _parse_analysis_json(_row_get(row, "settings_json"))
        settings_payload.update(
            {
                "terminal_position": True,
                "terminal_reason": terminal_reason,
                "legal_moves_count": legal_moves_count,
                "analysis_limit_mode": "terminal",
            }
        )
        return {
            "fen": row["fen"],
            "engine": row["engine"],
            "engine_version": row["engine_version"] or "terminal_position",
            "depth": 0,
            "achieved_depth": 0,
            "nodes": 0,
            "nps": None,
            "multipv": 0,
            "actual_multipv": 0,
            "analysis_kind": row["analysis_kind"],
            "analysis_profile": _row_get(row, "analysis_profile"),
            "requested_time_ms": time_budget_ms,
            "actual_time_ms": 0,
            "analysis_limit_mode": "terminal",
            "limit_mode": "terminal",
            "requested_depth": None,
            "requested_multipv": _row_get(row, "requested_multipv") or row["multipv"],
            "settings_json": settings_payload,
            "engine_settings": settings_payload,
            "side_to_move": "white" if board.turn == chess.WHITE else "black",
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "top_moves": [],
            "schema_version": row["schema_version"],
            "terminal_position": True,
            "terminal_reason": terminal_reason,
            "legal_moves_count": legal_moves_count,
        }

    def _canonical_analysis_json(
        self,
        row: Any,
        raw_analysis: dict[str, Any],
        analysis_time_ms: int,
    ) -> dict[str, Any]:
        board = chess.Board(row["fen"])
        raw_top_moves = raw_analysis.get("top_moves") or []
        top_moves = [
            self._canonical_top_move(board.turn, raw_top_move, rank)
            for rank, raw_top_move in enumerate(raw_top_moves, start=1)
        ]
        eval_cp = (
            top_moves[0]["eval_cp"]
            if top_moves
            else self._optional_int(raw_analysis.get("eval_cp"))
        )
        mate_in = (
            top_moves[0]["mate_in"]
            if top_moves
            else self._optional_int(raw_analysis.get("mate_in"))
        )
        engine_version = str(raw_analysis.get("engine_version") or "unknown")
        stabilized_eval = stabilized_eval_to_dict(raw_analysis.get("stabilized_eval"))
        if stabilized_eval is not None:
            eval_cp = self._optional_int(stabilized_eval.get("final_eval_cp"))
            mate_in = self._optional_int(stabilized_eval.get("final_mate_in"))
            engine_version = str(
                stabilized_eval.get("engine_version") or engine_version
            )

        engine_settings = raw_analysis.get("engine_settings")
        requested_settings = _parse_analysis_json(_row_get(row, "settings_json"))
        settings_payload = dict(requested_settings)
        if isinstance(engine_settings, dict):
            settings_payload.update(engine_settings)

        payload = {
            "fen": row["fen"],
            "engine": row["engine"],
            "engine_version": engine_version,
            "depth": raw_analysis.get("achieved_depth") or raw_analysis.get("depth") or row["depth"],
            "achieved_depth": raw_analysis.get("achieved_depth")
            or raw_analysis.get("depth"),
            "nodes": raw_analysis.get("nodes"),
            "nps": raw_analysis.get("nps"),
            "multipv": row["multipv"],
            "actual_multipv": raw_analysis.get("actual_multipv"),
            "analysis_kind": row["analysis_kind"],
            "analysis_profile": _row_get(row, "analysis_profile"),
            "requested_time_ms": _row_get(row, "requested_time_ms")
            or raw_analysis.get("requested_time_ms"),
            "actual_time_ms": analysis_time_ms,
            "analysis_limit_mode": raw_analysis.get("analysis_limit_mode")
            or _row_get(row, "analysis_limit_mode"),
            "limit_mode": raw_analysis.get("analysis_limit_mode")
            or _row_get(row, "analysis_limit_mode"),
            "requested_depth": _row_get(row, "requested_depth")
            if _row_get(row, "requested_depth") is not None
            else raw_analysis.get("requested_depth"),
            "requested_multipv": _row_get(row, "requested_multipv")
            or raw_analysis.get("requested_multipv")
            or row["multipv"],
            "settings_json": settings_payload,
            "threads": settings_payload.get("threads"),
            "hash_mb": settings_payload.get("hash_mb"),
            "uci_analyse_mode": settings_payload.get("uci_analyse_mode"),
            "uci_limit_strength": settings_payload.get("uci_limit_strength"),
            "skill_level": settings_payload.get("skill_level"),
            "syzygy_path_active": settings_payload.get("syzygy_path_active"),
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "top_moves": top_moves,
            "schema_version": row["schema_version"],
            "analysis_time_ms": analysis_time_ms,
        }
        if stabilized_eval is not None:
            payload["stabilized_eval"] = stabilized_eval
            payload["eval_source_kind"] = REVIEW_STABILIZED_EVAL_SOURCE_KIND
        return payload

    def _reliability_for_canonical(
        self,
        row: Any,
        canonical: dict[str, Any],
        analysis_time_ms: int,
        top_moves: list[dict[str, Any]],
    ) -> tuple[float, str]:
        stabilized_eval = canonical.get("stabilized_eval")
        if row["analysis_kind"] == "deep" and isinstance(stabilized_eval, dict):
            score = stabilized_eval.get("reliability_score")
            label = stabilized_eval.get("reliability_label")
            if score is not None and label is not None:
                return float(score), str(label)

        reliability = evaluate_analysis_reliability(
            depth=canonical.get("achieved_depth") or canonical.get("depth") or row["depth"],
            multipv=row["multipv"],
            time_ms=analysis_time_ms,
            has_mate=canonical["mate_in"] is not None,
            engine=row["engine"],
            top_moves_count=len(top_moves),
            pv_legal=self._all_pvs_are_legal(row["fen"], top_moves),
        )
        return reliability.reliability_score, reliability.label

    def _canonical_top_move(
        self,
        side_to_move: chess.Color,
        raw_top_move: dict[str, Any],
        rank: int,
    ) -> dict[str, Any]:
        eval_cp = self._optional_int(raw_top_move.get("eval_cp"))

        return {
            "rank": rank,
            "uci": raw_top_move.get("uci"),
            "eval_cp": eval_cp,
            "eval_pov_side_to_move_cp": self._eval_for_side_to_move(
                eval_cp,
                side_to_move,
            ),
            "mate_in": self._optional_int(raw_top_move.get("mate_in")),
            "pv": [str(move) for move in raw_top_move.get("pv", [])],
        }

    def _positions_after_moves(self, game_id: int) -> list[tuple[int, str]]:
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT ply, fen_before, uci
                FROM moves
                WHERE game_id = ?
                ORDER BY ply, id
                """,
                (game_id,),
            ).fetchall()

        if not rows:
            return []

        board = chess.Board(rows[0]["fen_before"])
        positions: list[tuple[int, str]] = []

        for row in rows:
            move = chess.Move.from_uci(row["uci"])
            if move not in board.legal_moves:
                continue
            board.push(move)
            positions.append((row["ply"], board.fen()))

        return positions

    def _all_pvs_are_legal(
        self,
        fen: str,
        top_moves: list[dict[str, Any]],
    ) -> bool:
        for top_move in top_moves:
            board = chess.Board(fen)
            for uci in top_move["pv"]:
                try:
                    move = chess.Move.from_uci(uci)
                except ValueError:
                    return False

                if move not in board.legal_moves:
                    return False
                board.push(move)

        return True

    def _append_log_line(
        self,
        row: Any,
        analysis_time_ms: int,
        status: str,
        top1_uci: str | None,
        engine_version: str,
    ) -> None:
        payload = {
            "ts": _utc_now_log(),
            "fen": row["fen"],
            "engine": row["engine"],
            "engine_version": engine_version,
            "depth": row["depth"],
            "multipv": row["multipv"],
            "analysis_kind": row["analysis_kind"],
            "analysis_profile": _row_get(row, "analysis_profile"),
            "requested_time_ms": _row_get(row, "requested_time_ms"),
            "analysis_limit_mode": _row_get(row, "analysis_limit_mode"),
            "analysis_time_ms": analysis_time_ms,
            "status": status,
            "top1_uci": top1_uci,
        }
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

        with self.log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(_serialize_json(payload) + "\n")

    def _time_budget_ms(self, row_or_kind: Any) -> int:
        if isinstance(row_or_kind, str):
            return TIME_BUDGET_MS_SHALLOW if row_or_kind == "shallow" else TIME_BUDGET_MS_DEEP
        requested_time_ms = _row_get(row_or_kind, "requested_time_ms")
        if requested_time_ms is not None:
            return int(requested_time_ms)
        kind = row_or_kind["analysis_kind"]
        return TIME_BUDGET_MS_SHALLOW if kind == "shallow" else TIME_BUDGET_MS_DEEP

    def _validate_kind(self, kind: str) -> None:
        if kind not in VALID_ANALYSIS_KINDS:
            raise ValueError(f"Invalid analysis kind: {kind}")

    def _validate_profile(self, profile: str | None) -> None:
        if profile is not None and profile not in VALID_ANALYSIS_PROFILES:
            raise ValueError(f"Invalid analysis profile: {profile}")

    def _validate_limit_mode(self, mode: str | None) -> None:
        if mode is not None and mode not in VALID_ANALYSIS_LIMIT_MODES:
            raise ValueError(f"Invalid analysis limit mode: {mode}")

    def _validate_fen(self, fen: str) -> None:
        try:
            board = chess.Board(fen)
        except ValueError as exc:
            raise InvalidFenError("invalid_fen") from exc
        if not board.is_valid():
            raise InvalidFenError("invalid_fen") from None

    def _optional_int(self, value: Any) -> int | None:
        return int(value) if value is not None else None

    def _eval_for_side_to_move(
        self,
        eval_cp: int | None,
        side_to_move: chess.Color,
    ) -> int | None:
        if eval_cp is None:
            return None

        return eval_cp if side_to_move == chess.WHITE else -eval_cp


_default_service = AnalysisService()


def get_or_create_analysis(
    fen: str,
    depth: int = 12,
    multipv: int = 3,
    kind: str = "deep",
    engine_version: str = "unknown",
    schema_version: str = ENGINE_ANALYSIS_SCHEMA_VERSION,
    analysis_profile: str | None = None,
    requested_time_ms: int | None = None,
    requested_depth: int | None = None,
    requested_multipv: int | None = None,
    analysis_limit_mode: str | None = None,
    settings_json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _default_service.get_or_create_analysis(
        fen=fen,
        depth=depth,
        multipv=multipv,
        kind=kind,
        engine_version=engine_version,
        schema_version=schema_version,
        analysis_profile=analysis_profile,
        requested_time_ms=requested_time_ms,
        requested_depth=requested_depth,
        requested_multipv=requested_multipv,
        analysis_limit_mode=analysis_limit_mode,
        settings_json=settings_json,
    )


def run_analysis(
    analysis_id: int,
    engine: Any | None = None,
) -> dict[str, Any] | None:
    return _default_service.run_analysis(analysis_id, engine=engine)


def process_pending_analyses(limit: int = 10) -> list[dict[str, Any]]:
    return _default_service.process_pending_analyses(limit=limit)


def recover_pending_analyses() -> int:
    return _default_service.recover_pending_analyses()


def evaluate_calibration(
    fen: str,
    depth: int = 22,
    time: float = 30.0,
    nodes: int | None = None,
    multipv: int = 1,
) -> dict[str, Any]:
    return _default_service.evaluate_calibration(
        fen=fen,
        depth=depth,
        time=time,
        nodes=nodes,
        multipv=multipv,
    )
