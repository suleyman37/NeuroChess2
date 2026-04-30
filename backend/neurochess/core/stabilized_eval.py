from __future__ import annotations

from dataclasses import asdict, dataclass
from math import exp
from statistics import median
from typing import Any


REVIEW_STABILIZED_EVAL_SOURCE_KIND = "review_stabilized_deep"
STABILIZED_EVAL_SCHEMA_VERSION = "review_stabilized_eval_v1"


@dataclass(frozen=True)
class StabilizedEval:
    fen: str
    final_eval_cp: int | None
    final_mate_in: int | None
    final_depth: int | None
    final_seldepth: int | None
    nodes: int | None
    time_ms: int | None
    pv: list[str]
    tail_scores_cp: list[int]
    tail_depths: list[int]
    tail_median_cp: float | None
    stability_cp: float | None
    reliability_score: float
    reliability_label: str
    engine_version: str
    source_kind: str = REVIEW_STABILIZED_EVAL_SOURCE_KIND
    schema_version: str = STABILIZED_EVAL_SCHEMA_VERSION

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_review_time_budget(half_moves_count: int) -> int:
    return int(_clamp(30 + float(half_moves_count), 45, 150))


def review_tail_window_ms(time_budget_ms: int) -> int:
    return int(_clamp(0.25 * float(time_budget_ms), 400, 800))


def build_stabilized_eval_from_final_analysis(
    fen: str,
    raw_analysis: dict[str, Any],
    analysis_time_ms: int | None = None,
) -> StabilizedEval:
    top_moves = raw_analysis.get("top_moves") or []
    top_move = top_moves[0] if top_moves else {}
    eval_cp = _optional_int(raw_analysis.get("eval_cp"))
    mate_in = _optional_int(raw_analysis.get("mate_in"))
    if eval_cp is None:
        eval_cp = _optional_int(top_move.get("eval_cp"))
    if mate_in is None:
        mate_in = _optional_int(top_move.get("mate_in"))

    sample = {
        "eval_cp": eval_cp,
        "mate_in": mate_in,
        "depth": raw_analysis.get("depth"),
        "seldepth": raw_analysis.get("seldepth"),
        "nodes": raw_analysis.get("nodes"),
        "time_ms": raw_analysis.get("time_ms") or analysis_time_ms,
        "pv": top_move.get("pv") or raw_analysis.get("pv") or [],
    }
    return build_stabilized_eval_from_samples(
        fen=fen,
        samples=[sample],
        engine_version=str(raw_analysis.get("engine_version") or "unknown"),
        time_budget_ms=analysis_time_ms,
    )


def build_stabilized_eval_from_samples(
    fen: str,
    samples: list[dict[str, Any]],
    engine_version: str = "unknown",
    time_budget_ms: int | None = None,
) -> StabilizedEval:
    normalized_samples = [_normalize_sample(sample) for sample in samples]
    normalized_samples = [
        sample
        for sample in normalized_samples
        if sample["eval_cp"] is not None or sample["mate_in"] is not None
    ]
    final = normalized_samples[-1] if normalized_samples else _normalize_sample({})
    final_eval_cp = final["eval_cp"]
    final_mate_in = final["mate_in"]
    final_depth = final["depth"]
    final_time_ms = final["time_ms"] or time_budget_ms or 0

    if final_mate_in is not None:
        return StabilizedEval(
            fen=fen,
            final_eval_cp=final_eval_cp,
            final_mate_in=final_mate_in,
            final_depth=final_depth,
            final_seldepth=final["seldepth"],
            nodes=final["nodes"],
            time_ms=final["time_ms"],
            pv=final["pv"],
            tail_scores_cp=[],
            tail_depths=[],
            tail_median_cp=None,
            stability_cp=None,
            reliability_score=1.0,
            reliability_label="mate_detected",
            engine_version=engine_version or "unknown",
        )

    tail_scores, tail_depths = _tail_cp_scores(
        normalized_samples,
        final_time_ms=final_time_ms,
        time_budget_ms=time_budget_ms,
    )
    tail_median = float(median(tail_scores)) if tail_scores else None
    stability = (
        float(max(tail_scores) - min(tail_scores))
        if len(tail_scores) >= 2
        else None
    )
    reliability_label = _stability_label(stability)
    reliability_score = _reliability_score(stability, final_depth)

    return StabilizedEval(
        fen=fen,
        final_eval_cp=final_eval_cp,
        final_mate_in=final_mate_in,
        final_depth=final_depth,
        final_seldepth=final["seldepth"],
        nodes=final["nodes"],
        time_ms=final["time_ms"],
        pv=final["pv"],
        tail_scores_cp=tail_scores,
        tail_depths=tail_depths,
        tail_median_cp=tail_median,
        stability_cp=stability,
        reliability_score=reliability_score,
        reliability_label=reliability_label,
        engine_version=engine_version or "unknown",
    )


def stabilized_eval_to_dict(value: StabilizedEval | dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, StabilizedEval):
        return value.to_dict()
    return dict(value)


def _tail_cp_scores(
    samples: list[dict[str, Any]],
    final_time_ms: int,
    time_budget_ms: int | None,
) -> tuple[list[int], list[int]]:
    budget_ms = time_budget_ms or final_time_ms or 0
    window_ms = review_tail_window_ms(budget_ms) if budget_ms else 800
    tail_start_ms = max(0, final_time_ms - window_ms)
    by_depth: dict[int, dict[str, Any]] = {}
    no_depth_samples: list[dict[str, Any]] = []

    for index, sample in enumerate(samples):
        eval_cp = sample["eval_cp"]
        if eval_cp is None or sample["mate_in"] is not None:
            continue
        sample_time = sample["time_ms"]
        if sample_time is not None and sample_time < tail_start_ms:
            continue
        depth = sample["depth"]
        if depth is None:
            no_depth_samples.append({**sample, "_index": index})
        else:
            by_depth[depth] = {**sample, "_index": index}

    ordered = sorted(
        [*by_depth.values(), *no_depth_samples],
        key=lambda item: int(item.get("_index") or 0),
    )
    return (
        [_optional_int(item["eval_cp"]) or 0 for item in ordered],
        [int(item["depth"]) for item in ordered if item["depth"] is not None],
    )


def _normalize_sample(sample: dict[str, Any]) -> dict[str, Any]:
    return {
        "eval_cp": _optional_int(sample.get("eval_cp")),
        "mate_in": _optional_int(sample.get("mate_in")),
        "depth": _optional_int(sample.get("depth")),
        "seldepth": _optional_int(sample.get("seldepth")),
        "nodes": _optional_int(sample.get("nodes")),
        "time_ms": _optional_int(sample.get("time_ms")),
        "pv": [str(move) for move in sample.get("pv") or []],
    }


def _stability_label(stability_cp: float | None) -> str:
    if stability_cp is None:
        return "unknown"
    if stability_cp <= 30:
        return "stable"
    if stability_cp <= 80:
        return "medium"
    return "unstable"


def _reliability_score(stability_cp: float | None, final_depth: int | None) -> float:
    if stability_cp is None:
        score = 0.6
    else:
        score = exp(-float(stability_cp) / 80.0)

    if final_depth is not None and final_depth < 12:
        score *= 0.75
    elif final_depth is not None and final_depth >= 20:
        score *= 1.05

    return round(_clamp(score, 0.0, 1.0), 3)


def _optional_int(value: Any) -> int | None:
    return int(value) if value is not None else None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
