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
EXPLORER_LINE_MAX_PLIES = 12
EXPLORER_ANALYSIS_PRESETS: dict[str, dict[str, Any]] = {
    "fast": {
        "requested_time_ms": 700,
        "analysis_profile": "quick",
        "label": "Rapide",
    },
    "standard": {
        "requested_time_ms": STABLE_ATTEMPT_EVALUATION_TIME_MS,
        "analysis_profile": STABLE_ATTEMPT_EVALUATION_PROFILE,
        "label": "Standard",
    },
    "deep": {
        "requested_time_ms": 2400,
        "analysis_profile": "deep",
        "label": "Précise",
    },
}


class ReviewExplorerEvaluationError(ValueError):
    pass


def evaluate_review_explorer_move(
    *,
    fen_before: str,
    move_uci: str,
    analysis_service: AnalysisService,
    analysis_preset: str = "standard",
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
            source_context=source_context,
            analysis_preset=analysis_preset,
        )

    san = board.san(move)
    after_board = board.copy()
    after_board.push(move)
    fen_after = after_board.fen()
    normalized_context = source_context or EXPLORER_MOVE_EVALUATION_SOURCE_CONTEXT
    preset = _normalize_analysis_preset(analysis_preset)

    before_analysis = _run_bounded_before_analysis(
        analysis_service,
        fen_before,
        analysis_preset=preset,
    )
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
            source_context=normalized_context,
            analysis_preset=preset,
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
            requested_time_ms=int(EXPLORER_ANALYSIS_PRESETS[preset]["requested_time_ms"]),
            analysis_profile=str(EXPLORER_ANALYSIS_PRESETS[preset]["analysis_profile"]),
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
        source_context=normalized_context,
        analysis_preset=preset,
    )


def evaluate_review_explorer_line(
    *,
    fen_start: str,
    moves_uci: list[str],
    analysis_service: AnalysisService,
    analysis_preset: str = "standard",
    source_context: str | None = None,
    game_id: int | None = None,
    review_moment_id: int | str | None = None,
) -> dict[str, Any]:
    board = _board_from_fen(fen_start)
    if board is None:
        raise ReviewExplorerEvaluationError("invalid_fen")
    preset = _normalize_analysis_preset(analysis_preset)
    normalized_context = source_context or EXPLORER_MOVE_EVALUATION_SOURCE_CONTEXT
    normalized_moves = [str(move or "").strip() for move in moves_uci if str(move or "").strip()]
    if not normalized_moves:
        return _line_response_payload(
            status="error",
            line_length=0,
            final_fen=board.fen(),
            per_move_results=[],
            final_quality="unknown",
            final_badge="unknown",
            message="Aucun coup à analyser dans cette ligne.",
            analysis_preset=preset,
            illegal_move_index=None,
            illegal_move_uci=None,
        )
    if len(normalized_moves) > EXPLORER_LINE_MAX_PLIES:
        return _line_response_payload(
            status="error",
            line_length=len(normalized_moves),
            final_fen=board.fen(),
            per_move_results=[],
            final_quality="unknown",
            final_badge="unknown",
            message=f"Ligne trop longue pour cette version : {EXPLORER_LINE_MAX_PLIES} demi-coups maximum.",
            analysis_preset=preset,
            illegal_move_index=None,
            illegal_move_uci=None,
        )

    per_move_results: list[dict[str, Any]] = []
    for index, move_uci in enumerate(normalized_moves, start=1):
        move = _move_from_uci(move_uci)
        if move is None or move not in board.legal_moves:
            return _line_response_payload(
                status="illegal",
                line_length=len(normalized_moves),
                final_fen=board.fen(),
                per_move_results=per_move_results,
                final_quality="illegal",
                final_badge="illegal",
                message=f"Coup illégal dans la ligne au demi-coup {index}.",
                analysis_preset=preset,
                illegal_move_index=index,
                illegal_move_uci=move_uci,
            )

        fen_before = board.fen()
        san = board.san(move)
        move_result = evaluate_review_explorer_move(
            fen_before=fen_before,
            move_uci=move_uci,
            analysis_service=analysis_service,
            analysis_preset=preset,
            source_context=normalized_context,
            game_id=game_id,
            review_moment_id=review_moment_id,
        )
        per_move_results.append(
            {
                "move_index": index,
                "uci": move_result.get("uci") or move_uci,
                "san": move_result.get("san") or san,
                "fen_before": fen_before,
                "fen_after": move_result.get("fen_after"),
                "result": move_result.get("result"),
                "quality_id": move_result.get("quality_id"),
                "label": move_result.get("label"),
                "stable_evaluation_status": move_result.get("stable_evaluation_status"),
                "no_side_effects": move_result.get("no_side_effects") is True,
            }
        )
        board.push(move)

    final_result = per_move_results[-1]
    final_quality = str(final_result.get("result") or "unknown")
    status = "needs_rebuild" if final_quality in {"needs_rebuild", "unknown"} else "ok"
    message = (
        "La ligne a été évaluée localement."
        if status == "ok"
        else "La ligne doit être recalculée pour donner un retour fiable."
    )
    return _line_response_payload(
        status=status,
        line_length=len(normalized_moves),
        final_fen=board.fen(),
        per_move_results=per_move_results,
        final_quality=final_quality,
        final_badge=str(final_result.get("quality_id") or final_quality),
        message=message,
        analysis_preset=preset,
        illegal_move_index=None,
        illegal_move_uci=None,
    )


