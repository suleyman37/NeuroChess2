# Gemini Control Plane Actions

Gemini decisions are converted into local Control Plane actions. These action
names are deterministic and do not execute anything by themselves.

- `CONTINUE`: the Gemini verdict is compatible with the mission and all
  deterministic gates passed.
- `REQUEST_PLANNER_NARROWING`: the Planner must narrow or split the mission
  before execution.
- `STOP_FOR_STRATEGIC_PULSE`: the mission should stop and request a strategic
  direction check.
- `QUARANTINE_REQUIRED`: the work must move to a quarantine path or stop.
- `BLOCK_VISUAL_REWORK`: a visual branch is not ready and needs rework.
- `RECORD_LONG_HORIZON_REPORT`: record Gemini's report; do not execute a new
  mission from it.
- `STOP_DETERMINISTIC_GATE`: a local gate failed or Gemini attempted to bypass
  safety. This outranks any Gemini approval.

These actions are recommendations to the future Control Plane. They do not call
Gemini, call ChatGPT, create branches, modify files, commit, or push.
