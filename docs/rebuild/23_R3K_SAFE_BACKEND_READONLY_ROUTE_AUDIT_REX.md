# R3K - Safe Backend Read-Only Route Audit for Existing Exercise Detail

## 1. Purpose

This document returns NeuroChess from automation hardening toward product work
without implementing product behavior yet. It is an audit-only evidence record
for a future Existing Exercise Read-Only Detail route.

The goal is to identify which existing backend routes and services can safely
support a read-only detail view for an already persisted exercise, and which
surfaces must remain forbidden because they may create training state, practice
state, review recomputation, scheduling changes, or result writes.

This document does not authorize active Practice, route implementation, frontend
implementation, training item creation, practice attempt creation, scoring,
solution reveal, due date mutation, Daily Plan mutation, XP/rank/Transfer, or
calls to unsafe review routes.

## 2. Current Product Context

- QG read-only exists as a safe product direction.
- Parties / Truth Chain read-only exists and is backed by a read-only service.
- Forge read-only preview exists as a non-mutating preview boundary.
- R3G defines the Practice boundary and explicitly blocks unsafe review and
  training-state side effects for REX.
- R3H defines the Existing Exercise Read-Only Detail contract: existing,
  persisted exercises only; no Practice start; no training creation; no attempts;
  no scheduling, scoring, solution reveal, or `/games/{game_id}/review`.
- R3I and R3J recommend a safe read-only detail path before any active Practice
  implementation.
- Active Practice implementation has not started.

## 3. Why This Audit Is Needed

The next useful product step is likely an Existing Exercise Read-Only Detail
surface. That step must be isolated because the existing Review, Training, Daily
Plan, and Practice surfaces can hide writes behind seemingly harmless calls.

A read-only detail route must prove it reads an already persisted exercise
without ensuring, generating, recomputing, grading, scheduling, revealing,
scoring, or recording anything. The route must be safe under repeated GET calls:
the second call must leave the database in the same state as the first call.

## 4. Candidate Routes And Services

| Route/service | Source file | Apparent purpose | Read-only candidate | Side-effect risk | Notes |
| --- | --- | --- | --- | --- | --- |
| `GET /games/{game_id}/truth-chain/moments` | `backend/neurochess/api/game_routes.py`; `backend/neurochess/review_moments_readonly_service.py` | Read persisted review moments for the Truth Chain | Yes | Low | Uses `ReviewMomentsReadOnlyService` and SQLite `mode=ro`; returns `readOnlyProof`; existing tests assert no training, practice, Daily Plan, or `due_at` mutation. |
| `ReviewMomentsReadOnlyService.get_truth_chain_moments` | `backend/neurochess/review_moments_readonly_service.py` | Load persisted review moments without writes | Yes | Low | Strongest known read-only pattern. It joins existing `training_items` only to expose availability, not detail. |
| `GET /games/{game_id}/moves` | `backend/neurochess/api/game_routes.py`; `backend/neurochess/data/repositories.py` | Read move history for an imported game | Yes, supporting only | Low | Useful for SAN/UCI/ply/FEN context, but it is not an exercise-detail route. |
| `GET /games/history` | `backend/neurochess/api/game_routes.py` | Read imported game history | Yes, supporting only | Low | Safe context route, not an exercise-detail route. |
| `TrainingItemService.list_items_for_game` | `backend/neurochess/training_item_service.py` | Select existing training items for one game | Unknown until route contract | Medium | The method appears SELECT-only, but the service also owns write paths. A future route may use a read-only subset only with anti-mutation tests and static guards. |
| `TrainingItemService.get_items_by_ids` | `backend/neurochess/training_item_service.py` | Select existing training items by id and join move context | Unknown until route contract | Medium | Promising internal data source for existing exercise detail, but it must be wrapped by a route that forbids creation and unsafe fields. |
| `GET /games/{game_id}/review/practice/sessions` | `backend/neurochess/api/game_routes.py` | List practice sessions for a game | No for REX detail | Medium | GET route, but belongs to Practice session state. Not authorized for existing exercise read-only detail. |
| `GET /review/practice/sessions/{session_id}` | `backend/neurochess/api/game_routes.py` | Read one practice session | No for REX detail | Medium | May expose session/attempt/solution state. It is not the future read-only exercise-detail route. |
| `GET /games/{game_id}/review` | `backend/neurochess/api/game_routes.py`; `backend/neurochess/review_service.py` | Read or assemble review payload | No | High | Calls `_ensure_training_items_for_review_payload`, which can create or update `training_items`. Forbidden for REX. |
| `POST /games/{game_id}/review/generate` | `backend/neurochess/api/game_routes.py`; `backend/neurochess/review_service.py` | Generate review | No | High | Can run review generation and training item ensure logic. |
| `POST /games/{game_id}/review/rebuild-metrics` | `backend/neurochess/api/game_routes.py` | Rebuild review metrics | No | High | Recompute/write path. Forbidden for read-only detail. |
| `POST /api/training/daily-plan` and `POST /api/training/daily-plan/practice` | `backend/neurochess/api/game_routes.py` | Create/update Daily Plan and start practice from it | No | High | Daily Plan and Practice mutation surfaces. |
| Practice session and attempt POST routes | `backend/neurochess/api/game_routes.py` | Create sessions, revisions, attempts, abandon, retry, complete | No | High | Active Practice write paths. Forbidden. |
| `POST /review/try-move/evaluate` and review explorer evaluate routes | `backend/neurochess/api/game_routes.py` | Evaluate moves or lines | No for REX detail | Medium | Evaluation endpoints are not the read-only detail route and may invoke analysis logic. |
| `TrainingItemService.ensure_training_items_for_game` | `backend/neurochess/training_item_service.py` | Ensure training items exist for review moments | No | High | Uses write retry and `_upsert_training_item`; explicitly forbidden for REX detail. |
| `ReviewService.get_review` and review generation/recompute helpers | `backend/neurochess/review_service.py` | Build/retrieve review payloads | No for REX detail | High | The API wrapper can ensure training items after review payload retrieval. Avoid for REX. |

