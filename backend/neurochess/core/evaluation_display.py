from __future__ import annotations

from dataclasses import asdict, dataclass
from math import exp
from typing import Any


EVALUATION_DISPLAY_SCHEMA_VERSION = "evaluation_display_v1"
LICHESS_WIN_PERCENT_COEFFICIENT = 0.00368208


@dataclass(frozen=True)
class EvaluationDisplay:
    white_percent: float
    black_percent: float
    label: str
    raw_cp: int | None
    mate_in: int | None
    is_mate: bool
    advantage_side: str
    magnitude: str
    schema_version: str = EVALUATION_DISPLAY_SCHEMA_VERSION


def cp_to_white_percent(cp: int) -> float:
    """Convert White POV centipawns into an eval-bar visualization percentage.

    This uses the Lichess Win% logistic curve as a visual non-linear transform.
    The returned percentage is for display only, not a win probability.
    """
    exponent = -LICHESS_WIN_PERCENT_COEFFICIENT * cp
    if exponent > 700:
        return 0.0
    if exponent < -700:
        return 100.0

    white_percent = 100.0 / (1.0 + exp(exponent))
    return _round_percent(_clamp_percent(white_percent))


def make_evaluation_display(
    eval_cp: int | None = None,
    mate_in: int | None = None,
) -> EvaluationDisplay:
    normalized_cp = _normalized_cp(eval_cp, mate_in)

    if mate_in is not None and mate_in > 0:
        white_percent = 100.0
    elif mate_in is not None and mate_in < 0:
        white_percent = 0.0
    else:
        white_percent = cp_to_white_percent(normalized_cp)

    white_percent, black_percent = _balanced_percentages(white_percent)
    advantage_side, magnitude = classify_advantage(eval_cp, mate_in)

    return EvaluationDisplay(
        white_percent=white_percent,
        black_percent=black_percent,
        label=format_eval_label(eval_cp, mate_in),
        raw_cp=eval_cp,
        mate_in=mate_in,
        is_mate=mate_in is not None,
        advantage_side=advantage_side,
        magnitude=magnitude,
    )


def format_eval_label(
    eval_cp: int | None = None,
    mate_in: int | None = None,
) -> str:
    if mate_in is not None:
        if mate_in > 0:
            return f"M{mate_in}"
        if mate_in < 0:
            return f"-M{abs(mate_in)}"
        return "M0"

    cp = 0 if eval_cp is None else eval_cp
    pawns = cp / 100.0
    return f"{pawns:+.2f}" if cp != 0 else "0.00"


def classify_advantage(
    eval_cp: int | None,
    mate_in: int | None,
) -> tuple[str, str]:
    if mate_in is not None:
        if mate_in > 0:
            return "white", "mate"
        if mate_in < 0:
            return "black", "mate"
        return "equal", "mate"

    cp = 0 if eval_cp is None else eval_cp
    abs_cp = abs(cp)

    if cp > 30:
        advantage_side = "white"
    elif cp < -30:
        advantage_side = "black"
    else:
        advantage_side = "equal"

    if abs_cp < 30:
        magnitude = "equal"
    elif abs_cp < 120:
        magnitude = "slight"
    elif abs_cp < 300:
        magnitude = "clear"
    else:
        magnitude = "winning"

    return advantage_side, magnitude


def to_json_safe(display: EvaluationDisplay) -> dict[str, Any]:
    return asdict(display)


def _normalized_cp(eval_cp: int | None, mate_in: int | None) -> int:
    if mate_in is not None:
        return 0
    return 0 if eval_cp is None else eval_cp


def _clamp_percent(value: float) -> float:
    return max(0.0, min(100.0, value))


def _round_percent(value: float) -> float:
    return round(value, 1)


def _balanced_percentages(white_percent: float) -> tuple[float, float]:
    white = _round_percent(_clamp_percent(white_percent))
    black = _round_percent(100.0 - white)
    return white, black
