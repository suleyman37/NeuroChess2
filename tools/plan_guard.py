"""Lightweight Plan1/Plan2 UI guard for NeuroChess.

This is intentionally small: it scans normal frontend source files for V1
surface terms that Plan1/Plan2 keep out of the user-facing product.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend" / "src"


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]
    include: tuple[str, ...]
    suggestion: str
    allow: tuple[str, ...] = ()


RULES = [
    Rule(
        name="forbidden V1 visual metaphor",
        pattern=re.compile(
            r"NeuroMonitor|NeuroBrain|BrainAtlas|CognitiveMap|neuro3d|"
            r"\bbrain\b|cortex|atlas cognitif|cognitive map",
            re.IGNORECASE,
        ),
        include=("frontend/src",),
        suggestion="remove from V1 UI or move to research backlog",
    ),
    Rule(
        name="raw diagnostic metric in Review UI",
        pattern=re.compile(
            r"diagnostic_gap|criticality_score|neuro_score_diag|Stockfish WDL",
            re.IGNORECASE,
        ),
        include=("frontend/src/components/review",),
        suggestion="hide in folded debug/advanced UI only",
        allow=(
            "frontend/src/components/review/ReviewTechnicalDetails.tsx",
            "frontend/src/components/review/reviewViewModel.ts",
        ),
    ),
    Rule(
        name="research feature exposed in navigation/UI",
        pattern=re.compile(
            r"Candidate Trainer|Intent Layer|LLM coach|Transfer Gap|domain score",
            re.IGNORECASE,
        ),
        include=("frontend/src",),
        suggestion="backlog as V2/V3/research, not V1 normal UI",
    ),
]


def iter_source_files() -> list[Path]:
    if not FRONTEND_SRC.exists():
        return []
    return [
        path
        for path in FRONTEND_SRC.rglob("*")
        if path.is_file() and path.suffix in {".ts", ".tsx", ".css", ".html"}
    ]


def normalized(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def applies(rule: Rule, rel: str) -> bool:
    return any(rel.startswith(prefix) for prefix in rule.include) and rel not in rule.allow


def main() -> int:
    findings: list[str] = []
    for path in iter_source_files():
        rel = normalized(path)
        text = path.read_text(encoding="utf-8", errors="ignore")
        for rule in RULES:
            if not applies(rule, rel):
                continue
            for match in rule.pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                findings.append(
                    f"{rel}:{line}: {rule.name}: {match.group(0)} "
                    f"(suggestion: {rule.suggestion})"
                )

    if findings:
        print("Plan guard failed:")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("Plan guard passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