## 5. Safe Read-Only Candidates

The safest existing backend pattern is:

- `GET /games/{game_id}/truth-chain/moments`
- `ReviewMomentsReadOnlyService.get_truth_chain_moments`

This path is valuable because it already uses a read-only SQLite connection,
returns a `readOnlyProof`, and has tests proving repeated calls do not mutate
training, practice, Daily Plan, or `due_at` state.

Supporting read-only candidates are:

- `GET /games/{game_id}/moves`, for move context only.
- `GET /games/history`, for game context only.
- `TrainingItemService.get_items_by_ids`, if and only if a future route wraps it
  with read-only constraints, anti-mutation tests, and no unsafe field exposure.
- `TrainingItemService.list_items_for_game`, if and only if it is used as a
  SELECT-only source under a dedicated read-only route contract.

There is not yet an existing public route that safely reads a persisted exercise
detail as a REX detail payload.

## 6. Unsafe Or Forbidden Paths

The following paths must remain forbidden for REX Existing Exercise Read-Only
Detail:

- `/games/{game_id}/review`, because it can call
  `_ensure_training_items_for_review_payload` and create or update
  `training_items`.
- `/games/{game_id}/review/generate`, review jobs, reconcile, cancel, and
  rebuild-metrics routes, because they are generation/recompute/job-control
  surfaces.
- `TrainingItemService.ensure_training_items_for_game` and `_upsert_training_item`,
  because they write training item rows.
- Daily Plan routes, especially `POST /api/training/daily-plan` and
  `POST /api/training/daily-plan/practice`; even read-only Daily Plan surfaces
  should remain outside the REX detail boundary.
- Practice session and attempt mutation routes:
  - `POST /games/{game_id}/review/practice/sessions`
  - `POST /games/{game_id}/review/practice/revisions`
  - `POST /review/practice/sessions/{session_id}/attempts`
  - `POST /review/practice/sessions/{session_id}/abandon`
  - `POST /review/practice/sessions/{session_id}/retry-failed`
  - `POST /review/practice/sessions/{session_id}/complete`
- Try-move and explorer evaluation routes, because REX detail must not grade,
  evaluate, or invoke analysis.
- Any route that recomputes Review, invokes engine analysis, updates scoring,
  records results, mutates `due_at`, touches Daily Plan rows, reveals solutions,
  or writes XP/rank/Transfer state.

## 7. Existing Exercise Detail Data Contract Candidate

