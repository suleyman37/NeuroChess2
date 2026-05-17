---
name: backend-readonly-proof
description: Use this skill for NeuroChess backend read-only audits, route tests, or evidence missions that must prove no mutation to Practice, training, scheduling, scoring, or progression state.
---

# Backend Read-Only Proof

Use this skill when backend work must be read-only or prove that a route/test
does not mutate sensitive NeuroChess learning state.

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

## Read-Only Boundary

Allowed shape:

- GET/read-only only;
- no hidden writes;
- no route that rebuilds Review unless explicitly allowed;
- no engine or review recompute unless explicitly allowed.

Forbidden sensitive zones:

- no `/games/{game_id}/review` if forbidden by R3K/R3L;
- no `ensure_training_items_for_game`;
- no `_ensure_training_items_for_review_payload`;
- no `training_items` writes;
- no `practice_attempts`;
- no `due_at`;
- no Daily Plan;
- no scoring/results;
- no XP/rank/Transfer;
- no insert/update/delete in sensitive tables.

## Evidence Plan

A backend read-only mission should collect:

- before/after DB state or anti-mutation proof;
- targeted test output;
- repeated GET identical state when relevant;
- clear list of tables checked;
- proof that unsafe route calls were not made;
- proof that no review rebuild occurred.

## Branch Rules

- Backend code changes require an ephemeral branch.
- Backend code must not auto-merge to `road-to-V2` during Night Mode.
- If read-only proof is missing, classify the branch `NEEDS_REWORK`.

## Test Expectations

Tests should prove:

- no `training_items` insert/update/delete;
- no `practice_attempts` insert/update/delete;
- no `due_at` mutation;
- no Daily Plan mutation;
- no scoring/results write;
- no hidden writes;
- no unsafe route call;
- no review rebuild.
