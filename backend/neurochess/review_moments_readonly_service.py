from __future__ import annotations

import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path
from typing import Any

from neurochess.data.database import DEFAULT_DB_PATH


TRUTH_CHAIN_MOMENTS_ROUTE = "/games/{game_id}/truth-chain/moments"
MAX_TRUTH_CHAIN_MOMENTS = 5


class ReviewMomentsReadOnlyNotFoundError(ValueError):
    """Raised when the requested game cannot be read."""


class ReviewMomentsReadOnlyService:
    """Read-only view service for persisted Review moments used by REX Truth Chain."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path

    def get_truth_chain_moments(self, game_id: int) -> dict[str, Any]:
        with closing(_connect_readonly(self.db_path)) as connection:
            game_row = _load_game_row(connection, game_id)
            if game_row is None:
                raise ReviewMomentsReadOnlyNotFoundError("Game does not exist")

            review_id = _row_value(game_row, "review_id")
            review_status = _row_value(game_row, "review_status")
            limitations: list[str] = []

            moment_rows: list[sqlite3.Row] = []
            total_moments = 0
            if review_id is None:
                limitations.append("no persisted review")
            elif _table_exists(connection, "review_moments"):
                total_moments = _count_review_moments(connection, int(review_id))
                moment_rows = _load_review_moments(connection, int(review_id))
                if total_moments == 0:
                    limitations.append("no persisted review moments")
                elif total_moments > MAX_TRUTH_CHAIN_MOMENTS:
                    limitations.append("limited to first 5 persisted moments")
            else:
                limitations.append("review moments table unavailable")

            moments = [_moment_payload(row) for row in moment_rows]

            return {
                "game": _game_payload(game_row, review_status),
                "moments": moments,
                "limitations": limitations,
                "readOnlyProof": {
                    "route": TRUTH_CHAIN_MOMENTS_ROUTE,
                    "methodsAllowed": ["GET"],
                    "writesPerformed": False,
                    "trainingItemsCreated": False,
                    "dailyPlanTouched": False,
                    "dueAtTouched": False,
                    "engineInvoked": False,
                },
            }


def _connect_readonly(db_path: str | Path | None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    if str(path) == ":memory:":
        connection = sqlite3.connect(str(path))
    else:
        connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def _load_game_row(connection: sqlite3.Connection, game_id: int) -> sqlite3.Row | None:
    game_columns = _table_columns(connection, "games")
    has_opening = _table_exists(connection, "game_opening_classifications")
    has_reviews = _table_exists(connection, "game_reviews")

    selected_columns = [
        "g.id AS id",
        _optional_game_column(game_columns, "white_name", "white_name"),
        _optional_game_column(game_columns, "black_name", "black_name"),
        _optional_game_column(game_columns, "result", "result"),
        _optional_game_column(game_columns, "opening_name_pgn", "opening_name_pgn"),
        _optional_game_column(game_columns, "eco_code_pgn", "eco_code_pgn"),
        "(SELECT COUNT(*) FROM moves m WHERE m.game_id = g.id) AS move_count",
    ]

    if has_opening:
        selected_columns.extend(
            [
                "c.opening_name AS classified_opening_name",
                "c.eco_code AS classified_eco_code",
            ]
        )
        opening_join = "LEFT JOIN game_opening_classifications c ON c.game_id = g.id"
    else:
        selected_columns.extend(
            [
                "NULL AS classified_opening_name",
                "NULL AS classified_eco_code",
            ]
        )
        opening_join = ""

    if has_reviews:
        selected_columns.extend(
            [
                "gr.id AS review_id",
                "gr.status AS review_status",
            ]
        )
        review_join = """
            LEFT JOIN game_reviews gr ON gr.id = (
                SELECT gr2.id
                FROM game_reviews gr2
                WHERE gr2.game_id = g.id
                ORDER BY gr2.id DESC
                LIMIT 1
            )
        """
    else:
        selected_columns.extend(
            [
                "NULL AS review_id",
                "NULL AS review_status",
            ]
        )
        review_join = ""

    sql = f"""
        SELECT
            {", ".join(selected_columns)}
        FROM games g
        {opening_join}
        {review_join}
        WHERE g.id = ?
        LIMIT 1
    """
    return connection.execute(sql, (game_id,)).fetchone()


def _count_review_moments(connection: sqlite3.Connection, review_id: int) -> int:
    row = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM review_moments
        WHERE review_id = ?
        """,
        (review_id,),
    ).fetchone()
    return int(row["count"] if row is not None else 0)


