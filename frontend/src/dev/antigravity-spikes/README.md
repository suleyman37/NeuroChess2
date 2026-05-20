# Antigravity Spike Import Surface

This directory is the only frontend surface future Antigravity Patch Proposal
Packs may modify for visual spikes.

Codex owns the `/app?antigravitySpike=<id>` route mount in `frontend/src/App.tsx`.
Antigravity must not touch `App.tsx`.

Allowed future proposal files:

- `frontend/src/dev/antigravity-spikes/**`
- `scripts/browser_antigravity_*_smoke.mjs`
- `docs/autopilot/A20ANTIGRAVITY*_REPORT.md`

Rules:

- DEV-only visual spikes only.
- No backend, package, DB, local, runtime, or V1 product flow changes.
- No screenshots or binary assets in Git.
- Proposal packs must include a valid `git apply --check` compatible
  `patch.diff`, rollback notes, risk report, test report, and files touched.
- Codex remains the only official integrator.
