# R3N - Replay Acceptance Contract

## Purpose

R3N defines the acceptance boundary for the next rebuild slice after R3M. It
keeps the product path focused on a read-only replay/detail experience while
requiring proof before any implementation is promoted.

This document is a contract only. It does not edit code, add tests, change
packages, or authorize direct product-code promotion to `road-to-V2`.

## User-Visible Value

The future user value is a calm replay of an existing game position and its
context, so the player can understand where the position came from before any
active training flow exists.

The immediate R3N value is to define what "accepted" means for that read-only
slice:

- the position belongs to the requested game;
- the displayed move context is already persisted or safely derived from stored
  game data;
- the route or UI does not imply a new training action;
- repeated reads leave durable state unchanged.

## Scope Boundary

R3N may be implementation work only after a separate test-contract mission has
created failing tests for the exact behavior. During Night Mode, any product
code branch must remain ephemeral and must not merge directly into
`road-to-V2`.

R3N must stay read-only:

- GET-only backend behavior;
- no frontend action that starts training;
- no scheduling change;
- no scoring/result write;
- no engine call;
- no review recomputation.

## Required Product Behavior

The accepted read-only replay/detail slice must:

- accept a game id and an existing detail id;
- verify that the detail belongs to the game;
- return a safe empty response when the detail cannot be found;
- include move context such as ply, SAN/UCI, FEN before, and FEN after when
  already available;
- include limitations when context is missing;
- include a read-only proof in each response;
- keep solution-like data hidden unless a later contract explicitly permits it.

The slice must not:

- create or update durable training state;
- record a user result;
- change review timing;
- generate missing review data;
- call unsafe review-generation surfaces;
- expose raw diagnostic internals as normal user truth.

## Acceptance Checks

Before R3N can be accepted, the report must show:

- targeted backend tests pass;
- repeated GET calls produce identical database snapshots;
- forbidden-call static guards pass;
- missing detail returns a safe empty response;
- cross-game detail access returns a safe not-found or forbidden response;
- hidden solution fields are absent;
- the read-only proof contains explicit false values for write-like behavior;
- no frontend files changed unless a later frontend-read-only contract allows
  that work.

## Evidence Expected In The Report

The R3N report must include:

- branch name and starting commit;
- changed files;
- targeted test command and result;
- static guard result;
- database snapshot method;
- sample read-only response with safe fields only;
- final branch status;
- recommendation: `READY_TO_REVIEW`, `NEEDS_REWORK`, `ABANDON_BRANCH`, or
  `QUARANTINE_REQUIRED`.

If the work runs during Night Mode, the branch must remain separate from
`road-to-V2` until morning review.

## Handoff Notes For The Next Slice

Next recommended mission:

```text
R3O_EXISTING_EXERCISE_READONLY_BACKEND_ROUTE_TESTS
```

Type:

```text
test-only on ephemeral branch
```

The next slice should write the narrow tests that prove the R3M/R3N contracts.
It should not implement the route in the same mission.
