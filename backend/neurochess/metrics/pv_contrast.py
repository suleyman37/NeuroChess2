from __future__ import annotations

from typing import Any

import chess


PV_CONTRAST_EVIDENCE_VERSION = "pv_contrast_evidence_v1"
PV_CONTRAST_MAX_PLIES = 8

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
}


def build_pv_contrast_evidence(
    annotation: dict[str, Any],
    analyses_by_fen: dict[str, dict[str, Any]] | None = None,
    game_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build safe branch contrast evidence from cached analyses only."""
    analyses_by_fen = analyses_by_fen or {}
    game_context = game_context or {}
    missing_data: list[str] = []

    fen_before = _optional_str(
        annotation.get("fen_before") or game_context.get("fen_before")
    )
    fen_after = _optional_str(annotation.get("fen_after") or game_context.get("fen_after"))
    played_move_uci = _optional_str(
        annotation.get("played_move_uci") or annotation.get("uci")
    )
    played_move_san = _optional_str(
        annotation.get("played_move_san") or annotation.get("san")
    )
    top_moves_before = _top_moves_from_sources(
        annotation.get("top_moves"),
        analyses_by_fen.get(fen_before or ""),
    )
    best_move_uci = _optional_str(annotation.get("best_move_uci")) or _entry_uci(
        top_moves_before[0] if top_moves_before else None
    )
    best_move_san = _optional_str(annotation.get("best_move_san"))
    side = _optional_str(
        annotation.get("player_color")
        or annotation.get("side")
        or annotation.get("color")
    )
    if side not in {"white", "black"}:
        side = None

    if not fen_before:
        missing_data.append("fen_before_missing")
    if not played_move_uci:
        missing_data.append("played_move_missing")
    if not best_move_uci:
        missing_data.append("best_move_missing")

    start_board = _board_from_fen(fen_before)
    if fen_before and start_board is None:
        missing_data.append("fen_before_invalid")

    played_branch = _build_played_branch(
        fen_before=fen_before,
        fen_after=fen_after,
        played_move_uci=played_move_uci,
        played_move_san=played_move_san,
        analysis_after=analyses_by_fen.get(fen_after or ""),
        side=side,
        missing_data=missing_data,
    )
    best_branch = _build_best_branch(
        fen_before=fen_before,
        best_move_uci=best_move_uci,
        best_move_san=best_move_san,
        top_moves_before=top_moves_before,
        side=side,
        missing_data=missing_data,
    )
    contrast = _build_contrast(
        annotation=annotation,
        played_branch=played_branch,
        best_branch=best_branch,
        missing_data=missing_data,
    )
    confidence = _confidence_for_evidence(played_branch, best_branch, missing_data)
    available = bool(
        fen_before
        and start_board is not None
        and played_branch.get("line_length", 0) >= 1
        and best_branch.get("line_length", 0) >= 1
    )
    if not available and not missing_data:
        missing_data.append("insufficient_branch_data")

    return {
        "schema_version": PV_CONTRAST_EVIDENCE_VERSION,
        "pv_contrast_evidence_version": PV_CONTRAST_EVIDENCE_VERSION,
        "available": available,
        "played_branch": played_branch,
        "best_branch": best_branch,
        "contrast": contrast,
        "confidence": confidence,
        "missing_data": _dedupe(missing_data),
    }


def summarize_position_signals(
    board_start: chess.Board | None,
    board_end: chess.Board | None,
    line_moves: list[dict[str, Any]],
    side: str | None,
) -> dict[str, Any]:
    start_material = _material_summary(board_start, side)
    end_material = _material_summary(board_end, side)
    captures = [move for move in line_moves if move.get("is_capture")]
    checks = [move for move in line_moves if move.get("is_check")]
    promotions = [move for move in line_moves if move.get("is_promotion")]
    forcing_count = len(captures) + len(checks) + len(promotions)
    active_reply = bool(len(line_moves) >= 2)
    return {
        "material_delta_basic": {
            "start_pov_material": start_material,
            "end_pov_material": end_material,
            "delta_pov_material": (
                None
                if start_material is None or end_material is None
                else end_material - start_material
            ),
            "capture_count": len(captures),
        },
        "forcing_signals": {
            "first_move_is_check": bool(line_moves and line_moves[0].get("is_check")),
            "first_move_is_capture": bool(line_moves and line_moves[0].get("is_capture")),
            "first_move_is_promotion": bool(
                line_moves and line_moves[0].get("is_promotion")
            ),
            "check_count": len(checks),
            "capture_count": len(captures),
            "promotion_count": len(promotions),
            "forcing_move_count": forcing_count,
        },
        "king_safety_basic": {
            "king_in_check_at_end": bool(board_end.is_check()) if board_end else None,
            "checks_in_line": len(checks),
            "first_move_gives_check": bool(line_moves and line_moves[0].get("is_check")),
        },
        "initiative_basic": {
            "forcing_move_count": forcing_count,
            "line_has_active_reply": active_reply,
            "reply_move_uci": line_moves[1]["uci"] if len(line_moves) >= 2 else None,
        },
        "mobility_basic": {
            "legal_moves_start": (
                board_start.legal_moves.count() if board_start is not None else None
            ),
            "legal_moves_end": (
                board_end.legal_moves.count() if board_end is not None else None
            ),
        },
    }


def _build_played_branch(
    *,
    fen_before: str | None,
    fen_after: str | None,
    played_move_uci: str | None,
    played_move_san: str | None,
    analysis_after: dict[str, Any] | None,
    side: str | None,
    missing_data: list[str],
) -> dict[str, Any]:
    after_top_moves = _top_moves_from_sources(None, analysis_after)
    reply_uci = _entry_uci(after_top_moves[0] if after_top_moves else None)
    reply_san = _san_for_uci(fen_after, reply_uci)
    if analysis_after is None:
        missing_data.append("played_branch_reply_missing")
    elif not reply_uci:
        missing_data.append("played_branch_reply_missing")

    reply_pv = _pv_from_entry(after_top_moves[0] if after_top_moves else None)
    branch_moves = [played_move_uci] if played_move_uci else []
    if reply_pv:
        branch_moves.extend(reply_pv)
    elif reply_uci:
        branch_moves.append(reply_uci)

    replay = _replay_line(fen_before, branch_moves, missing_data, "played_branch")
    return {
        "start_fen": fen_before,
        "played_move_uci": played_move_uci,
        "played_move_san": played_move_san,
        "after_played_fen": fen_after,
        "opponent_best_reply_uci": reply_uci,
        "opponent_best_reply_san": reply_san,
        "pv": replay["line"],
        "final_fen": replay["final_fen"],
        "line_length": len(replay["line"]),
        "summary_signals": summarize_position_signals(
            replay["start_board"],
            replay["end_board"],
            replay["line"],
            side,
        ),
    }


def _build_best_branch(
    *,
    fen_before: str | None,
    best_move_uci: str | None,
    best_move_san: str | None,
    top_moves_before: list[dict[str, Any]],
    side: str | None,
    missing_data: list[str],
) -> dict[str, Any]:
    best_top_move = top_moves_before[0] if top_moves_before else None
    best_pv = _pv_from_entry(best_top_move)
    if best_pv:
        branch_moves = best_pv
    elif best_move_uci:
        branch_moves = [best_move_uci]
        missing_data.append("best_branch_pv_missing")
    else:
        branch_moves = []
        missing_data.append("best_branch_move_missing")
    replay = _replay_line(fen_before, branch_moves, missing_data, "best_branch")
    if best_move_san is None and best_move_uci:
        best_move_san = _san_for_uci(fen_before, best_move_uci)
    return {
        "start_fen": fen_before,
        "best_move_uci": best_move_uci,
        "best_move_san": best_move_san,
        "pv": replay["line"],
        "final_fen": replay["final_fen"],
        "line_length": len(replay["line"]),
        "summary_signals": summarize_position_signals(
            replay["start_board"],
            replay["end_board"],
            replay["line"],
            side,
        ),
    }


def _build_contrast(
    *,
    annotation: dict[str, Any],
    played_branch: dict[str, Any],
    best_branch: dict[str, Any],
    missing_data: list[str],
) -> dict[str, Any]:
    player_before = _optional_float(
        annotation.get("player_win_percent_before")
        or annotation.get("player_percent_before")
    )
    win_loss = _optional_float(annotation.get("win_loss")) or 0.0
    missed_gain = _optional_float(annotation.get("missed_gain"))
    tags = set(annotation.get("tags") or [])
    played_signals = played_branch.get("summary_signals") or {}
    best_signals = best_branch.get("summary_signals") or {}
    played_forcing = _forcing_count(played_signals)
    best_forcing = _forcing_count(best_signals)
    best_first_forcing = _first_move_forcing(best_signals)
    played_first_forcing = _first_move_forcing(played_signals)
    main_type = "unknown"

    if "conversion_issue" in tags or (player_before is not None and player_before >= 75.0 and win_loss >= 10.0):
        main_type = "conversion"
    elif (
        "defensive_resource_missed" in tags
        or (
            player_before is not None
            and player_before <= 35.0
            and missed_gain is not None
            and missed_gain >= 10.0
        )
    ):
        main_type = "defense"
    elif best_first_forcing and not played_first_forcing:
        main_type = "forcing"
    elif _checks_in_line(best_signals) >= 2:
        main_type = "king_safety"
    elif _material_delta(best_signals) is not None and _material_delta(played_signals) is not None and (
        (_material_delta(best_signals) or 0) - (_material_delta(played_signals) or 0)
    ) >= 2:
        main_type = "material"
    elif played_branch.get("opponent_best_reply_uci"):
        main_type = "initiative"
    elif win_loss >= 5.0:
        main_type = "positional"

    played_reply = played_branch.get("opponent_best_reply_san") or played_branch.get(
        "opponent_best_reply_uci"
    )
    best_move = best_branch.get("best_move_san") or best_branch.get("best_move_uci")
    bullets = _safe_bullets(
        main_type=main_type,
        played_reply=played_reply,
        best_move=best_move,
        best_forcing=best_forcing,
        played_forcing=played_forcing,
        missing_data=missing_data,
    )
    return {
        "main_difference_type": main_type,
        "played_move_nature": _move_nature(played_signals),
        "best_move_nature": _move_nature(best_signals),
        "played_branch_risk": (
            f"After the played move, the opponent has an active reply: {played_reply}."
            if played_reply
            else "No cached opponent reply is available after the played move."
        ),
        "best_branch_benefit": (
            f"The best branch starts with {best_move}."
            if best_move
            else "The cached data does not contain a best move."
        ),
        "safe_explanation_bullets": bullets,
        "llm_safe_facts": bullets,
    }


def _replay_line(
    fen_before: str | None,
    raw_moves: list[str | None],
    missing_data: list[str],
    branch_name: str,
) -> dict[str, Any]:
    start_board = _board_from_fen(fen_before)
    if start_board is None:
        missing_data.append(f"{branch_name}_start_fen_invalid")
        return {
            "start_board": None,
            "end_board": None,
            "line": [],
            "final_fen": None,
        }
    board = start_board.copy(stack=False)
    line: list[dict[str, Any]] = []
    for raw_uci in raw_moves[:PV_CONTRAST_MAX_PLIES]:
        if not raw_uci:
            continue
        uci = str(raw_uci)
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            missing_data.append(f"{branch_name}_pv_invalid_uci")
            break
        if move not in board.legal_moves:
            missing_data.append(f"{branch_name}_pv_illegal_move")
            break
        is_capture = board.is_capture(move)
        is_promotion = move.promotion is not None
        san = board.san(move)
        color = "white" if board.turn == chess.WHITE else "black"
        board.push(move)
        line.append(
            {
                "ply_offset": len(line) + 1,
                "uci": uci,
                "san": san,
                "color": color,
                "fen_after": board.fen(),
                "is_capture": is_capture,
                "is_check": board.is_check(),
                "is_promotion": is_promotion,
            }
        )
    return {
        "start_board": start_board,
        "end_board": board,
        "line": line,
        "final_fen": board.fen() if line else None,
    }


def _top_moves_from_sources(
    top_moves: Any,
    analysis: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if isinstance(top_moves, list):
        return [entry for entry in top_moves if isinstance(entry, dict)]
    if isinstance(analysis, dict):
        analysis_json = analysis.get("analysis_json") or {}
        value = analysis_json.get("top_moves")
        if isinstance(value, list):
            return [entry for entry in value if isinstance(entry, dict)]
    return []


def _pv_from_entry(entry: dict[str, Any] | None) -> list[str]:
    if not isinstance(entry, dict):
        return []
    pv = entry.get("pv")
    if not isinstance(pv, list):
        return []
    return [str(move) for move in pv[:PV_CONTRAST_MAX_PLIES] if move]


def _entry_uci(entry: dict[str, Any] | None) -> str | None:
    if not isinstance(entry, dict):
        return None
    return _optional_str(entry.get("uci"))


def _board_from_fen(fen: str | None) -> chess.Board | None:
    if not fen:
        return None
    try:
        board = chess.Board(fen)
    except ValueError:
        return None
    return board if board.is_valid() else None


def _san_for_uci(fen: str | None, uci: str | None) -> str | None:
    board = _board_from_fen(fen)
    if board is None or not uci:
        return None
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return None
    if move not in board.legal_moves:
        return None
    return board.san(move)


def _material_summary(board: chess.Board | None, side: str | None) -> int | None:
    if board is None or side not in {"white", "black"}:
        return None
    white = 0
    black = 0
    for piece_type, value in PIECE_VALUES.items():
        white += len(board.pieces(piece_type, chess.WHITE)) * value
        black += len(board.pieces(piece_type, chess.BLACK)) * value
    balance = white - black
    return balance if side == "white" else -balance


def _confidence_for_evidence(
    played_branch: dict[str, Any],
    best_branch: dict[str, Any],
    missing_data: list[str],
) -> str:
    if played_branch.get("line_length", 0) >= 2 and best_branch.get("line_length", 0) >= 2:
        return "medium" if missing_data else "high"
    if played_branch.get("line_length", 0) >= 1 and best_branch.get("line_length", 0) >= 1:
        return "medium" if len(missing_data) <= 1 else "low"
    return "low"


def _safe_bullets(
    *,
    main_type: str,
    played_reply: Any,
    best_move: Any,
    best_forcing: int,
    played_forcing: int,
    missing_data: list[str],
) -> list[str]:
    bullets: list[str] = []
    if main_type == "forcing" or best_forcing > played_forcing:
        bullets.append("The best line is more forcing than the played line.")
    if played_reply:
        bullets.append("After the played move, the opponent has a cached active reply.")
    if best_move:
        bullets.append("The best branch is supported by the cached top move.")
    if main_type == "conversion":
        bullets.append("The move came from a favorable position and reduced the conversion margin.")
    if main_type == "defense":
        bullets.append("The cached best branch points to a defensive resource.")
    if missing_data:
        bullets.append("Some branch data is missing; the explanation should stay cautious.")
    return bullets or ["The cached data is insufficient for a precise contrast."]


def _move_nature(signals: dict[str, Any]) -> str:
    forcing = signals.get("forcing_signals") or {}
    if forcing.get("first_move_is_check"):
        return "check"
    if forcing.get("first_move_is_capture"):
        return "capture"
    if forcing.get("first_move_is_promotion"):
        return "promotion"
    if int(forcing.get("forcing_move_count") or 0) > 0:
        return "forcing_line"
    return "quiet_or_unknown"


def _forcing_count(signals: dict[str, Any]) -> int:
    forcing = signals.get("forcing_signals") or {}
    return int(forcing.get("forcing_move_count") or 0)


def _checks_in_line(signals: dict[str, Any]) -> int:
    king = signals.get("king_safety_basic") or {}
    return int(king.get("checks_in_line") or 0)


def _first_move_forcing(signals: dict[str, Any]) -> bool:
    forcing = signals.get("forcing_signals") or {}
    return bool(
        forcing.get("first_move_is_check")
        or forcing.get("first_move_is_capture")
        or forcing.get("first_move_is_promotion")
    )


def _material_delta(signals: dict[str, Any]) -> int | None:
    material = signals.get("material_delta_basic") or {}
    value = material.get("delta_pov_material")
    return int(value) if isinstance(value, int) else None


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
