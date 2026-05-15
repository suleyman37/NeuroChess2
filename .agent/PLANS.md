# NeuroChess AgentOS Plans

This file is the compact mission memory for autonomous Codex runs. It does not
replace the canonical plans.

## Source Order

1. `plan/Plan1.txt` governs science, metrics, engine truth, claims, and user
   model.
2. `plan/Plan2.txt` governs UX, navigation, surface behavior, and interface
   promises.
3. `plan/Plan3.md` governs execution, tests, release discipline, and Codex
   governance.
4. `docs/PLAN_SOURCE_OF_TRUTH.md`, `docs/PLAN_CONTEXT_MIN.md`,
   `docs/PLAN_FEATURE_BOUNDARIES.md`, and `docs/NEXT_PLAN_ACTIONS.md`.
5. Existing code, only as implementation state.

## Current REX Sequence

- R3B integrated QG Mission Core read-only.
- R3C reviewed the stage after QG and Truth Chain.
- R3D defined Forge read-only contract.
- R3E integrated Forge read-only preview.
- R3F reviewed the stage after Forge.
- Next recommended product mission:
  `R3G_PRACTICE_BOUNDARY_READONLY_CONTRACT`.

## Hard Boundaries

- No Practice implementation until a boundary contract proves safe actions.
- No `training_items` creation from REX Forge until explicitly contracted.
- No `practice_attempts` creation from read-only preview surfaces.
- No `due_at` mutation without a dedicated Practice/Daily Plan contract.
- No Daily Plan generation from QG, Parties, or Forge read-only flows.
- No XP, rank, Transfer Score, SkillTrace mastery, FSRS, ETV, raw WDL, or raw
  criticality as user truth.

## Autopilot Operating Contract

- Queue source: `ops/autopilot/queue.yaml`.
- Runtime state and logs: external QA artifact root.
- One task per `run_once.ps1` invocation.
- Risk tiers:
  `docs_tooling`, `frontend_readonly`, `backend_readonly`, `write_sensitive`.
- Automatic promotion is allowed only when deterministic checks and applicable
  local critics pass.
- If critics are unavailable, docs/tooling can continue with a recorded
  degraded proof. UI/backend tasks must either use deterministic smokes or
  quarantine if the policy requires a critic.
