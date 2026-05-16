# R3M - Rebuild Decision Contract

## Purpose

R3M defines the next product-value slice after R3L. It converts the existing
read-only route contract into a test-first decision boundary before any backend
implementation begins.

This document is docs-only. It does not authorize route implementation,
frontend integration, data writes, scheduling, scoring, or package changes.

## User-Visible Value

The future value is a safe read-only detail view for an already persisted
exercise-like position from a real game. The user should be able to inspect the
position context without creating a new attempt, schedule entry, score event, or
training mutation.

The immediate R3M value is narrower: prove the backend contract with tests
before any implementation work starts.

## Scope Boundary

R3M is a test-contract mission only.

Allowed future R3M output:

- targeted backend tests that describe the read-only route behavior;
- static guards against forbidden calls;
- database snapshot assertions proving repeated reads are non-mutating;
- documented expected response shape aligned with R3L.

Not allowed in R3M:

- route implementation;
- frontend changes;
- package changes;
- migrations;
- broad cleanup;
- opportunistic behavior outside the R3L contract.

## Files Allowed For The Future Implementation Slice

R3N, not R3M, may later touch a minimal backend read-only slice if R3M exists
and fails for the missing route.

Candidate future R3N files:

- `backend/neurochess/api/game_routes.py`
- `backend/neurochess/review_moments_readonly_service.py`
- `backend/neurochess/data/repositories.py`
- a narrow backend test module already introduced by R3M

Any implementation file must remain SELECT-only / GET-only and must include a
read-only proof in the response.

## Files Excluded From The Future Implementation Slice

Excluded from R3M and from any automatic Night Mode merge:

- `frontend/**`
- `plan/**`
- `package.json`
- `package-lock.json`
- `App.tsx`
- `.serena/**`
- `qa_artifacts/**`
- `.venv/**`
- generated runtime artifacts

Excluded backend behaviors:

- review generation or recomputation;
- ensure/create/upsert helpers;
- scheduling changes;
- scoring/result writes;
- engine invocation;
- any direct dependency on the unsafe review route.

## Acceptance Checks

R3M is acceptable only if it creates tests that require:

- GET-only behavior;
- game-scoped exercise ownership validation;
- empty or not-found behavior for missing persisted data;
- no writes after repeated GET calls;
- static rejection of forbidden service calls;
- hidden solution fields absent from the response;
- read-only proof present in success and empty responses.

R3N is acceptable later only if it implements the smallest code path needed to
make the R3M tests pass.

## Evidence Required In The Future Report

The future R3M report must include:

- changed test files;
- targeted backend test command and result;
- database snapshot evidence description;
- forbidden-call static guard result;
- confirmation that no implementation files changed;
- confirmation that no frontend files changed;
- final branch and git status.

The future R3N report must include:

- targeted backend test result;
- static guard result;
- read-only proof sample;
- repeated GET non-mutation evidence;
- confirmation that no product code was merged directly to `road-to-V2` during
  Night Mode.

## Handoff Note For The Next Supervisor Prompt

Next recommended mission:

```text
R3M_EXISTING_EXERCISE_READONLY_BACKEND_ROUTE_TEST_CONTRACT
```

Type:

```text
test_contract only
```

The next prompt should ask for backend tests only, on an ephemeral branch during
Night Mode, with no implementation and no direct merge to `road-to-V2`.
