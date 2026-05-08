from __future__ import annotations

import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

import chess
import chess.engine

from neurochess.core.evaluation_display import make_evaluation_display, to_json_safe
from neurochess.engines.engine_profiles import (
    apply_engine_profile_options,
    engine_profile_for_name,
    optional_syzygy_path,
)
from neurochess.engines.engine_config import STOCKFISH_PATH


LIVE_ANALYSIS_MAX_SECONDS: float | None = None
LIVE_ANALYSIS_THROTTLE_MS = 250
LIVE_ANALYSIS_MULTIPV = 1
LIVE_ANALYSIS_PROFILE = "live_continuous"
LIVE_ANALYSIS_LIMIT_MODE = "continuous"
LIVE_UPDATE_SCHEMA_VERSION = "live_analysis_update_v1"


@dataclass
class LiveAnalysisSession:
    session_id: str
    fen: str
    game_id: int | None = None
    ply: int | None = None
    context: str = "live"
    review_moment_id: str | None = None
    started_at: str = field(default_factory=lambda: _utc_now())
    status: str = "running"
    latest_payload: dict[str, Any] | None = None
    error_message: str | None = None
    stop_event: threading.Event = field(default_factory=threading.Event)
    updates: queue.Queue[dict[str, Any]] = field(default_factory=queue.Queue)
    thread: threading.Thread | None = None


class StockfishLiveAnalyzer:
    def __init__(
        self,
        stockfish_path: str | None = None,
        max_seconds: float | None = LIVE_ANALYSIS_MAX_SECONDS,
        throttle_ms: int = LIVE_ANALYSIS_THROTTLE_MS,
        multipv: int = LIVE_ANALYSIS_MULTIPV,
    ) -> None:
        self.stockfish_path = stockfish_path or STOCKFISH_PATH
        self.max_seconds = max_seconds
        self.throttle_ms = throttle_ms
        self.multipv = max(1, multipv)

    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> Iterable[dict[str, Any]]:
        board = chess.Board(fen)
        engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
        last_emit = 0.0

        try:
            engine_version = _engine_version(engine)
            engine_settings = apply_engine_profile_options(
                engine,
                LIVE_ANALYSIS_PROFILE,
                requested_multipv=self.multipv,
                limit_mode=LIVE_ANALYSIS_LIMIT_MODE,
                syzygy_path=optional_syzygy_path(),
            )
            started_at = time.monotonic()
            limit = (
                chess.engine.Limit()
                if self.max_seconds is None
                else chess.engine.Limit(time=self.max_seconds)
            )
            with engine.analysis(
                board,
                limit,
                multipv=self.multipv,
            ) as analysis:
                for info in analysis:
                    if stop_event.is_set():
                        analysis.stop()
                        break

                    raw_update = _raw_update_from_info(
                        board=board,
                        info=info,
                        engine_version=engine_version,
                        elapsed_ms=int((time.monotonic() - started_at) * 1000),
                        engine_settings=engine_settings,
                    )
                    if raw_update is None:
                        continue

                    now = time.monotonic()
                    if last_emit and (now - last_emit) * 1000 < self.throttle_ms:
                        continue

                    last_emit = now
                    yield raw_update
        finally:
            try:
                engine.quit()
            except Exception:
                pass


class FakeLiveAnalyzer:
    """Deterministic live analyzer used only when the backend fake engine is active."""

    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> Iterable[dict[str, Any]]:
        board = chess.Board(fen)
        legal_moves = list(board.legal_moves)
        best_move = legal_moves[0].uci() if legal_moves else None
        started_at = time.monotonic()
        while not stop_event.is_set():
            elapsed_ms = int((time.monotonic() - started_at) * 1000)
            yield {
                "engine_version": "FakeLive deterministic v1",
                "depth": 4,
                "nodes": 1234 + elapsed_ms,
                "nps": 5678,
                "time_ms": max(50, elapsed_ms),
                "elapsed_ms": elapsed_ms,
                "eval_cp": 42 if board.turn == chess.WHITE else -42,
                "mate_in": None,
                "best_move_uci": best_move,
                "pv": [best_move] if best_move else [],
            }
            stop_event.wait(0.25)


