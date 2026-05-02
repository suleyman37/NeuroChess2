---
name: neurochess-add-metric
description: Add or modify a NeuroChess cognitive metric safely. Use for tasks that introduce, change, expose, or consume metrics, formulas, score fields, training-driving signals, review scoring, diagnostic values, or metric UI/API contracts.
---

# NeuroChess Add Metric

## When To Use

- A task adds or changes a metric, formula, score, diagnostic value, ranking
  signal, or metric-backed UI/API field.
- A task makes a metric drive Review, Practice, training selection, reporting,
  or user-visible explanation.

## When Not To Use

- Pure wording, CSS, routing, or component layout changes with no metric impact.
- Debug missions where formulas must remain unchanged.
- Research-only notes that do not enter product code, UI, API, or training.

## Required Docs

- `docs/METRIC_REGISTRY.md`
- `docs/FORMULAS_AND_METRICS.md`
- `docs/FORMULA_IMPLEMENTATION_AUDIT.md`
- `docs/data_model.md` if engine analysis fields are involved.
- `docs/SCREEN_CONTRACTS.md` if the metric becomes visible.

## Mandatory Steps

1. Read the required docs before code.
2. Decide the metric category: `communication`, `action`, `audit`, or
   `research`.
3. Define the formula before implementation.
4. Define `metric_id`, `formula_id`, and schema/version fields such as
   `metric_schema_version` or formula version.
5. Confirm input dependencies and POV conventions, especially `eval_cp` POV
   White.
6. Add or update the Metric Registry before using the metric.
7. Add or update `FORMULAS_AND_METRICS.md` for any new or changed formula.
8. Keep final metric computation backend-authoritative.
9. Never compute the metric in the frontend.
10. Expose to frontend only through API, manifest, or typed payload when needed.
11. Add golden tests or focused formula tests.
12. Update screen/action docs if visibility or training behavior changes.

## Validation

- Formula is documented, versioned, and registered.
- Backend tests cover normal cases, boundaries, missing data, and POV.
- Golden tests protect constants and visible score semantics.
- Frontend only displays returned values and does not recompute final grading.
- Research/audit metrics are hidden or clearly advanced/debug only.

## Stop Conditions

- Formula or category is unclear.
- Product decision conflicts with existing docs.
- The metric would be visible but not registered.
- The metric would drive training without calibration or registry plan.
- Implementation requires frontend-only grading.

