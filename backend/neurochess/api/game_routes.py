from __future__ import annotations

from dataclasses import asdict, is_dataclass
from email import policy
from email.parser import BytesParser
from typing import Any

import chess
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from neurochess.analysis_service import AnalysisService, InvalidFenError
from neurochess.api.schemas import (
    CreateGameRequest,
    DailyPlanRequest,
    FinishGameRequest,
    GameStateResponse,
    PlayMoveRequest,
    ProductCapabilitiesResponse,
    ReviewExplorerEvaluateLineRequest,
    ReviewExplorerEvaluateMoveRequest,
    RecordReviewPracticeAttemptRequest,
    ReviewTryMoveEvaluationRequest,
    StartLiveAnalysisRequest,
    StartReviewPracticeSessionRequest,
    StartReviewJobRequest,
    StopLiveAnalysisRequest,
)
from neurochess.capabilities import get_capabilities_manifest
from neurochess.core.evaluation_display import make_evaluation_display, to_json_safe
from neurochess.core.game_recorder import GameRecorder, GameRecorderError
from neurochess.core.game_session import GameSession, GameSessionError
from neurochess.data.repositories import Repository
from neurochess.live_analysis_service import (
    LiveAnalysisService,
    get_default_live_analysis_service,
)
from neurochess.metrics.try_move import evaluate_try_move_attempt
from neurochess.daily_plan_service import DailyPlanService
from neurochess.opening_service import OpeningService, OpeningServiceError
from neurochess.pgn_import_service import PgnImportService
from neurochess.privacy_service import UserDataConfirmationError, UserDataService
from neurochess.review_job_service import ReviewJobService
from neurochess.review_explorer_service import (
    ReviewExplorerEvaluationError,
    evaluate_review_explorer_line,
    evaluate_review_explorer_move,
)
from neurochess.review_practice_service import (
    ReviewPracticeService,
    ReviewPracticeServiceError,
)
from neurochess.review_service import ReviewService, ReviewServiceError
from neurochess.review_try_move_stabilization import (
    enrich_annotation_with_stable_attempt_evaluation,
)
from neurochess.training_item_service import TrainingItemService


ACTIVE_SESSIONS: dict[int, GameSession] = {}
SHALLOW_ANALYSIS_DEPTH = 8
SHALLOW_ANALYSIS_MULTIPV = 1
DEEP_ANALYSIS_DEPTH = 12
DEEP_ANALYSIS_MULTIPV = 3
ENGINE_UNAVAILABLE_WARNING = "analysis_engine_unavailable"
ENGINE_UNAVAILABLE_MESSAGE = (
    "Moteur d'analyse indisponible. Verifie le chemin Stockfish ou "
    "NEUROCHESS_STOCKFISH_PATH."
)


router = APIRouter()


def get_repository() -> Repository:
    return Repository()


def get_recorder(repository: Repository = Depends(get_repository)) -> GameRecorder:
    return GameRecorder(repository)


def get_analysis_service(
    repository: Repository = Depends(get_repository),
) -> AnalysisService:
    return AnalysisService(repository.db_path)


def get_live_analysis_service() -> LiveAnalysisService:
    return get_default_live_analysis_service()


