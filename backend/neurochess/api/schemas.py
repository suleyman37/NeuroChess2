from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class CreateGameRequest(BaseModel):
    mode: str = "classic"
    opponent_type: str | None = "none"
    opponent_level: int | None = None


class PlayMoveRequest(BaseModel):
    uci: str
    is_player: bool = True
    time_spent: float | None = None


class FinishGameRequest(BaseModel):
    result: str | None = None


class StartLiveAnalysisRequest(BaseModel):
    fen: str
    game_id: int | None = None
    ply: int | None = None
    context: str | None = None
    review_moment_id: str | None = None


class StopLiveAnalysisRequest(BaseModel):
    session_id: str


class CapabilityProduct(BaseModel):
    name: str


class CapabilityTab(BaseModel):
    id: str
    label: str
    screen_id: str


class CapabilityMetric(BaseModel):
    metric_id: str
    label: str
    category: str
    visibility: str
    source_field: str | None = None
    formula_version_field: str | None = None


class CapabilityAction(BaseModel):
    action_id: str
    label: str
    screen_id: str
    type: str


class CapabilityPractice(BaseModel):
    enabled: bool
    grading_authority: str
    default_scope: str
    default_max_items: int
    result_values: list[str]


class CapabilityUiContract(BaseModel):
    summary_max_priorities: int
    summary_max_takeaways: int
    prescriptive_max_primary_actions: int
    prescriptive_max_secondary_actions: int
    beginner_hides_raw_formulas: bool
    beginner_hides_evidence_json: bool
    technical_details_location: str


class CapabilityReview(BaseModel):
    tabs: list[CapabilityTab]
    visible_metrics: list[CapabilityMetric]
    advanced_metrics: list[CapabilityMetric]
    hidden_metrics: list[str]
    actions: list[CapabilityAction]
    practice: CapabilityPractice
    ui_contract: CapabilityUiContract


class ProductCapabilitiesResponse(BaseModel):
    schema_version: str
    product: CapabilityProduct
    review: CapabilityReview


class StartReviewJobRequest(BaseModel):
    profile: str = "standard"
    force_reanalysis: bool = False


class StartReviewPracticeSessionRequest(BaseModel):
    pov: str = "user"
    scope: str = "top_priority"
    max_items: int = 5


class RecordReviewPracticeAttemptRequest(BaseModel):
    ply: int
    attempted_uci: str | None = None
    result: str | None = None
    time_spent_ms: int | None = None
    hint_used: bool = False
    reveal_used: bool = False
    source_context: str | None = None


class EvaluationResponse(BaseModel):
    white_percent: float
    black_percent: float
    label: str
    is_mate: bool = False
    advantage_side: str
    magnitude: str


class EvaluationSourceResponse(BaseModel):
    kind: str
    depth: int | None = None
    time_ms: int | None = None
    nodes: int | None = None
    engine_version: str = "unknown"


class MoveResponse(BaseModel):
    ply: int
    fen_before: str
    uci: str
    san: str
    fen_after: str
    turn_after: str
    is_game_over: bool
    result: str | None = None


class GameListItem(BaseModel):
    id: int
    created_at: str
    completed_at: str | None = None
    mode: str
    opponent_type: str | None = None
    opponent_level: int | None = None
    result: str | None = None
    completed: int


class GameStateResponse(BaseModel):
    game_id: int
    fen: str
    legal_moves: list[str]
    moves: list[dict[str, Any]]
    result: str | None = None
    is_game_over: bool
    evaluation: EvaluationResponse | None = None
    evaluation_display: EvaluationResponse | None = None
    evaluation_source: EvaluationSourceResponse | None = None
    live_analysis_session_id: str | None = None
    fen_after: str | None = None
    warnings: list[str] = []
    move: MoveResponse | None = None
    game: dict[str, Any] | None = None