def _run_bounded_before_analysis(
    analysis_service: AnalysisService,
    fen: str,
    *,
    analysis_preset: str = "standard",
) -> dict[str, Any] | None:
    preset = _normalize_analysis_preset(analysis_preset)
    preset_settings = EXPLORER_ANALYSIS_PRESETS[preset]
    settings = {
        "purpose": "review_explorer_move_evaluation",
        "requested_time_ms": preset_settings["requested_time_ms"],
        "requested_multipv": EXPLORER_MOVE_EVALUATION_MULTIPV,
        "analysis_limit_mode": EXPLORER_MOVE_EVALUATION_LIMIT_MODE,
        "analysis_profile": preset_settings["analysis_profile"],
        "analysis_preset": preset,
        "no_practice_side_effects": True,
    }
    try:
        row = analysis_service.get_or_create_analysis(
            fen=fen,
            depth=STABLE_ATTEMPT_EVALUATION_DEPTH,
            multipv=EXPLORER_MOVE_EVALUATION_MULTIPV,
            kind="deep",
            analysis_profile=str(preset_settings["analysis_profile"]),
            requested_time_ms=int(preset_settings["requested_time_ms"]),
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
    source_context: str | None,
    analysis_preset: str,
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
        "source_context": source_context or EXPLORER_MOVE_EVALUATION_SOURCE_CONTEXT,
        "analysis_preset": _normalize_analysis_preset(analysis_preset),
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
        "feedback": feedback,
    }


def _line_response_payload(
    *,
    status: str,
    line_length: int,
    final_fen: str | None,
    per_move_results: list[dict[str, Any]],
    final_quality: str,
    final_badge: str,
    message: str,
    analysis_preset: str,
    illegal_move_index: int | None,
    illegal_move_uci: str | None,
) -> dict[str, Any]:
    payload = {
        "status": status,
        "line_length": line_length,
        "final_fen": final_fen,
        "per_move_results": per_move_results,
        "final_quality": final_quality,
        "final_badge": final_badge,
        "message": message,
        "no_side_effects": True,
        "analysis_preset": _normalize_analysis_preset(analysis_preset),
        "max_line_plies": EXPLORER_LINE_MAX_PLIES,
    }
    if illegal_move_index is not None:
        payload["illegal_move_index"] = illegal_move_index
    if illegal_move_uci is not None:
        payload["illegal_move_uci"] = illegal_move_uci
    return payload


def _normalize_analysis_preset(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in EXPLORER_ANALYSIS_PRESETS else "standard"


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
