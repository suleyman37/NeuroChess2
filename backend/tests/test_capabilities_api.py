from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app


def _walk(value: Any) -> list[Any]:
    values = [value]
    if isinstance(value, dict):
        for key, item in value.items():
            values.extend(_walk(key))
            values.extend(_walk(item))
    elif isinstance(value, list):
        for item in value:
            values.extend(_walk(item))
    return values


class CapabilitiesApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()

    def test_get_capabilities_returns_manifest_contract(self) -> None:
        response = self.client.get("/capabilities")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["schema_version"], "capabilities_manifest_v1")
        self.assertEqual(payload["product"]["name"], "NeuroChess 2")

        review = payload["review"]
        self.assertEqual(
            [tab["id"] for tab in review["tabs"]],
            ["summary", "learn", "practice", "explorer"],
        )

        visible_metric_ids = {
            metric["metric_id"] for metric in review["visible_metrics"]
        }
        self.assertIn("coach_neuro_score_v1", visible_metric_ids)
        self.assertIn("neuro_score_public_v1", visible_metric_ids)
        self.assertTrue(
            all(metric["category"] == "communication" for metric in review["visible_metrics"])
        )

        self.assertEqual(
            set(review["hidden_metrics"]),
            {
                "criticality_score_v1",
                "neuro_score_diag_v1",
                "neuro_severity_raw_v1",
            },
        )
        self.assertEqual(review["practice"]["grading_authority"], "backend")
        self.assertIn("revealed", review["practice"]["result_values"])
        self.assertIn("skipped", review["practice"]["result_values"])

    def test_capabilities_manifest_exposes_no_raw_formulas(self) -> None:
        payload = self.client.get("/capabilities").json()
        values = _walk(payload)
        forbidden_keys = {
            "formula",
            "formula_reference",
            "formula_expression",
            "raw_formula",
            "expression",
        }
        forbidden_tokens = (
            "exp(",
            "100 / (1 +",
            "0.55 *",
            "0.45 *",
            "0.35 *",
            "0.65 *",
            "win_loss =",
            "criticality_score =",
        )

        for value in values:
            if isinstance(value, str):
                self.assertNotIn(value, forbidden_keys)
                for token in forbidden_tokens:
                    self.assertNotIn(token, value)

    def test_frontend_client_exposes_capabilities_call(self) -> None:
        client_source = (PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts").read_text(
            encoding="utf-8"
        )

        self.assertIn("export type ProductCapabilities", client_source)
        self.assertIn("export function getCapabilities()", client_source)
        self.assertIn('request<ProductCapabilities>("/capabilities")', client_source)


if __name__ == "__main__":
    unittest.main()
