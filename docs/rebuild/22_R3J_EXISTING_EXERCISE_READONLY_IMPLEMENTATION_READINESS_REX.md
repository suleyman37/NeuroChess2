# R3J Existing Exercise Read-Only Implementation Readiness - NeuroChess REX

## 1. Status

Status:
Docs-only readiness decision after R3H and R3I.

R3J does not implement anything.
R3J decides whether the next safe product mission may move from contract to a
bounded read-only implementation candidate.

Known chain:
- QG read-only established a safe mission surface.
- Parties / Truth Chain read-only established real game material without writes.
- Forge read-only preview showed how a moment can suggest later training value.
- R3G defined the Practice boundary.
- R3H defined existing exercise read-only detail as a safe bridge only when the
  exercise already exists.
- R3I recommended existing exercise read-only detail as the safest next product
  direction, provided route safety can be proven first.

## 2. Evidence Used

Evidence read for this decision:
- `docs/rebuild/19_R3G_PRACTICE_BOUNDARY_READONLY_CONTRACT_REX.md`
- `docs/rebuild/20_R3H_EXISTING_EXERCISE_READONLY_DETAIL_CONTRACT_REX.md`
- `docs/rebuild/21_R3I_NEXT_STEP_DECISION_AFTER_R3H_REX.md`

Evidence not read in this docs-only step:
- frontend implementation files;
- backend route handlers;
- database contents;
- runtime network traces.

Therefore this document can decide readiness for the next contract or test-first
mission, but it cannot certify implementation safety by itself.

## 3. Known R3H State

R3H clarified that an existing exercise detail may be shown only when the
exercise already exists and the read path is proven non-mutating.

R3H permits a future read-only detail to show:
- position or moment context;
- source;
- status;
- limitations;
- already persisted detail fields if a safe route exists.

R3H forbids:
- active Practice start;
- practice_attempt creation;
- training_item creation;
- due_at mutation;
- Daily Plan mutation;
- scoring writes;
- hidden solution reveal;
- XP, rank, or Transfer Score creation;
- unsafe `/games/{game_id}/review` usage;
- POST, PATCH, PUT, or DELETE methods.

R3H also defines the honest fallback:
if no proven read-only detail route exists, the UI must remain at signal-only
and must not imply that a usable exercise is ready.

## 4. Known R3I State

R3I decided that the next product direction should remain read-only.

R3I compared:
- existing exercise read-only implementation;
- active Practice first attempt;
- more contracts;
- UI polish;
- AgentOS hardening;
- Gemini visual judge.

R3I recommended:
R3J_EXISTING_EXERCISE_READONLY_DETAIL_INTEGRATION_CONTRACT_OR_PREVIEW.

R3I did not approve active Practice implementation.
R3I did not prove a safe route exists.
R3I required route inventory, GET-only proof, no-mutation evidence, and copy
review before any implementation.

## 5. Safe Next Product Options

| Option | Product value | Risk | Readiness |
| --- | --- | --- | --- |
| Existing exercise read-only route audit | High: decides whether implementation can start | Low to medium: docs/tests only if scoped | Ready as next mission |
| Existing exercise read-only preview implementation | High: visible value after Forge | Medium: only safe after route proof | Not ready until audit evidence exists |
| Additional contract only | Medium: reduces ambiguity | Low: may delay visible value | Ready if audit discovers route gaps |
| UI copy clarification only | Low to medium: reduces false promises | Low: can drift into cosmetic work | Secondary |
| AgentOS hardening | Medium automation value | Low product risk | Useful, but separate from product progress |
| Gemini visual judge | Medium QA value later | Low to medium automation risk | Not needed before route safety |

## 6. Recommended Next Product Mission

Recommended next product mission:
R3K_EXISTING_EXERCISE_READONLY_ROUTE_AUDIT_TEST_CONTRACT.

Purpose:
prove whether a safe existing exercise read-only detail route already exists, or
whether a dedicated route must be designed before UI integration.

R3K should be test-contract first, not implementation.
It should use the A7 TDD separation rule and the A6 red-tier quarantine rules
if any hidden write path is discovered.

Allowed R3K shape:
- inventory candidate read routes;
- identify forbidden write paths;
- define anti-mutation tests;
- define route-level evidence required before UI work;
- decide GO/NO-GO for a later read-only preview implementation.

R3K should not build the frontend detail view yet.

## 7. Explicit Boundaries

The next product mission must not:
- start Practice;
- create practice_attempts;
- create training_items;
- mutate due_at;
- mutate Daily Plan;
- schedule revision;
- record scoring;
- reveal hidden solution state;
- create XP;
- create rank;
- create Transfer Score;
- call `/games/{game_id}/review`;
- import PGN;
- launch analysis;
- add frontend implementation;
- add backend implementation without prior test-contract evidence.

Allowed only after proof:
- GET-only existing exercise detail read;
- zero database mutation before and after repeated reads;
- no unsafe review route;
- no Practice route;
- no Daily Plan route;
- no write methods;
- no copy that implies an active exercise flow.

## 8. Required Evidence Before Implementation

Before any implementation mission, the repo must contain:
- route inventory for existing exercise detail candidates;
- explicit list of allowed GET routes;
- explicit list of forbidden routes and methods;
- anti-mutation test contract;
- before/after database snapshot plan or equivalent no-mutation proof;
- expected UI copy;
- forbidden UI copy;
- rollback expectation;
- GO/NO-GO for implementation.

If any required evidence is missing, implementation remains NO-GO.

## 9. GO / NO-GO

GO:
Prepare R3K as a bounded route-audit and test-contract mission for existing
exercise read-only detail.

Conditional GO later:
Implement a read-only preview only after R3K proves the route surface is GET-only
and non-mutating.

NO-GO:
- active Practice implementation;
- any learning-state write;
- any direct UI integration before route proof;
- any red-tier auto-promotion;
- any multi-mission autonomous product chain.

Decision:
R3J recommends a safe return to product work through R3K route audit/test
contract, not through active Practice and not through immediate implementation.

## 10. A9 Closure

A9 pilot complete; STOP after this third A9 mission.

Do not ask for a fourth A9 micro-prompt.
Do not start R3K in this run.
