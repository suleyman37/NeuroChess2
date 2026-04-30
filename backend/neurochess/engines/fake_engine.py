from __future__ import annotations

import hashlib
import os
import threading
import time
from typing import Any

import chess

from neurochess.core.stabilized_eval import (
    REVIEW_STABILIZED_EVAL_SOURCE_KIND,
    build_stabilized_eval_from_final_analysis,
)
from neurochess.engines.engine_profiles import engine_profile_for_name


FAKE_ENGINE_VERSION = "FakeFish deterministic v5.3.A4g"


class FakeStockfishService:
    """Deterministic test engine for Review job regression and smoke tests."""

    _lock = threading.Lock()
    _global_call_index = 0
    _failed_once_keys: set[str] = set()

    def __init__(self) -> None:
        self.closed = False
        hard_timeout = _optional_int(os.environ.get("FAKE_ENGINE_HARD_TIMEOUT_MS"))
        self.analysis_hard_timeout_ms = hard_timeout if hard_timeout is not None else None

    @classmethod
    def reset_state(cls) -> None:
        with cls._lock:
            cls._global_call_index = 0
            cls._failed_once_keys = set()

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
        analysis_limit_mode: str = "mixed",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        board = chess.Board(fen)
        fen_key = _fen_key(fen)
        call_index = self._next_call_index()
        self._maybe_delay_or_fail(call_index, fen_key)

        top_moves = _top_moves(board, multipv, fen)
        eval_cp = top_moves[0]["eval_cp"] if top_moves else _deterministic_eval_cp(fen)
        achieved_depth = _deterministic_depth(fen, depth)
        nodes = max(1, achieved_depth * 12_345 + (int(fen_key[:4], 16) % 10_000))
        elapsed_ms = max(1, _optional_int(os.environ.get("FAKE_ENGINE_DELAY_MS")) or 300)
        nps = int(nodes / max(elapsed_ms / 1000.0, 0.001))
        profile = engine_profile_for_name(analysis_profile or "standard")
        actual_multipv = len(top_moves)
        settings = {
            "engine_profile": profile.name,
            "analysis_profile": profile.analysis_profile,
            "analysis_limit_mode": analysis_limit_mode,
            "limit_mode": analysis_limit_mode,
            "threads": profile.threads,
            "hash_mb": profile.hash_mb,
            "multipv": actual_multipv,
            "uci_analyse_mode": profile.uci_analyse_mode,
            "uci_limit_strength": profile.uci_limit_strength,
            "skill_level": 20,
            "syzygy_path_active": False,
            "fake_engine": True,
            "fake_call_index": call_index,
        }
        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": FAKE_ENGINE_VERSION,
            "depth": achieved_depth,
            "achieved_depth": achieved_depth,
            "nodes": nodes,
            "nps": nps,
            "actual_time_ms": elapsed_ms,
            "multipv": multipv,
            "actual_multipv": actual_multipv,
            "analysis_kind": "deep",
            "analysis_profile": analysis_profile,
            "requested_time_ms": time_budget_ms,
            "analysis_limit_mode": analysis_limit_mode,
            "limit_mode": analysis_limit_mode,
            "requested_depth": None if analysis_limit_mode == "time" else depth,
            "requested_multipv": multipv,
            "engine_settings": settings,
            "settings_json": settings,
            "eval_cp": eval_cp,
            "mate_in": None,
            "top_moves": top_moves,
        }

    def analyze_stabilized_fen(
        self,
        fen: str,
        time_budget_sec: float,
        min_depth: int | None = None,
        multipv: int = 3,
        limit_mode: str = "time",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        time_budget_ms = int(time_budget_sec * 1000)
        raw = self.analyze_fen(
            fen=fen,
            depth=min_depth or 18,
            multipv=multipv,
            time_budget_ms=time_budget_ms,
            analysis_limit_mode=limit_mode,
            analysis_profile=analysis_profile,
        )
        stabilized = build_stabilized_eval_from_final_analysis(
            fen=fen,
            raw_analysis=raw,
            analysis_time_ms=time_budget_ms,
        )
        raw["stabilized_eval"] = stabilized.to_dict()
        raw["eval_source_kind"] = REVIEW_STABILIZED_EVAL_SOURCE_KIND
        return raw

    def close(self) -> None:
        self.closed = True

    def terminate(self) -> None:
        self.closed = True

    @classmethod
    def _next_call_index(cls) -> int:
        with cls._lock:
            cls._global_call_index += 1
            return cls._global_call_index

    def _maybe_delay_or_fail(self, call_index: int, fen_key: str) -> None:
        hang_on_index = _optional_int(os.environ.get("FAKE_ENGINE_HANG_ON_INDEX"))
        hang_on_key = os.environ.get("FAKE_ENGINE_HANG_ON_FEN_KEY")
        should_hang = (
            (hang_on_index is not None and call_index == hang_on_index)
            or (hang_on_key is not None and hang_on_key == fen_key)
        )
        if should_hang:
            timeout_ms = self.analysis_hard_timeout_ms or 60_000
            time.sleep((timeout_ms + 250) / 1000.0)
            return

        fail_on_index = _optional_int(os.environ.get("FAKE_ENGINE_FAIL_ON_INDEX"))
        fail_on_key = os.environ.get("FAKE_ENGINE_FAIL_ON_FEN_KEY")
        should_fail = (
            (fail_on_index is not None and call_index == fail_on_index)
            or (fail_on_key is not None and fail_on_key == fen_key)
        )
        if should_fail:
            fail_token = f"{call_index}:{fen_key}"
            fail_once = _truthy(os.environ.get("FAKE_ENGINE_FAIL_ONCE"))
            with self._lock:
                already_failed = fail_token in self._failed_once_keys
                if fail_once and not already_failed:
                    self._failed_once_keys.add(fail_token)
            if not fail_once or not already_failed:
                raise RuntimeError("fake_engine_forced_failure")

        delay_ms = _optional_int(os.environ.get("FAKE_ENGINE_DELAY_MS"))
        time.sleep(max(0, delay_ms if delay_ms is not None else 300) / 1000.0)


def _top_moves(board: chess.Board, requested_multipv: int, fen: str) -> list[dict[str, Any]]:
    moves = list(board.legal_moves)[: max(0, int(requested_multipv))]
    base_eval = _deterministic_eval_cp(fen)
    top_moves: list[dict[str, Any]] = []
    for rank, move in enumerate(moves, start=1):
        eval_cp = base_eval - (rank - 1) * 12
        top_moves.append(
            {
                "rank": rank,
                "uci": move.uci(),
                "eval_cp": eval_cp,
                "eval_pov_side_to_move_cp": eval_cp if board.turn == chess.WHITE else -eval_cp,
                "mate_in": None,
                "pv": [move.uci()],
            }
        )
    return top_moves


def _deterministic_eval_cp(fen: str) -> int:
    digest = hashlib.sha256(fen.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 401 - 200


def _deterministic_depth(fen: str, requested_depth: int) -> int:
    digest = hashlib.sha256(("depth:" + fen).encode("utf-8")).hexdigest()
    return max(int(requested_depth or 0), 14 + int(digest[:2], 16) % 9)


def _fen_key(fen: str) -> str:
    return hashlib.sha256(fen.encode("utf-8")).hexdigest()[:16]


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
