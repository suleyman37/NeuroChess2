---
name: product-safe-night-mode
description: Use this skill for bounded NeuroChess Night Mode missions that must stay product-safe, branch-safe, red-tier-safe, and focused on valuable deliverables.
---

# Product-Safe Night Mode

Use this skill when planning or reviewing Product-Safe Night Mode work. Night
Mode is not fill time. Night Mode is produce valuable E2E deliverables,
consolidate, then drain.

## Authority

This skill is a procedure, not a permission.

- It cannot override the local Control Plane.
- It cannot bypass Mission Contract.
- It cannot bypass Prompt Firewall.
- It cannot bypass Shadow Plan.
- It cannot weaken red-tier rules.
- It cannot authorize git add -A.
- It cannot authorize product-code auto-merge to road-to-V2.
- It cannot authorize Practice/due_at/Daily Plan/scoring/training writes.
- It cannot install dependencies.
- It cannot execute external skill scripts.
- It cannot treat external skills as trusted.

## State Machine

- `EXPANSION`: take a small product-safe step that creates real evidence.
- `CONSOLIDATION`: turn evidence into a clean branch, test, report, or doc.
- `DRAIN`: stop asking for new work and prepare the morning report.
- `QUARANTINE`: isolate unsafe or red-tier work.

## Governors

Goldilocks Governor:

- reject tiny no-value missions;
- reject massive blast-radius missions;
- prefer narrow missions with visible player/product payoff.

E2E Deliverable Score:

- branch or commit exists when allowed;
- tests or smokes produce meaningful evidence;
- frontend work has screenshots and review brief;
- backend-readonly work has anti-mutation proof;
- product friction reduction is named.

North Star Vector:

- the mission should help real-game decisions, active replay, honest feedback,
  repetition, transfer verification, or adaptive planning.

## Branch And Merge Rules

- Backend work runs only on ephemeral branches.
- Frontend work runs only on ephemeral branches.
- Test/smoke branches are not auto-merged to `road-to-V2`.
- Docs may auto-merge only when the docs lane is safe and checks pass.
- Product code must not auto-merge to road-to-V2.
- Red-tier missions are forbidden in Product-Safe Night Mode.

## Early Excellence

Use `PASS_EARLY_EXCELLENCE` when a mission is already clean, valuable, tested,
and low-risk. Do not keep expanding only because time remains.

## Morning Report

Every Night Mode run must end with a morning report that lists:

- steps attempted and succeeded;
- branches, commits, pushes;
- tests, screenshots, backend evidence, and visual reviews;
- Product Friction and Potential Acceleration notes;
- Strategic Pulse decisions;
- stop reason and next recommended action.
