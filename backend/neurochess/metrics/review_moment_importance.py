from __future__ import annotations

from typing import Any


REVIEW_MOMENT_IMPORTANCE_VERSION = "review_moment_importance_v1"

PRIORITY_TRAINING = "priority_training"
SECONDARY_TRAINING = "secondary_training"
MICRO_GAP = "micro_gap"
GOOD_DECISION = "good_decision"
INFORMATIONAL = "informational"
NO_MAJOR_MOMENT = "no_major_moment"

MOMENT_IMPORTANCE_LABELS = {
    PRIORITY_TRAINING: "Moment prioritaire",
    SECONDARY_TRAINING: "Moment secondaire",
    MICRO_GAP: "Micro-écart",
    GOOD_DECISION: "Bonne décision",
    INFORMATIONAL: "Observation",
    NO_MAJOR_MOMENT: "Aucun moment majeur",
}

MOMENT_IMPORTANCE_REASONS = {
    PRIORITY_TRAINING: (
        "Cette décision a fait perdre une ressource importante et se "
        "transforme en exercice utile."
    ),
    SECONDARY_TRAINING: (
        "Cette décision a coûté un peu de précision, mais l'impact reste "
        "limité."
    ),
    MICRO_GAP: (
        "Le moteur préfère une autre option, mais l'impact pratique est faible."
    ),
    GOOD_DECISION: "Bon choix dans la partie : cette idée mérite d'être consolidée.",
    INFORMATIONAL: "Observation utile, sans exercice prioritaire à forcer.",
    NO_MAJOR_MOMENT: (
        "La partie est restée trop propre ou équilibrée pour générer un "
        "exercice prioritaire."
    ),
}

TRAINING_TAGS = {
    "missed_opportunity",
    "conversion_issue",
    "defensive_resource_missed",
    "persistent_loss",
    "cluster",
    "decisive",
}

GOOD_PRIMARY_CATEGORIES = {"best", "excellent", "very_good", "good"}
LOSS_PRIMARY_CATEGORIES = {"inexact", "to_review", "critical", "decisive"}


def classify_review_moment_importance(
    move_metrics: dict[str, Any],
) -> dict[str, Any]:
    """Classify a Review move into a user-safe action category.

    This function is intentionally a product-routing layer over existing Review
    signals. It does not define a public numeric score, and it does not alter
    NeuroScore, due dates, or engine truth.
    """

    primary = str(move_metrics.get("primary_category") or "")
    tags = {str(tag) for tag in (move_metrics.get("tags") or [])}
    win_loss = _optional_float(move_metrics.get("win_loss"))
    criticality = _optional_float(move_metrics.get("criticality_score")) or 0.0
    missed_gain = _optional_float(move_metrics.get("missed_gain"))
    move_accuracy = _optional_float(move_metrics.get("move_accuracy"))
    ply = _optional_int(move_metrics.get("ply")) or 0
    player_before = _optional_float(
        move_metrics.get("player_percent_before")
        if move_metrics.get("player_percent_before") is not None
        else move_metrics.get("player_win_percent_before")
    )
    player_after = _optional_float(
        move_metrics.get("player_percent_after")
        if move_metrics.get("player_percent_after") is not None
        else move_metrics.get("player_win_percent_after")
    )
    is_book = bool(move_metrics.get("is_book")) or "book" in tags or primary == "book"
    has_best_move = bool(str(move_metrics.get("best_move_uci") or "").strip())
    tactical_or_forcing = primary in {"critical", "decisive"} or bool(tags & TRAINING_TAGS)
    balanced_band = _in_balanced_band(player_before) and _in_balanced_band(player_after)
    opening_like = is_book or 0 < ply <= 8
    already_lost = player_before is not None and player_before <= 10.0

    loss_value = win_loss or 0.0
    missed_value = missed_gain or 0.0

    if primary == "unknown" and win_loss is None and move_accuracy is None:
        return _importance_payload(INFORMATIONAL)

    if (
        primary in GOOD_PRIMARY_CATEGORIES
        and not is_book
        and loss_value <= 7.0
    ) or "strong_find" in tags:
        return _importance_payload(GOOD_DECISION, is_good_decision=True)

    if _is_micro_gap(
        opening_like=opening_like,
        balanced_band=balanced_band,
        tactical_or_forcing=tactical_or_forcing,
        is_book=is_book,
        primary=primary,
        win_loss=win_loss,
        criticality=criticality,
        missed_gain=missed_gain,
    ):
        return _importance_payload(MICRO_GAP, is_micro_gap=True)

    meaningful_loss = (
        primary in {"critical", "decisive"}
        or loss_value >= 15.0
        or criticality >= 18.0
        or missed_value >= 15.0
        or (tactical_or_forcing and loss_value >= 10.0)
    )
    if meaningful_loss and has_best_move and not (already_lost and loss_value < 20.0):
        return _importance_payload(PRIORITY_TRAINING, is_training_recommended=True)

    smaller_loss = (
        primary in LOSS_PRIMARY_CATEGORIES
        or loss_value >= 7.0
        or criticality >= 10.0
        or missed_value >= 7.0
    )
    if smaller_loss and has_best_move:
        return _importance_payload(SECONDARY_TRAINING)

    if primary in GOOD_PRIMARY_CATEGORIES or move_accuracy is not None and move_accuracy >= 80.0:
        return _importance_payload(GOOD_DECISION, is_good_decision=True)

    return _importance_payload(INFORMATIONAL)


def no_major_moment_payload() -> dict[str, Any]:
    return _importance_payload(NO_MAJOR_MOMENT)


def _is_micro_gap(
    *,
    opening_like: bool,
    balanced_band: bool,
    tactical_or_forcing: bool,
    is_book: bool,
    primary: str,
    win_loss: float | None,
    criticality: float,
    missed_gain: float | None,
) -> bool:
    loss_value = win_loss or 0.0
    missed_value = missed_gain or 0.0
    if tactical_or_forcing or missed_value >= 10.0:
        return False
    if is_book and criticality < 15.0 and loss_value <= 12.0:
        return True
    if win_loss is not None and abs(win_loss) < 2.0 and criticality < 10.0:
        return True
    if opening_like and balanced_band and loss_value <= 8.0 and criticality <= 14.0:
        return True
    if primary == "playable" and loss_value <= 7.0 and criticality < 10.0:
        return True
    return False


def _importance_payload(
    importance: str,
    *,
    is_training_recommended: bool = False,
    is_micro_gap: bool = False,
    is_good_decision: bool = False,
) -> dict[str, Any]:
    return {
        "moment_importance": importance,
        "moment_group": importance,
        "moment_label": MOMENT_IMPORTANCE_LABELS[importance],
        "moment_reason": MOMENT_IMPORTANCE_REASONS[importance],
        "moment_importance_version": REVIEW_MOMENT_IMPORTANCE_VERSION,
        "is_training_recommended": bool(is_training_recommended),
        "is_micro_gap": bool(is_micro_gap),
        "is_good_decision": bool(is_good_decision),
    }


def _in_balanced_band(value: float | None) -> bool:
    return value is not None and 38.0 <= value <= 62.0


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
