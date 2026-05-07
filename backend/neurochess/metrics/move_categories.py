from __future__ import annotations

from typing import Any

from neurochess.metrics.review_metrics import (
    clamp,
    player_percent_from_eval,
)
from neurochess.metrics.review_moment_importance import (
    GOOD_DECISION,
    INFORMATIONAL,
    MICRO_GAP,
    PRIORITY_TRAINING,
    SECONDARY_TRAINING,
)


MOVE_CATEGORY_FORMULA_VERSION = "neuro_move_categories_v1"
REVIEW_SECTIONS_VERSION = "neuro_review_sections_v1"

PRIMARY_CATEGORY_LABELS = {
    "book": "Livre",
    "best": "Meilleur",
    "excellent": "Excellent",
    "very_good": "Très bon",
    "good": "Bon",
    "playable": "Jouable",
    "inexact": "Imprécis",
    "to_review": "À revoir",
    "critical": "Critique",
    "decisive": "Décisif",
    "unknown": "Non classé",
}

TAG_LABELS = {
    "book": "Livre",
    "strong_find": "Coup fort",
    "missed_opportunity": "Opportunité manquée",
    "persistent_loss": "Perte persistante",
    "cluster": "Série d'erreurs",
    "conversion_issue": "Conversion",
    "defensive_resource_missed": "Défense manquée",
    "decisive": "Décisif",
}

TO_REVIEW_TAGS = {
    "missed_opportunity",
    "conversion_issue",
    "defensive_resource_missed",
    "persistent_loss",
    "cluster",
}

MISSED_OPPORTUNITY_TAGS = {
    "missed_opportunity",
    "conversion_issue",
    "defensive_resource_missed",
}


def categorize_review_move(move_metrics: dict[str, Any]) -> dict[str, Any]:
    """Categorize one analyzed move using Win% loss as the canonical signal."""
    win_loss = _optional_float(move_metrics.get("win_loss"))
    move_accuracy = _optional_float(
        move_metrics.get("move_accuracy")
        if move_metrics.get("move_accuracy") is not None
        else move_metrics.get("lichess_like_move_accuracy")
    )
    criticality = _optional_float(move_metrics.get("criticality_score")) or 0.0
    player_before = _optional_float(move_metrics.get("player_percent_before"))
    player_after = _optional_float(move_metrics.get("player_percent_after"))
    persistence_weight = _optional_float(move_metrics.get("persistence_weight")) or 1.0
    cluster_weight = _optional_float(move_metrics.get("cluster_weight")) or 1.0
    is_book = bool(move_metrics.get("is_book"))
    top_moves = _top_moves_from_metrics(move_metrics)
    best_move_uci = _top_move_uci(top_moves)
    missed_gain = _missed_gain(
        move_metrics=move_metrics,
        top_moves=top_moves,
        player_after=player_after,
    )
    decisive = _is_decisive(move_metrics, win_loss, criticality)
    critical_anomaly = (win_loss is not None and win_loss > 35.0) or criticality >= 25.0

    if win_loss is None and move_accuracy is None:
        primary = "unknown"
    elif is_book and not decisive and not critical_anomaly:
        primary = "book"
    elif decisive:
        primary = "decisive"
    elif critical_anomaly:
        primary = "critical"
    elif _matches_threshold(win_loss, move_accuracy, 0.5, 99.0):
        primary = "best"
    elif _matches_threshold(win_loss, move_accuracy, 2.0, 95.0):
        primary = "excellent"
    elif _matches_threshold(win_loss, move_accuracy, 4.0, 90.0):
        primary = "very_good"
    elif _matches_threshold(win_loss, move_accuracy, 7.0, 80.0):
        primary = "good"
    elif _matches_threshold(win_loss, move_accuracy, 12.0, 65.0):
        primary = "playable"
    elif _matches_threshold(win_loss, move_accuracy, 20.0, 45.0):
        primary = "inexact"
    elif (win_loss is not None and win_loss <= 35.0) or criticality >= 10.0:
        primary = "to_review"
    else:
        primary = "critical"

    tags: list[str] = []
    if is_book:
        tags.append("book")
    if _is_strong_find(
        primary=primary,
        win_loss=win_loss,
        move_accuracy=move_accuracy,
        player_before=player_before,
        top_moves=top_moves,
        side=str(move_metrics.get("side") or move_metrics.get("color") or ""),
        criticality=criticality,
    ):
        tags.append("strong_find")
    if (
        missed_gain is not None
        and missed_gain >= 10.0
        and primary not in {"best", "excellent"}
        and (player_before is None or player_before > 10.0)
    ):
        tags.append("missed_opportunity")
    if decisive:
        tags.append("decisive")
    if persistence_weight > 1.10:
        tags.append("persistent_loss")
    if cluster_weight > 1.10:
        tags.append("cluster")
    if player_before is not None and win_loss is not None:
        if player_before >= 75.0 and win_loss >= 10.0:
            tags.append("conversion_issue")
        if player_before <= 35.0 and missed_gain is not None and missed_gain >= 10.0:
            tags.append("defensive_resource_missed")

    tags = _dedupe(tags)
    return {
        "primary_category": primary,
        "category_label": PRIMARY_CATEGORY_LABELS[primary],
        "tags": tags,
        "tag_labels": [TAG_LABELS[tag] for tag in tags if tag in TAG_LABELS],
        "missed_gain": _round_optional(missed_gain),
        "best_move_uci": best_move_uci,
        "reason": move_category_reason(primary, tags),
        "section_priority": _section_priority(
            win_loss=win_loss,
            criticality=criticality,
            missed_gain=missed_gain,
            neuro_diagnostic_loss=_optional_float(
                move_metrics.get("neuro_diagnostic_loss")
            ),
        ),
        "move_category_formula_version": MOVE_CATEGORY_FORMULA_VERSION,
    }


