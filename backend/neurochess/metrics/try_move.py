from __future__ import annotations

import json
from typing import Any

import chess

from neurochess.metrics.review_metrics import player_percent_from_eval


TRY_MOVE_MODEL_VERSION = "try_move_v1_pv5_stable_bands"
PRACTICE_FEEDBACK_CLASSIFIER_VERSION = "practice_feedback_canonical_uci_v2_stable_eval"
PV_LINE_MAX_PLIES = 8

VERY_GOOD_WIN_LOSS_DELTA = 2.0
ACCEPTABLE_WIN_LOSS_DELTA = 5.0
PLAYABLE_WIN_LOSS_DELTA = 8.0
IMPRECISE_WIN_LOSS_DELTA = 14.0

ACCEPTED_QUALITIES = {"best", "very_good", "acceptable"}
CANDIDATE_QUALITIES = {
    "best",
    "very_good",
    "acceptable",
    "playable",
    "imprecise",
}


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
            "candidate_moves": [],
            "pv_line": [],
            "pv_line_available": False,
            "pv_line_message": "Meilleur coup indisponible dans les donnees de Review.",
            "try_move_model_version": TRY_MOVE_MODEL_VERSION,
        }

    board = _board_from_fen(fen_before)
    best_san = _san_for_uci(board, best_move_uci)
    best_entry = {
        "uci": best_move_uci,
        "san": best_san,
        "quality": "best",
        "delta_from_best_win_percent": 0.0,
        "eval_cp": None,
        "mate_in": None,
    }
    acceptable_moves = [dict(best_entry)]
    candidate_moves = [dict(best_entry)]

    top = [entry for entry in (top_moves or []) if isinstance(entry, dict)]
    best_source = _top_move_for_uci(top, best_move_uci) or (top[0] if top else None)
    if isinstance(best_source, dict):
        best_entry["eval_cp"] = _optional_int(best_source.get("eval_cp"))
        best_entry["mate_in"] = _optional_int(best_source.get("mate_in"))
        acceptable_moves[0].update(
            eval_cp=best_entry["eval_cp"],
            mate_in=best_entry["mate_in"],
        )
        candidate_moves[0].update(
            eval_cp=best_entry["eval_cp"],
            mate_in=best_entry["mate_in"],
        )

    best_percent = _top_move_player_percent(best_source, side) if best_source else None
    if best_percent is not None:
        seen = {best_move_uci}
        for entry in top:
            uci = _entry_uci(entry)
            if not uci or uci in seen:
                continue
            candidate_percent = _top_move_player_percent(entry, side)
            if candidate_percent is None:
                continue
            delta = max(0.0, best_percent - candidate_percent)
            quality = quality_from_best_delta(delta)
            if quality == "wrong":
                continue
            candidate = {
                "uci": uci,
                "san": _san_for_uci(board, uci),
                "quality": quality,
                "delta_from_best_win_percent": round(delta, 2),
                "eval_cp": _optional_int(entry.get("eval_cp")),
                "mate_in": _optional_int(entry.get("mate_in")),
            }
            candidate_moves.append(candidate)
            if quality in ACCEPTED_QUALITIES:
                acceptable_moves.append(dict(candidate))
            seen.add(uci)

    pv_line = build_pv_line(fen_before, top[0] if top else None)
    return {
        "try_move_supported": True,
        "acceptable_moves": acceptable_moves,
        "candidate_moves": candidate_moves,
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
            candidate_moves_uci=[best_move_uci],
            is_exact_best=True,
            is_accepted=True,
            result="best",
            reason_code="exact_best_move",
            should_show_best_move=False,
            should_schedule_review=True,
        )
        return {
            "result": "best",
            "message": f"Bien joue. Tu as trouve l'idee critique : {best_move_san or best_move_uci}.",
            "show_best_move": False,
            "reason_code": "exact_best_move",
            "evidence": evidence,
        }

    candidates = _candidate_moves_from_annotation(board, annotation, best_move)
    evidence["candidate_moves_uci"] = [entry["uci"] for entry in candidates]
    evidence["accepted_moves_uci"] = [
        entry["uci"] for entry in candidates if entry.get("quality") in ACCEPTED_QUALITIES
    ]
    for candidate in candidates:
        if candidate["uci"] != attempt_uci:
            continue
        quality = str(candidate.get("quality") or "acceptable")
        result = result_from_quality(quality)
        reason_code = f"candidate_move_{quality}"
        evidence.update(
            is_accepted=quality in ACCEPTED_QUALITIES,
            result=result,
            reason_code=reason_code,
            delta_from_best_win_percent=candidate.get("delta_from_best_win_percent"),
            should_show_best_move=should_show_best_move_for_result(result),
            should_schedule_review=should_schedule_review_for_result(result),
        )
        return {
            "result": result,
            "message": message_for_result(result, best_move_san or best_move_uci),
            "show_best_move": should_show_best_move_for_result(result),
            "reason_code": reason_code,
            "evidence": evidence,
        }

    stable = stable_attempt_evaluation_for_uci(annotation, attempt_uci)
    best_percent = best_player_percent(annotation, board, best_move)
    if stable is not None and best_percent is not None:
        side = "white" if board.turn == chess.WHITE else "black"
        attempt_percent = player_percent_from_eval(
            stable.get("eval_cp"),
            stable.get("mate_in"),
            side,
        )
        delta = max(0.0, best_percent - attempt_percent)
        result = result_from_quality(quality_from_best_delta(delta))
        reason_code = "stable_attempt_eval_loss_band"
        evidence.update(
            result=result,
            reason_code=reason_code,
            delta_from_best_win_percent=round(delta, 2),
            stable_attempt_evaluation=stable,
            should_show_best_move=should_show_best_move_for_result(result),
            should_schedule_review=should_schedule_review_for_result(result),
        )
        return {
            "result": result,
            "message": message_for_result(result, best_move_san or best_move_uci),
            "show_best_move": should_show_best_move_for_result(result),
            "reason_code": reason_code,
            "evidence": evidence,
        }

    evidence.update(
        result="needs_rebuild",
        reason_code="stable_evaluation_required_for_legal_out_of_list",
        stable_attempt_evaluation_available=stable is not None,
        best_reference_available=best_percent is not None,
        should_show_best_move=False,
        should_schedule_review=False,
    )
    return {
        "result": "needs_rebuild",
        "message": "Analyse stable requise avant de juger ce coup.",
        "show_best_move": False,
        "reason_code": "stable_evaluation_required_for_legal_out_of_list",
        "evidence": evidence,
    }


