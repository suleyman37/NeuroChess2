from __future__ import annotations

from typing import Any

import chess


OPENING_REALITY_EVIDENCE_VERSION = "opening_reality_evidence_v1"
SEARCH_WINDOW_AFTER_EXIT_PLIES = 8
SIGNIFICANT_OPENING_EXIT_WIN_LOSS = 7.0

_CRITICAL_PRIMARY_CATEGORIES = {"inexact", "to_review", "critical", "decisive"}
_OPENING_EXIT_TAGS = {
    "missed_opportunity",
    "conversion_issue",
    "defensive_resource_missed",
    "persistent_loss",
    "cluster",
}


def build_opening_reality_evidence(
    *,
    game: Any | None,
    opening_classification: dict[str, Any] | None,
    moves: list[Any],
    move_annotations: list[dict[str, Any]],
) -> dict[str, Any]:
    initial_fen = _initial_fen_for_game(game, moves)
    if not _is_standard_starting_fen(initial_fen):
        return _not_applicable_payload()

    if not opening_classification:
        return _missing_data_payload(["opening_classification_missing"])

    classification_status = str(
        opening_classification.get("classification_status") or ""
    )
    if classification_status == "not_applicable_from_position":
        return _not_applicable_payload()
    if classification_status in {"failed", "unknown"}:
        return _missing_data_payload(
            ["opening_classification_unavailable"],
            classification=opening_classification,
        )

    out_of_book_ply = _optional_int(opening_classification.get("out_of_book_ply"))
    opening_name = _optional_str(opening_classification.get("opening_name"))
    if out_of_book_ply is None:
        return _missing_data_payload(
            ["out_of_book_ply_missing"],
            classification=opening_classification,
        )

    book_until_ply = _book_until_ply(opening_classification, out_of_book_ply)
    move_by_ply = {_optional_int(_value(move, "ply")): move for move in moves}
    last_book_move = move_by_ply.get(book_until_ply)
    out_move = move_by_ply.get(out_of_book_ply)
    last_book_san = _optional_str(_value(last_book_move, "san"))
    last_book_uci = _optional_str(_value(last_book_move, "uci"))
    fen_before_exit = _optional_str(opening_classification.get("out_of_book_fen"))
    if fen_before_exit is None:
        fen_before_exit = _optional_str(_value(out_move, "fen_before"))
    out_of_book_san = _optional_str(_value(out_move, "san"))
    out_of_book_uci = _optional_str(_value(out_move, "uci"))
    fen_after_exit = _optional_str(_value(out_move, "fen_after"))
    if fen_after_exit is None:
        fen_after_exit = _fen_after_move(fen_before_exit, out_of_book_uci)
    last_book_fen = _optional_str(_value(last_book_move, "fen_after")) or fen_before_exit

    missing_data: list[str] = []
    if not opening_name:
        missing_data.append("opening_name_missing")
    if out_move is None:
        missing_data.append("out_of_book_move_missing")
    if fen_before_exit is None:
        missing_data.append("out_of_book_fen_missing")

    critical = _first_critical_moment_after_exit(move_annotations, out_of_book_ply)
    first_loss = _first_loss_after_exit(move_annotations, out_of_book_ply)
    linked_moment = critical

    summary = _summary(
        opening_name=opening_name,
        out_of_book_ply=out_of_book_ply,
        linked_moment=linked_moment,
    )
    recommendation = _recommendation(linked_moment)
    confidence = _confidence(opening_classification, missing_data)

    return {
        "schema_version": OPENING_REALITY_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "available": bool(opening_name and fen_before_exit and out_move is not None),
        "status": "available" if not missing_data else "missing_data",
        "opening_name": opening_name,
        "eco": _optional_str(opening_classification.get("eco_code")),
        "source": _opening_source(opening_classification.get("source")),
        "book_until_ply": book_until_ply,
        "last_book_ply": book_until_ply,
        "last_book_move_san": last_book_san,
        "last_book_move_uci": last_book_uci,
        "last_book_fen": last_book_fen,
        "out_of_book_ply": out_of_book_ply,
        "out_of_book_move_san": out_of_book_san,
        "out_of_book_move_uci": out_of_book_uci,
        "out_of_book_fen": fen_before_exit,
        "exit_ply": out_of_book_ply,
        "exit_move_san": out_of_book_san,
        "exit_move_uci": out_of_book_uci,
        "fen_before_exit": fen_before_exit,
        "fen_after_exit": fen_after_exit,
        "move_number_exit": _move_number_from_ply(out_of_book_ply),
        "exit_color": (
            _optional_str(opening_classification.get("out_of_book_color"))
            or _side_to_move(fen_before_exit)
        ),
        "side_to_move_at_exit": (
            _optional_str(opening_classification.get("out_of_book_color"))
            or _side_to_move(fen_before_exit)
        ),
        "critical_moment_after_exit": critical,
        "first_loss_after_exit": first_loss,
        "summary": summary,
        "recommendation": recommendation,
        "confidence": confidence,
        "missing_data": missing_data,
        "search_window_after_exit_plies": SEARCH_WINDOW_AFTER_EXIT_PLIES,
        "significant_loss_threshold": SIGNIFICANT_OPENING_EXIT_WIN_LOSS,
    }


def _not_applicable_payload() -> dict[str, Any]:
    return {
        "schema_version": OPENING_REALITY_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "available": False,
        "status": "not_applicable_from_position",
        "opening_name": None,
        "eco": None,
        "source": "unknown",
        "book_until_ply": None,
        "last_book_ply": None,
        "last_book_move_san": None,
        "last_book_move_uci": None,
        "last_book_fen": None,
        "out_of_book_ply": None,
        "out_of_book_move_san": None,
        "out_of_book_move_uci": None,
        "out_of_book_fen": None,
        "exit_ply": None,
        "exit_move_san": None,
        "exit_move_uci": None,
        "fen_before_exit": None,
        "fen_after_exit": None,
        "move_number_exit": None,
        "exit_color": None,
        "side_to_move_at_exit": None,
        "critical_moment_after_exit": None,
        "first_loss_after_exit": None,
        "summary": "Ouverture non applicable : la partie commence depuis une position spéciale.",
        "recommendation": "Travaille cette position comme un départ spécial, pas comme une ligne d'ouverture.",
        "confidence": "high",
        "missing_data": [],
    }


def _missing_data_payload(
    missing_data: list[str],
    *,
    classification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    classification = classification or {}
    out_of_book_ply = _optional_int(classification.get("out_of_book_ply"))
    return {
        "schema_version": OPENING_REALITY_EVIDENCE_VERSION,
        "opening_reality_evidence_version": OPENING_REALITY_EVIDENCE_VERSION,
        "available": False,
        "status": "missing_data",
        "opening_name": _optional_str(classification.get("opening_name")),
        "eco": _optional_str(classification.get("eco_code")),
        "source": _opening_source(classification.get("source")),
        "book_until_ply": _optional_int(classification.get("last_book_ply")),
        "last_book_ply": _optional_int(classification.get("last_book_ply")),
        "last_book_move_san": None,
        "last_book_move_uci": None,
        "last_book_fen": None,
        "out_of_book_ply": out_of_book_ply,
        "out_of_book_move_san": None,
        "out_of_book_move_uci": None,
        "out_of_book_fen": _optional_str(classification.get("out_of_book_fen")),
        "exit_ply": out_of_book_ply,
        "exit_move_san": None,
        "exit_move_uci": None,
        "fen_before_exit": _optional_str(classification.get("out_of_book_fen")),
        "fen_after_exit": None,
        "move_number_exit": _move_number_from_ply(out_of_book_ply) if out_of_book_ply else None,
        "exit_color": _optional_str(classification.get("out_of_book_color")),
        "side_to_move_at_exit": _optional_str(classification.get("out_of_book_color")),
        "critical_moment_after_exit": None,
        "first_loss_after_exit": None,
        "summary": "Données d'ouverture insuffisantes pour établir un diagnostic fiable.",
        "recommendation": "Relance la classification d'ouverture si tu veux ce diagnostic.",
        "confidence": "low",
        "missing_data": missing_data,
    }


def _first_critical_moment_after_exit(
    annotations: list[dict[str, Any]],
    out_of_book_ply: int,
) -> dict[str, Any] | None:
    for annotation in _annotations_after_exit(annotations, out_of_book_ply):
        tags = set(annotation.get("tags") or [])
        category = str(annotation.get("primary_category") or "")
        win_loss = _optional_float(annotation.get("win_loss"))
        if (
            category in _CRITICAL_PRIMARY_CATEGORIES
            or tags.intersection(_OPENING_EXIT_TAGS)
            or (
                win_loss is not None
                and win_loss >= SIGNIFICANT_OPENING_EXIT_WIN_LOSS
            )
        ):
            return _moment_payload(annotation)
    return None


def _first_loss_after_exit(
    annotations: list[dict[str, Any]],
    out_of_book_ply: int,
) -> dict[str, Any] | None:
    for annotation in _annotations_after_exit(annotations, out_of_book_ply):
        win_loss = _optional_float(annotation.get("win_loss"))
        if win_loss is not None and win_loss >= SIGNIFICANT_OPENING_EXIT_WIN_LOSS:
            return _moment_payload(annotation)
    return None


def _annotations_after_exit(
    annotations: list[dict[str, Any]],
    out_of_book_ply: int,
) -> list[dict[str, Any]]:
    end_ply = out_of_book_ply + SEARCH_WINDOW_AFTER_EXIT_PLIES
    return sorted(
        [
            annotation
            for annotation in annotations
            if out_of_book_ply
            <= (_optional_int(annotation.get("ply")) or -1)
            <= end_ply
        ],
        key=lambda item: _optional_int(item.get("ply")) or 0,
    )


def _moment_payload(annotation: dict[str, Any]) -> dict[str, Any]:
    return {
        "ply": _optional_int(annotation.get("ply")),
        "move_number": _optional_int(annotation.get("move_number")),
        "move_san": _optional_str(annotation.get("san")),
        "move_uci": _optional_str(annotation.get("uci")),
        "color": _optional_str(annotation.get("color") or annotation.get("side")),
        "category": _optional_str(annotation.get("primary_category")),
        "category_label": _optional_str(annotation.get("category_label")),
        "tags": list(annotation.get("tags") or []),
        "win_loss": _round_optional(annotation.get("win_loss")),
        "impact_label": _optional_str(annotation.get("impact_label")),
        "reason": _moment_reason(annotation),
    }


def _moment_reason(annotation: dict[str, Any]) -> str:
    tags = set(annotation.get("tags") or [])
    if "missed_opportunity" in tags:
        return "opportunité manquée juste après la sortie du livre"
    if "conversion_issue" in tags:
        return "conversion moins précise après la sortie"
    if "defensive_resource_missed" in tags:
        return "ressource défensive manquée après la sortie"
    if "persistent_loss" in tags:
        return "perte durable après la sortie du livre"
    if "cluster" in tags:
        return "enchaînement d'erreurs après la sortie"
    category = str(annotation.get("primary_category") or "")
    if category in {"critical", "decisive"}:
        return "moment critique peu après la sortie du livre"
    if category == "to_review":
        return "coup à revoir peu après la sortie du livre"
    win_loss = _optional_float(annotation.get("win_loss"))
    if win_loss is not None and win_loss >= SIGNIFICANT_OPENING_EXIT_WIN_LOSS:
        return "perte significative peu après la sortie du livre"
    return _optional_str(annotation.get("reason")) or "moment lié à la sortie du livre"


def _summary(
    *,
    opening_name: str | None,
    out_of_book_ply: int,
    linked_moment: dict[str, Any] | None,
) -> str:
    opening_label = opening_name or "ouverture non classifiée"
    exit_move = _move_number_from_ply(out_of_book_ply)
    if linked_moment:
        move_number = linked_moment.get("move_number") or _move_number_from_ply(
            _optional_int(linked_moment.get("ply")) or out_of_book_ply
        )
        impact = _optional_float(linked_moment.get("win_loss"))
        impact_text = f", impact -{round(impact)} %" if impact is not None else ""
        return (
            f"Ouverture détectée : {opening_label}. La partie sort du livre au coup "
            f"{exit_move}. Le premier vrai problème arrive peu après : coup "
            f"{move_number}{impact_text}."
        )
    return (
        f"Ouverture détectée : {opening_label}. La partie sort du livre au coup "
        f"{exit_move}. La sortie du livre n'a pas immédiatement entraîné de perte importante."
    )


def _recommendation(linked_moment: dict[str, Any] | None) -> str:
    if linked_moment:
        return "Revoir la position de sortie, puis le premier moment critique lié."
    return "Revoir la position de sortie et vérifier le plan choisi juste après le livre."


def _confidence(
    opening_classification: dict[str, Any],
    missing_data: list[str],
) -> str:
    if missing_data:
        return "low"
    raw = str(opening_classification.get("confidence") or "low")
    if raw in {"low", "medium", "high"}:
        return raw
    return "low"


def _book_until_ply(
    opening_classification: dict[str, Any],
    out_of_book_ply: int,
) -> int | None:
    last_book_ply = _optional_int(opening_classification.get("last_book_ply"))
    if last_book_ply is not None:
        return last_book_ply
    return max(0, out_of_book_ply - 1)


def _opening_source(source: Any) -> str:
    value = str(source or "").strip()
    if value == "lichess_chess_openings":
        return "lichess_book"
    if value == "internal_seed":
        return "local_book"
    return "unknown"


def _initial_fen_for_game(game: Any | None, moves: list[Any]) -> str:
    initial_fen = _optional_str(_value(game, "initial_fen"))
    if initial_fen:
        return initial_fen
    if moves:
        first_fen = _optional_str(_value(moves[0], "fen_before"))
        if first_fen:
            return first_fen
    return chess.STARTING_FEN


def _is_standard_starting_fen(fen: str) -> bool:
    try:
        return chess.Board(fen).fen() == chess.STARTING_FEN
    except Exception:
        return False


def _side_to_move(fen: str | None) -> str | None:
    if not fen:
        return None
    try:
        return "white" if chess.Board(fen).turn == chess.WHITE else "black"
    except Exception:
        return None


def _fen_after_move(fen: str | None, uci: str | None) -> str | None:
    if not fen or not uci:
        return None
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            return None
        board.push(move)
        return board.fen()
    except Exception:
        return None


def _move_number_from_ply(ply: int) -> int:
    return max(1, (ply + 1) // 2)


def _value(row: Any | None, key: str, default: Any = None) -> Any:
    if row is None:
        return default
    if isinstance(row, dict):
        return row.get(key, default)
    try:
        keys = row.keys()
    except AttributeError:
        return getattr(row, key, default)
    return row[key] if key in keys else default


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


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


def _round_optional(value: Any, digits: int = 3) -> float | None:
    number = _optional_float(value)
    return round(number, digits) if number is not None else None
