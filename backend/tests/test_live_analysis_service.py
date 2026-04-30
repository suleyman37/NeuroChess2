from __future__ import annotations

import json
import sys
import threading
import unittest
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.live_analysis_service import LiveAnalysisService


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
BLACK_TO_MOVE_WHITE_ADVANTAGE_FEN = (
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
)


class FakeLiveAnalyzer:
    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> list[dict[str, Any]]:
        _ = fen, stop_event
        return [
            {
                "engine_version": "FakeLive 1",
                "depth": 4,
                "seldepth": 6,
                "nodes": 1234,
                "nps": 5678,
                "time_ms": 250,
                "eval_cp": 300,
                "mate_in": None,
                "best_move_uci": "e2e4",
                "pv": ["e2e4", "e7e5"],
            }
        ]


class MateLiveAnalyzer:
    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> list[dict[str, Any]]:
        _ = fen, stop_event
        return [
            {
                "engine_version": "FakeLive 1",
                "depth": 4,
                "nodes": 100,
                "time_ms": 200,
                "eval_cp": None,
                "mate_in": 2,
                "best_move_uci": "g6g7",
                "pv": ["g6g7"],
            }
        ]


class BlockingLiveAnalyzer:
    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> list[dict[str, Any]]:
        _ = fen
        stop_event.wait(5)
        return []


class ErrorLiveAnalyzer:
    def stream(
        self,
        fen: str,
        stop_event: threading.Event,
    ) -> list[dict[str, Any]]:
        _ = fen, stop_event
        raise RuntimeError("deterministic live failure")


class LiveAnalysisServiceTests(unittest.TestCase):
    def test_start_session_returns_unique_session_ids(self) -> None:
        service = LiveAnalysisService(analyzer_factory=BlockingLiveAnalyzer)

        first = service.start_session(START_FEN, game_id=1, ply=1)
        second = service.start_session(START_FEN, game_id=1, ply=1)
        service.stop_all()

        self.assertNotEqual(first, second)
        self.assertEqual(service.get_session(first)["status"], "stopped")
        self.assertEqual(service.get_session(second)["status"], "stopped")

    def test_stop_session_marks_status_stopped(self) -> None:
        service = LiveAnalysisService(analyzer_factory=BlockingLiveAnalyzer)
        session_id = service.start_session(START_FEN, game_id=1, ply=1)

        result = service.stop_session(session_id)

        self.assertEqual(result["status"], "stopped")
        self.assertEqual(service.get_session(session_id)["status"], "stopped")

    def test_stop_sessions_for_game_stops_previous_sessions(self) -> None:
        service = LiveAnalysisService(analyzer_factory=BlockingLiveAnalyzer)
        first = service.start_session(START_FEN, game_id=7, ply=1)
        second = service.start_session(START_FEN, game_id=8, ply=1)

        service.stop_sessions_for_game(7)
        service.stop_all()

        self.assertEqual(service.get_session(first)["status"], "stopped")
        self.assertEqual(service.get_session(second)["status"], "stopped")

    def test_stream_update_contains_live_contract(self) -> None:
        service = LiveAnalysisService(analyzer_factory=FakeLiveAnalyzer)
        session_id = service.start_session(
            START_FEN,
            game_id=1,
            ply=1,
            context="historical",
        )

        payload = self._first_update(service, session_id)

        self.assertEqual(payload["type"], "analysis_update")
        self.assertEqual(payload["session_id"], session_id)
        self.assertEqual(payload["fen"], START_FEN)
        self.assertEqual(payload["context"], "historical")
        self.assertEqual(payload["evaluation_source"]["kind"], "live")
        self.assertEqual(payload["analysis_profile"], "live_continuous")
        self.assertEqual(payload["analysis_limit_mode"], "continuous")
        self.assertEqual(payload["evaluation_source"]["analysis_profile"], "live_continuous")
        self.assertEqual(payload["evaluation_source"]["analysis_limit_mode"], "continuous")
        self.assertEqual(payload["threads"], 4)
        self.assertEqual(payload["hash_mb"], 512)
        self.assertEqual(payload["multipv"], 1)
        self.assertEqual(payload["fen_key"], START_FEN)
        self.assertEqual(payload["evaluation_display"]["label"], "+3.00")
        self.assertEqual(payload["depth"], 4)
        self.assertEqual(payload["nodes"], 1234)

    def test_live_update_respects_white_pov_and_side_to_move_pov(self) -> None:
        service = LiveAnalysisService(analyzer_factory=FakeLiveAnalyzer)
        session_id = service.start_session(
            BLACK_TO_MOVE_WHITE_ADVANTAGE_FEN,
            game_id=1,
            ply=1,
        )

        payload = self._first_update(service, session_id)

        self.assertEqual(payload["eval_cp"], 300)
        self.assertEqual(payload["eval_pov_side_to_move_cp"], -300)
        self.assertGreater(payload["evaluation_display"]["white_percent"], 50.0)

    def test_live_mate_display_is_exact(self) -> None:
        service = LiveAnalysisService(analyzer_factory=MateLiveAnalyzer)
        session_id = service.start_session(
            "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
            game_id=1,
            ply=1,
        )

        payload = self._first_update(service, session_id)

        self.assertEqual(payload["mate_in"], 2)
        self.assertEqual(payload["evaluation_display"]["white_percent"], 100.0)
        self.assertEqual(payload["evaluation_display"]["black_percent"], 0.0)
        self.assertEqual(payload["evaluation_display"]["label"], "M2")

    def test_live_engine_error_is_streamed_without_raising(self) -> None:
        service = LiveAnalysisService(analyzer_factory=ErrorLiveAnalyzer)
        session_id = service.start_session(START_FEN, game_id=1, ply=1)

        payload = self._first_event(service, session_id)

        self.assertEqual(payload["type"], "analysis_error")
        self.assertEqual(payload["session_id"], session_id)
        self.assertIn("deterministic live failure", payload["error_message"])

    def test_stopped_event_is_distinct_from_error_event(self) -> None:
        service = LiveAnalysisService(analyzer_factory=BlockingLiveAnalyzer)
        session_id = service.start_session(START_FEN, game_id=1, ply=1)

        service.stop_session(session_id)
        payload = self._first_event(service, session_id)

        self.assertEqual(payload["type"], "analysis_stopped")
        self.assertEqual(payload["session_id"], session_id)
        self.assertEqual(payload["context"], "live")
        self.assertEqual(payload["fen"], START_FEN)
        self.assertNotIn("error_message", payload)

    def _first_update(
        self,
        service: LiveAnalysisService,
        session_id: str,
    ) -> dict[str, Any]:
        payload = self._first_event(service, session_id)
        self.assertEqual(payload["type"], "analysis_update")
        return payload

    def _first_event(
        self,
        service: LiveAnalysisService,
        session_id: str,
    ) -> dict[str, Any]:
        event = next(iter(service.stream_session(session_id)))
        self.assertTrue(event.startswith("data: "))
        return json.loads(event.removeprefix("data: ").strip())


if __name__ == "__main__":
    unittest.main()