def quality_from_best_delta(delta: float) -> str:
    value = max(0.0, float(delta))
    if value <= VERY_GOOD_WIN_LOSS_DELTA:
        return "very_good"
    if value <= ACCEPTABLE_WIN_LOSS_DELTA:
        return "acceptable"
    if value <= PLAYABLE_WIN_LOSS_DELTA:
        return "playable"
    if value <= IMPRECISE_WIN_LOSS_DELTA:
        return "imprecise"
    return "wrong"


def result_from_quality(quality: str) -> str:
    normalized = str(quality or "").strip().lower()
    if normalized in {"best", "very_good", "acceptable", "playable", "imprecise"}:
        return normalized
    return "wrong"


def message_for_result(result: str, best_label: str | None) -> str:
    if result == "very_good":
        return "Excellente idee. Ce coup garde l'essentiel."
    if result == "acceptable":
        return "Bonne idee. Ce coup repond au probleme principal de la position."
    if result == "playable":
        return "Jouable. Le coup reste sain, meme s'il n'est pas l'idee principale."
    if result == "imprecise":
        return "A ameliorer. Le coup perd quelque chose d'utile, sans etre une erreur decisive."
    if result == "wrong":
        return f"A revoir. Le meilleur coup etait {best_label}."
    return "Coup evalue."


def should_show_best_move_for_result(result: str) -> bool:
    return result in {"imprecise", "wrong"}


def should_schedule_review_for_result(result: str) -> bool:
    return result in {"best", "very_good", "acceptable", "wrong"}


def stable_attempt_evaluation_for_uci(
    annotation: dict[str, Any],
    attempt_uci: str,
) -> dict[str, Any] | None:
    candidates: list[Any] = []
    for key in (
        "stable_attempt_evaluation",
        "attempt_stable_evaluation",
        "attempt_evaluation",
    ):
        value = annotation.get(key)
        if isinstance(value, dict):
            candidates.append(value)
        elif isinstance(value, list):
            candidates.extend(value)
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        raw_uci = candidate.get("uci") or candidate.get("move_uci") or candidate.get("attempted_uci")
        if raw_uci is not None and str(raw_uci) != attempt_uci:
            continue
        eval_cp = _optional_int(
            candidate.get("eval_cp")
            if "eval_cp" in candidate
            else candidate.get("final_eval_cp")
        )
        mate_in = _optional_int(candidate.get("mate_in") if "mate_in" in candidate else candidate.get("final_mate_in"))
        if eval_cp is None and mate_in is None:
            continue
        return {
            "uci": attempt_uci,
            "eval_cp": eval_cp,
            "mate_in": mate_in,
            "source_kind": candidate.get("source_kind") or candidate.get("source"),
            "analysis_id": candidate.get("analysis_id"),
            "fen_after": candidate.get("fen_after"),
            "requested_time_ms": candidate.get("requested_time_ms"),
        }
    return None


