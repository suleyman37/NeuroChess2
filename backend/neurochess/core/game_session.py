from __future__ import annotations

from typing import Any

import chess
import chess.pgn


class GameSessionError(Exception):
    pass


class GameSession:
    def __init__(self, starting_fen: str | None = None) -> None:
        self._starting_fen = starting_fen

        try:
            self._board = chess.Board(starting_fen) if starting_fen else chess.Board()
        except ValueError as exc:
            raise GameSessionError(f"Invalid starting FEN: {starting_fen}") from exc

    @property
    def board(self) -> chess.Board:
        return self._board

    def current_fen(self) -> str:
        return self._board.fen()

    def legal_moves_uci(self) -> list[str]:
        return [move.uci() for move in self._board.legal_moves]

    def is_legal_uci(self, uci: str) -> bool:
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return False

        return move in self._board.legal_moves

    def preview_uci(self, uci: str) -> dict[str, Any]:
        move = self._parse_legal_move(uci)
        fen_before = self._board.fen()
        san = self._board.san(move)
        temp_board = self._board.copy()
        temp_board.push(move)
        is_game_over = temp_board.is_game_over()

        return {
            "ply": self._board.ply() + 1,
            "fen_before": fen_before,
            "uci": move.uci(),
            "san": san,
            "fen_after": temp_board.fen(),
            "turn_after": "white" if temp_board.turn == chess.WHITE else "black",
            "is_game_over": is_game_over,
            "result": temp_board.result() if is_game_over else None,
        }

    def push_uci(self, uci: str) -> dict[str, Any]:
        move_data = self.preview_uci(uci)
        move = self._parse_legal_move(uci)
        self._board.push(move)
        return move_data

    def is_game_over(self) -> bool:
        return self._board.is_game_over()

    def result(self) -> str | None:
        return self._board.result() if self._board.is_game_over() else None

    def pgn(self) -> str:
        game = chess.pgn.Game.from_board(self._board)
        game.headers["Event"] = "NeuroChess 2 Game"
        game.headers["Site"] = "Local"
        game.headers["Result"] = self._board.result() if self._board.is_game_over() else "*"

        if self._starting_fen is not None:
            game.headers["SetUp"] = "1"
            game.headers["FEN"] = self._starting_fen

        return str(game)

    def _parse_legal_move(self, uci: str) -> chess.Move:
        try:
            move = chess.Move.from_uci(uci)
        except ValueError as exc:
            raise GameSessionError(f"Malformed UCI move: {uci}") from exc
        except chess.IllegalMoveError as exc:
            raise GameSessionError(f"Illegal UCI move: {uci}") from exc

        if move not in self._board.legal_moves:
            raise GameSessionError(f"Illegal move in current position: {uci}")

        return move
