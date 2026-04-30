from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from neurochess.data.database import get_connection
from neurochess.data.models import Game, Move, PositionAnalysis


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_game(row: sqlite3.Row) -> Game:
    return Game(
        id=row["id"],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
        mode=row["mode"],
        opponent_type=row["opponent_type"],
        opponent_level=row["opponent_level"],
        result=row["result"],
        pgn=row["pgn"],
        completed=bool(row["completed"]),
        source=_row_value(row, "source"),
        source_platform=_row_value(row, "source_platform"),
        source_url=_row_value(row, "source_url"),
        source_game_id=_row_value(row, "source_game_id"),
        initial_fen=_row_value(row, "initial_fen"),
        current_position_fen=_row_value(row, "current_position_fen"),
        variant=_row_value(row, "variant"),
        import_status=_row_value(row, "import_status", "ok") or "ok",
        import_warnings_json=_row_value(row, "import_warnings_json", "[]") or "[]",
        import_error=_row_value(row, "import_error"),
        import_schema_version=_row_value(row, "import_schema_version"),
    )


def _row_to_move(row: sqlite3.Row) -> Move:
    return Move(
        id=row["id"],
        game_id=row["game_id"],
        ply=row["ply"],
        fen_before=row["fen_before"],
        uci=row["uci"],
        san=row["san"],
        is_player=bool(row["is_player"]),
        time_spent=row["time_spent"],
        eval_before_cp=row["eval_before_cp"],
        eval_after_cp=row["eval_after_cp"],
        best_move_uci=row["best_move_uci"],
        cp_loss=row["cp_loss"],
        classification=row["classification"],
        created_at=row["created_at"],
        annotations=row["annotations"],
    )


def _row_to_position_analysis(row: sqlite3.Row) -> PositionAnalysis:
    return PositionAnalysis(
        id=row["id"],
        fen=row["fen"],
        analysis_json=json.loads(row["analysis_json"]),
        engine=row["engine"],
        depth=row["depth"],
        schema_version=row["schema_version"],
        created_at=row["created_at"],
        engine_version=row["engine_version"],
        multipv=row["multipv"],
        analysis_time_ms=row["analysis_time_ms"],
        reliability_score=row["reliability_score"],
        reliability_label=row["reliability_label"],
        status=row["status"],
        error_message=row["error_message"],
        completed_at=row["completed_at"],
        analysis_kind=row["analysis_kind"],
    )


def _serialize_analysis(analysis_json: dict[str, Any] | str) -> str:
    if isinstance(analysis_json, str):
        parsed = json.loads(analysis_json)
    else:
        parsed = analysis_json

    if not isinstance(parsed, dict):
        raise ValueError("analysis_json must be a JSON object")

    return json.dumps(parsed, ensure_ascii=False, sort_keys=True)


