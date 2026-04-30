from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

import chess

from neurochess.core.game_session import GameSession, GameSessionError


class GameRecorderError(Exception):
    pass


class GameRecorder:
    def __init__(self, repository: Any) -> None:
        self.repository = repository
        self._validate_repository()

    def start_game(
        self,
        mode: str,
        opponent_type: str | None = None,
        opponent_level: int | None = None,
    ) -> int:
        if mode is None or not mode.strip():
            raise GameRecorderError("Game mode must not be empty")

        try:
            return int(
                self.repository.create_game(
                    mode=mode,
                    opponent_type=opponent_type,
                    opponent_level=opponent_level,
                )
            )
        except Exception as exc:
            raise GameRecorderError(f"Unable to create game: {exc}") from exc

    def play_move(
        self,
        game_id: int,
        session: GameSession,
        uci: str,
        is_player: bool,
        time_spent: float | None = None,
    ) -> dict[str, Any]:
        self._get_existing_game(game_id)
        move_data = session.preview_uci(uci)

        try:
            self.repository.add_move(
                game_id=game_id,
                ply=move_data["ply"],
                fen_before=move_data["fen_before"],
                uci=move_data["uci"],
                san=move_data["san"],
                is_player=is_player,
                time_spent=time_spent,
                eval_before_cp=None,
                eval_after_cp=None,
                best_move_uci=None,
                cp_loss=None,
                classification=None,
            )
        except Exception as exc:
            raise GameRecorderError(f"Unable to record move: {exc}") from exc

        try:
            pushed_data = session.push_uci(uci)
        except GameSessionError as exc:
            raise GameRecorderError(
                f"Move was recorded but could not be applied to the session: {exc}"
            ) from exc

        if pushed_data != move_data:
            raise GameRecorderError(
                "Move was recorded but session replay produced different move data"
            )

        return move_data

    def finish_game(
        self,
        game_id: int,
        session: GameSession,
        result: str | None = None,
    ) -> None:
        self._get_existing_game(game_id)
        final_result = result

        if final_result is None:
            final_result = session.result() if session.is_game_over() else "*"

        try:
            self.repository.finish_game(game_id, result=final_result, pgn=session.pgn())
        except Exception as exc:
            raise GameRecorderError(f"Unable to finish game: {exc}") from exc

    def load_session(self, game_id: int) -> GameSession:
        game = self._get_existing_game(game_id)

        try:
            moves = self.repository.get_moves_for_game(game_id)
        except Exception as exc:
            raise GameRecorderError(f"Unable to load moves for game {game_id}: {exc}") from exc

        initial_fen = _initial_fen_for_game(game, moves)
        session = GameSession(initial_fen)

        for move in sorted(moves, key=lambda item: item.ply):
            try:
                session.push_uci(move.uci)
            except GameSessionError as exc:
                raise GameRecorderError(
                    f"Corrupted game {game_id}: illegal move at ply {move.ply}: {move.uci}"
                ) from exc

        return session

    def get_game_with_moves(self, game_id: int) -> dict[str, Any]:
        game = self._get_existing_game(game_id)

        try:
            moves = self.repository.get_moves_for_game(game_id)
        except Exception as exc:
            raise GameRecorderError(f"Unable to load moves for game {game_id}: {exc}") from exc

        return {
            "game": _to_json_dict(game),
            "moves": [_to_json_dict(move) for move in moves],
        }

    def _validate_repository(self) -> None:
        if self.repository is None:
            raise GameRecorderError("Repository must not be None")

        required_methods = (
            "create_game",
            "finish_game",
            "add_move",
            "get_game",
            "get_moves_for_game",
        )
        missing_methods = [
            method
            for method in required_methods
            if not callable(getattr(self.repository, method, None))
        ]

        if missing_methods:
            joined_methods = ", ".join(missing_methods)
            raise GameRecorderError(f"Repository is missing methods: {joined_methods}")

    def _get_existing_game(self, game_id: int) -> Any:
        try:
            game = self.repository.get_game(game_id)
        except Exception as exc:
            raise GameRecorderError(f"Unable to load game {game_id}: {exc}") from exc

        if game is None:
            raise GameRecorderError(f"Game does not exist: {game_id}")

        return game


def _to_json_dict(value: Any) -> dict[str, Any]:
    if is_dataclass(value):
        return asdict(value)

    if isinstance(value, dict):
        return dict(value)

    if hasattr(value, "__dict__"):
        return dict(vars(value))

    raise GameRecorderError(f"Cannot serialize value as dict: {type(value).__name__}")


def _initial_fen_for_game(game: Any, moves: list[Any]) -> str:
    initial_fen = getattr(game, "initial_fen", None)
    if isinstance(initial_fen, str) and initial_fen.strip():
        return initial_fen.strip()
    if moves:
        first_fen = getattr(moves[0], "fen_before", None)
        if isinstance(first_fen, str) and first_fen.strip():
            return first_fen.strip()
    return chess.STARTING_FEN
