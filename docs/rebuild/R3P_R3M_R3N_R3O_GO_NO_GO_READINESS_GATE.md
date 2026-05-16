# R3P - R3M/R3N/R3O Go/No-Go Readiness Gate

## Purpose

R3P defines the decision gate for the R3M, R3N, and R3O contracts. Its purpose
is to decide whether the next daytime product slice is ready to move from
contracts into an ephemeral implementation or test branch.

This document is docs-only. It must not start implementation during A15.

## Inputs Reviewed

The readiness decision uses these inputs:

- `docs/rebuild/R3M_REBUILD_DECISION_CONTRACT.md`
- `docs/rebuild/R3N_REPLAY_ACCEPTANCE_CONTRACT.md`
- `docs/rebuild/R3O_FRONTEND_READONLY_HANDOFF_CONTRACT.md`
- current `road-to-V2` cleanliness;
- A15 live pilot evidence;
- targeted checks from each docs-only step.

## Go Criteria

The next product slice is GO only if all of these are true:

- R3M clearly defines the test-first boundary;
- R3N clearly defines the replay/detail acceptance boundary;
- R3O clearly defines the frontend-read-only evidence boundary;
- the next mission has exactly one target surface;
- the next mission runs on an ephemeral branch if product code or tests are
  touched;
- the next mission has a Mission Contract before execution;
- required checks are listed as explicit checks and not implied;
- morning review accepts the evidence scope.

## No-Go Criteria

The next product slice is NO-GO if any of these are true:

- the target surface is ambiguous;
- implementation and tests are bundled without a test-first decision;
- the mission would edit product code directly on `road-to-V2`;
- the mission would edit package or environment files;
- the route source or UI copy could imply a write-like user action;
- required evidence cannot be collected;
- the branch cannot be preserved for review.

## Evidence Checklist

Before approving the next slice, collect:

- branch name;
- starting commit;
- exact expected changed files;
- anti-mutation or read-only proof plan when backend is involved;
- screenshot/contact-sheet plan when frontend is involved;
- required test command;
- Mission Contract path;
- final recommendation category.

Accepted recommendation categories:

- `READY_TO_REVIEW`
- `NEEDS_REWORK`
- `ABANDON_BRANCH`
- `QUARANTINE_REQUIRED`

## Out-of-Scope During A15 Step 4

A15 step 4 does not permit:

- product code edits;
- test code edits;
- dependency edits;
- plan edits;
- environment or credential requests;
- direct product-code merge to `road-to-V2`;
- runtime state writes;
- multi-file output.

## Decision Template

```text
Decision: GO | NO_GO
Target slice:
Branch requirement:
Expected files:
Required checks:
Evidence required:
Morning review owner:
Reason:
```

## Constraints

This gate should be used as a narrow morning-review checklist. It is not a
backlog, roadmap, or implementation prompt.

If the next mission cannot satisfy this gate, the safe action is `NEEDS_REWORK`
with a smaller target slice.
