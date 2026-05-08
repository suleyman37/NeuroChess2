from __future__ import annotations

import json
from typing import Any

import chess

from neurochess.analysis_service import AnalysisService
from neurochess.metrics.try_move import (
    TRY_MOVE_MODEL_VERSION,
    build_try_move_payload,
    evaluate_try_move_attempt,
)
from neurochess.review_try_move_stabilization import (
    STABLE_ATTEMPT_EVALUATION_DEPTH,
    STABLE_ATTEMPT_EVALUATION_PROFILE,
    STABLE_ATTEMPT_EVALUATION_TIME_MS,
    enrich_annotation_with_stable_attempt_evaluation,
)


EXPLORER_MOVE_EVALUATION_MULTIPV = 5
EXPLORER_MOVE_EVALUATION_LIMIT_MODE = "time"
EXPLORER_MOVE_EVALUATION_SOURCE_CONTEXT = "review_explorer"


class ReviewExplorerEvaluationError(ValueError):
    pass


def evaluate_review_explorer_move(
    *,
    fen_before: str,
    move_uci: str,
    analysis_service: AnalysisService,
    source_context: str | None = None,
    game_id: int | None = None,
    review_moment_id: int | str | None = None,
) -> dict[str, Any]:
    board = _board_from_fen(fen_before)
    if board is None:
        raise ReviewExplorerEvaluationError("invalid_fen")

    move = _move_from_uci(move_uci)
    if move is None or move not in board.legal_moves:
        return _response_payload(
            legal=False,
            result="illegal",
            label=_label_for_result("illegal"),
            fen_before=fen_before,
            move_uci=move_uci,
            san=None,
            fen_after=None,
            stable_evaluation_status="illegal",
            feedback=None,
        )

    san = board.san(move)
    after_board = board.copy()
    after_board.push(move)
    fen_after = after_board.fen()
    normalized_context = source_context or EXPLORER_MOVE_EVALUATION_SOURCE_CONTEXT

    before_analysis = _run_bounded_before_analysis(analysis_service, fen_before)
    top_moves = _top_moves_from_analysis(before_analysis)
    best_move_uci = _best_move_uci(top_moves)
    if best_move_uci is None:
        return _response_payload(
            legal=True,
            result="needs_rebuild",
            label=_label_for_result("needs_rebuild"),
            fen_before=fen_before,
            move_uci=move.uci(),
            san=san,
            fen_after=fen_after,
            stable_evaluation_status="best_reference_unavailable",
            feedback=None,
        )

    try_payload = build_try_move_payload(
        fen_before=fen_before,
        side="white" if board.turn == chess.WHITE else "black",
        best_move_uci=best_move_uci,
        top_moves=top_moves,
    )
    annotation = {
        "fen_before": fen_before,
        "best_move_uci": best_move_uci,
        "best_move_san": _san_for_uci(board, best_move_uci),
        "top_moves": top_moves,
        "source_context": normalized_context,
        "review_moment_id": review_moment_id,
        "game_id": game_id,
        **try_payload,
    }
    feedback = evaluate_try_move_attempt(move.uci(), annotation)

    if feedback.get("reason_code") == "stable_evaluation_required_for_legal_out_of_list":
        enriched = enrich_annotation_with_stable_attempt_evaluation(
            annotation,
            move.uci(),
            analysis_service,
        )
        if enriched is not annotation:
            feedback = evaluate_try_move_attempt(move.uci(), enriched)

    result = str(feedback.get("result") or "unknown")
    evidence = feedback.get("evidence") if isinstance(feedback.get("evidence"), dict) else {}
    stable_available = isinstance(evidence.get("stable_attempt_evaluation"), dict)
    if result == "needs_rebuild":
        stable_status = (
            "stable_evaluation_unavailable"
            if feedback.get("reason_code") == "stable_evaluation_required_for_legal_out_of_list"
            else "needs_rebuild"
        )
    elif stable_available:
        stable_status = "stable_resulting_position"
    else:
        stable_status = "best_reference"

    return _response_payload(
        legal=True,
        result=result,
        label=_label_for_result(result),
        fen_before=fen_before,
        move_uci=move.uci(),
        san=san,
        fen_after=fen_after,
        stable_evaluation_status=stable_status,
        feedback=feedback,
    )