def best_player_percent(
    annotation: dict[str, Any],
    board: chess.Board,
    best_move: chess.Move,
) -> float | None:
    side = "white" if board.turn == chess.WHITE else "black"
    best_uci = best_move.uci()
    entries: list[Any] = []
    for key in ("top_moves", "candidate_moves", "acceptable_moves"):
        value = annotation.get(key)
        if isinstance(value, list):
            entries.extend(value)
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if _entry_uci(entry) != best_uci:
            continue
        percent = _top_move_player_percent(entry, side)
        if percent is not None:
            return percent
    eval_cp = _optional_int(annotation.get("eval_after_best_move"))
    mate_in = _optional_int(annotation.get("mate_after_best_move"))
    if eval_cp is not None or mate_in is not None:
        return player_percent_from_eval(eval_cp, mate_in, side)
    return None


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


def _top_move_for_uci(
    entries: list[dict[str, Any]],
    uci: str | None,
) -> dict[str, Any] | None:
    if not uci:
        return None
    for entry in entries:
        if _entry_uci(entry) == uci:
            return entry
    return None


def _top_move_player_percent(entry: dict[str, Any] | None, side: str | None) -> float | None:
    if not isinstance(entry, dict) or side not in {"white", "black"}:
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


def _candidate_moves_from_annotation(
    board: chess.Board,
    annotation: dict[str, Any],
    best_move: chess.Move,
) -> list[dict[str, Any]]:
    side = "white" if board.turn == chess.WHITE else "black"
    best_uci = best_move.uci()
    candidates_by_uci: dict[str, dict[str, Any]] = {
        best_uci: {
            "uci": best_uci,
            "san": _san_for_move(board, best_move) or best_uci,
            "quality": "best",
            "delta_from_best_win_percent": 0.0,
        }
    }

    for entry in _candidate_move_entries(annotation):
        if isinstance(entry, dict):
            raw_move = entry.get("uci") or entry.get("san") or entry.get("move")
            raw_quality = str(entry.get("quality") or "acceptable").strip().lower()
            delta = _optional_float(entry.get("delta_from_best_win_percent"))
            eval_cp = _optional_int(entry.get("eval_cp"))
            mate_in = _optional_int(entry.get("mate_in"))
        else:
            raw_move = entry
            raw_quality = "acceptable"
            delta = None
            eval_cp = None
            mate_in = None
        move = _move_from_notation(board, raw_move)
        if move is None:
            continue
        quality = raw_quality if raw_quality in CANDIDATE_QUALITIES else "acceptable"
        uci = move.uci()
        if uci == best_uci:
            quality = "best"
            delta = 0.0
        candidates_by_uci[uci] = {
            "uci": uci,
            "san": _san_for_move(board, move) or uci,
            "quality": quality,
            "delta_from_best_win_percent": delta,
            "eval_cp": eval_cp,
            "mate_in": mate_in,
        }

    top_moves = [entry for entry in annotation.get("top_moves") or [] if isinstance(entry, dict)]
    best_source = _top_move_for_uci(top_moves, best_uci) or (top_moves[0] if top_moves else None)
    best_percent = _top_move_player_percent(best_source, side) if best_source else None
    if best_percent is not None:
        for entry in top_moves:
            uci = _entry_uci(entry)
            if not uci:
                continue
            move = _move_from_notation(board, uci)
            if move is None:
                continue
            candidate_percent = _top_move_player_percent(entry, side)
            if candidate_percent is None:
                continue
            delta = max(0.0, best_percent - candidate_percent)
            quality = "best" if uci == best_uci else quality_from_best_delta(delta)
            if quality == "wrong":
                continue
            candidates_by_uci[uci] = {
                "uci": uci,
                "san": _san_for_move(board, move) or uci,
                "quality": quality,
                "delta_from_best_win_percent": round(delta, 2),
                "eval_cp": _optional_int(entry.get("eval_cp")),
                "mate_in": _optional_int(entry.get("mate_in")),
            }

    return list(candidates_by_uci.values())


def _candidate_move_entries(annotation: dict[str, Any]) -> list[Any]:
    entries: list[Any] = []
    for key in ("candidate_moves", "acceptable_moves", "accepted_moves"):
        value = annotation.get(key)
        if isinstance(value, list):
            entries.extend(value)
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
        "candidate_moves_uci": [],
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


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
