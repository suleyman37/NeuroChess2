# Autonomous Improvement Conductor

A20AN adds a bounded control plane for autonomous NeuroChess improvement work.

Tracked script:

- `ops/autopilot/run_autonomous_improvement_loop.ps1`

Modes:

- `DryRun`: simulate five iterations without product edits.
- `Rehearsal`: bounded rehearsal loop, defaulting to explicit max iterations.
- `RunOnce`: select one objective, generate one micro-mission, diagnose, and queue next work.
- `Status`: read conductor state.
- `Stop`: write a runtime stop flag.

Default limits:

- max iterations: 6
- max runtime minutes: 180
- max files per micro-mission: 8
- max diff lines per micro-mission: 1200
- no road push
- no auto-merge
- no product DB writes
- no backend high-risk writes
- no package changes

Loop:

1. Load the objective reservoir.
2. Select the next micro-mission.
3. Generate branch, validation, success criteria, and stop conditions.
4. Collect evidence.
5. Run Mission Doctor.
6. Try Supervisor Bridge if live GPT is explicitly allowed.
7. Use Local Fallback when live GPT is parked or unavailable.
8. Update score and runtime state.
9. Stop at iteration, runtime, stop-flag, or hard-safety limits.

No-user-intervention rule:

- no READY prompt
- no EvidencePath, OutputPath, or ArtifactPath prompt
- no password prompt
- no ChatGPT auth request
- no waiting indefinitely

If a live lane needs human action, the conductor records `PARKED_HUMAN_ACTION_REQUIRED` or the lane-specific blocker and continues offline.