def _run_bounded_before_analysis(
    analysis_service: AnalysisService,
    fen: str,
) -> dict[str, Any] | None:
    settings = {
        "purpose": "review_explorer_move_evaluation",
        "requested_time_ms": STABLE_ATTEMPT_EVALUATION_TIME_MS,
        "requested_multipv": EXPLORER_MOVE_EVALUATION_MULTIPV,
        "analysis_limit_mode": EXPLORER_MOVE_EVALUATION_LIMIT_MODE,
        "analysis_profile": STABLE_ATTEMPT_EVALUATION_PROFILE,
        "no_practice_side_effects": True,
    }
    try:
        row = analysis_service.get_or_create_analysis(
            fen=fen,
            depth=STABLE_ATTEMPT_EVALUATION_DEPTH,
            multipv=EXPLORER_MOVE_EVALUATION_MULTIPV,
            kind="deep",
            analysis_profile=STABLE_ATTEMPT_EVALUATION_PROFILE,
            requested_time_ms=STABLE_ATTEMPT_EVALUATION_TIME_MS,
            requested_depth=STABLE_ATTEMPT_EVALUATION_DEPTH,
            requested_multipv=EXPLORER_MOVE_EVALUATION_MULTIPV,
            analysis_limit_mode=EXPLORER_MOVE_EVALUATION_LIMIT_MODE,
            settings_json=settings,
        )
        result = row
        if str(row.get("status") or "") != "done":
            result = analysis_service.run_analysis(int(row["id"])) or row
    except Exception:
        return None

    if str(result.get("status") or "") != "done":
        return None
    payload = result.get("analysis_json")
    return _parse_json(payload)


def _response_payload(
    *,
    legal: bool,
    result: str,
    label: str,
    fen_before: str,
    move_uci: str,
    san: str | None,
    fen_after: str | None,
    stable_evaluation_status: str,
    feedback: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "legal": legal,
        "result": result,
        "quality_id": result,
        "label": label,
        "san": san,
        "uci": move_uci,
        "fen_before": fen_before,
        "fen_after": fen_after,
        "stable_evaluation_status": stable_evaluation_status,
        "no_side_effects": True,
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
        "feedback": feedback,
    }


def _top_moves_from_analysis(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    top_moves = payload.get("top_moves") if isinstance(payload, dict) else None
    if not isinstance(top_moves, list):
        return []
    return [dict(entry) for entry in top_moves if isinstance(entry, dict) and entry.get("uci")]


def _best_move_uci(top_moves: list[dict[str, Any]]) -> str | None:
    if not top_moves:
        return None
    value = top_moves[0].get("uci")
    return str(value) if value else None


def _board_from_fen(fen: str) -> chess.Board | None:
    try:
        board = chess.Board(str(fen or ""))
    except ValueError:
        return None
    return board if board.is_valid() else None


def _move_from_uci(value: str) -> chess.Move | None:
    try:
        return chess.Move.from_uci(str(value or "").strip())
    except ValueError:
        return None


def _san_for_uci(board: chess.Board, uci: str | None) -> str | None:
    if not uci:
        return None
    move = _move_from_uci(uci)
    if move is None or move not in board.legal_moves:
        return None
    return board.san(move)


def _parse_json(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _label_for_result(result: str) -> str:
    normalized = str(result or "").strip().lower()
    return {
        "best": "Meilleure idée",
        "very_good": "Excellente idée",
        "acceptable": "Bonne idée",
        "playable": "Jouable",
        "imprecise": "À améliorer",
        "wrong": "À revoir",
        "illegal": "Coup illégal",
        "needs_rebuild": "À recalculer",
        "unknown": "Non évalué",
    }.get(normalized, "Non évalué")
