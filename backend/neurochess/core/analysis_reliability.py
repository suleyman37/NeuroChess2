from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


ANALYSIS_RELIABILITY_SCHEMA_VERSION = "analysis_reliability_v1"


@dataclass(frozen=True)
class AnalysisReliability:
    reliability_score: float
    label: str
    reasons: list[str]
    warnings: list[str]
    schema_version: str = ANALYSIS_RELIABILITY_SCHEMA_VERSION


def evaluate_analysis_reliability(
    depth: int | None = None,
    multipv: int | None = None,
    time_ms: int | None = None,
    has_mate: bool = False,
    engine: str | None = None,
    top_moves_count: int | None = None,
    pv_legal: bool = True,
) -> AnalysisReliability:
    """Estimate how cautious future UI/modules should be about an analysis.

    This is an internal prudence indicator, not a scientific truth about engine
    accuracy. Adjustments are cumulative and the score is clamped once at the
    end, preserving the MVP rules exactly.
    """
    _ = time_ms, engine
    score = 0.5
    reasons: list[str] = []
    warnings: list[str] = []

    if depth is None:
        score -= 0.20
        warnings.append("missing_depth")
    elif depth < 8:
        score -= 0.25
        reasons.append("very_low_depth")
    elif depth < 12:
        score -= 0.10
        reasons.append("low_depth")
    elif depth < 16:
        score += 0.05
        reasons.append("usable_depth")
    else:
        score += 0.20
        reasons.append("strong_depth")

    if multipv is None:
        score -= 0.05
    elif multipv == 1:
        reasons.append("single_line_only")
    elif multipv >= 3:
        score += 0.10
        reasons.append("multipv_available")

    if top_moves_count is None or top_moves_count == 0:
        score -= 0.25
        warnings.append("no_top_moves")
    elif top_moves_count == 1:
        score -= 0.05
    elif top_moves_count >= 3:
        score += 0.05

    if not pv_legal:
        score -= 0.40
        warnings.append("illegal_pv_detected")

    if has_mate:
        score += 0.10
        reasons.append("forced_mate_detected")

    reliability_score = _clamp_score(score)

    return AnalysisReliability(
        reliability_score=reliability_score,
        label=_label_for_score(reliability_score),
        reasons=reasons,
        warnings=warnings,
    )


def to_json_safe(reliability: AnalysisReliability) -> dict[str, Any]:
    return asdict(reliability)


def _clamp_score(score: float) -> float:
    return max(0.0, min(1.0, score))


def _label_for_score(score: float) -> str:
    if score < 0.4:
        return "low"
    if score < 0.75:
        return "medium"
    return "high"
