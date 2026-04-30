from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Game:
    id: int
    created_at: str
    completed_at: str | None
    mode: str
    opponent_type: str | None
    opponent_level: int | None
    result: str | None
    pgn: str | None
    completed: bool
    source: str | None = None
    source_platform: str | None = None
    source_url: str | None = None
    source_game_id: str | None = None
    initial_fen: str | None = None
    current_position_fen: str | None = None
    variant: str | None = None
    import_status: str = "ok"
    import_warnings_json: str = "[]"
    import_error: str | None = None
    import_schema_version: str | None = None


@dataclass(frozen=True)
class Move:
    id: int
    game_id: int
    ply: int
    fen_before: str
    uci: str
    san: str
    is_player: bool
    time_spent: float | None
    eval_before_cp: int | None
    eval_after_cp: int | None
    best_move_uci: str | None
    cp_loss: int | None
    classification: str | None
    created_at: str
    annotations: str = "{}"


@dataclass(frozen=True)
class PositionAnalysis:
    id: int
    fen: str
    analysis_json: dict[str, Any]
    engine: str
    depth: int
    schema_version: str
    created_at: str
    engine_version: str = "unknown"
    multipv: int = 3
    analysis_time_ms: int | None = None
    reliability_score: float | None = None
    reliability_label: str | None = None
    status: str = "pending"
    error_message: str | None = None
    completed_at: str | None = None
    analysis_kind: str = "deep"
