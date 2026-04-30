from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.engines.stockfish_service import (
    ENGINE_ANALYSIS_SCHEMA_VERSION,
    StockfishService,
    StockfishServiceError,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
BLACK_TO_MOVE_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"


class StockfishServiceTests(unittest.TestCase):
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

    def test_stockfish_service_starts_and_closes(self) -> None:
        service = StockfishService()
        service.start()
        service.close()
        service.close()

    def test_analyze_start_position_returns_expected_shape(self) -> None:
        result = self.service.analyze_fen(START_FEN)

        expected_keys = {
            "fen",
            "engine",
            "depth",
            "multipv",
            "side_to_move",
            "eval_cp",
            "mate_in",
            "top_moves",
            "schema_version",
        }
        self.assertTrue(expected_keys.issubset(result.keys()))
        self.assertEqual(result["fen"], START_FEN)
        self.assertEqual(result["engine"], "stockfish")
        self.assertEqual(result["side_to_move"], "white")
        self.assertEqual(result["schema_version"], ENGINE_ANALYSIS_SCHEMA_VERSION)
        self.assertGreaterEqual(len(result["top_moves"]), 1)

        for top_move in result["top_moves"]:
            self.assertIn("eval_cp", top_move)
            self.assertIn("eval_pov_side_to_move_cp", top_move)
            self.assertIn("uci", top_move)
            self.assertIn("san", top_move)
            self.assertIn("pv", top_move)

    def test_black_to_move_eval_is_normalized_for_side_to_move(self) -> None:
        result = self.service.analyze_fen(BLACK_TO_MOVE_FEN)

        self.assertEqual(result["side_to_move"], "black")
        top_move = result["top_moves"][0]

        if top_move["eval_cp"] is not None:
            self.assertEqual(
                top_move["eval_pov_side_to_move_cp"],
                -top_move["eval_cp"],
            )

    def test_best_move_returns_legal_uci(self) -> None:
        best_move = self.service.best_move(START_FEN)
        board = chess.Board(START_FEN)

        self.assertIn(chess.Move.from_uci(best_move), board.legal_moves)

    def test_analysis_result_is_json_serializable(self) -> None:
        result = self.service.analyze_fen(START_FEN)

        json.dumps(result)


if __name__ == "__main__":
    unittest.main()