def _load_review_moments(
    connection: sqlite3.Connection,
    review_id: int,
) -> list[sqlite3.Row]:
    has_training_items = _table_exists(connection, "training_items")
    if has_training_items:
        training_join = """
            LEFT JOIN training_items ti
              ON ti.source_moment_id = rm.id
             AND ti.status = 'active'
        """
        training_select = "ti.id AS training_item_id"
    else:
        training_join = ""
        training_select = "NULL AS training_item_id"

    return connection.execute(
        f"""
        SELECT
            rm.id,
            rm.game_id,
            rm.ply,
            rm.fen_before,
            rm.fen_after,
            rm.played_uci,
            rm.played_san,
            rm.cp_loss_label,
            rm.review_type,
            {training_select}
        FROM review_moments rm
        {training_join}
        WHERE rm.review_id = ?
        ORDER BY rm.ply, rm.id
        LIMIT ?
        """,
        (review_id, MAX_TRUTH_CHAIN_MOMENTS),
    ).fetchall()


def _game_payload(row: sqlite3.Row, review_status: Any) -> dict[str, Any]:
    opening_name = _first_text(
        _row_value(row, "classified_opening_name"),
        _row_value(row, "opening_name_pgn"),
    )
    eco_code = _first_text(
        _row_value(row, "classified_eco_code"),
        _row_value(row, "eco_code_pgn"),
    )
    return {
        "id": str(row["id"]),
        "white": _row_value(row, "white_name"),
        "black": _row_value(row, "black_name"),
        "result": _row_value(row, "result"),
        "openingName": opening_name,
        "eco": eco_code,
        "moveCount": int(_row_value(row, "move_count", 0) or 0),
        "reviewStatus": review_status,
    }


def _moment_payload(row: sqlite3.Row) -> dict[str, Any]:
    visual_severity = _visual_severity_from_label(_row_value(row, "cp_loss_label"))
    limitations: list[str] = []
    if not _row_value(row, "fen_before") or not _row_value(row, "fen_after"):
        limitations.append("position unavailable")
    if not _row_value(row, "played_san"):
        limitations.append("san unavailable")
    if visual_severity == "unknown":
        limitations.append("visual severity unavailable")
    if _row_value(row, "training_item_id") is None:
        limitations.append("no persisted exercise")

    return {
        "id": str(row["id"]),
        "gameId": str(row["game_id"]),
        "ply": int(row["ply"]),
        "moveNumber": _move_number(int(row["ply"])),
        "san": _row_value(row, "played_san"),
        "uci": _row_value(row, "played_uci"),
        "fenBefore": _row_value(row, "fen_before"),
        "fenAfter": _row_value(row, "fen_after"),
        "label": _safe_moment_label(_row_value(row, "cp_loss_label")),
        "momentKind": _moment_kind(_row_value(row, "review_type")),
        "visualSeverity": visual_severity,
        "reviewAvailable": True,
        "exerciseAvailable": _row_value(row, "training_item_id") is not None,
        "source": "persisted_review_moment",
        "limitations": limitations,
    }


def _optional_game_column(columns: set[str], column: str, alias: str) -> str:
    if column in columns:
        return f"g.{column} AS {alias}"
    return f"NULL AS {alias}"


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (table_name,),
    ).fetchone()
    return row is not None


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    return {str(row["name"]) for row in connection.execute(f"PRAGMA table_info({table_name})")}


def _row_value(row: sqlite3.Row, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except AttributeError:
        return default
    return row[key] if key in keys else default


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _move_number(ply: int) -> int:
    return (ply + 1) // 2 if ply > 0 else 0


def _safe_moment_label(label: Any) -> str:
    if isinstance(label, str) and label.strip():
        return label.strip()
    return "Review moment"


def _moment_kind(review_type: Any) -> str:
    if review_type == "player_loss":
        return "tactical"
    return "unknown"


def _visual_severity_from_label(label: Any) -> str:
    if not isinstance(label, str):
        return "unknown"
    normalized = _ascii_fold(label.strip().casefold())
    if not normalized:
        return "unknown"
    if "decis" in normalized or "mate" in normalized:
        return "critical"
    if "tres important" in normalized:
        return "high"
    if "important" in normalized or "significatif" in normalized:
        return "medium"
    if "leger" in normalized or "micro" in normalized:
        return "low"
    return "unknown"


def _ascii_fold(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