class LiveAnalysisService:
    def __init__(
        self,
        analyzer_factory: Any | None = None,
        max_queue_size: int = 100,
    ) -> None:
        self._analyzer_factory = analyzer_factory or StockfishLiveAnalyzer
        self._max_queue_size = max_queue_size
        self._sessions: dict[str, LiveAnalysisSession] = {}
        self._lock = threading.RLock()

    def start_session(
        self,
        fen: str,
        game_id: int | None = None,
        ply: int | None = None,
        context: str | None = None,
        review_moment_id: str | None = None,
    ) -> str:
        _validate_fen(fen)
        self._stop_running_sessions()
        session = LiveAnalysisSession(
            session_id=str(uuid.uuid4()),
            fen=fen,
            game_id=game_id,
            ply=ply,
            context=_normalize_context(context),
            review_moment_id=review_moment_id,
        )
        thread = threading.Thread(
            target=self._run_session,
            args=(session,),
            name=f"live-analysis-{session.session_id}",
            daemon=True,
        )
        session.thread = thread

        with self._lock:
            self._sessions[session.session_id] = session

        thread.start()
        return session.session_id

    def stop_session(self, session_id: str) -> dict[str, Any]:
        session = self._session_or_none(session_id)
        if session is None:
            return {"session_id": session_id, "status": "not_found"}

        self._stop_session_object(session)
        return {"session_id": session_id, "status": session.status}

    def stop_sessions_for_game(self, game_id: int) -> None:
        with self._lock:
            sessions = [
                session
                for session in self._sessions.values()
                if session.game_id == game_id and session.status == "running"
            ]

        for session in sessions:
            self._stop_session_object(session)

    def stop_all(self) -> None:
        with self._lock:
            sessions = list(self._sessions.values())

        for session in sessions:
            self._stop_session_object(session)

    def _stop_running_sessions(self) -> None:
        with self._lock:
            sessions = [
                session
                for session in self._sessions.values()
                if session.status == "running"
            ]

        for session in sessions:
            self._stop_session_object(session)

    def get_latest(self, session_id: str) -> dict[str, Any] | None:
        session = self._session_or_none(session_id)
        return session.latest_payload if session is not None else None

    def wait_for_latest(
        self,
        session_id: str,
        timeout_seconds: float = 0.35,
    ) -> dict[str, Any] | None:
        deadline = time.monotonic() + max(0.0, timeout_seconds)
        while time.monotonic() < deadline:
            latest = self.get_latest(session_id)
            if latest is not None:
                return latest
            time.sleep(0.025)
        return self.get_latest(session_id)

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        session = self._session_or_none(session_id)
        if session is None:
            return None

        return {
            "session_id": session.session_id,
            "game_id": session.game_id,
            "ply": session.ply,
            "context": session.context,
            "review_moment_id": session.review_moment_id,
            "fen": session.fen,
            "started_at": session.started_at,
            "status": session.status,
            "latest_payload": session.latest_payload,
            "error_message": session.error_message,
        }

    def stream_session(self, session_id: str) -> Iterable[str]:
        session = self._session_or_none(session_id)
        if session is None:
            yield _sse({"type": "analysis_stopped", "session_id": session_id})
            return

        while True:
            try:
                payload = session.updates.get(timeout=0.5)
            except queue.Empty:
                if session.status != "running":
                    yield _sse(
                        {
                            "type": "analysis_stopped",
                            "session_id": session.session_id,
                            "context": session.context,
                            "review_moment_id": session.review_moment_id,
                            "fen": session.fen,
                        }
                    )
                    return
                continue

            yield _sse(payload)
            if payload.get("type") in {"analysis_stopped", "analysis_error"}:
                return

    def _run_session(self, session: LiveAnalysisSession) -> None:
        try:
            analyzer = self._analyzer_factory()
            for raw_update in analyzer.stream(session.fen, session.stop_event):
                if session.stop_event.is_set():
                    break
                payload = _build_live_update(
                    session=session,
                    raw_update=raw_update,
                )
                session.latest_payload = payload
                self._enqueue(session, payload)

            if session.status == "running":
                self._mark_session_stopped(session)
        except Exception as exc:
            session.error_message = repr(exc)
            session.status = "error"
            self._enqueue(
                session,
                {
                    "type": "analysis_error",
                    "session_id": session.session_id,
                    "game_id": session.game_id,
                    "ply": session.ply,
                    "context": session.context,
                    "review_moment_id": session.review_moment_id,
                    "fen": session.fen,
                    "error_message": session.error_message,
                },
            )

    def _stop_session_object(self, session: LiveAnalysisSession) -> None:
        session.stop_event.set()
        if session.status == "running":
            self._mark_session_stopped(session)
        if session.thread is not None and session.thread is not threading.current_thread():
            session.thread.join(timeout=0.25)

    def _mark_session_stopped(self, session: LiveAnalysisSession) -> None:
        session.status = "stopped"
        self._enqueue(
            session,
            {
                "type": "analysis_stopped",
                "session_id": session.session_id,
                "game_id": session.game_id,
                "ply": session.ply,
                "context": session.context,
                "review_moment_id": session.review_moment_id,
                "fen": session.fen,
            },
        )

    def _enqueue(
        self,
        session: LiveAnalysisSession,
        payload: dict[str, Any],
    ) -> None:
        while session.updates.qsize() >= self._max_queue_size:
            try:
                session.updates.get_nowait()
            except queue.Empty:
                break
        session.updates.put(payload)

    def _session_or_none(self, session_id: str) -> LiveAnalysisSession | None:
        with self._lock:
            return self._sessions.get(session_id)


