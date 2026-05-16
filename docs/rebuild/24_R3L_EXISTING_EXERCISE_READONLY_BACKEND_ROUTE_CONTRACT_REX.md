# R3L - Existing Exercise Read-Only Backend Route Contract

## 1. Purpose

R3L converts the R3K route audit into an exact backend route contract for a
future Existing Exercise Read-Only Detail endpoint.

This document does not implement anything. It does not authorize backend code,
frontend code, tests, active Practice, training item creation, practice attempt
creation, `due_at` mutation, Daily Plan mutation, scoring, XP/rank/Transfer, or
solution reveal.

The only product intent is to define what a future GET-only backend route must
do when reading an already persisted exercise/training item detail without side
effects.

## 2. Current Evidence From R3K

R3K found the safest existing read-only pattern to be:

- `GET /games/{game_id}/truth-chain/moments`
- `ReviewMomentsReadOnlyService.get_truth_chain_moments`

That path uses a read-only SQLite connection, returns `readOnlyProof`, and has
tests showing repeated calls do not mutate training, practice, Daily Plan, or
`due_at` state.

R3K also found supporting read-only context routes and helpers:

- `GET /games/{game_id}/moves`, for move context only;
- `GET /games/history`, for game context only;
- `TrainingItemService.get_items_by_ids`, only as a future audited SELECT-only
  source;
- `TrainingItemService.list_items_for_game`, only as a future audited
  SELECT-only source.

R3K found these paths unsafe or forbidden for REX detail:

- `/games/{game_id}/review`;
- review generate, rebuild, job, reconcile, and cancel routes;
- `TrainingItemService.ensure_training_items_for_game`;
- `_ensure_training_items_for_review_payload`;
- Practice session and attempt mutation routes;
- Daily Plan mutation routes;
- try-move and explorer evaluation routes.

`/games/{game_id}/review` remains forbidden because the route can pass its
payload through `_ensure_training_items_for_review_payload`, which can call
`TrainingItemService.ensure_training_items_for_game` and create or update
`training_items`. REX detail needs an already persisted exercise read. It must
never ensure, create, recompute, grade, schedule, record, or reveal anything.

## 3. Proposed Route

Primary recommended route:

```text
GET /games/{game_id}/truth-chain/exercises/{exercise_id}/detail
```

Rationale:

- it stays scoped by `game_id`;
- it sits near the proven Truth Chain read-only surface;
- it makes the exercise relationship explicit;
- it avoids the unsafe `/games/{game_id}/review` surface;
- it leaves room for an honest `null` detail when the persisted exercise does
  not exist or does not belong to the game.

Alternative route names may be considered later, but this contract chooses the
route above as the primary recommendation.

The route must:

- be GET-only;
- be scoped by `game_id`;
- read only already persisted exercise/training item data;
- return a `null`, `not_found`, or limited response if no persisted exercise
  exists;
- never create an exercise;
- never create `training_items`;
- never update `training_items`;
- never create `practice_attempts`;
- never create Practice sessions;
- never mutate `due_at`;
- never touch Daily Plan state;
- never call `TrainingItemService.ensure_training_items_for_game`;
- never call `_ensure_training_items_for_review_payload`;
- never call `/games/{game_id}/review`.

## 4. Allowed Read Sources

Allowed sources for a future implementation:

- game table or game repository read for basic game identity;
- moves read for FEN, SAN, UCI, ply, and move-number context when already
  available;
- `ReviewMomentsReadOnlyService` or equivalent read-only review moment source
  for source context;
- `training_items` SELECT-only read for an already persisted exercise;
- read-only joins between persisted `training_items`, moves, games, and review
  moments when needed to prove game ownership and context.

Allowed implementation properties:

- use a read-only SQLite connection or read-only transaction where feasible;
- use explicit SELECT queries only;
- return limitations instead of recomputing missing data;
- include a `readOnlyProof` object in every response.

Explicitly not allowed:

- engine calls;
- Stockfish calls;
- review recomputation;
- review generation;
- Daily Plan reads or writes for this route;
- Practice service writes;
- scoring/result writes;
- import, analysis, or rebuild flows.

## 5. Forbidden Sources And Calls

The future route must explicitly forbid:

- `/games/{game_id}/review`;
- `TrainingItemService.ensure_training_items_for_game`;
- `_ensure_training_items_for_review_payload`;
- `TrainingItemService._upsert_training_item`;
- Practice session creation;
- Practice attempt creation;
- Practice revision creation;
- Daily Plan generation, rebuild, update, or practice start;
- `due_at` mutation;
- scoring writes;
- result recording;
- XP, rank, league, or Transfer Score writes;
- solution reveal unless a later Practice/reveal contract explicitly allows it;
- Stockfish or engine invocation;
- review recompute;
- review generate;
- review rebuild metrics;
- review jobs, reconcile, cancel, or diagnostics as a source for this route;
- try-move evaluation;
- review explorer move or line evaluation;
- POST, PATCH, PUT, or DELETE equivalents for this detail route.

## 6. Response Contract Candidate

Conceptual response shape:

