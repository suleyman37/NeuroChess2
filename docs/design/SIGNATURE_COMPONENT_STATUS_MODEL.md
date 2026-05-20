# Signature Component Status Model

Tracked state:

- `ops/autopilot/signature_component_status.yaml`

Statuses:

- `STATUS_0_NOT_STARTED`
- `STATUS_1_PROBED`
- `STATUS_2_TRIPLED`
- `STATUS_2_REVIEWED_DEV_ONLY`
- `STATUS_3_VOTED`
- `STATUS_4_INTEGRATED`
- `STATUS_5_PROMOTED`

Initial A20AN state:

All signature candidates are `STATUS_0_NOT_STARTED` unless later evidence proves otherwise.

Candidate components:

- Sacred Board Chamber
- Piece Identity System
- Decision Feedback Language
- Critical Moment Sigil
- Aftermath Timeline
- Piece Breath
- Memory Cabinet
- Decision Pressure Field

Scoring:

- Final Five signature score is `sum(statuses) / 25`.
- If the Final Five have not been selected yet, candidate probes are tracked separately.
- `STATUS_2_REVIEWED_DEV_ONLY` means a component has a canonical DEV candidate
  from screenshot-backed review but is not integrated, voted, promoted, or
  product-facing. It counts as status index 2 for progress tracking while
  remaining separate from `STATUS_2_TRIPLED`.

Purpose:

This model keeps visual production grounded in visible candidate progress instead of abstract automation work.
