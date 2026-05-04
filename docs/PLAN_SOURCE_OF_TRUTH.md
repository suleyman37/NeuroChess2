# Plan Source Of Truth

## Local Plan Files

- Plan directory: `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2\plan`
- Plan1: `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2\plan\Plan1.txt`
- Plan2: `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2\plan\Plan2.txt`
- Plan3: `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2\plan\Plan3.md`

## Roles

Plan1 is the scientific, mathematical, engine, metrics, user-model, learning,
and progression constitution for NeuroChess.

Plan2 is the UX, interface, journey, screen hierarchy, product behavior, and
visual design constitution for NeuroChess.

Plan3 is the execution-order, technical roadmap, Codex governance, testing, and
V1 delivery constitution for NeuroChess. It does not replace Plan1 or Plan2; it
governs sprint order and acceptance discipline.

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

1. Read `docs/PLAN_CONTEXT_MIN.md`.
2. Read `docs/PLAN_FEATURE_BOUNDARIES.md` when the change touches visible product
   behavior.
3. Return to Plan1/Plan2/Plan3 in `/plan` only when there is a doubt,
   contradiction, missing boundary, or sprint-order question.

After product/code changes:

1. Update `docs/PLAN_ALIGNMENT_AUDIT.md` when alignment state changes.
2. Update `docs/NEXT_PLAN_ACTIONS.md` when task priority changes.
3. Run `python tools/plan_guard.py`.
4. Run the relevant frontend/backend tests or document blockers.
