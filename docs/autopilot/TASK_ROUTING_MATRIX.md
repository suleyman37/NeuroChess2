# Task Routing Matrix

The router implementation lives in `ops/autopilot/multi_agent_workload_router.ps1`.

## Scoring Formula

For each task `t` and agent `a`:

```text
agent_score(a,t) =
  2.0 * agent_fit
+ 1.6 * expected_pixel_value
+ 1.4 * exploration_value
+ 1.2 * proof_strength
- 2.0 * integration_risk
- 1.8 * safety_risk
- 1.3 * live_dependency_risk
- 1.0 * codex_context_cost
- 0.8 * recent_failure_penalty
```

## Hard Rules

- If `safety_risk > 0.4`, external agents cannot execute.
- If `integration_risk > 0.6`, Codex is primary.
- If backend/package/DB is touched, Antigravity is forbidden.
- If the task is visual exploratory and integration risk is below `0.4`, Antigravity is preferred.
- If image critique is required, Gemini is preferred.
- If strategic contradiction is the task, ChatGPT is preferred.
- If a live lane is unavailable, local fallback wins.
- If pixel bottleneck is active, non-pixel tasks are penalized.

## Matrix

| Category | Primary | Secondary | Required Proof | Stop Condition |
|---|---|---|---|---|
| DEV-only visual variant exploration | Antigravity | Codex | Proposal pack, screenshots external, risk/test reports | Touches V1 route, backend, DB, package, local/runtime, or secrets |
| Signature component refinement | Antigravity | Codex | Variant screenshots and Codex import validation | No isolated component boundary |
| Browser screenshot critique | Gemini | Local fallback | Single isolated screenshot and visual packet | No attached image |
| Strategic architecture review | ChatGPT | Codex | Structured critique and contradiction list | Tries to override hard safety gates |
| Final integration into official repo | Codex | OMEGA | Local validation, explicit staging, diff inspection | Unvalidated proposal or protected branch |
| Build/typecheck repair | Codex | Local fallback | Reproduce failing check, then pass it | Package install required without mission |
| Backend/API/DB work | Codex | Local fallback | Backend tests and data contract | External agent proposes direct backend mutation |
| Package/dependency changes | Codex | None | Dedicated package mission | Any package mutation in proposal pack |
| Secret/local/runtime handling | Codex | Local fallback | Redacted status only | Secret/profile/runtime enters diff |
| Road-to-V2 merge audit | Codex | ChatGPT | Merge audit report and branch checks | Attempt to push or merge protected branch |
| Failure Ledger analysis | OMEGA | Codex | Ledger delta and cause classification | Score inflation without proof |
| Human taste vote import | Codex | Human | Explicit vote artifact, no PII | Autonomy waits for human input |
| CSS/SVG animation spike | Antigravity | Codex | Sandbox proposal and screenshot proof | Dependency install or product route change |
| Board readability visual patch | Antigravity | Gemini | Before/after isolated board screenshots | Chess rules or backend truth affected |
| Pixel evidence recapture | Local fallback | Gemini | External screenshots and manifest | Screenshots staged for commit |
| Night mode objective selection | OMEGA | ChatGPT | Objective score and safety gate | Non-pixel objective during pixel bottleneck |
