# Metric Registry Rules

- Source of truth: `docs/METRIC_REGISTRY.md`.
- Every metric used in UI, training selection, scoring, reporting, debug panels, or research notes must be registered before use.
- Metric categories: `communication`, `action`, `audit`, `research`. Do not blur categories.
- Normal UI may show communication metrics and calibrated-enough action outcomes only. Debug/advanced may show audit metrics if labeled. Research metrics stay out of normal UI.
- `criticality_score_v1` is an action metric and should drive selection, not be shown as a user truth.
- `coach_neuro_score_v1` is the visible coach NeuroScore communication metric, not scientific truth.
- `neuro_score_public_v1` is reference precision, displayed secondarily as `Precision de reference`.
- `neuro_score_diag_v1`, `neuro_severity_raw_v1`, and `diagnostic_gap_v1` are internal/audit until calibrated.
- Any new or changed metric requires registry update plus tests/golden tests where behavior matters.