def get_review_service(
    repository: Repository = Depends(get_repository),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> ReviewService:
    return ReviewService(repository.db_path, analysis_service=analysis_service)


def get_review_job_service(
    repository: Repository = Depends(get_repository),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    review_service: ReviewService = Depends(get_review_service),
) -> ReviewJobService:
    return ReviewJobService(
        repository.db_path,
        review_service=review_service,
        analysis_service=analysis_service,
    )


def get_review_practice_service(
    repository: Repository = Depends(get_repository),
    review_service: ReviewService = Depends(get_review_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> ReviewPracticeService:
    return ReviewPracticeService(
        repository.db_path,
        review_service=review_service,
        analysis_service=analysis_service,
    )


def get_opening_service(
    repository: Repository = Depends(get_repository),
) -> OpeningService:
    return OpeningService(repository.db_path)


def get_pgn_import_service(
    repository: Repository = Depends(get_repository),
) -> PgnImportService:
    return PgnImportService(repository.db_path)


def get_user_data_service(
    repository: Repository = Depends(get_repository),
) -> UserDataService:
    return UserDataService(repository.db_path)


def get_training_item_service(
    repository: Repository = Depends(get_repository),
) -> TrainingItemService:
    return TrainingItemService(repository.db_path)


def get_daily_plan_service(
    repository: Repository = Depends(get_repository),
) -> DailyPlanService:
    return DailyPlanService(repository.db_path)


def _ensure_training_items_for_review_payload(
    game_id: int,
    payload: dict[str, Any],
    training_item_service: TrainingItemService,
) -> dict[str, Any]:
    if payload.get("status") in {"done", "completed", "partial"}:
        training_items = training_item_service.ensure_training_items_for_game(
            game_id,
            review_payload=payload,
        )
        payload = dict(payload)
        payload["training_items_available"] = len(training_items)
    return payload


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "app": "NeuroChess 2",
        "version": "v3",
    }


@router.get("/api/export")
def export_user_data(
    user_data_service: UserDataService = Depends(get_user_data_service),
) -> dict[str, Any]:
    return user_data_service.export_user_data()


@router.delete("/api/user-data")
def delete_user_data(
    confirm: str | None = Query(None),
    user_data_service: UserDataService = Depends(get_user_data_service),
) -> dict[str, Any]:
    try:
        return user_data_service.delete_user_data(confirm=confirm)
    except UserDataConfirmationError as exc:
        raise HTTPException(
            status_code=400,
            detail="confirmation_required",
        ) from exc


@router.get("/capabilities", response_model=ProductCapabilitiesResponse)
def get_capabilities() -> dict[str, Any]:
    return get_capabilities_manifest()


@router.post("/games", response_model=GameStateResponse)
def create_game(
    request: CreateGameRequest | None = None,
    recorder: GameRecorder = Depends(get_recorder),
) -> dict[str, Any]:
    payload = request or CreateGameRequest()

    try:
        game_id = recorder.start_game(
            mode=payload.mode,
            opponent_type=payload.opponent_type,
            opponent_level=payload.opponent_level,
        )
    except GameRecorderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session = GameSession()
    ACTIVE_SESSIONS[game_id] = session

    return _game_state_payload(
        game_id=game_id,
        session=session,
        repository=recorder.repository,
        warnings=[],
    )


@router.get("/games", response_model=list[dict[str, Any]])
def list_games(repository: Repository = Depends(get_repository)) -> list[dict[str, Any]]:
    return [_game_list_item(game) for game in repository.list_games()]


@router.post("/games/import-pgn/preview")
async def preview_pgn_import(
    request: Request,
    pgn_import_service: PgnImportService = Depends(get_pgn_import_service),
) -> dict[str, Any]:
    payload = await _read_pgn_import_request(request)
    return pgn_import_service.preview_import(payload["pgn_text"])


@router.post("/games/import-pgn")
async def import_pgn_games(
    request: Request,
    pgn_import_service: PgnImportService = Depends(get_pgn_import_service),
) -> dict[str, Any]:
    payload = await _read_pgn_import_request(request)
    return pgn_import_service.import_pgn(
        payload["pgn_text"],
        user_alias=payload.get("user_alias"),
        platform=payload.get("platform") or "unknown",
    )


@router.get("/games/history")
def get_game_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    scope: str = Query("mine"),
    pgn_import_service: PgnImportService = Depends(get_pgn_import_service),
) -> list[dict[str, Any]]:
    return pgn_import_service.history(limit=limit, offset=offset, scope=scope)


@router.get("/games/{game_id}")
def get_game(
    game_id: int,
    recorder: GameRecorder = Depends(get_recorder),
) -> dict[str, Any]:
    try:
        session = _get_or_load_session(game_id, recorder)
        payload = _game_state_payload(
            game_id=game_id,
            session=session,
            repository=recorder.repository,
        )
        payload["game"] = recorder.get_game_with_moves(game_id)["game"]
        return payload
    except GameRecorderError as exc:
        raise _http_error_for_recorder(exc) from exc


@router.get("/games/{game_id}/moves")
def get_game_moves(
    game_id: int,
    repository: Repository = Depends(get_repository),
) -> dict[str, Any]:
    game = repository.get_game(game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game does not exist")

    moves = repository.get_moves_for_game(game_id)
    move_payloads = _move_history_payloads(moves)
    initial_fen = _initial_fen_for_game_payload(game, moves)
    current_fen = (
        move_payloads[-1]["fen_after"] if move_payloads else initial_fen
    )

    return {
        "game_id": game_id,
        "initial_fen": initial_fen,
        "current_fen": current_fen,
        "status": _history_status(game),
        "moves": move_payloads,
    }


@router.get("/games/{game_id}/diagnostics")
def get_game_diagnostics(
    game_id: int,
    pgn_import_service: PgnImportService = Depends(get_pgn_import_service),
) -> dict[str, Any]:
    try:
        return pgn_import_service.game_diagnostics(game_id)
    except ValueError as exc:
        if "game not found" in str(exc):
            raise HTTPException(status_code=404, detail="Game does not exist") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/games/{game_id}/moves")
def play_move(
    game_id: int,
    request: PlayMoveRequest,
    background_tasks: BackgroundTasks,
    recorder: GameRecorder = Depends(get_recorder),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> dict[str, Any]:
    try:
        session = _get_or_load_session(game_id, recorder)
        move_data = recorder.play_move(
            game_id=game_id,
            session=session,
            uci=request.uci,
            is_player=request.is_player,
            time_spent=request.time_spent,
        )
    except GameSessionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GameRecorderError as exc:
        raise _http_error_for_recorder(exc) from exc

    fen_after = session.current_fen()
    evaluation_display, evaluation_source, warnings = _try_shallow_engine_evaluation(
        fen_after,
        analysis_service,
    )

    try:
        deep_analysis = analysis_service.get_or_create_analysis(
            fen=fen_after,
            depth=DEEP_ANALYSIS_DEPTH,
            multipv=DEEP_ANALYSIS_MULTIPV,
            kind="deep",
        )
    except InvalidFenError as exc:
        raise HTTPException(status_code=400, detail="invalid_fen") from exc
    else:
        if deep_analysis["status"] == "pending":
            background_tasks.add_task(analysis_service.process_pending_analyses, 10)

    live_analysis_session_id = _try_start_live_analysis(
        fen=fen_after,
        game_id=game_id,
        ply=_move_ply(move_data),
        live_analysis_service=live_analysis_service,
        warnings=warnings,
    )

    return _game_state_payload(
        game_id=game_id,
        session=session,
        repository=recorder.repository,
        move=move_data,
        evaluation_display=evaluation_display,
        evaluation_source=evaluation_source,
        live_analysis_session_id=live_analysis_session_id,
        fen_after=fen_after,
        warnings=warnings,
    )


@router.get("/analyses/by-fen")
def get_analysis_by_fen(
    fen: str = Query(...),
    kind: str = Query("deep"),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> Any:
    try:
        analysis = analysis_service.get_analysis_by_fen(fen, kind=kind)
    except InvalidFenError as exc:
        raise HTTPException(status_code=400, detail="invalid_fen") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis["status"] in {"pending", "running"}:
        return JSONResponse(status_code=202, content=analysis)

    if analysis["status"] == "failed":
        return JSONResponse(status_code=409, content=analysis)

    return analysis


@router.get("/games/{game_id}/analyses")
def get_game_analyses(
    game_id: int,
    recorder: GameRecorder = Depends(get_recorder),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> dict[str, Any]:
    try:
        recorder.get_game_with_moves(game_id)
    except GameRecorderError as exc:
        raise _http_error_for_recorder(exc) from exc

    return {
        "game_id": game_id,
        "analyses": analysis_service.get_game_deep_analyses(game_id),
    }


@router.post("/games/{game_id}/review/generate")
def generate_game_review(
    game_id: int,
    background_tasks: BackgroundTasks,
    force_retry_failed: bool = Query(False),
    profile: str = Query("standard"),
    review_service: ReviewService = Depends(get_review_service),
    training_item_service: TrainingItemService = Depends(get_training_item_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> Any:
    if str(profile).lower() in {"standard", "deep"}:
        live_analysis_service.stop_sessions_for_game(game_id)
    try:
        payload = review_service.generate_review(
            game_id,
            force_retry_failed=force_retry_failed,
            profile=profile,
        )
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if payload["status"] == "pending" and payload.get("review_work_active"):
        background_tasks.add_task(
            analysis_service.process_pending_analyses,
            _review_analysis_batch_limit(payload),
        )
        return JSONResponse(status_code=202, content=payload)

    return _ensure_training_items_for_review_payload(
        game_id,
        payload,
        training_item_service,
    )


@router.post("/games/{game_id}/review/jobs")
def start_review_job(
    game_id: int,
    request: StartReviewJobRequest,
    background_tasks: BackgroundTasks,
    review_job_service: ReviewJobService = Depends(get_review_job_service),
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> Any:
    if str(request.profile).lower() in {"standard", "deep"}:
        live_analysis_service.stop_sessions_for_game(game_id)
    try:
        payload = review_job_service.start_job(
            game_id,
            profile=request.profile,
            force_reanalysis=request.force_reanalysis,
        )
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if payload["status"] in {"queued", "running", "finalizing"}:
        background_tasks.add_task(review_job_service.run_job, payload["job_id"])
    return JSONResponse(status_code=202 if payload["status"] != "completed" else 200, content=payload)


@router.get("/review/jobs/{job_id}")
def get_review_job_status(
    job_id: str,
    review_job_service: ReviewJobService = Depends(get_review_job_service),
) -> Any:
    try:
        return review_job_service.get_job(job_id)
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/review/jobs/{job_id}/diagnostics")
def get_review_job_diagnostics(
    job_id: str,
    review_job_service: ReviewJobService = Depends(get_review_job_service),
) -> Any:
    try:
        return review_job_service.get_job_diagnostics(job_id)
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/jobs/{job_id}/reconcile")
def reconcile_review_job(
    job_id: str,
    review_job_service: ReviewJobService = Depends(get_review_job_service),
) -> Any:
    try:
        return review_job_service.reconcile_review_job(job_id)
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/jobs/{job_id}/cancel")
def cancel_review_job(
    job_id: str,
    review_job_service: ReviewJobService = Depends(get_review_job_service),
) -> Any:
    try:
        return review_job_service.cancel_job(job_id)
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/games/{game_id}/review")
def get_game_review(
    game_id: int,
    profile: str = Query("standard"),
    review_service: ReviewService = Depends(get_review_service),
    training_item_service: TrainingItemService = Depends(get_training_item_service),
) -> dict[str, Any]:
    try:
        payload = review_service.get_review(game_id, profile=profile)
        return _ensure_training_items_for_review_payload(
            game_id,
            payload,
            training_item_service,
        )
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/games/{game_id}/review/rebuild-metrics")
def rebuild_game_review_metrics(
    game_id: int,
    profile: str = Query("standard"),
    review_service: ReviewService = Depends(get_review_service),
    training_item_service: TrainingItemService = Depends(get_training_item_service),
) -> dict[str, Any]:
    try:
        payload = review_service.rebuild_review_metrics_from_cached_analyses(
            game_id,
            profile=profile,
        )
        return _ensure_training_items_for_review_payload(
            game_id,
            payload,
            training_item_service,
        )
    except ReviewServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/api/training/daily-plan/today")
def get_daily_plan_today(
    daily_plan_service: DailyPlanService = Depends(get_daily_plan_service),
) -> dict[str, Any]:
    return daily_plan_service.get_today_plan()


@router.post("/api/training/daily-plan")
def create_daily_plan(
    request: DailyPlanRequest,
    daily_plan_service: DailyPlanService = Depends(get_daily_plan_service),
) -> dict[str, Any]:
    return daily_plan_service.create_or_get_today_plan(
        max_items=request.max_items or 6,
        duration_preference=request.duration_preference,
    )


@router.post("/api/training/daily-plan/practice")
def start_daily_plan_practice_session(
    request: DailyPlanRequest,
    daily_plan_service: DailyPlanService = Depends(get_daily_plan_service),
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    items, plan = daily_plan_service.create_plan_practice_items(
        max_items=request.max_items or 6,
    )
    try:
        session = practice_service.create_session_from_training_items(
            items,
            scope="daily_plan",
        )
        session["daily_plan"] = plan
        return session
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            payload = dict(exc.payload)
            payload["daily_plan"] = plan
            return JSONResponse(status_code=exc.status_code, content=payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/games/{game_id}/review/practice/sessions")
def start_review_practice_session(
    game_id: int,
    request: StartReviewPracticeSessionRequest,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.create_session(
            game_id,
            pov=request.pov,
            scope=request.scope,
            max_items=request.max_items,
        )
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/games/{game_id}/review/practice/sessions")
def list_review_practice_sessions(
    game_id: int,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.list_sessions_for_game(game_id)
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/games/{game_id}/review/practice/revisions")
def start_due_review_practice_session(
    game_id: int,
    request: StartReviewPracticeSessionRequest,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.create_due_review_session(
            game_id,
            pov=request.pov,
            max_items=request.max_items,
        )
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/review/practice/sessions/{session_id}")
def get_review_practice_session(
    session_id: int,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.get_session(session_id)
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/practice/sessions/{session_id}/attempts")
def record_review_practice_attempt(
    session_id: int,
    request: RecordReviewPracticeAttemptRequest,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.record_attempt(
            session_id,
            ply=request.ply,
            attempted_uci=request.attempted_uci,
            result=request.result,
            time_spent_ms=request.time_spent_ms,
            hint_used=request.hint_used,
            reveal_used=request.reveal_used,
            source_context=request.source_context,
        )
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/try-move/evaluate")
def evaluate_review_try_move(
    request: ReviewTryMoveEvaluationRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> Any:
    payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
    move_played = str(payload.pop("move_played") or "")
    feedback = evaluate_try_move_attempt(move_played, payload)
    if feedback.get("reason_code") == "stable_evaluation_required_for_legal_out_of_list":
        enriched = enrich_annotation_with_stable_attempt_evaluation(
            payload,
            move_played,
            analysis_service,
        )
        if enriched is not payload:
            feedback = evaluate_try_move_attempt(move_played, enriched)
    return feedback


@router.post("/api/review/explorer/evaluate-move")
def evaluate_review_explorer_move_endpoint(
    request: ReviewExplorerEvaluateMoveRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> Any:
    try:
        return evaluate_review_explorer_move(
            fen_before=request.fen_before,
            move_uci=request.move_uci,
            analysis_service=analysis_service,
            analysis_preset=request.analysis_preset or "standard",
            source_context=request.source_context,
            game_id=request.game_id,
            review_moment_id=request.review_moment_id,
        )
    except ReviewExplorerEvaluationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/review/explorer/evaluate-line")
def evaluate_review_explorer_line_endpoint(
    request: ReviewExplorerEvaluateLineRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> Any:
    try:
        return evaluate_review_explorer_line(
            fen_start=request.fen_start,
            moves_uci=request.moves_uci,
            analysis_service=analysis_service,
            analysis_preset=request.analysis_preset or "standard",
            source_context=request.source_context,
            game_id=request.game_id,
            review_moment_id=request.review_moment_id,
        )
    except ReviewExplorerEvaluationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/review/practice/sessions/{session_id}/abandon")
def abandon_review_practice_session(
    session_id: int,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.abandon_session(session_id)
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/practice/sessions/{session_id}/retry-failed")
def retry_failed_review_practice_session(
    session_id: int,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.retry_failed_session(session_id)
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/review/practice/sessions/{session_id}/complete")
def complete_review_practice_session(
    session_id: int,
    practice_service: ReviewPracticeService = Depends(get_review_practice_service),
) -> Any:
    try:
        return practice_service.complete_session(session_id)
    except ReviewPracticeServiceError as exc:
        if exc.payload is not None:
            return JSONResponse(status_code=exc.status_code, content=exc.payload)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _review_analysis_batch_limit(payload: dict[str, Any]) -> int:
    try:
        required_count = int(payload.get("total_required_deep_count") or 0)
    except (TypeError, ValueError):
        required_count = 0
    return max(10, required_count)


@router.post("/openings/import-seed")
def import_opening_seed_endpoint(
    opening_service: OpeningService = Depends(get_opening_service),
) -> dict[str, Any]:
    try:
        return opening_service.import_opening_seed()
    except OpeningServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/openings/import-book")
def import_opening_book_endpoint(
    opening_service: OpeningService = Depends(get_opening_service),
) -> dict[str, Any]:
    try:
        return opening_service.import_opening_book()
    except OpeningServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/games/{game_id}/opening/classify")
def classify_game_opening_endpoint(
    game_id: int,
    opening_service: OpeningService = Depends(get_opening_service),
) -> dict[str, Any]:
    try:
        return opening_service.classify_game_opening(game_id)
    except OpeningServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/games/{game_id}/opening")
def get_game_opening_endpoint(
    game_id: int,
    opening_service: OpeningService = Depends(get_opening_service),
) -> dict[str, Any]:
    try:
        return opening_service.get_game_opening(game_id)
    except OpeningServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/live-analysis/start")
def start_live_analysis(
    request: StartLiveAnalysisRequest,
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> dict[str, Any]:
    try:
        session_id = live_analysis_service.start_session(
            fen=request.fen,
            game_id=request.game_id,
            ply=request.ply,
            context=request.context,
            review_moment_id=request.review_moment_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid_fen") from exc

    return {
        "session_id": session_id,
        "fen": request.fen,
        "context": request.context or "live",
        "status": "started",
        "latest_payload": live_analysis_service.wait_for_latest(session_id),
    }


@router.post("/live-analysis/stop")
def stop_live_analysis(
    request: StopLiveAnalysisRequest,
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> dict[str, Any]:
    return live_analysis_service.stop_session(request.session_id)


@router.get("/live-analysis/stream")
def stream_live_analysis(
    session_id: str = Query(...),
    live_analysis_service: LiveAnalysisService = Depends(get_live_analysis_service),
) -> StreamingResponse:
    return StreamingResponse(
        live_analysis_service.stream_session(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _read_pgn_import_request(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")
    payload: dict[str, Any] = {
        "pgn_text": "",
        "user_alias": None,
        "platform": "unknown",
    }

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="invalid_json") from exc
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="invalid_json")
        payload["pgn_text"] = str(body.get("pgn_text") or "")
        payload["user_alias"] = body.get("user_alias")
        payload["platform"] = body.get("platform") or "unknown"
    elif "multipart/form-data" in content_type:
        if _multipart_parser_available():
            form = await request.form()
            file = form.get("file")
            pgn_text = form.get("pgn_text")
            if file is not None and hasattr(file, "read"):
                raw = await file.read()  # type: ignore[union-attr]
                payload["pgn_text"] = raw.decode("utf-8", errors="replace")
            elif pgn_text is not None:
                payload["pgn_text"] = str(pgn_text)
            payload["user_alias"] = form.get("user_alias")
            payload["platform"] = form.get("platform") or "unknown"
        else:
            payload.update(
                _read_multipart_pgn_payload(
                    content_type=content_type,
                    raw_body=await request.body(),
                )
            )
    else:
        raw = await request.body()
        payload["pgn_text"] = raw.decode("utf-8", errors="replace")

    if not str(payload["pgn_text"]).strip():
        raise HTTPException(status_code=400, detail="pgn_text_required")
    return payload


def _multipart_parser_available() -> bool:
    try:
        __import__("multipart")
    except ModuleNotFoundError:
        return False
    return True


def _read_multipart_pgn_payload(
    content_type: str,
    raw_body: bytes,
) -> dict[str, Any]:
    message = BytesParser(policy=policy.default).parsebytes(
        (
            f"Content-Type: {content_type}\r\n"
            "MIME-Version: 1.0\r\n"
            "\r\n"
        ).encode("utf-8")
        + raw_body
    )
    if not message.is_multipart():
        raise HTTPException(status_code=400, detail="invalid_multipart")

    fields: dict[str, str] = {}
    for part in message.iter_parts():
        params = part.get_params(header="content-disposition", unquote=True) or []
        disposition_params = {
            str(key): str(value)
            for key, value in params[1:]
            if key and value is not None
        }
        name = disposition_params.get("name")
        if not name:
            continue
        raw_value = part.get_payload(decode=True) or b""
        fields[name] = raw_value.decode("utf-8", errors="replace")

    return {
        "pgn_text": fields.get("file") or fields.get("pgn_text") or "",
        "user_alias": fields.get("user_alias"),
        "platform": fields.get("platform") or "unknown",
    }


@router.post("/games/{game_id}/finish")
def finish_game(
    game_id: int,
    request: FinishGameRequest | None = None,
    recorder: GameRecorder = Depends(get_recorder),
) -> dict[str, Any]:
    try:
        session = _get_or_load_session(game_id, recorder)
        recorder.finish_game(
            game_id=game_id,
            session=session,
            result=request.result if request is not None else None,
        )
        ACTIVE_SESSIONS.pop(game_id, None)
        payload = _game_state_payload(
            game_id=game_id,
            session=session,
            repository=recorder.repository,
        )
        payload["game"] = recorder.get_game_with_moves(game_id)["game"]
        return payload
    except GameRecorderError as exc:
        raise _http_error_for_recorder(exc) from exc


def _get_or_load_session(game_id: int, recorder: GameRecorder) -> GameSession:
    session = ACTIVE_SESSIONS.get(game_id)

    if session is not None:
        return session

    session = recorder.load_session(game_id)
    ACTIVE_SESSIONS[game_id] = session
    return session


def _game_state_payload(
    game_id: int,
    session: GameSession,
    repository: Repository,
    move: dict[str, Any] | None = None,
    evaluation_display: dict[str, Any] | None = None,
    evaluation_source: dict[str, Any] | None = None,
    live_analysis_session_id: str | None = None,
    fen_after: str | None = None,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    moves = [_to_json_dict(item) for item in repository.get_moves_for_game(game_id)]

    return {
        "game_id": game_id,
        "fen": session.current_fen(),
        "legal_moves": session.legal_moves_uci(),
        "moves": moves,
        "result": session.result(),
        "is_game_over": session.is_game_over(),
        "evaluation": evaluation_display,
        "evaluation_display": evaluation_display,
        "evaluation_source": evaluation_source,
        "live_analysis_session_id": live_analysis_session_id,
        "fen_after": fen_after,
        "warnings": warnings or [],
        "move": move,
        "game": None,
    }


def _try_shallow_engine_evaluation(
    fen: str,
    analysis_service: AnalysisService,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    try:
        analysis = analysis_service.get_or_create_analysis(
            fen=fen,
            depth=SHALLOW_ANALYSIS_DEPTH,
            multipv=SHALLOW_ANALYSIS_MULTIPV,
            kind="shallow",
            analysis_profile="quick",
            requested_multipv=SHALLOW_ANALYSIS_MULTIPV,
            analysis_limit_mode="mixed",
            settings_json={
                "analysis_profile": "quick",
                "analysis_limit_mode": "mixed",
                "requested_multipv": SHALLOW_ANALYSIS_MULTIPV,
                "threads": 2,
                "hash_mb": 256,
            },
        )

        if analysis["status"] == "pending":
            analysis = analysis_service.run_analysis(analysis["id"]) or analysis

        if analysis["status"] != "done":
            return None, None, [ENGINE_UNAVAILABLE_WARNING]

        analysis_json = analysis["analysis_json"]
        display = make_evaluation_display(
            eval_cp=analysis_json.get("eval_cp"),
            mate_in=analysis_json.get("mate_in"),
        )
        display_payload = to_json_safe(display)
        source = {
            "kind": "shallow",
            "depth": analysis_json.get("depth") or analysis.get("depth"),
            "time_ms": analysis_json.get("analysis_time_ms")
            or analysis.get("analysis_time_ms"),
            "nodes": None,
            "engine_version": analysis_json.get("engine_version")
            or analysis.get("engine_version")
            or "unknown",
        }
        return (
            {
                "white_percent": display_payload["white_percent"],
                "black_percent": display_payload["black_percent"],
                "label": display_payload["label"],
                "is_mate": display_payload["is_mate"],
                "advantage_side": display_payload["advantage_side"],
                "magnitude": display_payload["magnitude"],
            },
            source,
            [],
        )
    except InvalidFenError:
        return None, None, ["invalid_fen"]
    except Exception:
        return None, None, [ENGINE_UNAVAILABLE_WARNING]


def _try_start_live_analysis(
    fen: str,
    game_id: int,
    ply: int | None,
    live_analysis_service: LiveAnalysisService,
    warnings: list[str],
) -> str | None:
    try:
        live_analysis_service.stop_sessions_for_game(game_id)
        return live_analysis_service.start_session(
            fen=fen,
            game_id=game_id,
            ply=ply,
            context="live",
        )
    except Exception:
        warnings.append("live_analysis_unavailable")
        return None


def _move_ply(move_data: dict[str, Any]) -> int | None:
    try:
        return int(_to_json_dict(move_data).get("ply"))
    except (TypeError, ValueError):
        return None


def _move_history_payloads(moves: list[Any]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for move in moves:
        fen_before = move.fen_before
        board = chess.Board(fen_before)
        played_move = chess.Move.from_uci(move.uci)
        side_to_move_before = "white" if board.turn == chess.WHITE else "black"
        next_board = board.copy()
        next_board.push(played_move)
        payloads.append(
            {
                "ply": move.ply,
                "side_to_move_before": side_to_move_before,
                "played_uci": move.uci,
                "played_san": move.san,
                "fen_before": fen_before,
                "fen_after": next_board.fen(),
            }
        )
    return payloads


def _history_status(game: Any) -> str:
    if not bool(game.completed):
        return "in_progress"
    if game.result == "*":
        return "manually_terminated"
    return "finished"


def _initial_fen_for_game_payload(game: Any, moves: list[Any]) -> str:
    initial_fen = getattr(game, "initial_fen", None)
    if isinstance(initial_fen, str) and initial_fen.strip():
        return initial_fen.strip()
    if moves:
        first_fen = getattr(moves[0], "fen_before", None)
        if isinstance(first_fen, str) and first_fen.strip():
            return first_fen.strip()
    return chess.STARTING_FEN


def _game_list_item(game: Any) -> dict[str, Any]:
    payload = _to_json_dict(game)
    payload.pop("pgn", None)
    payload["completed"] = int(bool(payload["completed"]))
    return payload


def _to_json_dict(value: Any) -> dict[str, Any]:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return dict(value)
    if hasattr(value, "__dict__"):
        return dict(vars(value))
    raise TypeError(f"Cannot serialize value: {type(value).__name__}")


def _http_error_for_recorder(exc: GameRecorderError) -> HTTPException:
    message = str(exc)
    status_code = 404 if "does not exist" in message else 400
    return HTTPException(status_code=status_code, detail=message)
