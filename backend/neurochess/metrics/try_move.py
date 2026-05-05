from __future__ import annotations

import json
from typing import Any

import chess

from neurochess.metrics.review_metrics import player_percent_from_eval


TRY_MOVE_MODEL_VERSION = "try_move_v0_cached_candidates"
PRACTICE_FEEDBACK_CLASSIFIER_VERSION = "practice_feedback_canonical_uci_v1"
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
            "pv_line_message": "Meilleur coup indisponible dans les donnees de Review.",
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
            "Ligne proposee par le moteur."
            if pv_line
            else "Ligne complete indisponible ; seul le meilleur coup est affiche."
        ),
        "try_move_model_version": TRY_MOVE_MODEL_VERSION,
    }


def evaluate_try_move_attempt(
    attempt_move: str,
    annotation: dict[str, Any],
) -> dict[str, Any]:
    fen_before = annotation.get("fen_before")
    board = _board_from_fen(str(fen_before) if fen_before is not None else None)
    evidence = _base_attempt_evidence(board, attempt_move, annotation)
    if board is None:
        evidence.update(result="needs_rebuild", reason_code="missing_or_invalid_fen")
        return {
            "result": "needs_rebuild",
            "message": "Review a reconstruire avant de corriger cette position.",
            "show_best_move": False,
            "reason_code": "missing_or_invalid_fen",
            "evidence": evidence,
        }

    attempt = _move_from_notation(board, attempt_move)
    if attempt is None:
        evidence.update(
            is_legal=False,
            result="illegal",
            reason_code="illegal_or_unparseable_user_move",
        )
        return {
            "result": "illegal",
            "message": "Ce coup n'est pas legal dans cette position.",
            "show_best_move": False,
            "reason_code": "illegal_or_unparseable_user_move",
            "evidence": evidence,
        }

    attempt_uci = attempt.uci()
    evidence.update(
        is_legal=True,
        user_move_uci=attempt_uci,
        user_move_san=_san_for_move(board, attempt),
    )

    best_move = _best_move_from_annotation(board, annotation)
    if best_move is None:
        evidence.update(
            result="needs_rebuild",
            reason_code="best_move_missing_or_unparseable",
        )
        return {
            "result": "needs_rebuild",
            "message": "Review a reconstruire avant de corriger cette position.",
            "show_best_move": False,
            "reason_code": "best_move_missing_or_unparseable",
            "evidence": evidence,
        }

    best_move_uci = best_move.uci()
    best_move_san = _san_for_move(board, best_move)
    evidence.update(best_move_uci=best_move_uci, best_move_san=best_move_san)

    if attempt_uci == best_move_uci:
        evidence.update(
            accepted_moves_uci=[best_move_uci],
            is_exact_best=True,
            is_accepted=True,
            result="best",
            reason_code="exact_best_move",
            should_show_best_move=False,
            should_schedule_review=True,
        )
        return {
            "result": "best",
            "message": f"Bien joué. Tu as trouvé l’idée critique : {best_move_san or best_move_uci}.",
            "show_best_move": False,
            "reason_code": "exact_best_move",
            "evidence": evidence,
        }

    accepted_moves = _accepted_moves_from_annotation(board, annotation, best_move)
    evidence["accepted_moves_uci"] = [entry["uci"] for entry in accepted_moves]
    for accepted in accepted_moves:
        if accepted["uci"] != attempt_uci:
            continue
        quality = accepted.get("quality") or "acceptable"
        result = "very_good" if quality == "very_good" else "acceptable"
        reason_code = f"accepted_move_{quality}"
        evidence.update(
            is_accepted=True,
            result=result,
            reason_code=reason_code,
            should_show_best_move=False,
            should_schedule_review=True,
        )
        return {
            "result": result,
            "message": "Bonne idee. Ce coup repond au probleme principal de la position.",
            "show_best_move": False,
            "reason_code": reason_code,
            "evidence": evidence,
        }

    evidence.update(
        result="wrong",
        reason_code="legal_not_best_or_accepted",
        should_show_best_move=True,
        should_schedule_review=True,
    )
    return {
        "result": "wrong",
        "message": f"Pas encore. Le coup cle etait {best_move_san or best_move_uci}.",
        "show_best_move": True,
        "reason_code": "legal_not_best_or_accepted",
        "evidence": evidence,
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
    return _san_for_move(board, move)


def _san_for_move(board: chess.Board, move: chess.Move) -> str | None:
    if move not in board.legal_moves:
        return None
    return board.san(move)


def _move_from_notation(board: chess.Board, value: Any) -> chess.Move | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    move = _move_from_uci(raw)
    if move is not None and move in board.legal_moves:
        return move
    san_candidates = [raw]
    if "0-0" in raw:
        san_candidates.append(raw.replace("0-0", "O-O"))
    for candidate in san_candidates:
        try:
            parsed = board.parse_san(candidate)
        except ValueError:
            continue
        if parsed in board.legal_moves:
            return parsed
    return None


def _best_move_from_annotation(
    board: chess.Board,
    annotation: dict[str, Any],
) -> chess.Move | None:
    for key in ("best_move_uci", "best_move_san", "best_move"):
        move = _move_from_notation(board, annotation.get(key))
        if move is not None:
            return move
    return None


def _accepted_moves_from_annotation(
    board: chess.Board,
    annotation: dict[str, Any],
    best_move: chess.Move,
) -> list[dict[str, str]]:
    accepted_by_uci: dict[str, dict[str, str]] = {
        best_move.uci(): {
            "uci": best_move.uci(),
            "san": _san_for_move(board, best_move) or best_move.uci(),
            "quality": "best",
        }
    }
    for entry in _accepted_move_entries(annotation):
        if isinstance(entry, dict):
            raw_move = entry.get("uci") or entry.get("san") or entry.get("move")
            raw_quality = str(entry.get("quality") or "acceptable").strip().lower()
        else:
            raw_move = entry
            raw_quality = "acceptable"
        move = _move_from_notation(board, raw_move)
        if move is None:
            continue
        quality = raw_quality if raw_quality in {"best", "very_good", "acceptable"} else "acceptable"
        uci = move.uci()
        if uci == best_move.uci():
            quality = "best"
        accepted_by_uci[uci] = {
            "uci": uci,
            "san": _san_for_move(board, move) or uci,
            "quality": quality,
        }
    return list(accepted_by_uci.values())


def _accepted_move_entries(annotation: dict[str, Any]) -> list[Any]:
    entries: list[Any] = []
    acceptable = annotation.get("acceptable_moves")
    if isinstance(acceptable, list):
        entries.extend(acceptable)
    accepted = annotation.get("accepted_moves")
    if isinstance(accepted, list):
        entries.extend(accepted)
    accepted_json = annotation.get("accepted_moves_json")
    if isinstance(accepted_json, str) and accepted_json.strip():
        try:
            parsed = json.loads(accepted_json)
        except ValueError:
            parsed = None
        if isinstance(parsed, list):
            entries.extend(parsed)
    elif isinstance(accepted_json, list):
        entries.extend(accepted_json)
    return entries


def _base_attempt_evidence(
    board: chess.Board | None,
    attempt_move: Any,
    annotation: dict[str, Any],
) -> dict[str, Any]:
    side_to_move = None
    if board is not None:
        side_to_move = "white" if board.turn == chess.WHITE else "black"
    return {
        "classifier_version": PRACTICE_FEEDBACK_CLASSIFIER_VERSION,
        "fen": annotation.get("fen_before"),
        "side_to_move": side_to_move,
        "user_move_raw": str(attempt_move or ""),
        "user_move_uci": None,
        "user_move_san": None,
        "best_move_raw": (
            annotation.get("best_move_uci")
            or annotation.get("best_move_san")
            or annotation.get("best_move")
        ),
        "best_move_uci": None,
        "best_move_san": None,
        "accepted_moves_uci": [],
        "is_legal": False,
        "is_exact_best": False,
        "is_accepted": False,
        "result": None,
        "reason_code": None,
        "source_context": annotation.get("source_context"),
        "review_moment_id": annotation.get("review_moment_id")
        or annotation.get("source_moment_id"),
        "training_item_id": annotation.get("training_item_id"),
        "eval_before": annotation.get("eval_before"),
        "eval_after_user_move": annotation.get("eval_after_user_move"),
        "eval_after_best_move": annotation.get("eval_after_best_move"),
        "win_loss": annotation.get("win_loss"),
        "primary_tag": annotation.get("primary_category") or annotation.get("primary_tag"),
        "should_show_best_move": False,
        "should_schedule_review": None,
    }
