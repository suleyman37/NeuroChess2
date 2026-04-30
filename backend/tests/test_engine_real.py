from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.analysis_service import AnalysisService
from neurochess.engines.stockfish_service import StockfishService, StockfishServiceError


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
WHITE_EXTRA_QUEEN_WHITE_TO_MOVE = (
    "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
)
WHITE_EXTRA_QUEEN_BLACK_TO_MOVE = (
    "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"
)
BLACK_EXTRA_QUEEN_BLACK_TO_MOVE = (
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1"
)
WHITE_MATE_IN_ONE = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"
BLACK_MATE_IN_ONE = "8/8/8/8/8/5kq1/8/7K b - - 0 1"


class RealEngineConventionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.service = StockfishService()
        try:
            cls.service.start()
        except StockfishServiceError as exc:
            raise unittest.SkipTest(f"Stockfish unavailable: {exc}") from exc

    @classmethod
    def tearDownClass(cls) -> None:
        service = getattr(cls, "service", None)
        if service is not None:
            service.close()

    def test_white_extra_queen_white_to_move_is_positive(self) -> None:
        result = self._analyze(WHITE_EXTRA_QUEEN_WHITE_TO_MOVE)

        self.assertIsNotNone(result["eval_cp"])
        self.assertGreater(result["eval_cp"], 300)

    def test_white_extra_queen_black_to_move_stays_positive_white_pov(self) -> None:
        result = self._analyze(WHITE_EXTRA_QUEEN_BLACK_TO_MOVE)

        self.assertIsNotNone(result["eval_cp"])
        self.assertGreater(result["eval_cp"], 300)

    def test_black_extra_queen_black_to_move_is_negative_white_pov(self) -> None:
        result = self._analyze(BLACK_EXTRA_QUEEN_BLACK_TO_MOVE)

        self.assertIsNotNone(result["eval_cp"])
        self.assertLess(result["eval_cp"], -300)

    def test_start_position_is_near_equal(self) -> None:
        result = self._analyze(START_FEN)

        self.assertIsNotNone(result["eval_cp"])
        self.assertGreater(result["eval_cp"], -150)
        self.assertLess(result["eval_cp"], 150)

    def test_white_forced_mate_is_positive_mate(self) -> None:
        result = self._analyze(WHITE_MATE_IN_ONE, depth=4)

        self.assertIsNotNone(result["mate_in"])
        self.assertGreater(result["mate_in"], 0)

    def test_black_forced_mate_is_negative_mate(self) -> None:
        result = self._analyze(BLACK_MATE_IN_ONE, depth=4)

        self.assertIsNotNone(result["mate_in"])
        self.assertLess(result["mate_in"], 0)

    def test_calibration_payload_has_v1_schema(self) -> None:
        payload = AnalysisService().evaluate_calibration(
            START_FEN,
            depth=2,
            time=0.2,
            multipv=1,
        )

        self.assertEqual(payload["schema_version"], "calibration_v1")
        self.assertEqual(payload["analysis_kind"], "calibration")
        self.assertEqual(payload["evaluation_source"]["kind"], "calibration")
        self.assertIn("engine_options_reported", payload)
        self.assertIn("result", payload)
        self.assertIn("evaluation_display", payload)

    def _analyze(self, fen: str, depth: int = 6) -> dict[str, object]:
        return self.service.analyze_fen(
            fen,
            depth=depth,
            multipv=1,
            time_budget_ms=1000,
        )


if __name__ == "__main__":
    unittest.main()
