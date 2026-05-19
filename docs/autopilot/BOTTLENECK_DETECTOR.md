# Bottleneck Detector

The A20AU Bottleneck Detector is the OMEGA Observe step.

It reads:

- `ops/autopilot/autonomy_score_state.json`
- `ops/autopilot/signature_component_status.yaml`
- `ops/autopilot/failure_ledger.yaml` when present

It detects:

- lowest score category
- repeated blocker
- meta drift
- no-pixel streak
- live web over-focus
- evidence weakness
- screenshot quality weakness
- signature status stagnation
- night readiness blockers
- operator friction

Rules:

- If visual production is below 18.5 after a meta/control-plane mission, activate the Pixel Mandate.
- If top signatures are tripled but no human data exists, prioritize provisional refinement or limited pixel rehearsal.
- If live lanes repeat failures, park them and continue offline.
- Missing human data is not a blocker.

Output is JSON with `primary_bottleneck`, `secondary_bottlenecks`, `recommended_lane`, `blocked_lanes`, `must_not_do`, and `pixel_mandate_active`.
