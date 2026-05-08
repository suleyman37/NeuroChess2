# Metric Visibility Governance Audit V1

Date: 2026-05-08

Scope: visibility and copy governance only. No formula, threshold, NeuroScore
calculation, Review selection, Daily Plan, `due_at`, engine, LLM, or Candidate
Trainer change was made.

## Validated Contract

- `coach_neuro_score_v1` may be visible as `NeuroScore` only when framed as a
  coach communication score.
- Reference precision stays separate from the coach score.
- `neuro_score_diag_v1`, `diagnostic_gap_v1`, raw `criticality_score_v1`, raw
  Stockfish WDL, internal priority numbers, and raw Evidence JSON are not normal
  user-facing metrics.
- SkillTrace, ETV, FSRS, BKT, IRT, posterior values, Transfer Gap, and
  uncalibrated domain `/100` scores stay out of V1 normal UI.

## Current Findings

The normal Review cockpit already frames `NeuroScore` as a coach score and shows
reference precision separately. The backend/API still carries internal metric
fields for scoring, training selection, audit, and compatibility. That is
acceptable when those fields are not presented as user truth.

An older score-details component still had audit metric labels ready to render if
the component were reused. The V1 patch keeps normal score details to public
coach/reference metrics and returns no audit rows from the normal score view
model.

## Static Guard

`backend/tests/test_metric_visibility_governance_static.py` prevents forbidden
raw metric labels and research/memory metric names from appearing in normal
frontend copy while allowing typed API fields and DEV-only technical debug
surfaces.

## Known Limits

- This is a static visibility audit, not corpus calibration.
- Debug and API payload fields still contain internal metric names by design.
- The guard checks normal frontend source copy; it does not prove every possible
  runtime payload.