def _build_live_update(
    session: LiveAnalysisSession,
    raw_update: dict[str, Any],
) -> dict[str, Any]:
    eval_cp = _optional_int(raw_update.get("eval_cp"))
    mate_in = _optional_int(raw_update.get("mate_in"))
    display = to_json_safe(make_evaluation_display(eval_cp=eval_cp, mate_in=mate_in))
    engine_version = str(raw_update.get("engine_version") or "unknown")
    depth = _optional_int(raw_update.get("depth"))
    nodes = _optional_int(raw_update.get("nodes"))
    time_ms = _optional_int(raw_update.get("time_ms"))
    elapsed_ms = _optional_int(raw_update.get("elapsed_ms")) or time_ms
    engine_settings = raw_update.get("engine_settings")
    if not isinstance(engine_settings, dict):
        profile = engine_profile_for_name(LIVE_ANALYSIS_PROFILE)
        engine_settings = {
            "analysis_profile": profile.analysis_profile,
            "analysis_limit_mode": LIVE_ANALYSIS_LIMIT_MODE,
            "threads": profile.threads,
            "hash_mb": profile.hash_mb,
            "multipv": LIVE_ANALYSIS_MULTIPV,
            "uci_analyse_mode": profile.uci_analyse_mode,
            "uci_limit_strength": profile.uci_limit_strength,
            "skill_level": None,
            "syzygy_path_active": False,
        }
    analysis_profile = str(
        engine_settings.get("analysis_profile") or LIVE_ANALYSIS_PROFILE
    )
    analysis_limit_mode = str(
        engine_settings.get("analysis_limit_mode") or LIVE_ANALYSIS_LIMIT_MODE
    )

    return {
        "type": "analysis_update",
        "session_id": session.session_id,
        "live_session_id": session.session_id,
        "game_id": session.game_id,
        "ply": session.ply,
        "context": session.context,
        "review_moment_id": session.review_moment_id,
        "fen": session.fen,
        "fen_key": session.fen,
        "engine_version": engine_version,
        "analysis_kind": "live",
        "analysis_profile": analysis_profile,
        "analysis_limit_mode": analysis_limit_mode,
        "depth": depth,
        "seldepth": _optional_int(raw_update.get("seldepth")),
        "nodes": nodes,
        "nps": _optional_int(raw_update.get("nps")),
        "time_ms": time_ms,
        "elapsed_ms": elapsed_ms,
        "threads": engine_settings.get("threads"),
        "hash_mb": engine_settings.get("hash_mb"),
        "multipv": engine_settings.get("multipv") or LIVE_ANALYSIS_MULTIPV,
        "uci_analyse_mode": engine_settings.get("uci_analyse_mode"),
        "uci_limit_strength": engine_settings.get("uci_limit_strength"),
        "skill_level": engine_settings.get("skill_level"),
        "syzygy_path_active": engine_settings.get("syzygy_path_active"),
        "eval_cp": eval_cp,
        "eval_pov_side_to_move_cp": _eval_for_side_to_move(
            eval_cp,
            chess.Board(session.fen).turn,
        ),
        "mate_in": mate_in,
        "best_move_uci": raw_update.get("best_move_uci"),
        "pv": [str(move) for move in raw_update.get("pv", [])],
        "evaluation_display": {
            "white_percent": display["white_percent"],
            "black_percent": display["black_percent"],
            "label": display["label"],
            "is_mate": display["is_mate"],
        },
        "evaluation_source": {
            "kind": "live",
            "analysis_profile": analysis_profile,
            "analysis_limit_mode": analysis_limit_mode,
            "depth": depth,
            "time_ms": time_ms,
            "elapsed_ms": elapsed_ms,
            "nodes": nodes,
            "nps": _optional_int(raw_update.get("nps")),
            "threads": engine_settings.get("threads"),
            "hash_mb": engine_settings.get("hash_mb"),
            "multipv": engine_settings.get("multipv") or LIVE_ANALYSIS_MULTIPV,
            "engine_version": engine_version,
        },
        "schema_version": LIVE_UPDATE_SCHEMA_VERSION,
    }