There is no currently verified safe public route for existing persisted exercise
detail. The smallest future backend route contract should be a GET-only route
that reads a known existing exercise by id and validates that it belongs to the
requested game or source moment.

Possible future route shape:

```text
GET /games/{game_id}/existing-exercises/{training_item_id}/read-only
```

Alternate shape, if game scoping is handled inside the payload:

```text
GET /training-items/{training_item_id}/read-only
```

The response should expose only conceptual detail data needed for a read-only
preview:

- exercise id, only if the row already exists;
- game id;
- source review moment id, if available;
- ply or move number;
- SAN and UCI from the persisted move context;
- `fen_before` and `fen_after`, if already persisted or derivable from existing
  stored move data without engine/review recompute;
- side to move;
- label, category, domain, or source tags that are already stored and safe;
- short reason/context text suitable for a read-only preview;
- limitations if data is incomplete;
- `readOnlyProof`, including:
  - `writesPerformed: false`
  - `trainingItemsCreated: false`
  - `practiceAttemptsCreated: false`
  - `dailyPlanTouched: false`
  - `dueAtTouched: false`
  - `scoringTouched: false`
  - `engineInvoked: false`
  - `reviewRecomputed: false`
  - `solutionRevealed: false`

The response must never expose:

- a hidden solution or accepted-move set unless a later reveal contract allows it;
- score/result rows;
- latest attempt result;
- `due_at` mutation or next due date update;
- Daily Plan membership as a call side effect;
- XP, rank, league, or Transfer Score;
- raw unsafe metrics such as `criticality_score`, `diagnostic_gap`,
  `neuro_score_diag`, or uncalibrated domain scores;
- internal evidence JSON, debug payloads, or engine internals;
- any field that implies Practice has started.

## 8. Required Anti-Mutation Tests For Future Implementation

Before any implementation, a test-contract mission should define anti-mutation
coverage for the route. Required checks:

- repeated GET calls return stable payloads and identical database state;
- no `training_items` rows are inserted, updated, or deleted;
- no `review_practice_sessions` rows are inserted, updated, or deleted;
- no `review_practice_attempts` rows are inserted, updated, or deleted;
- no `daily_plan_items` rows are inserted, updated, or deleted;
- no `due_at` value changes;
- no scoring/result rows are inserted, updated, or deleted;
- no XP/rank/Transfer state changes;
- no review recomputation is triggered;
- no engine invocation occurs;
- no call path reaches `/games/{game_id}/review`;
- no call path reaches `_ensure_training_items_for_review_payload`;
- no call path reaches `TrainingItemService.ensure_training_items_for_game`;
- static guards reject forbidden fragments in the new route/service;
- invalid exercise id returns a safe 404;
- exercise id for a different game returns a safe 404 or 403;
- missing source moment data returns limitations, not recomputation;
- hidden solution fields are absent from the payload;
- the route remains GET-only and has no POST/PATCH/PUT/DELETE equivalent.

The existing `backend/tests/test_truth_chain_readonly_route.py` is the strongest
template for future REX anti-mutation tests.

## 9. GO / NO-GO

GO:

- A docs-only or test-contract mission for a dedicated Existing Exercise
  Read-Only Backend Route Contract.
- A future GET-only route only after anti-mutation tests are written first.
- Reuse of the Truth Chain read-only pattern: read-only connection,
  `readOnlyProof`, limitations for incomplete data, and static forbidden-call
  guards.

NO-GO:

- Active Practice implementation.
- Any route that creates or ensures training items.
- Any route that creates practice sessions, revisions, attempts, scoring, or
  result rows.
- Any `due_at` mutation.
- Any Daily Plan creation, rebuild, or update.
- Any solution reveal.
- Any `/games/{game_id}/review` dependency for REX.
- Any frontend implementation before backend read-only tests and contract exist.

## 10. Recommended Next Mission

Recommended next mission:

```text
R3L_EXISTING_EXERCISE_READONLY_BACKEND_ROUTE_CONTRACT
```

Type:

```text
docs-only test/route contract
```

Purpose:

- define the exact GET-only backend route contract;
- define the response schema and forbidden fields;
- define the anti-mutation test contract;
- require test-first separation before implementation;
- keep active Practice, `due_at`, Daily Plan, scoring, XP/rank/Transfer, and
  solution reveal out of scope.

Do not proceed to active Practice yet.
