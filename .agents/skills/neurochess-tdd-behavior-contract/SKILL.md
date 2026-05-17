---
name: neurochess-tdd-behavior-contract
description: Use this skill for NeuroChess test-first or behavior-first missions that must keep test contracts separate from implementation and prove backend, frontend, or product behavior safely.
---

# NeuroChess TDD Behavior Contract

Use this skill when a mission needs test-first thinking, behavior contracts, or
evidence that tests prove public behavior rather than implementation trivia.

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

## Behavior-First Rules

- Tests should focus public behavior or stable contracts.
- Avoid implementation-detail-only tests.
- Keep `test_contract` and implementation separated when TDD separation is
  required.
- Do not merge failing tests broken to `road-to-V2`.
- Do not write tests to hide failure.
- Do not use broad test rewrites at night.
- Tests should prove player/product behavior when possible.

## Backend Read-Only Tests

Backend read-only tests must prove:

- no mutation;
- no `training_items` writes;
- no `practice_attempts`;
- no `due_at`;
- no Daily Plan mutation;
- no scoring/results writes;
- no unsafe route calls;
- no review rebuild.

## Frontend Tests And Smokes

Frontend tests or smokes should prove:

- visible state is truthful;
- CTAs are safe;
- loading, disabled, empty, and error states are credible;
- screenshots match the product contract when UI changes are visible;
- browser behavior tests follow user flows;
- public behavior beats implementation-detail assertions;
- failure screenshots are captured for UI smokes;
- snapshot-only proof is not enough for visual readiness.

Red-tier implementation requires quarantine. This skill cannot authorize red-tier
work on `road-to-V2`.