def _raw_update_from_info(
    board: chess.Board,
    info: chess.engine.InfoDict,
    engine_version: str,
    elapsed_ms: int,
    engine_settings: dict[str, Any],
) -> dict[str, Any] | None:
    if "score" not in info and "pv" not in info:
        return None

    score = info.get("score")
    eval_cp, mate_in = _score_from_white_pov(score)
    pv_moves = info.get("pv", [])
    best_move = pv_moves[0] if pv_moves else None
    time_seconds = info.get("time")

    return {
        "engine_version": engine_version,
        "analysis_profile": LIVE_ANALYSIS_PROFILE,
        "analysis_limit_mode": LIVE_ANALYSIS_LIMIT_MODE,
        "engine_settings": engine_settings,
        "elapsed_ms": elapsed_ms,
        "depth": _optional_int(info.get("depth")),
        "seldepth": _optional_int(info.get("seldepth")),
        "nodes": _optional_int(info.get("nodes")),
        "nps": _optional_int(info.get("nps")),
        "time_ms": int(time_seconds * 1000) if time_seconds is not None else None,
        "eval_cp": eval_cp,
        "mate_in": mate_in,
        "best_move_uci": best_move.uci() if best_move is not None else None,
        "pv": [move.uci() for move in pv_moves],
        "side_to_move": "white" if board.turn == chess.WHITE else "black",
    }


def _score_from_white_pov(
    score: chess.engine.PovScore | None,
) -> tuple[int | None, int | None]:
    if score is None:
        return None, None

    white_score = score.pov(chess.WHITE)
    return white_score.score(mate_score=None), white_score.mate()


def _engine_version(engine: chess.engine.SimpleEngine) -> str:
    engine_id = getattr(engine, "id", {}) or {}
    name = engine_id.get("name") if isinstance(engine_id, dict) else None
    return str(name) if name else "unknown"


def _eval_for_side_to_move(
    eval_cp: int | None,
    side_to_move: chess.Color,
) -> int | None:
    if eval_cp is None:
        return None
    return eval_cp if side_to_move == chess.WHITE else -eval_cp


def _validate_fen(fen: str) -> None:
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError("invalid_fen")


def _normalize_context(context: str | None) -> str:
    if context in {"live", "historical", "review", "final", "initial"}:
        return context
    return "live"


def _optional_int(value: Any) -> int | None:
    return int(value) if value is not None else None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False, sort_keys=True)}\n\n"


def _default_analyzer_factory() -> Any:
    if os.environ.get("NEUROCHESS_LIVE_ENGINE_MODE") == "fake":
        return FakeLiveAnalyzer
    if os.environ.get("NEUROCHESS_ENGINE_MODE") == "fake":
        return FakeLiveAnalyzer
    return StockfishLiveAnalyzer


_default_live_analysis_service = LiveAnalysisService(
    analyzer_factory=_default_analyzer_factory(),
)


def get_default_live_analysis_service() -> LiveAnalysisService:
    return _default_live_analysis_service
