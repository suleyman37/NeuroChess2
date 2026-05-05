from __future__ import annotations

from math import ceil, exp, floor, sqrt
from typing import Any


WIN_PERCENT_COEFFICIENT = 0.00368208
MOVE_ACCURACY_FORMULA_VERSION = "lichess_exp_uncertainty_v1"
GAME_ACCURACY_FORMULA_VERSION = "lichess_weighted_harmonic_v1"
NEURO_SCORE_FORMULA_VERSION = "neuro_diagnostic_regularized_v1"
DUAL_REVIEW_SCORE_FORMULA_VERSION = "dual_lichess_neuro_v1"
HEADLINE_SCORE_FORMULA_VERSION = "headline_neurochess_score_v2"
COACH_REFERENCE_ACCURACY_WEIGHT = 0.35
COACH_NEURO_DIAG_WEIGHT = 0.65


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def white_percent_from_eval(eval_cp: int | float | None, mate_in: int | None) -> float:
    if mate_in is not None:
        if mate_in > 0:
            return 100.0
        if mate_in < 0:
            return 0.0
        return 50.0

    cp = 0.0 if eval_cp is None else float(eval_cp)
    exponent = -WIN_PERCENT_COEFFICIENT * cp
    if exponent > 700:
        return 0.0
    if exponent < -700:
        return 100.0
    return 100.0 / (1.0 + exp(exponent))


def player_percent_from_white_percent(white_percent: float, side: str) -> float:
    if side == "white":
        return float(white_percent)
    if side == "black":
        return 100.0 - float(white_percent)
    raise ValueError(f"Unsupported side: {side}")


def player_percent_from_eval(
    eval_cp: int | float | None,
    mate_in: int | None,
    side: str,
) -> float:
    return player_percent_from_white_percent(
        white_percent_from_eval(eval_cp, mate_in),
        side,
    )


def win_loss_from_player_percents(
    player_percent_before: float,
    player_percent_after: float,
) -> float:
    return max(0.0, float(player_percent_before) - float(player_percent_after))


def mover_win_percent_loss(
    eval_before_cp: int | None,
    mate_before: int | None,
    eval_after_cp: int | None,
    mate_after: int | None,
    played_by: str,
) -> float:
    before = player_percent_from_eval(eval_before_cp, mate_before, played_by)
    after = player_percent_from_eval(eval_after_cp, mate_after, played_by)
    return round(win_loss_from_player_percents(before, after), 3)


def move_accuracy_from_win_loss(win_loss: float) -> float:
    raw_accuracy = (
        103.1668100711649
        * exp(-0.04354415386753951 * max(0.0, float(win_loss)))
        - 3.166924740191411
    )
    return round(clamp(raw_accuracy + 1.0, 0.0, 100.0), 3)


def headline_neurochess_score(
    lichess_like_accuracy: float | None,
    neuro_score: float | None,
    diagnostic_gap: float | None = None,
) -> float | None:
    """UX display score: keep public accuracy neutral, temper it by diagnostic gap."""
    if lichess_like_accuracy is None:
        return None
    lichess_score = float(lichess_like_accuracy)
    if neuro_score is None:
        if diagnostic_gap is None:
            return _round_optional(clamp(lichess_score, 0.0, 100.0), 2)
        penalty = COACH_NEURO_DIAG_WEIGHT * max(0.0, float(diagnostic_gap))
        return _round_optional(clamp(lichess_score - penalty, 0.0, 100.0), 2)
    raw_neuro = float(neuro_score)
    return _round_optional(
        clamp(
            COACH_REFERENCE_ACCURACY_WEIGHT * lichess_score
            + COACH_NEURO_DIAG_WEIGHT * raw_neuro,
            0.0,
            100.0,
        ),
        2,
    )


def _round_optional(value: float | None, digits: int = 3) -> float | None:
    return round(float(value), digits) if value is not None else None