def build_review_sections(
    annotations: list[dict[str, Any]],
    *,
    limit: int = 10,
) -> dict[str, list[dict[str, Any]]]:
    analyzed = [
        annotation
        for annotation in annotations
        if annotation.get("primary_category") != "unknown"
    ]
    priority_training = [
        annotation
        for annotation in analyzed
        if annotation.get("moment_importance") == PRIORITY_TRAINING
    ]
    secondary_training = [
        annotation
        for annotation in analyzed
        if annotation.get("moment_importance") == SECONDARY_TRAINING
    ]
    micro_gaps = [
        annotation
        for annotation in analyzed
        if annotation.get("moment_importance") == MICRO_GAP
    ]
    good_decisions = [
        annotation
        for annotation in analyzed
        if annotation.get("moment_importance") == GOOD_DECISION
    ]
    informational = [
        annotation
        for annotation in analyzed
        if annotation.get("moment_importance") == INFORMATIONAL
    ]
    legacy_to_review = [
        annotation
        for annotation in analyzed
        if annotation.get("primary_category") in {"to_review", "critical", "decisive"}
        or TO_REVIEW_TAGS.intersection(annotation.get("tags") or [])
    ]
    to_review = priority_training + [
        annotation for annotation in secondary_training if annotation not in priority_training
    ]
    if not to_review:
        to_review = legacy_to_review
    strong_moves = [
        annotation
        for annotation in analyzed
        if annotation.get("primary_category") in {"best", "excellent"}
        or "strong_find" in (annotation.get("tags") or [])
    ]
    missed = [
        annotation
        for annotation in analyzed
        if MISSED_OPPORTUNITY_TAGS.intersection(annotation.get("tags") or [])
    ]
    return {
        "priority_training": sorted(
            priority_training,
            key=lambda item: (
                -float(item.get("section_priority") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "secondary_training": sorted(
            secondary_training,
            key=lambda item: (
                -float(item.get("section_priority") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "micro_gaps": sorted(
            micro_gaps,
            key=lambda item: (
                int(item.get("ply") or 0),
                -float(item.get("move_accuracy") or 0.0),
            ),
        )[:limit],
        "good_decisions": sorted(
            good_decisions,
            key=lambda item: (
                0 if "strong_find" in (item.get("tags") or []) else 1,
                -float(item.get("move_accuracy") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "informational": sorted(
            informational,
            key=lambda item: int(item.get("ply") or 0),
        )[:limit],
        "to_review": sorted(
            to_review,
            key=lambda item: (
                -float(item.get("section_priority") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "strong_moves": sorted(
            strong_moves,
            key=lambda item: (
                0 if "strong_find" in (item.get("tags") or []) else 1,
                -float(item.get("move_accuracy") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "missed_opportunities": sorted(
            missed,
            key=lambda item: (
                -float(item.get("missed_gain") or 0.0),
                -float(item.get("criticality_score") or 0.0),
                int(item.get("ply") or 0),
            ),
        )[:limit],
        "all": sorted(analyzed, key=lambda item: int(item.get("ply") or 0)),
    }


def move_category_reason(primary_category: str, tags: list[str]) -> str:
    if "defensive_resource_missed" in tags:
        return "Ressource défensive manquée."
    if "conversion_issue" in tags:
        return "Position gagnante moins bien convertie."
    if "missed_opportunity" in tags:
        return "Opportunité tactique manquée."
    if "persistent_loss" in tags:
        return "Erreur persistante dans la suite."
    if "cluster" in tags:
        return "Erreur dans une séquence déjà fragile."
    if "strong_find" in tags:
        return "Bon coup dans une position critique."
    if primary_category == "book":
        return "Coup de livre."
    if primary_category in {"critical", "decisive"}:
        return "Perte importante de chances de gain."
    if primary_category in {"best", "excellent", "very_good"}:
        return "Coup précis dans la position."
    if primary_category in {"good", "playable"}:
        return "Coup jouable avec peu de perte."
    if primary_category == "inexact":
        return "Petite imprécision à surveiller."
    if primary_category == "to_review":
        return "Coup à revoir pour comprendre la perte."
    return "Données insuffisantes pour classer le coup."


def _matches_threshold(
    win_loss: float | None,
    move_accuracy: float | None,
    loss_threshold: float,
    accuracy_threshold: float,
) -> bool:
    return (
        (win_loss is not None and win_loss <= loss_threshold)
        or (move_accuracy is not None and move_accuracy >= accuracy_threshold)
    )


def _is_decisive(
    move_metrics: dict[str, Any],
    win_loss: float | None,
    criticality: float,
) -> bool:
    mate_before = move_metrics.get("mate_before")
    mate_after = move_metrics.get("mate_after")
    return (
        (win_loss is not None and win_loss >= 60.0)
        or criticality >= 50.0
        or ((mate_before is not None or mate_after is not None) and (win_loss or 0.0) >= 20.0)
    )


def _is_strong_find(
    *,
    primary: str,
    win_loss: float | None,
    move_accuracy: float | None,
    player_before: float | None,
    top_moves: list[dict[str, Any]],
    side: str,
    criticality: float,
) -> bool:
    if primary == "book" or move_accuracy is None or win_loss is None:
        return False
    if move_accuracy < 95.0 or win_loss > 2.0:
        return False
    return (
        (player_before is not None and 20.0 <= player_before <= 80.0)
        or _best_alternative_gap(top_moves, side) >= 5.0
        or criticality >= 10.0
    )


def _best_alternative_gap(top_moves: list[dict[str, Any]], side: str) -> float:
    if len(top_moves) < 2 or side not in {"white", "black"}:
        return 0.0
    best = _top_move_player_percent(top_moves[0], side)
    second = _top_move_player_percent(top_moves[1], side)
    if best is None or second is None:
        return 0.0
    return max(0.0, best - second)


def _missed_gain(
    *,
    move_metrics: dict[str, Any],
    top_moves: list[dict[str, Any]],
    player_after: float | None,
) -> float | None:
    if player_after is None or not top_moves:
        return None
    best_uci = _top_move_uci(top_moves)
    played_uci = move_metrics.get("uci")
    if best_uci is not None and played_uci is not None and best_uci == played_uci:
        return 0.0
    side = str(move_metrics.get("side") or move_metrics.get("color") or "")
    if side not in {"white", "black"}:
        return None
    best_player_after = _top_move_player_percent(top_moves[0], side)
    if best_player_after is None:
        return None
    return max(0.0, best_player_after - player_after)


def _top_move_player_percent(top_move: dict[str, Any], side: str) -> float | None:
    eval_cp = _optional_float(top_move.get("eval_cp"))
    mate_in = _optional_int(top_move.get("mate_in"))
    if eval_cp is None and mate_in is None:
        return None
    return player_percent_from_eval(eval_cp, mate_in, side)


def _top_moves_from_metrics(move_metrics: dict[str, Any]) -> list[dict[str, Any]]:
    direct = move_metrics.get("top_moves")
    if isinstance(direct, list):
        return [move for move in direct if isinstance(move, dict)]
    evidence = move_metrics.get("review_evidence")
    if isinstance(evidence, dict) and isinstance(evidence.get("top_moves"), list):
        return [move for move in evidence["top_moves"] if isinstance(move, dict)]
    return []


def _top_move_uci(top_moves: list[dict[str, Any]]) -> str | None:
    if not top_moves:
        return None
    value = top_moves[0].get("uci")
    return str(value) if value is not None else None


def _section_priority(
    *,
    win_loss: float | None,
    criticality: float,
    missed_gain: float | None,
    neuro_diagnostic_loss: float | None,
) -> float:
    return round(
        max(
            win_loss or 0.0,
            criticality,
            missed_gain or 0.0,
            neuro_diagnostic_loss or 0.0,
        ),
        3,
    )


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _round_optional(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(float(clamp(value, -100.0, 100.0)), digits)


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped
