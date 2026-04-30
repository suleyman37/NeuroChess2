from __future__ import annotations

from typing import Any

import chess

from neurochess.metrics.review_metrics import player_percent_from_eval


TRY_MOVE_MODEL_VERSION = "try_move_v0_cached_candidates"
PV_LINE_MAX_PLIES = 8


def build_try_move_payload(
    *,
    fen_before: str | None,
    side: str | None,
    best_move_uci: str | None,
    top_moves: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not best_move_uci:
        return {
            "try_move_supported": False,
            "acceptable_moves": [],
            "pv_line": [],
            "pv_line_available": False,
            "pv_line_message": "Meilleur coup indisponible dans les données de Review.",
            "try_move_model_version": TRY_MOVE_MODEL_VERSION,
        }

    board = _board_from_fen(fen_before)
    best_san = _san_for_uci(board, best_move_uci)
    accepted = [
        {
            "uci": best_move_uci,
            "san": best_san,
            "quality": "best",
            "delta_from_best_win_percent": 0.0,
        }
    ]

    top = top_moves or []
    best_percent = _top_move_player_percent(top[0], side) if top else None
    if best_percent is not None:
        seen = {best_move_uci}
        for entry in top[1:]:
            uci = _entry_uci(entry)
            candidate_percent = _top_move_player_percent(entry, side)
            if not uci or uci in seen or candidate_percent is None:
                continue
            delta = max(0.0, best_percent - candidate_percent)
            if delta <= 2.0:
                quality = "very_good"
            elif delta <= 5.0:
                quality = "acceptable"
            else:
                continue
            accepted.append(
                {
                    "uci": uci,
                    "san": _san_for_uci(board, uci),
                    "quality": quality,
                    "delta_from_best_win_percent": round(delta, 2),
                }
            )
            seen.add(uci)

    pv_line = build_pv_line(fen_before, top[0] if top else None)
    return {
        "try_move_supported": True,
        "acceptable_moves": accepted,
        "pv_line": pv_line,
        "pv_line_available": bool(pv_line),
        "pv_line_message": (
            "Ligne proposée par le moteur."
            if pv_line
            else "Ligne complète indisponible ; seul le meilleur coup est affiché."
        ),
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
    }


def evaluate_try_move_attempt(
    attempt_uci: str,
    annotation: dict[str, Any],
) -> dict[str, Any]:
    fen_before = annotation.get("fen_before")
    board = _board_from_fen(str(fen_before) if fen_before is not None else None)
    if board is None or not _is_legal_uci(board, attempt_uci):
        return {
            "result": "illegal",
            "message": "Ce coup est illégal dans cette position.",
            "show_best_move": False,
        }

    best_move_uci = annotation.get("best_move_uci")
    if not best_move_uci:
        return {
            "result": "unknown",
            "message": "Coup joué. Les données disponibles ne permettent pas de l'évaluer précisément.",
            "show_best_move": False,
        }

    if attempt_uci == best_move_uci:
        return {
            "result": "best",
            "message": "Excellent : tu as trouvé le meilleur coup.",
            "show_best_move": False,
        }

    for accepted in annotation.get("acceptable_moves") or []:
        if not isinstance(accepted, dict) or accepted.get("uci") != attempt_uci:
            continue
        quality = accepted.get("quality")
        if quality == "very_good":
            return {
                "result": "very_good",
                "message": "Très bon : ce coup garde presque autant de chances.",
                "show_best_move": False,
            }
        if quality == "acceptable":
            return {
                "result": "acceptable",
                "message": "Jouable : ce coup fonctionne, mais le meilleur coup était plus précis.",
                "show_best_move": False,
            }

    return {
        "result": "wrong",
        "message": "À revoir : ce coup ne résout pas le problème principal.",
        "show_best_move": True,
    }


def build_pv_line(
    fen_before: str | None,
    top_move: dict[str, Any] | None,
    *,
    max_plies: int = PV_LINE_MAX_PLIES,
) -> list[dict[str, Any]]:
    if not isinstance(top_move, dict):
        return []
    pv = top_move.get("pv")
    if not isinstance(pv, list) or not pv:
        return []
    board = _board_from_fen(fen_before)
    if board is None:
        return []

    line: list[dict[str, Any]] = []
    for raw_uci in pv[:max_plies]:
        uci = str(raw_uci)
        move = _move_from_uci(uci)
        if move is None or move not in board.legal_moves:
            break
        san = board.san(move)
        board.push(move)
        line.append(
            {
                "ply_offset": len(line) + 1,
                "uci": uci,
                "san": san,
                "fen_after": board.fen(),
            }
        )
    return line


def _entry_uci(entry: dict[str, Any]) -> str | None:
    value = entry.get("uci")
    return str(value) if value is not None else None


def _top_move_player_percent(entry: dict[str, Any], side: str | None) -> float | None:
    if side not in {"white", "black"}:
        return None
    if entry.get("eval_cp") is None and entry.get("mate_in") is None:
        return None
    return player_percent_from_eval(entry.get("eval_cp"), entry.get("mate_in"), side)


def _board_from_fen(fen: str | None) -> chess.Board | None:
    if not fen:
        return None
    try:
        board = chess.Board(fen)
    except ValueError:
        return None
    return board if board.is_valid() else None


def _move_from_uci(uci: str) -> chess.Move | None:
    try:
        return chess.Move.from_uci(uci)
    except ValueError:
        return None


def _is_legal_uci(board: chess.Board, uci: str) -> bool:
    move = _move_from_uci(uci)
    return bool(move and move in board.legal_moves)


def _san_for_uci(board: chess.Board | None, uci: str | None) -> str | None:
    if board is None or not uci:
        return None
    move = _move_from_uci(uci)
    if move is None or move not in board.legal_moves:
        return None
    return board.san(move)
