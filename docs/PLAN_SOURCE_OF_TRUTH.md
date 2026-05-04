# NeuroChess Plan Source Of Truth

## Canonical Plan Files

- Plan directory: `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2\plan`
- Plan1: `plan/Plan1.txt` - scientific source of truth - Plan1 v3.0 FINAL - Codex-ready
- Plan2: `plan/Plan2.txt` - UX/product/interface source of truth - Plan2 v4.0 FINAL - 20/20 - Codex-ready
- Plan3: `plan/Plan3.md` - technical execution/release/testing/governance
  source of truth - Plan3 v4.0 FINAL - 20/20 - Codex-ready

## Roles

Plan1 is the scientific, mathematical, engine, metrics, user-model, learning,
and progression constitution for NeuroChess.

Plan2 is the UX, interface, journey, screen hierarchy, product behavior, and
visual design constitution for NeuroChess.

Plan3 is the execution-order, technical roadmap, Codex governance, testing, and
V1 delivery constitution for NeuroChess. It does not replace Plan1 or Plan2; it
governs sprint order and acceptance discipline.

## Canonical Rules

- `plan/Plan1.txt` is the only scientific source of truth for NeuroChess.
- `plan/Plan2.txt` is the only UX/product/interface source of truth for NeuroChess.
- `plan/Plan3.md` is the only technical execution, release, testing, and Codex
  governance source of truth for NeuroChess.
- Older plan versions, downloaded copies, previous summaries, old prompts,
  backups, and model memory must be ignored if they conflict with the files in
  `/plan`.
- Plan1, Plan2, and Plan3 are constitutions, not implementation missions. Codex
  must never apply any full plan at once.
- One mission = one objective = one controlled diff = tests = report.

## Priority Order

When sources disagree, use this order:

1. Plan1, Plan2, and Plan3.
2. Internal docs in `docs/`.
3. Current implementation.

The current code is implementation state only. It is not product truth when it
contradicts Plan1, Plan2, or Plan3.

## Product Guardrails

- No visible V1 feature may exist without a justification in Plan1 or Plan2.
- V2, V3, and research features must be hidden from normal UI, documented, or
  removed from the V1 surface.
- Backend support may exist before UI exposure when it is useful for V1/V2 and
  does not change user-facing promises.
- Beginner and normal flows must not expose raw formulas, raw evidence payloads,
  debug panels, engine internals, raw criticality, Diagnostic Gap, or uncalibrated
  domain scores as user truth.
- The product must prefer this loop: import -> analyze -> key moments ->
  understand -> practice -> review later.
- Plan3 must be applied sprint-by-sprint only: one Codex mission, one precise
  objective, one controlled diff, relevant tests, and a final report.

## Future Session Protocol

Before product/code changes:

1. Read `AGENTS.md`.
2. Read `docs/PLAN_SOURCE_OF_TRUTH.md`.
3. Read `docs/PLAN_CONTEXT_MIN.md`.
4. Read the canonical plan files relevant to the mission.
5. Read `docs/PLAN_FEATURE_BOUNDARIES.md` when the change touches visible product
   behavior.
6. Return to Plan1/Plan2/Plan3 in `/plan` whenever there is a doubt,
   contradiction, missing boundary, or sprint-order question.

After product/code changes:

1. Update `docs/PLAN_ALIGNMENT_AUDIT.md` when alignment state changes.
2. Update `docs/NEXT_PLAN_ACTIONS.md` when task priority changes.
3. Run `python tools/plan_guard.py`.
4. Run the relevant frontend/backend tests or document blockers.
