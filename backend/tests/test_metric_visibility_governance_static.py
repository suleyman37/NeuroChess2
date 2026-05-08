from __future__ import annotations

import re
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
DOCS = PROJECT_ROOT / "docs"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def frontend_sources() -> dict[str, str]:
    sources: dict[str, str] = {}
    for path in FRONTEND_SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        rel = path.relative_to(PROJECT_ROOT).as_posix()
        sources[rel] = read(path)
    return sources


class MetricVisibilityGovernanceStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.sources = frontend_sources()
        self.normal_ui_sources = {
            rel: text
            for rel, text in self.sources.items()
            if rel
            not in {
                "frontend/src/api/client.ts",
                "frontend/src/components/review/ReviewTechnicalDetails.tsx",
            }
        }
        self.visible_copy_sources = {
            rel: text
            for rel, text in self.normal_ui_sources.items()
            if rel
            not in {
                "frontend/src/App.tsx",
                "frontend/src/components/review/reviewViewModel.ts",
            }
        }
        self.normal_ui_combined = "\n".join(self.normal_ui_sources.values())
        self.metric_registry = read(DOCS / "METRIC_REGISTRY.md")
        self.formulas = read(DOCS / "FORMULAS_AND_METRICS.md")

    def test_forbidden_internal_metric_labels_are_not_user_facing(self) -> None:
        forbidden_patterns = {
            "diagnostic_gap_copy": r"diagnostic gap|écart diagnostique",
            "neurodiagnostic_copy": r"neurodiagnostic|score diagnostic",
            "criticality_copy": r"criticality score|score de criticité",
            "raw_wdl": r"\braw_wdl\b",
            "stockfish_wdl_copy": r"raw Stockfish WDL|Stockfish WDL brut",
            "evidence_json": r"Evidence JSON",
        }
        findings: list[str] = []
        for rel, text in self.visible_copy_sources.items():
            for name, pattern in forbidden_patterns.items():
                if re.search(pattern, text, flags=re.IGNORECASE):
                    findings.append(f"{rel}: {name}")
        self.assertEqual([], findings)

    def test_neuroscore_copy_stays_coach_framed(self) -> None:
        self.assertIn("NeuroScore", self.normal_ui_combined)
        self.assertIn("Score coach", self.normal_ui_combined)
        self.assertIn("Précision de référence", self.normal_ui_combined)
        for forbidden in (
            "prediction Elo",
            "Elo prediction",
            "intelligence",
            "neuroplasticit",
            "brain score",
            "score cérébral",
            "2400",
        ):
            self.assertNotIn(forbidden.lower(), self.normal_ui_combined.lower())

    def test_research_and_memory_metrics_stay_out_of_normal_ui(self) -> None:
        forbidden_patterns = (
            r"\bTransfer Gap\b",
            r"\bSkillTrace\b",
            r"\bFSRS\b",
            r"\bETV\b",
            r"\bBKT\b",
            r"\bIRT\b",
            r"\bposterior\b",
            r"\bNeuroMonitor\b",
            r"\bcortex\b",
            r"\batlas\b",
            r"\bdomain score\b",
        )
        for pattern in forbidden_patterns:
            self.assertIsNone(
                re.search(pattern, self.normal_ui_combined, flags=re.IGNORECASE),
                pattern,
            )

    def test_internal_metrics_are_documented_as_internal_or_debug_only(self) -> None:
        for metric_id in (
            "diagnostic_gap_v1",
            "neuro_score_diag_v1",
            "criticality_score_v1",
            "expected_score_wdl_sfXX_v1",
        ):
            self.assertIn(metric_id, self.metric_registry)
        self.assertIn("debug_only", self.metric_registry)
        self.assertIn("coach_neuro_score_v1", self.metric_registry)
        self.assertIn("coach communication", self.formulas)
        self.assertIn("not a scientific truth", self.formulas)


if __name__ == "__main__":
    unittest.main()
