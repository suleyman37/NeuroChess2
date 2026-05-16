# R3Q Product-Safe Next-Action Decision

## Context

R3M, R3N, R3O, and R3P now exist as a handoff chain:

- R3M defines the test-first rebuild decision boundary.
- R3N defines replay/detail acceptance for a later read-only slice.
- R3O defines the frontend-read-only handoff boundary.
- R3P defines the Go/No-Go readiness gate.

A15 has kept the live pilot docs-only after Strategic Pulse narrowed the run.
No backend or frontend product code is authorized by this document.

## Decision

Proceed next to exactly one read-before-build checklist for the next daytime
product mission.

## Selected Next Action

```text
R3R_READ_BEFORE_BUILD_CHECKLIST_FOR_DAYTIME_PRODUCT_BRANCH
```

Type:

```text
docs-only checklist, then daytime ephemeral branch
```

The checklist should convert R3M/R3N/R3O/R3P into a small set of read-before-
build instructions for the human-supervised product branch that follows A15.

## Why This Action Is Selected

This action is selected because A15 proved the live supervisor loop can produce
bounded product-value docs, but Strategic Pulse explicitly narrowed the final
pilot steps away from product code.

The next safe move is therefore not implementation inside A15. It is a compact
daytime checklist that tells the next product branch what to read, what to
change, what evidence to collect, and when to stop.

## What Is Explicitly Not Authorized In This Step

R3Q does not authorize:

- backend edits;
- frontend edits;
- test edits;
- plan edits;
- package edits;
- environment or credential changes;
- direct product-code merge to `road-to-V2`;
- runtime state writes;
- multi-file output.

## Entry Criteria For The Next Daytime Product Mission

The next daytime product mission may start only if:

- `road-to-V2` is clean and aligned with origin;
- R3M/R3N/R3O/R3P/R3Q are present;
- the mission has one target surface;
- product code runs on an ephemeral branch;
- Mission Contract is registered before execution;
- required checks are known before edits;
- expected evidence is listed before edits;
- morning review accepts the target slice.

## Exit Criteria For This R3Q Document

R3Q is complete when:

- this file exists as the only R3Q output;
- `git status --short --branch` was run;
- `git diff --check` passed;
- `tools/plan_guard.py` passed;
- no product code changed;
- the final A15 report says STOP after step 5.

## Handoff Note For The Human Operator

Recommended next mission after A15:

```text
R3R_READ_BEFORE_BUILD_CHECKLIST_FOR_DAYTIME_PRODUCT_BRANCH
```

Do not continue A15 to a sixth step. The next move should happen as a new,
daytime, human-reviewed mission with a fresh precheck.
