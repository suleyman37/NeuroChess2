from __future__ import annotations

import json
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.analysis_service import (
    ENGINE_ANALYSIS_SCHEMA_VERSION,
    TIME_BUDGET_MS_DEEP,
    InvalidFenError,
    AnalysisService,
)
from neurochess.core.stabilized_eval import (
    REVIEW_STABILIZED_EVAL_SOURCE_KIND,
    build_stabilized_eval_from_samples,
    compute_review_time_budget,
)
from neurochess.data.database import init_db
from neurochess.engines.fake_engine import FakeStockfishService


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
BLACK_TO_MOVE_WHITE_ADVANTAGE_FEN = (
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
)
INVALID_C_FEN = "7r/8/4k1Rp/8/2c2P2/4B3/PPP3PP/2K2BNR b - - 1 18"
SEMANTICALLY_INVALID_FEN = "8/8/8/8/8/8/4k3/4K3 w - - 0 1"


class FakeEngine:
    def __init__(
        self,
        eval_cp: int = 35,
        mate_in: int | None = None,
        uci: str = "e2e4",
        pv: list[str] | None = None,
        engine_version: str | None = "FakeFish 1",
    ) -> None:
        self.eval_cp = eval_cp
        self.mate_in = mate_in
        self.uci = uci
        self.pv = pv if pv is not None else [uci]
        self.engine_version = engine_version
        self.calls: list[dict[str, Any]] = []

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "fen": fen,
                "depth": depth,
                "multipv": multipv,
                "time_budget_ms": time_budget_ms,
            }
        )
        payload = {
            "fen": fen,
            "engine": "stockfish",
            "depth": depth,
            "multipv": multipv,
            "eval_cp": self.eval_cp,
            "mate_in": self.mate_in,
            "top_moves": [
                {
                    "rank": 1,
                    "uci": self.uci,
                    "san": "ignored",
                    "eval_cp": self.eval_cp,
                    "eval_pov_side_to_move_cp": 999,
                    "mate_in": self.mate_in,
                    "pv": self.pv,
                }
            ],
        }
        if self.engine_version is not None:
            payload["engine_version"] = self.engine_version
        return payload


class TimeoutEngine:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "fen": fen,
                "depth": depth,
                "multipv": multipv,
                "time_budget_ms": time_budget_ms,
            }
        )
        raise TimeoutError("deterministic timeout")


class HangingEngine:
    analysis_hard_timeout_ms = 25

    def __init__(self) -> None:
        self.closed = False

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
        analysis_limit_mode: str = "mixed",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        time.sleep(0.2)
        return {
            "fen": fen,
            "engine": "stockfish",
            "depth": depth,
            "multipv": multipv,
            "eval_cp": 0,
            "mate_in": None,
            "top_moves": [],
        }

    def close(self) -> None:
        self.closed = True


class ExplodingEngine:
    def analyze_fen(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise AssertionError("terminal positions must not call Stockfish")

    def analyze_stabilized_fen(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise AssertionError("terminal positions must not call Stockfish")


class SettingsFakeEngine(FakeEngine):
    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
        analysis_limit_mode: str = "mixed",
        analysis_profile: str | None = None,
    ) -> dict[str, Any]:
        payload = super().analyze_fen(
            fen=fen,
            depth=depth,
            multipv=multipv,
            time_budget_ms=time_budget_ms,
        )
        payload.update(
            {
                "analysis_profile": analysis_profile,
                "analysis_limit_mode": analysis_limit_mode,
                "requested_time_ms": time_budget_ms,
                "requested_depth": None if analysis_limit_mode == "time" else depth,
                "requested_multipv": multipv,
                "achieved_depth": 17,
                "nodes": 123456,
                "nps": 98765,
                "engine_settings": {
                    "analysis_profile": analysis_profile,
                    "analysis_limit_mode": analysis_limit_mode,
                    "threads": 6,
                    "hash_mb": 1024,
                    "multipv": multipv,
                    "uci_analyse_mode": True,
                    "uci_limit_strength": False,
                    "skill_level": 20,
                    "syzygy_path_active": False,
                },
            }
        )
        return payload


class StabilizedFakeEngine:
    def __init__(self, samples: list[dict[str, Any]]) -> None:
        self.samples = samples
        self.calls: list[dict[str, Any]] = []

    def analyze_stabilized_fen(
        self,
        fen: str,
        time_budget_sec: float,
        min_depth: int | None = None,
        multipv: int = 3,
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "fen": fen,
                "time_budget_sec": time_budget_sec,
                "min_depth": min_depth,
                "multipv": multipv,
            }
        )
        stabilized = build_stabilized_eval_from_samples(
            fen=fen,
            samples=self.samples,
            engine_version="StableFake 1",
            time_budget_ms=int(time_budget_sec * 1000),
        )
        final_eval = stabilized.final_eval_cp
        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": "StableFake 1",
            "depth": min_depth,
            "multipv": multipv,
            "eval_cp": 0,
            "mate_in": None,
            "top_moves": [
                {
                    "rank": 1,
                    "uci": "e2e4",
                    "eval_cp": final_eval,
                    "eval_pov_side_to_move_cp": final_eval,
                    "mate_in": stabilized.final_mate_in,
                    "pv": ["e2e4"],
                }
            ],
            "stabilized_eval": stabilized.to_dict(),
            "eval_source_kind": REVIEW_STABILIZED_EVAL_SOURCE_KIND,
        }


class AnalysisServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-analysis-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        self.log_path = self.temp_dir / "analysis.log"
        init_db(self.db_path)
        self.service = AnalysisService(self.db_path, log_path=self.log_path)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_white_advantage_white_to_move_has_positive_side_to_move_eval(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(eval_cp=120, uci="e2e4"),
        )

        top_move = analysis["analysis_json"]["top_moves"][0]
        self.assertGreater(top_move["eval_cp"], 0)
        self.assertGreater(top_move["eval_pov_side_to_move_cp"], 0)

    def test_white_advantage_black_to_move_has_negative_side_to_move_eval(self) -> None:
        analysis = self._run_fake(
            BLACK_TO_MOVE_WHITE_ADVANTAGE_FEN,
            FakeEngine(eval_cp=120, uci="e7e5"),
        )

        top_move = analysis["analysis_json"]["top_moves"][0]
        self.assertGreater(top_move["eval_cp"], 0)
        self.assertLess(top_move["eval_pov_side_to_move_cp"], 0)

    def test_symmetric_position_eval_is_close_to_zero(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(eval_cp=0, uci="e2e4"),
        )

        self.assertAlmostEqual(analysis["analysis_json"]["eval_cp"], 0, delta=10)

    def test_mate_for_white_is_positive(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(eval_cp=900, mate_in=2, uci="e2e4"),
        )

        self.assertGreater(analysis["analysis_json"]["mate_in"], 0)

    def test_mate_for_black_is_negative(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(eval_cp=-900, mate_in=-3, uci="e2e4"),
        )

        self.assertLess(analysis["analysis_json"]["mate_in"], 0)

    def test_analysis_json_is_canonical_and_uci_only(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(eval_cp=35, uci="e2e4", pv=["e2e4", "e7e5", "g1f3"]),
        )
        payload = analysis["analysis_json"]

        self.assertEqual(payload["schema_version"], ENGINE_ANALYSIS_SCHEMA_VERSION)
        self.assertEqual(payload["analysis_kind"], "deep")
        self.assertIn("top_moves", payload)
        self.assertEqual(payload["top_moves"][0]["pv"], ["e2e4", "e7e5", "g1f3"])
        self.assertNotIn("san", payload["top_moves"][0])

    def test_run_analysis_uses_engine_version_returned_by_engine(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(engine_version="FakeFish 1"),
        )

        self.assertEqual(analysis["analysis_json"]["engine_version"], "FakeFish 1")
        self.assertEqual(analysis["engine_version"], "FakeFish 1")

    def test_run_analysis_engine_version_falls_back_to_unknown(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(engine_version=None),
        )

        self.assertEqual(analysis["analysis_json"]["engine_version"], "unknown")
        self.assertEqual(analysis["engine_version"], "unknown")

    def test_default_unknown_key_reuses_done_row_with_real_engine_version(self) -> None:
        analysis = self._run_fake(
            START_FEN,
            FakeEngine(engine_version="FakeFish 1"),
        )

        reused = self.service.get_or_create_analysis(START_FEN)

        self.assertEqual(reused["id"], analysis["id"])
        self.assertEqual(reused["engine_version"], "FakeFish 1")
        self.assertEqual(self._analysis_count(), 1)

    def test_get_or_create_is_idempotent_for_same_key(self) -> None:
        first = self.service.get_or_create_analysis(START_FEN)
        second = self.service.get_or_create_analysis(START_FEN)

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self._analysis_count(), 1)

    def test_get_or_create_rejects_invalid_fen_before_insert(self) -> None:
        with self.assertRaises(InvalidFenError) as context:
            self.service.get_or_create_analysis(INVALID_C_FEN)

        self.assertEqual(str(context.exception), "invalid_fen")
        self.assertEqual(self._analysis_count(), 0)

    def test_get_or_create_rejects_semantically_invalid_fen_before_insert(self) -> None:
        with self.assertRaises(InvalidFenError) as context:
            self.service.get_or_create_analysis(SEMANTICALLY_INVALID_FEN)

        self.assertEqual(str(context.exception), "invalid_fen")
        self.assertEqual(self._analysis_count(), 0)

    def test_get_analysis_by_fen_rejects_invalid_fen(self) -> None:
        with self.assertRaises(InvalidFenError) as context:
            self.service.get_analysis_by_fen(INVALID_C_FEN)

        self.assertEqual(str(context.exception), "invalid_fen")

    def test_different_schema_versions_can_coexist(self) -> None:
        self.service.get_or_create_analysis(
            START_FEN,
            schema_version=ENGINE_ANALYSIS_SCHEMA_VERSION,
        )
        self.service.get_or_create_analysis(
            START_FEN,
            schema_version="engine_analysis_v3_test",
        )

        self.assertEqual(self._analysis_count(), 2)

    def test_concurrent_get_or_create_creates_single_row(self) -> None:
        barrier = threading.Barrier(10)
        errors: list[BaseException] = []
        ids: list[int] = []
        ids_lock = threading.Lock()

        def worker() -> None:
            try:
                barrier.wait()
                analysis = self.service.get_or_create_analysis(START_FEN)
                with ids_lock:
                    ids.append(analysis["id"])
            except BaseException as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        self.assertEqual(len(set(ids)), 1)
        self.assertEqual(self._analysis_count(), 1)

    def test_recover_pending_analyses_resets_running_rows(self) -> None:
        analysis = self.service.get_or_create_analysis(START_FEN)
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                "UPDATE position_analyses SET status = 'running' WHERE id = ?",
                (analysis["id"],),
            )
            connection.commit()

        recovered_count = self.service.recover_pending_analyses()
        recovered = self.service.get_analysis_by_fen(START_FEN)

        self.assertEqual(recovered_count, 1)
        self.assertIsNotNone(recovered)
        self.assertEqual(recovered["status"], "pending")

    def test_time_budget_timeout_marks_failed_without_raising(self) -> None:
        analysis = self.service.get_or_create_analysis(START_FEN)
        engine = TimeoutEngine()
        result = self.service.run_analysis(analysis["id"], engine=engine)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_message"], "time_budget_exceeded")
        self.assertEqual(engine.calls[0]["time_budget_ms"], TIME_BUDGET_MS_DEEP)

    def test_hard_timeout_marks_failed_and_closes_engine(self) -> None:
        analysis = self.service.get_or_create_analysis(
            START_FEN,
            requested_time_ms=10,
            analysis_limit_mode="time",
        )
        engine = HangingEngine()

        result = self.service.run_analysis(analysis["id"], engine=engine)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_message"], "time_budget_exceeded")
        self.assertTrue(engine.closed)

    def test_terminal_checkmate_position_does_not_call_engine(self) -> None:
        board = chess.Board()
        for uci in ["f2f3", "e7e5", "g2g4", "d8h4"]:
            board.push(chess.Move.from_uci(uci))
        analysis = self.service.get_or_create_analysis(
            board.fen(),
            analysis_profile="standard",
            requested_time_ms=1000,
            requested_multipv=3,
            analysis_limit_mode="time",
        )

        result = self.service.run_analysis(analysis["id"], engine=ExplodingEngine())

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "done")
        payload = result["analysis_json"]
        self.assertEqual(payload["analysis_limit_mode"], "terminal")
        self.assertTrue(payload["settings_json"]["terminal_position"])
        self.assertLess(payload["mate_in"], 0)
        self.assertEqual(payload["top_moves"], [])

    def test_terminal_stalemate_position_does_not_call_engine(self) -> None:
        stalemate_fen = "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1"
        analysis = self.service.get_or_create_analysis(
            stalemate_fen,
            analysis_profile="standard",
            requested_time_ms=1000,
            requested_multipv=3,
            analysis_limit_mode="time",
        )

        result = self.service.run_analysis(analysis["id"], engine=ExplodingEngine())

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "done")
        payload = result["analysis_json"]
        self.assertEqual(payload["analysis_limit_mode"], "terminal")
        self.assertEqual(payload["eval_cp"], 0)
        self.assertIsNone(payload["mate_in"])

    def test_effective_multipv_clamps_to_legal_moves(self) -> None:
        one_move_fen = "8/8/8/8/8/8/8/k1KQ4 b - - 0 1"

        self.assertEqual(self.service._effective_multipv(one_move_fen, 3), 1)

    def test_compute_review_time_budget_examples(self) -> None:
        self.assertEqual(compute_review_time_budget(11), 45)
        self.assertEqual(compute_review_time_budget(30), 60)
        self.assertEqual(compute_review_time_budget(60), 90)
        self.assertEqual(compute_review_time_budget(100), 130)
        self.assertEqual(compute_review_time_budget(120), 150)
        self.assertEqual(compute_review_time_budget(200), 150)

    def test_stabilized_eval_uses_final_score_and_tail_stability(self) -> None:
        stabilized = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[
                {"eval_cp": 20, "depth": 6, "time_ms": 100},
                {"eval_cp": 30, "depth": 8, "time_ms": 400},
                {"eval_cp": 80, "depth": 14, "time_ms": 1600},
                {"eval_cp": 82, "depth": 16, "time_ms": 2000, "nodes": 1234},
            ],
            engine_version="StableFake 1",
            time_budget_ms=2000,
        )

        self.assertEqual(stabilized.final_eval_cp, 82)
        self.assertAlmostEqual(stabilized.tail_median_cp or 0, 81, delta=2)
        self.assertEqual(stabilized.reliability_label, "stable")
        self.assertGreater(stabilized.reliability_score, 0.9)
        self.assertEqual(stabilized.nodes, 1234)

    def test_stabilized_eval_marks_divergent_tail_unstable(self) -> None:
        stabilized = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[
                {"eval_cp": 20, "depth": 14, "time_ms": 1200},
                {"eval_cp": 100, "depth": 15, "time_ms": 1600},
                {"eval_cp": -50, "depth": 16, "time_ms": 2000},
            ],
            engine_version="StableFake 1",
            time_budget_ms=2000,
        )

        self.assertEqual(stabilized.final_eval_cp, -50)
        self.assertEqual(stabilized.reliability_label, "unstable")
        self.assertLess(stabilized.reliability_score, 0.3)

    def test_stabilized_eval_unknown_when_tail_is_too_small(self) -> None:
        stabilized = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[{"eval_cp": 42, "depth": 16, "time_ms": 2000}],
            engine_version="StableFake 1",
            time_budget_ms=2000,
        )

        self.assertEqual(stabilized.final_eval_cp, 42)
        self.assertIsNone(stabilized.stability_cp)
        self.assertEqual(stabilized.reliability_label, "unknown")
        self.assertEqual(stabilized.reliability_score, 0.6)

    def test_stabilized_eval_mate_is_canonical_and_not_sigmoid(self) -> None:
        stabilized = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[
                {"eval_cp": 40, "depth": 10, "time_ms": 500},
                {"mate_in": 3, "depth": 14, "time_ms": 1000},
            ],
            engine_version="StableFake 1",
            time_budget_ms=1000,
        )

        self.assertEqual(stabilized.final_mate_in, 3)
        self.assertEqual(stabilized.reliability_label, "mate_detected")
        self.assertEqual(stabilized.reliability_score, 1.0)

    def test_stabilized_eval_depth_adjusts_reliability(self) -> None:
        weak = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[
                {"eval_cp": 80, "depth": 8, "time_ms": 1600},
                {"eval_cp": 82, "depth": 9, "time_ms": 2000},
            ],
            engine_version="StableFake 1",
            time_budget_ms=2000,
        )
        deep = build_stabilized_eval_from_samples(
            fen=START_FEN,
            samples=[
                {"eval_cp": 80, "depth": 20, "time_ms": 1600},
                {"eval_cp": 82, "depth": 22, "time_ms": 2000},
            ],
            engine_version="StableFake 1",
            time_budget_ms=2000,
        )

        self.assertLess(weak.reliability_score, deep.reliability_score)
        self.assertLess(weak.reliability_score, 0.9)

    def test_run_analysis_stores_stabilized_snapshot_for_deep_analysis(self) -> None:
        analysis = self.service.get_or_create_analysis(START_FEN)
        engine = StabilizedFakeEngine(
            [
                {"eval_cp": 20, "depth": 10, "time_ms": 1000},
                {"eval_cp": 82, "depth": 16, "time_ms": 5000},
            ]
        )

        result = self.service.run_analysis(analysis["id"], engine=engine)

        self.assertIsNotNone(result)
        payload = result["analysis_json"]
        self.assertEqual(payload["eval_cp"], 82)
        self.assertEqual(payload["eval_source_kind"], REVIEW_STABILIZED_EVAL_SOURCE_KIND)
        self.assertEqual(payload["stabilized_eval"]["final_eval_cp"], 82)
        self.assertEqual(
            payload["stabilized_eval"]["source_kind"],
            REVIEW_STABILIZED_EVAL_SOURCE_KIND,
        )
        self.assertEqual(result["reliability_label"], "unknown")
        self.assertEqual(engine.calls[0]["time_budget_sec"], TIME_BUDGET_MS_DEEP / 1000)

    def test_run_analysis_persists_engine_profile_settings(self) -> None:
        analysis = self.service.get_or_create_analysis(
            START_FEN,
            depth=802,
            multipv=3,
            kind="deep",
            analysis_profile="standard",
            requested_time_ms=1200,
            requested_depth=None,
            requested_multipv=3,
            analysis_limit_mode="time",
            settings_json={"analysis_profile": "standard"},
        )
        result = self.service.run_analysis(analysis["id"], engine=SettingsFakeEngine())

        self.assertIsNotNone(result)
        payload = result["analysis_json"]
        self.assertEqual(payload["analysis_profile"], "standard")
        self.assertEqual(payload["analysis_limit_mode"], "time")
        self.assertEqual(payload["achieved_depth"], 17)
        self.assertEqual(payload["nodes"], 123456)
        self.assertEqual(payload["nps"], 98765)
        self.assertEqual(payload["settings_json"]["threads"], 6)
        self.assertEqual(payload["settings_json"]["hash_mb"], 1024)
        self.assertEqual(result["settings_json"]["threads"], 6)

    def test_fake_engine_mode_produces_deterministic_delayed_metadata(self) -> None:
        previous_mode = os.environ.get("NEUROCHESS_ENGINE_MODE")
        previous_delay = os.environ.get("FAKE_ENGINE_DELAY_MS")
        previous_timeout = os.environ.get("FAKE_ENGINE_HARD_TIMEOUT_MS")
        os.environ["NEUROCHESS_ENGINE_MODE"] = "fake"
        os.environ["FAKE_ENGINE_DELAY_MS"] = "1"
        os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = "1000"
        FakeStockfishService.reset_state()
        try:
            analysis = self.service.get_or_create_analysis(
                START_FEN,
                depth=802,
                multipv=3,
                kind="deep",
                analysis_profile="standard",
                requested_time_ms=1000,
                requested_depth=None,
                requested_multipv=3,
                analysis_limit_mode="time",
                settings_json={"analysis_profile": "standard"},
            )
            result = self.service.run_analysis(analysis["id"])
        finally:
            _restore_env("NEUROCHESS_ENGINE_MODE", previous_mode)
            _restore_env("FAKE_ENGINE_DELAY_MS", previous_delay)
            _restore_env("FAKE_ENGINE_HARD_TIMEOUT_MS", previous_timeout)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "done")
        payload = result["analysis_json"]
        self.assertEqual(payload["engine_version"], "FakeFish deterministic v5.3.A4g")
        self.assertEqual(payload["analysis_limit_mode"], "time")
        self.assertEqual(payload["settings_json"]["threads"], 6)
        self.assertEqual(payload["settings_json"]["hash_mb"], 1024)
        self.assertEqual(payload["settings_json"]["fake_engine"], True)
        self.assertGreaterEqual(payload["nodes"], 1)
        self.assertGreaterEqual(payload["nps"], 1)

    def test_log_file_gets_one_json_line_per_engine_call(self) -> None:
        self._run_fake(START_FEN, FakeEngine(eval_cp=35, uci="e2e4"))

        lines = self.log_path.read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(lines), 1)
        payload = json.loads(lines[0])
        self.assertEqual(payload["status"], "done")
        self.assertEqual(payload["top1_uci"], "e2e4")

    def _run_fake(self, fen: str, engine: FakeEngine) -> dict[str, Any]:
        analysis = self.service.get_or_create_analysis(fen)
        result = self.service.run_analysis(analysis["id"], engine=engine)
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "done")
        return result

    def _analysis_count(self) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(
                connection.execute(
                    "SELECT COUNT(*) FROM position_analyses"
                ).fetchone()[0]
            )


def _restore_env(name: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