def _standard_deviation(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    return sqrt(sum((value - mean) ** 2 for value in values) / len(values))


def _window_bounds(index: int, total: int, window_size: int) -> tuple[int, int]:
    half = max(1, window_size // 2)
    start = max(0, index - half)
    end = min(total, start + window_size)
    start = max(0, end - window_size)
    return start, end


def lichess_like_game_accuracy(
    moves: list[dict[str, Any]],
) -> dict[str, Any]:
    n = len(moves)
    if n == 0:
        return {
            "score": None,
            "weighted_mean": None,
            "harmonic_mean": None,
            "window_size": None,
            "volatility_weights": [],
        }

    window_size = int(clamp(floor(n / 10), 2, 8))
    weights: list[float] = []
    weighted_total = 0.0
    weight_total = 0.0
    for index, move in enumerate(moves):
        start, end = _window_bounds(index, n, window_size)
        window_values: list[float] = []
        for window_move in moves[start:end]:
            before = window_move.get("player_percent_before")
            after = window_move.get("player_percent_after")
            if before is not None:
                window_values.append(float(before))
            if after is not None:
                window_values.append(float(after))
        volatility = _standard_deviation(window_values)
        weight = clamp(volatility, 0.5, 12.0)
        weights.append(round(weight, 3))
        accuracy = float(move["move_accuracy"])
        weighted_total += accuracy * weight
        weight_total += weight

    weighted_mean = weighted_total / weight_total if weight_total > 0 else None
    epsilon = 1e-6
    harmonic_mean = n / sum(
        1.0 / max(float(move["move_accuracy"]), epsilon) for move in moves
    )
    score = (
        clamp((weighted_mean + harmonic_mean) / 2.0, 0.0, 100.0)
        if weighted_mean is not None
        else None
    )
    return {
        "score": _round_optional(score, 2),
        "weighted_mean": _round_optional(weighted_mean, 3),
        "harmonic_mean": _round_optional(harmonic_mean, 3),
        "window_size": window_size,
        "volatility_weights": weights,
    }


def _future_player_percents(
    move: dict[str, Any],
    timeline: list[dict[str, Any]],
    side: str,
    window_plies: int,
) -> list[float]:
    ply = int(move["ply"])
    future: list[float] = []
    for row in timeline:
        row_ply = int(row.get("ply") or 0)
        if row_ply <= ply or row_ply > ply + window_plies:
            continue
        white_after = row.get("white_percent_after")
        if white_after is not None:
            future.append(player_percent_from_white_percent(float(white_after), side))
    return future


def neuro_diagnostic_score(
    moves: list[dict[str, Any]],
    timeline: list[dict[str, Any]] | None = None,
    future_window_plies: int = 10,
) -> dict[str, Any]:
    n = len(moves)
    if n == 0:
        return {
            "score": None,
            "moves": [],
            "mean_win_loss": None,
            "tail_win_loss": None,
            "mean_diagnostic_loss": None,
            "tail_diagnostic_loss": None,
            "max_win_loss": None,
        }

    timeline_rows = timeline or moves
    enriched: list[dict[str, Any]] = []
    cluster_memory = 0.0
    for move in moves:
        side = str(move["side"])
        win_loss = max(0.0, float(move["win_loss"]))
        future = _future_player_percents(move, timeline_rows, side, future_window_plies)
        if future:
            future_avg = sum(future) / len(future)
            persistent_loss = max(0.0, float(move["player_percent_before"]) - future_avg)
            persistence_ratio = clamp(persistent_loss / max(win_loss, 1.0), 0.0, 1.0)
            persistence_weight = 1.0 + 0.25 * persistence_ratio
        else:
            persistence_weight = 1.0

        cluster_weight = 1.0 + 0.25 * clamp(cluster_memory / 50.0, 0.0, 1.0)
        omega = clamp(persistence_weight * cluster_weight, 1.0, 1.75)
        diagnostic_loss = win_loss * omega
        enriched.append(
            {
                **move,
                "persistence_weight": round(persistence_weight, 3),
                "cluster_weight": round(cluster_weight, 3),
                "omega": round(omega, 3),
                "neuro_diagnostic_loss": round(diagnostic_loss, 3),
            }
        )
        cluster_memory = 0.6 * cluster_memory + win_loss

    diagnostic_losses = [float(move["neuro_diagnostic_loss"]) for move in enriched]
    win_losses = [float(move["win_loss"]) for move in enriched]
    tail_count = min(max(3, ceil(0.10 * n)), n)
    tail_diagnostic = sorted(diagnostic_losses, reverse=True)[:tail_count]
    tail_win = sorted(win_losses, reverse=True)[:tail_count]
    mean_diagnostic_loss = sum(diagnostic_losses) / n
    tail_diagnostic_loss = sum(tail_diagnostic) / tail_count
    mean_win_loss = sum(win_losses) / n
    tail_win_loss = sum(tail_win) / tail_count
    z_value = 0.65 * mean_diagnostic_loss + 0.35 * tail_diagnostic_loss
    score = clamp(100.0 * exp(-0.035 * z_value), 0.0, 100.0)
    return {
        "score": _round_optional(score, 2),
        "moves": enriched,
        "mean_win_loss": _round_optional(mean_win_loss, 3),
        "tail_win_loss": _round_optional(tail_win_loss, 3),
        "mean_diagnostic_loss": _round_optional(mean_diagnostic_loss, 3),
        "tail_diagnostic_loss": _round_optional(tail_diagnostic_loss, 3),
        "max_win_loss": _round_optional(max(win_losses), 3),
        "tail_count": tail_count,
        "z_value": _round_optional(z_value, 3),
    }


def review_metric_bundle(
    moves: list[dict[str, Any]],
    *,
    timeline: list[dict[str, Any]] | None = None,
    missing_moves: int = 0,
    coverage: float | None = None,
    confidence: str = "low",
) -> dict[str, Any]:
    lichess = lichess_like_game_accuracy(moves)
    neuro = neuro_diagnostic_score(moves, timeline=timeline)
    lichess_score = lichess["score"]
    neuro_score = neuro["score"]
    diagnostic_gap = (
        round(float(lichess_score) - float(neuro_score), 2)
        if lichess_score is not None and neuro_score is not None
        else None
    )
    return {
        "lichess_like_accuracy": lichess_score,
        "neuro_score": neuro_score,
        "diagnostic_gap": diagnostic_gap,
        "move_count_analyzed": len(moves),
        "missing_moves": int(missing_moves),
        "coverage": coverage,
        "confidence": confidence,
        "weighted_mean": lichess["weighted_mean"],
        "harmonic_mean": lichess["harmonic_mean"],
        "volatility_window_size": lichess["window_size"],
        "volatility_weights": lichess["volatility_weights"],
        "mean_win_loss": neuro["mean_win_loss"],
        "tail_win_loss": neuro["tail_win_loss"],
        "mean_diagnostic_loss": neuro["mean_diagnostic_loss"],
        "tail_diagnostic_loss": neuro["tail_diagnostic_loss"],
        "max_win_loss": neuro["max_win_loss"],
        "tail_count": neuro.get("tail_count"),
        "z_value": neuro.get("z_value"),
        "formula_versions": {
            "move_accuracy_formula_version": MOVE_ACCURACY_FORMULA_VERSION,
            "game_accuracy_formula_version": GAME_ACCURACY_FORMULA_VERSION,
            "neuro_score_formula_version": NEURO_SCORE_FORMULA_VERSION,
        },
        "moves": neuro["moves"],
    }