def _row_value(row: sqlite3.Row, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except AttributeError:
        return default
    return row[key] if key in keys else default


class Repository:
    """SQLite repository for V0 data.

    Position analyses are stored as JSON text in SQLite and returned as Python
    dictionaries in PositionAnalysis.analysis_json.
    """

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path

    def create_game(
        self,
        mode: str,
        opponent_type: str | None = None,
        opponent_level: int | None = None,
    ) -> int:
        with closing(get_connection(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO games (
                    created_at,
                    mode,
                    opponent_type,
                    opponent_level
                )
                VALUES (?, ?, ?, ?)
                """,
                (_utc_now(), mode, opponent_type, opponent_level),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def finish_game(
        self,
        game_id: int,
        result: str | None = None,
        pgn: str | None = None,
    ) -> None:
        with closing(get_connection(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE games
                SET completed = 1,
                    completed_at = ?,
                    result = ?,
                    pgn = ?
                WHERE id = ?
                """,
                (_utc_now(), result, pgn, game_id),
            )
            connection.commit()

    def add_move(
        self,
        game_id: int,
        ply: int,
        fen_before: str,
        uci: str,
        san: str,
        is_player: bool,
        time_spent: float | None = None,
        eval_before_cp: int | None = None,
        eval_after_cp: int | None = None,
        best_move_uci: str | None = None,
        cp_loss: int | None = None,
        classification: str | None = None,
    ) -> int:
        with closing(get_connection(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO moves (
                    game_id,
                    ply,
                    fen_before,
                    uci,
                    san,
                    is_player,
                    time_spent,
                    eval_before_cp,
                    eval_after_cp,
                    best_move_uci,
                    cp_loss,
                    classification,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    game_id,
                    ply,
                    fen_before,
                    uci,
                    san,
                    int(is_player),
                    time_spent,
                    eval_before_cp,
                    eval_after_cp,
                    best_move_uci,
                    cp_loss,
                    classification,
                    _utc_now(),
                ),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def list_games(self) -> list[Game]:
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                "SELECT * FROM games ORDER BY id"
            ).fetchall()
            return [_row_to_game(row) for row in rows]

    def get_game(self, game_id: int) -> Game | None:
        with closing(get_connection(self.db_path)) as connection:
            row = connection.execute(
                "SELECT * FROM games WHERE id = ?",
                (game_id,),
            ).fetchone()
            return _row_to_game(row) if row is not None else None

    def get_moves_for_game(self, game_id: int) -> list[Move]:
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM moves
                WHERE game_id = ?
                ORDER BY ply, id
                """,
                (game_id,),
            ).fetchall()
            return [_row_to_move(row) for row in rows]

    def save_position_analysis(
        self,
        fen: str,
        analysis_json: dict[str, Any] | str,
        engine: str | None = None,
        depth: int | None = None,
        schema_version: str = "v0",
    ) -> int:
        serialized_analysis = _serialize_analysis(analysis_json)

        with closing(get_connection(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO position_analyses (
                    fen,
                    analysis_json,
                    engine,
                    depth,
                    schema_version,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    fen,
                    serialized_analysis,
                    engine or "stockfish",
                    depth if depth is not None else 12,
                    schema_version,
                    _utc_now(),
                ),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def get_position_analysis_by_fen(self, fen: str) -> PositionAnalysis | None:
        with closing(get_connection(self.db_path)) as connection:
            row = connection.execute(
                """
                SELECT *
                FROM position_analyses
                WHERE fen = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (fen,),
            ).fetchone()
            return _row_to_position_analysis(row) if row is not None else None


_default_repository = Repository()


def create_game(
    mode: str,
    opponent_type: str | None = None,
    opponent_level: int | None = None,
) -> int:
    return _default_repository.create_game(mode, opponent_type, opponent_level)


def finish_game(
    game_id: int,
    result: str | None = None,
    pgn: str | None = None,
) -> None:
    _default_repository.finish_game(game_id, result, pgn)


def add_move(
    game_id: int,
    ply: int,
    fen_before: str,
    uci: str,
    san: str,
    is_player: bool,
    time_spent: float | None = None,
    eval_before_cp: int | None = None,
    eval_after_cp: int | None = None,
    best_move_uci: str | None = None,
    cp_loss: int | None = None,
    classification: str | None = None,
) -> int:
    return _default_repository.add_move(
        game_id,
        ply,
        fen_before,
        uci,
        san,
        is_player,
        time_spent,
        eval_before_cp,
        eval_after_cp,
        best_move_uci,
        cp_loss,
        classification,
    )


def list_games() -> list[Game]:
    return _default_repository.list_games()


def get_game(game_id: int) -> Game | None:
    return _default_repository.get_game(game_id)


def get_moves_for_game(game_id: int) -> list[Move]:
    return _default_repository.get_moves_for_game(game_id)


def save_position_analysis(
    fen: str,
    analysis_json: dict[str, Any] | str,
    engine: str | None = None,
    depth: int | None = None,
    schema_version: str = "v0",
) -> int:
    return _default_repository.save_position_analysis(
        fen,
        analysis_json,
        engine,
        depth,
        schema_version,
    )


def get_position_analysis_by_fen(fen: str) -> PositionAnalysis | None:
    return _default_repository.get_position_analysis_by_fen(fen)
