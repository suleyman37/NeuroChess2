from __future__ import annotations

import threading
import time
from typing import Any

import chess
import chess.engine

from neurochess.core.stabilized_eval import (
    REVIEW_STABILIZED_EVAL_SOURCE_KIND,
    build_stabilized_eval_from_final_analysis,
    build_stabilized_eval_from_samples,
)
from neurochess.engines.engine_config import (
    DEFAULT_ANALYSIS_DEPTH,
    DEFAULT_MULTIPV,
    STOCKFISH_PATH,
)
from neurochess.engines.engine_profiles import (
    apply_engine_profile_options,
    optional_syzygy_path,
)


ENGINE_ANALYSIS_SCHEMA_VERSION = "engine_analysis_v1"


class StockfishServiceError(RuntimeError):
    """Raised when Stockfish cannot be started, queried, or closed cleanly."""


class StockfishService:
    def __init__(self, stockfish_path: str | None = None) -> None:
        self.stockfish_path = stockfish_path or STOCKFISH_PATH
        self._engine: chess.engine.SimpleEngine | None = None
        self._lock = threading.Lock()

    def start(self) -> None:
        if self._engine is not None:
            return

        try:
            self._engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
        except FileNotFoundError as exc:
            raise StockfishServiceError(
                f"Stockfish executable not found: {self.stockfish_path}"
            ) from exc
        except PermissionError as exc:
            raise StockfishServiceError(
                f"Stockfish executable is not accessible: {self.stockfish_path}"
            ) from exc
        except Exception as exc:
            raise StockfishServiceError(
                f"Unable to start Stockfish at {self.stockfish_path}: {exc}"
            ) from exc

    def close(self) -> None:
        if self._engine is None:
            return

        engine = self._engine
        self._engine = None

        try:
            engine.quit()
        except Exception as exc:
            raise StockfishServiceError(
                f"Unable to close Stockfish cleanly: {exc}"
            ) from exc

    def terminate(self) -> None:
        """Best-effort hard stop used by watchdog timeouts."""
        if self._engine is None:
            return

        engine = self._engine
        self._engine = None
        try:
            engine.close()
        except Exception:
            try:
                engine.quit()
            except Exception:
                pass

    def analyze_fen(
        self,
        fen: str,
        depth: int = DEFAULT_ANALYSIS_DEPTH,
        multipv: int = DEFAULT_MULTIPV,
        time_budget_ms: int | None = None,
        analysis_limit_mode: str = "mixed",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        board = self._board_from_fen(fen)
        self.start()

        if self._engine is None:
            raise StockfishServiceError("Stockfish engine is not started")

        requested_multipv = self._effective_multipv(board, multipv)
        started_at = time.monotonic()
        engine_settings: dict[str, Any] = {}

        try:
            with self._lock:
                engine_settings = apply_engine_profile_options(
                    self._engine,
                    analysis_profile or "shallow",
                    requested_multipv=requested_multipv,
                    limit_mode=analysis_limit_mode,
                    syzygy_path=optional_syzygy_path(),
                )
                if analysis_limit_mode == "time":
                    limit = chess.engine.Limit(
                        time=(
                            time_budget_ms / 1000.0
                            if time_budget_ms is not None
                            else None
                        ),
                    )
                elif analysis_limit_mode == "depth":
                    limit = chess.engine.Limit(depth=depth)
                else:
                    limit = chess.engine.Limit(
                        depth=depth,
                        time=(
                            time_budget_ms / 1000.0
                            if time_budget_ms is not None
                            else None
                        ),
                    )
                raw_analysis = self._engine.analyse(
                    board,
                    limit,
                    multipv=requested_multipv,
                )
        except Exception as exc:
            raise StockfishServiceError(f"Stockfish analysis failed: {exc}") from exc

        analysis_lines = (
            raw_analysis if isinstance(raw_analysis, list) else [raw_analysis]
        )
        best_info = analysis_lines[0] if analysis_lines else {}
        top_moves = [
            self._build_top_move(board, info, rank)
            for rank, info in enumerate(analysis_lines, start=1)
        ]

        eval_cp = top_moves[0]["eval_cp"] if top_moves else None
        mate_in = top_moves[0]["mate_in"] if top_moves else None
        actual_time_ms = int((time.monotonic() - started_at) * 1000)
        info_time = best_info.get("time") if isinstance(best_info, dict) else None
        if info_time is not None:
            actual_time_ms = int(float(info_time) * 1000)
        achieved_depth = self._optional_int(best_info.get("depth")) if best_info else None

        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": self._engine_version(),
            "depth": achieved_depth or depth,
            "achieved_depth": achieved_depth,
            "nodes": self._optional_int(best_info.get("nodes")) if best_info else None,
            "nps": self._optional_int(best_info.get("nps")) if best_info else None,
            "actual_time_ms": actual_time_ms,
            "multipv": requested_multipv,
            "analysis_limit_mode": analysis_limit_mode,
            "requested_time_ms": time_budget_ms,
            "requested_depth": depth if analysis_limit_mode != "time" else None,
            "requested_multipv": requested_multipv,
            "engine_settings": engine_settings,
            "side_to_move": "white" if board.turn == chess.WHITE else "black",
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "top_moves": top_moves,
            "schema_version": ENGINE_ANALYSIS_SCHEMA_VERSION,
        }

    def analyze_stabilized_fen(
        self,
        fen: str,
        time_budget_sec: float,
        min_depth: int | None = None,
        multipv: int = DEFAULT_MULTIPV,
        limit_mode: str = "mixed",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        board = self._board_from_fen(fen)
        self.start()

        if self._engine is None:
            raise StockfishServiceError("Stockfish engine is not started")

        requested_multipv = self._effective_multipv(board, multipv)
        depth = min_depth or DEFAULT_ANALYSIS_DEPTH
        engine_settings: dict[str, Any] = {}

        try:
            samples: list[dict[str, Any]] = []
            final_info: chess.engine.InfoDict | None = None
            latest_by_multipv: dict[int, chess.engine.InfoDict] = {}
            started_at = time.monotonic()
            with self._lock:
                engine_settings = apply_engine_profile_options(
                    self._engine,
                    analysis_profile or "standard",
                    requested_multipv=requested_multipv,
                    limit_mode=limit_mode,
                    syzygy_path=optional_syzygy_path(),
                )
                if limit_mode == "time":
                    limit = chess.engine.Limit(time=time_budget_sec)
                elif limit_mode == "depth":
                    limit = chess.engine.Limit(depth=depth)
                else:
                    limit = chess.engine.Limit(depth=depth, time=time_budget_sec)
                with self._engine.analysis(
                    board,
                    limit,
                    multipv=requested_multipv,
                ) as analysis:
                    for info in analysis:
                        multipv_index = self._optional_int(info.get("multipv")) or 1
                        latest_by_multipv[multipv_index] = info
                        if multipv_index == 1 or final_info is None:
                            final_info = info
                        if multipv_index == 1:
                            sample = self._stabilized_sample_from_info(
                                board,
                                info,
                                elapsed_ms=int((time.monotonic() - started_at) * 1000),
                            )
                            if sample is not None:
                                samples.append(sample)
        except Exception:
            raw_analysis = self.analyze_fen(
                fen=fen,
                depth=depth,
                multipv=requested_multipv,
                time_budget_ms=int(time_budget_sec * 1000),
                analysis_limit_mode=limit_mode,
                analysis_profile=analysis_profile,
            )
            stabilized = build_stabilized_eval_from_final_analysis(
                fen=fen,
                raw_analysis=raw_analysis,
                analysis_time_ms=int(time_budget_sec * 1000),
            )
            raw_analysis["stabilized_eval"] = stabilized.to_dict()
            raw_analysis["eval_source_kind"] = REVIEW_STABILIZED_EVAL_SOURCE_KIND
            return raw_analysis

        if final_info is None:
            raise StockfishServiceError("Stockfish did not return analysis info")

        best_info = latest_by_multipv.get(1) or final_info
        top_moves = [
            self._build_top_move(board, info, rank)
            for rank, info in sorted(latest_by_multipv.items())
        ]
        if not top_moves and best_info is not None:
            top_moves = [self._build_top_move(board, best_info, 1)]
        top_move = top_moves[0]
        eval_cp = top_move["eval_cp"]
        mate_in = top_move["mate_in"]
        actual_time_ms = int((time.monotonic() - started_at) * 1000)
        stabilized = build_stabilized_eval_from_samples(
            fen=fen,
            samples=samples,
            engine_version=self._engine_version(),
            time_budget_ms=int(time_budget_sec * 1000),
        )
        achieved_depth = self._optional_int(best_info.get("depth")) if best_info else None

        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": self._engine_version(),
            "depth": achieved_depth or depth,
            "achieved_depth": achieved_depth,
            "nodes": self._optional_int(best_info.get("nodes")) if best_info else None,
            "nps": self._optional_int(best_info.get("nps")) if best_info else None,
            "actual_time_ms": actual_time_ms,
            "multipv": requested_multipv,
            "analysis_limit_mode": limit_mode,
            "requested_time_ms": int(time_budget_sec * 1000),
            "requested_depth": depth if limit_mode != "time" else None,
            "requested_multipv": requested_multipv,
            "engine_settings": engine_settings,
            "side_to_move": "white" if board.turn == chess.WHITE else "black",
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "top_moves": top_moves,
            "schema_version": ENGINE_ANALYSIS_SCHEMA_VERSION,
            "stabilized_eval": stabilized.to_dict(),
            "eval_source_kind": REVIEW_STABILIZED_EVAL_SOURCE_KIND,
        }

    def evaluate_calibration(
        self,
        fen: str,
        depth: int = 22,
        time_limit: float = 30.0,
        nodes: int | None = None,
        multipv: int = 1,
    ) -> dict[str, Any]:
        board = self._board_from_fen(fen)
        self.start()

        if self._engine is None:
            raise StockfishServiceError("Stockfish engine is not started")

        requested_multipv = self._effective_multipv(board, multipv)

        try:
            with self._lock:
                configured_values = self._configure_calibration_options()
                options_reported = self._engine_options_report(
                    configured_values=configured_values,
                    requested_multipv=requested_multipv,
                )
                raw_analysis = self._engine.analyse(
                    board,
                    chess.engine.Limit(
                        depth=depth,
                        time=time_limit,
                        nodes=nodes,
                    ),
                    multipv=requested_multipv,
                )
        except Exception as exc:
            raise StockfishServiceError(
                f"Stockfish calibration analysis failed: {exc}"
            ) from exc

        analysis_lines = (
            raw_analysis if isinstance(raw_analysis, list) else [raw_analysis]
        )
        best_info = analysis_lines[0] if analysis_lines else {}

        return {
            "fen": fen,
            "engine_version": self._engine_version(),
            "engine_options_reported": options_reported,
            "limit_used": {
                "depth": depth,
                "time": time_limit,
                "nodes": nodes,
                "multipv": requested_multipv,
            },
            "result": self._build_calibration_result(board, best_info),
            "side_to_move": "white" if board.turn == chess.WHITE else "black",
        }

    def best_move(
        self,
        fen: str,
        depth: int = DEFAULT_ANALYSIS_DEPTH,
    ) -> str:
        analysis = self.analyze_fen(fen, depth=depth, multipv=1)
        top_moves = analysis["top_moves"]

        if not top_moves or top_moves[0]["uci"] is None:
            raise StockfishServiceError("Stockfish did not return a legal best move")

        return top_moves[0]["uci"]

    def _board_from_fen(self, fen: str) -> chess.Board:
        try:
            board = chess.Board(fen)
        except ValueError as exc:
            raise StockfishServiceError(f"Invalid FEN: {fen}") from exc
        if not board.is_valid():
            raise StockfishServiceError(f"Invalid FEN: {fen}")
        return board

    def _build_top_move(
        self,
        board: chess.Board,
        info: chess.engine.InfoDict,
        rank: int,
    ) -> dict[str, Any]:
        score = info.get("score")
        eval_cp, mate_in = self._score_from_white_pov(score)
        pv_moves = info.get("pv", [])
        first_move = pv_moves[0] if pv_moves else None

        return {
            "rank": rank,
            "uci": first_move.uci() if first_move is not None else None,
            "san": board.san(first_move) if first_move is not None else None,
            "eval_cp": eval_cp,
            "eval_pov_side_to_move_cp": self._normalize_cp_for_side_to_move(
                eval_cp,
                board.turn,
            ),
            "mate_in": mate_in,
            "pv": [move.uci() for move in pv_moves],
        }

    def _effective_multipv(self, board: chess.Board, requested_multipv: int) -> int:
        legal_moves_count = board.legal_moves.count()
        if legal_moves_count <= 0:
            return 1
        return max(1, min(int(requested_multipv), legal_moves_count))

    def _stabilized_sample_from_info(
        self,
        board: chess.Board,
        info: chess.engine.InfoDict,
        elapsed_ms: int,
    ) -> dict[str, Any] | None:
        score = info.get("score")
        if score is None:
            return None
        eval_cp, mate_in = self._score_from_white_pov(score)
        pv_moves = info.get("pv", [])
        time_seconds = info.get("time")
        return {
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "depth": self._optional_int(info.get("depth")),
            "seldepth": self._optional_int(info.get("seldepth")),
            "nodes": self._optional_int(info.get("nodes")),
            "time_ms": int(time_seconds * 1000)
            if time_seconds is not None
            else elapsed_ms,
            "pv": [move.uci() for move in pv_moves],
        }

    def _engine_version(self) -> str:
        if self._engine is None:
            return "unknown"

        engine_id = getattr(self._engine, "id", {}) or {}
        name = engine_id.get("name") if isinstance(engine_id, dict) else None
        return str(name) if name else "unknown"

    def _engine_options_report(
        self,
        configured_values: dict[str, Any],
        requested_multipv: int,
    ) -> dict[str, dict[str, Any]]:
        if self._engine is None:
            return {}

        report: dict[str, dict[str, Any]] = {}
        for name in (
            "Threads",
            "Hash",
            "MultiPV",
            "UCI_NNUE",
            "EvalFile",
            "EvalFileSmall",
        ):
            option = self._engine.options.get(name)
            configured_value = configured_values.get(name)

            if option is None:
                report[name] = {
                    "exposed": False,
                    "configured_value": configured_value,
                    "status": "not_exposed",
                }
                continue

            payload = {
                "exposed": True,
                "default": option.default,
                "configured_value": configured_value,
            }
            if option.min is not None:
                payload["min"] = option.min
            if option.max is not None:
                payload["max"] = option.max
            if name in {"EvalFile", "EvalFileSmall"}:
                payload["value"] = option.default
            if name == "MultiPV" and configured_value is None:
                payload["configured_value"] = requested_multipv
            report[name] = payload

        return report

    def _configure_calibration_options(self) -> dict[str, Any]:
        if self._engine is None or "UCI_NNUE" not in self._engine.options:
            return {}

        try:
            self._engine.configure({"UCI_NNUE": True})
            return {"UCI_NNUE": True}
        except Exception:
            return {"UCI_NNUE": None}

    def _build_calibration_result(
        self,
        board: chess.Board,
        info: chess.engine.InfoDict,
    ) -> dict[str, Any]:
        score = info.get("score")
        eval_cp, mate_in = self._score_from_white_pov(score)
        pv_moves = info.get("pv", [])
        best_move = pv_moves[0] if pv_moves else None
        time_seconds = info.get("time")
        time_ms = int(time_seconds * 1000) if time_seconds is not None else None

        return {
            "depth_reached": self._optional_int(info.get("depth")),
            "seldepth": self._optional_int(info.get("seldepth")),
            "nodes": self._optional_int(info.get("nodes")),
            "nps": self._optional_int(info.get("nps")),
            "time_ms": time_ms,
            "hashfull_permil": self._optional_int(info.get("hashfull")),
            "eval_cp": eval_cp,
            "eval_pov_side_to_move_cp": self._normalize_cp_for_side_to_move(
                eval_cp,
                board.turn,
            ),
            "mate_in": mate_in,
            "best_move_uci": best_move.uci() if best_move is not None else None,
            "pv": [move.uci() for move in pv_moves],
        }

    def _score_from_white_pov(
        self,
        score: chess.engine.PovScore | None,
    ) -> tuple[int | None, int | None]:
        if score is None:
            return None, None

        white_score = score.pov(chess.WHITE)
        return white_score.score(mate_score=None), white_score.mate()

    def _normalize_cp_for_side_to_move(
        self,
        eval_cp: int | None,
        side_to_move: chess.Color,
    ) -> int | None:
        if eval_cp is None:
            return None

        return eval_cp if side_to_move == chess.WHITE else -eval_cp

    def _optional_int(self, value: Any) -> int | None:
        return int(value) if value is not None else None
