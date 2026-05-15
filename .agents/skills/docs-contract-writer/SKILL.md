# Docs Contract Writer

Use this skill for NeuroChess docs-only contracts such as R3G.

## Rules

- Do not modify product code.
- Do not stage or commit anything outside the target doc unless explicitly
  authorized.
- Align with Plan1, Plan2, Plan3, `AGENTS.md`, and `.agent/PLANS.md`.
- State what is acquired, what is missing, allowed routes, forbidden routes,
  side effects, future smoke requirements, rollback, and GO/NO-GO.
- Be explicit about anti-mutation proofs for Practice, Daily Plan, training
  items, attempts, and `due_at`.

## Checks

- `git diff --check`
- `tools/plan_guard.py` when `docs/rebuild/` is touched
- Exact staged file list before commit
