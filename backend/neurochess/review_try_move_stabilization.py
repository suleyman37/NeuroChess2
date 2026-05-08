from __future__ import annotations

import json
from contextlib import closing
from typing import Any

import chess

from neurochess.analysis_service import AnalysisService
from neurochess.data.database import get_connection


STABLE_ATTEMPT_EVALUATION_TIME_MS = 1200
STABLE_ATTEMPT_EVALUATION_DEPTH = 812
STABLE_ATTEMPT_EVALUATION_MULTIPV = 1
STABLE_ATTEMPT_EVALUATION_PROFILE = "quick"
STABLE_ATTEMPT_EVALUATION_LIMIT_MODE = "time"


def enrich_annotation_with_stable_attempt_evaluation(
    annotation: dict[str, Any],
    attempt_move: str | None,
    analysis_service: AnalysisService | None,
    *,
    requested_time_ms: int = STABLE_ATTEMPT_EVALUATION_TIME_MS,
    analysis_profile: str = STABLE_ATTEMPT_EVALUATION_PROFILE,
    requested_multipv: int = STABLE_ATTEMPT_EVALUATION_MULTIPV,
) -> dict[str, Any]:
    """Attach a bounded stabilized eval for a legal out-of-list attempt.

    This uses the existing analysis pipeline on the resulting position. It does
    not read live analysis, and it does not classify from intermediate engine
    samples.
    """

    if analysis_service is None or not attempt_move:
        return annotation
    board = _board_from_fen(annotation.get("fen_before"))
    if board is None:
        return annotation
    move = _move_from_notation(board, attempt_move)
    if move is None:
        return annotation

    board.push(move)
    fen_after = board.fen()
    stable = _cached_stable_eval(analysis_service, fen_after)
    if stable is None:
        stable = _run_bounded_stable_eval(
            analysis_service,
            fen_after,
            requested_time_ms=requested_time_ms,
            analysis_profile=analysis_profile,
            requested_multipv=requested_multipv,
        )
    if stable is None:
        return annotation

    enriched = dict(annotation)
    stable_payload = dict(stable)
    stable_payload["uci"] = move.uci()
    stable_payload["fen_after"] = fen_after
    enriched["stable_attempt_evaluation"] = stable_payload
    return enriched


def _cached_stable_eval(
    analysis_service: AnalysisService,
    fen: str,
) -> dict[str, Any] | None:
    try:
        with closing(get_connection(analysis_service.db_path)) as connection:
            row = connection.execute(
                """
                SELECT id, analysis_json, analysis_profile, requested_time_ms,
                       requested_multipv, analysis_limit_mode
                FROM position_analyses
                WHERE fen = ?
                  AND status = 'done'
                  AND analysis_kind = 'deep'
                ORDER BY
                  CASE COALESCE(analysis_profile, '')
                    WHEN 'deep' THEN 0
                    WHEN 'standard' THEN 1
                    WHEN 'quick' THEN 2
                    ELSE 3
                  END,
                  COALESCE(requested_time_ms, 0) DESC,
                  COALESCE(requested_multipv, 0) DESC,
                  id DESC
                LIMIT 1
                """,
                (fen,),
            ).fetchone()
    except Exception:
        return None
    if row is None:
        return None
    payload = _parse_json(row["analysis_json"])
    stable = _stable_eval_from_analysis_json(payload)
    if stable is None:
        return None
    stable.update(
        source_kind="cached_resulting_position_analysis",
        analysis_id=int(row["id"]),
        requested_time_ms=row["requested_time_ms"],
        requested_multipv=row["requested_multipv"],
        analysis_limit_mode=row["analysis_limit_mode"],
    )
    return stable


def _run_bounded_stable_eval(
    analysis_service: AnalysisService,
    fen: str,
    *,
    requested_time_ms: int = STABLE_ATTEMPT_EVALUATION_TIME_MS,
    analysis_profile: str = STABLE_ATTEMPT_EVALUATION_PROFILE,
    requested_multipv: int = STABLE_ATTEMPT_EVALUATION_MULTIPV,
) -> dict[str, Any] | None:
    settings = {
        "purpose": "try_move_stable_attempt_evaluation",
        "requested_time_ms": requested_time_ms,
        "requested_multipv": requested_multipv,
        "analysis_limit_mode": STABLE_ATTEMPT_EVALUATION_LIMIT_MODE,
        "analysis_profile": analysis_profile,
    }
    try:
        row = analysis_service.get_or_create_analysis(
            fen=fen,
            depth=STABLE_ATTEMPT_EVALUATION_DEPTH,
            multipv=requested_multipv,
            kind="deep",
            analysis_profile=analysis_profile,
            requested_time_ms=requested_time_ms,
            requested_depth=STABLE_ATTEMPT_EVALUATION_DEPTH,
            requested_multipv=requested_multipv,
            analysis_limit_mode=STABLE_ATTEMPT_EVALUATION_LIMIT_MODE,
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
    if not isinstance(payload, dict):
        payload = _parse_json(payload)
    stable = _stable_eval_from_analysis_json(payload)
    if stable is None:
        return None
    stable.update(
        source_kind="bounded_resulting_position_analysis",
        analysis_id=int(result.get("id") or 0) or None,
        requested_time_ms=STABLE_ATTEMPT_EVALUATION_TIME_MS,
        requested_multipv=STABLE_ATTEMPT_EVALUATION_MULTIPV,
        analysis_limit_mode=STABLE_ATTEMPT_EVALUATION_LIMIT_MODE,
    )
    return stable


def _stable_eval_from_analysis_json(payload: dict[str, Any]) -> dict[str, Any] | None:
    stable = payload.get("stabilized_eval")
    if isinstance(stable, dict):
        eval_cp = _optional_int(stable.get("final_eval_cp"))
        mate_in = _optional_int(stable.get("final_mate_in"))
        if eval_cp is not None or mate_in is not None:
            return {
                "eval_cp": eval_cp,
                "mate_in": mate_in,
                "reliability_score": stable.get("reliability_score"),
                "reliability_label": stable.get("reliability_label"),
            }

    top_moves = payload.get("top_moves")
    if isinstance(top_moves, list) and top_moves:
        first = top_moves[0]
        if isinstance(first, dict):
            eval_cp = _optional_int(first.get("eval_cp"))
            mate_in = _optional_int(first.get("mate_in"))
            if eval_cp is not None or mate_in is not None:
                return {"eval_cp": eval_cp, "mate_in": mate_in}

    eval_cp = _optional_int(payload.get("eval_cp"))
    mate_in = _optional_int(payload.get("mate_in"))
    if eval_cp is not None or mate_in is not None:
        return {"eval_cp": eval_cp, "mate_in": mate_in}
    return None


def _board_from_fen(value: Any) -> chess.Board | None:
    if not value:
        return None
    try:
        board = chess.Board(str(value))
    except ValueError:
        return None
    return board if board.is_valid() else None


def _move_from_notation(board: chess.Board, value: Any) -> chess.Move | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        move = chess.Move.from_uci(raw)
    except ValueError:
        move = None
    if move is not None and move in board.legal_moves:
        return move
    try:
        parsed = board.parse_san(raw)
    except ValueError:
        return None
    return parsed if parsed in board.legal_moves else None


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


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