```ts
type ExistingExerciseReadOnlyDetailResponse = {
  game: {
    id: string;
    white?: string;
    black?: string;
    result?: string;
    openingName?: string;
  };
  exercise: {
    id: string;
    gameId: string;
    sourceMomentId?: string;
    sourcePly?: number;
    moveNumber?: number;
    playedSan?: string;
    playedUci?: string;
    fenBefore?: string;
    fenAfter?: string;
    label?: string;
    category?: string;
    promptContext?: string;
    exerciseAvailable: true;
  } | null;
  limitations: string[];
  readOnlyProof: {
    route: string;
    methodsAllowed: ["GET"];
    writesPerformed: false;
    trainingItemsCreated: false;
    trainingItemsUpdated: false;
    practiceSessionsCreated: false;
    practiceAttemptsCreated: false;
    dueAtTouched: false;
    dailyPlanTouched: false;
    scoringTouched: false;
    resultRecorded: false;
    engineInvoked: false;
    reviewRecomputed: false;
    reviewRouteTouched: false;
    solutionRevealed: false;
  };
};
```

Field rules:

- `exercise` is `null` when the exercise id does not exist, does not belong to
  the game, or cannot be safely read.
- `limitations` must explain missing persisted data without triggering any
  fallback recomputation.
- `readOnlyProof` must be present even for empty or not-found responses.
- `playedSan`, `playedUci`, `fenBefore`, and `fenAfter` may be omitted when not
  already available from safe persisted data.
- `promptContext` must be short, user-safe context. It must not reveal hidden
  solutions or internal diagnostic JSON.

Fields that must not appear:

- accepted moves;
- best move as solution;
- hidden solution explanation;
- latest attempt result;
- score/result payload;
- next due date mutation;
- Daily Plan membership as an action result;
- XP, rank, league, or Transfer Score;
- raw `criticality_score`;
- `diagnostic_gap`;
- `neuro_score_diag`;
- uncalibrated domain score;
- engine internals;
- debug evidence JSON.

## 7. UX Copy Contract For Future Frontend

Allowed copy:

- "Voir l'exercice existant"
- "Detail en lecture seule"
- "Aucune tentative creee"
- "Aucune revision programmee"
- "Position issue d'un exercice deja existant"
- "Lecture seule"
- "Detail indisponible"
- "Exercice introuvable"

Forbidden copy:

- "S'entrainer maintenant"
- "Commencer Practice"
- "Drill pret" unless a persisted exercise truly exists and the detail route
  proves it safely;
- "Revision programmee"
- "XP gagne"
- "Score de transfert"
- "Solution revelee" unless a later contract explicitly allows reveal;
- "Tentative creee"
- "Plan genere"
- "Exercice cree"

The future frontend must not present a read-only detail as an active training
entry point. Any CTA must preserve the read-only boundary.

## 8. Anti-Mutation Test Contract

R3M must write tests before R3N implementation. Required tests:

- repeated GET produces identical database state;
- no `training_items` row is inserted;
- no `training_items` row is updated;
- no `training_items` row is deleted;
- no `review_practice_sessions` row is inserted, updated, or deleted;
- no `review_practice_attempts` row is inserted, updated, or deleted;
- no `due_at` value changes;
- no Daily Plan row or state is touched;
- no scoring/result row is inserted or updated;
- no XP/rank/Transfer state is touched;
- no engine invocation occurs;
- no review recompute occurs;
- no review generation occurs;
- no `/games/{game_id}/review` call occurs;
- no `_ensure_training_items_for_review_payload` call occurs;
- no `TrainingItemService.ensure_training_items_for_game` call occurs;
- no `_upsert_training_item` call occurs;
- invalid exercise id returns `exercise: null`, 404, or another safe empty
  response defined by the test contract;
- exercise id for another game returns forbidden/not_found and no mutation;
- missing source move or moment data returns limitations and no recomputation;
- hidden solution fields are absent;
- route accepts GET only;
- POST, PATCH, PUT, and DELETE are absent or rejected;
- static guard checks the future route/service source for forbidden fragments.

The existing `backend/tests/test_truth_chain_readonly_route.py` should be used
as the closest pattern for anti-mutation snapshots and static forbidden-fragment
guards.

## 9. R3M / R3N Proposed Sequence

R3M:

```text
Existing Exercise Read-Only Backend Route Test Contract
```

Type:

```text
test_contract only
```

Goal:

- write backend tests first;
- do not implement the route;
- define anti-mutation snapshots;
- define response expectations;
- define forbidden call/static guards;
- prove that the route must not depend on `/games/{game_id}/review`.

R3N:

```text
Existing Exercise Read-Only Backend Route Implementation
```

Type:

```text
backend-readonly implementation only
```

Goal:

- implement only what R3M tests require;
- keep implementation GET-only;
- use SELECT-only sources;
- include `readOnlyProof`;
- do not add frontend code;
- do not add opportunistic Practice behavior.

R3O:

```text
Frontend REX Forge Existing Exercise Read-Only Detail Integration Contract
```

Type:

```text
docs or frontend-readonly later
```

Goal:

- define how Forge/REX may display the read-only detail after backend proof;
- keep UX copy honest;
- forbid active Practice CTAs.

Do not recommend active Practice yet.

## 10. GO / NO-GO

GO:

- R3L docs-only contract complete.
- Future R3M test_contract mission.
- Future R3N implementation only after R3M exists and fails for the missing
  route.
- Future route only if it is GET-only, game-scoped, SELECT-only, and
  anti-mutation tested.

NO-GO:

- active Practice;
- backend route implementation in R3L;
- frontend implementation in R3L;
- combined tests and implementation for amber/red surfaces;
- `due_at` mutation;
- Daily Plan mutation;
- scoring;
- result recording;
- XP/rank/Transfer;
- frontend "S'entrainer" CTA;
- `/games/{game_id}/review`;
- red-tier work without quarantine.

Decision:
Proceed next to R3M as a test-first contract mission. Do not proceed directly
to implementation, and do not start active Practice.
