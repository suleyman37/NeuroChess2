# Multi-Agent Workload Router

A20BH introduces a small router for deciding which lane should handle a task.

The router does not grant authority. It only recommends where work should happen. Codex remains the official integrator.

## Lanes

### Codex

Use Codex when:

- commit or push is required;
- protected path or safety policy matters;
- tests, validation, and final integration matter;
- `road-to-V2` policy matters;
- the task has high integration or safety risk.

### Antigravity

Use Antigravity only when:

- work is exploratory;
- multiple visual variants are useful;
- the work is DEV-only frontend exploration;
- screenshots matter;
- integration risk is low;
- output can be a Patch Proposal Pack.

Antigravity must not touch the official repo directly.

### Gemini

Use Gemini when:

- screenshot critique is needed;
- board readability or visual weirdness is the question;
- multimodal comparison matters.

### ChatGPT

Use ChatGPT when:

- product strategy is unclear;
- mission selection needs challenge;
- high-level architecture contradiction needs critique.

### Local Fallback

Use local fallback when:

- live lanes fail;
- external agents are unavailable;
- the task must continue offline.

## Script

`ops/autopilot/multi_agent_workload_router.ps1`

Supported modes:

- `Status`
- `Route`
- `DryRun`

A20BH dry-run proves:

- visual variant exploration -> Antigravity;
- final integration -> Codex;
- screenshot critique -> Gemini;
- strategic review -> ChatGPT;
- blocked live lane -> local fallback.
