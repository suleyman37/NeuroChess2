from __future__ import annotations

from typing import Any

from neurochess.engines.engine_config import (
    DEFAULT_ANALYSIS_DEPTH,
    DEFAULT_MULTIPV,
)
from neurochess.engines.stockfish_service import StockfishService


class EngineManager:
    def __init__(self, stockfish_path: str | None = None) -> None:
        self.stockfish = StockfishService(stockfish_path)

    def start(self) -> None:
        self.stockfish.start()

    def close(self) -> None:
        self.stockfish.close()

    def analyze_fen(
        self,
        fen: str,
        depth: int = DEFAULT_ANALYSIS_DEPTH,
        multipv: int = DEFAULT_MULTIPV,
    ) -> dict[str, Any]:
        return self.stockfish.analyze_fen(fen, depth=depth, multipv=multipv)

    def best_move(
        self,
        fen: str,
        depth: int = DEFAULT_ANALYSIS_DEPTH,
    ) -> str:
        return self.stockfish.best_move(fen, depth=depth)
