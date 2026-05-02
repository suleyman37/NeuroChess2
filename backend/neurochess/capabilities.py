from __future__ import annotations

from copy import deepcopy
from typing import Any


CAPABILITIES_SCHEMA_VERSION = "capabilities_manifest_v1"

CAPABILITIES_MANIFEST: dict[str, Any] = {
    "schema_version": CAPABILITIES_SCHEMA_VERSION,
    "product": {
        "name": "NeuroChess 2",
    },
    "review": {
        "tabs": [
            {
                "id": "summary",
                "label": "R\u00e9sum\u00e9",
                "screen_id": "app.review.summary",
            },
            {
                "id": "learn",
                "label": "Apprendre",
                "screen_id": "app.review.learn.challenge",
            },
            {
                "id": "practice",
                "label": "S'entra\u00eener",
                "screen_id": "app.review.training",
            },
            {
                "id": "explorer",
                "label": "Explorer",
                "screen_id": "app.review.explorer",
            },
        ],
        "visible_metrics": [
            {
                "metric_id": "coach_neuro_score_v1",
                "label": "NeuroScore",
                "category": "communication",
                "source_field": "coach_neuro_score",
                "formula_version_field": "coach_score_formula_version",
                "visibility": "when_data_sufficient",
            },
            {
                "metric_id": "neuro_score_public_v1",
                "label": "Pr\u00e9cision de r\u00e9f\u00e9rence",
                "category": "communication",
                "source_field": "public_neuro_score",
                "formula_version_field": "public_score_formula_version",
                "visibility": "when_data_sufficient",
            },
            {
                "metric_id": "review_confidence_v1",
                "label": "Confiance",
                "category": "communication",
                "source_field": "review_score_confidence",
                "visibility": "when_data_sufficient",
            },
        ],
        "advanced_metrics": [
            {
                "metric_id": "diagnostic_gap_v1",
                "label": "\u00c9cart diagnostique",
                "category": "audit",
                "visibility": "advanced_only",
            },
        ],
        "hidden_metrics": [
            "criticality_score_v1",
            "neuro_score_diag_v1",
            "neuro_severity_raw_v1",
        ],
        "actions": [
            {
                "action_id": "review.start_practice",
                "label": "S'entra\u00eener sur cette Review",
                "screen_id": "app.review.summary",
                "type": "primary",
            },
            {
                "action_id": "review.open_key_lesson",
                "label": "Voir la le\u00e7on cl\u00e9",
                "screen_id": "app.review.summary",
                "type": "secondary",
            },
            {
                "action_id": "review.open_explorer",
                "label": "Explorer",
                "screen_id": "app.review.summary",
                "type": "secondary",
            },
            {
                "action_id": "practice.reveal_solution",
                "label": "Voir la correction",
                "screen_id": "app.review.training",
                "type": "secondary",
            },
            {
                "action_id": "practice.skip_item",
                "label": "Passer",
                "screen_id": "app.review.training",
                "type": "alternative",
            },
        ],
        "practice": {
            "enabled": True,
            "grading_authority": "backend",
            "default_scope": "top_priority",
            "default_max_items": 5,
            "result_values": [
                "best",
                "very_good",
                "acceptable",
                "wrong",
                "illegal",
                "revealed",
                "skipped",
            ],
        },
        "ui_contract": {
            "summary_max_priorities": 3,
            "summary_max_takeaways": 3,
            "prescriptive_max_primary_actions": 1,
            "prescriptive_max_secondary_actions": 2,
            "beginner_hides_raw_formulas": True,
            "beginner_hides_evidence_json": True,
            "technical_details_location": "explorer_or_advanced",
        },
    },
}


def get_capabilities_manifest() -> dict[str, Any]:
    return deepcopy(CAPABILITIES_MANIFEST)
