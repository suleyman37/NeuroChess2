# R3I Next-Step Decision After R3H - NeuroChess REX

## 1. Status

Status:
Decision document after R3H.

R3H is complete and pushed.

Known chain:
- QG read-only gives a safe mission surface.
- Parties / Truth Chain read-only gives real game material.
- Forge read-only preview shows how a moment could become training.
- R3G defined the Practice boundary.
- R3H defined existing exercise read-only detail as the smallest honest bridge after Forge.

R3I does not implement anything.
R3I decides the next product step.

## 2. What R3H Clarified

R3H clarified that an existing exercise detail can be useful only if it reads an already persisted exercise.

It must not:
- create a practice_attempt;
- create a training_item;
- mutate due_at;
- mutate Daily Plan;
- start active Practice;
- score a result;
- reveal a solution unless already allowed by persisted read-only data;
- create XP, rank, or Transfer Score;
- call `/games/{game_id}/review`.

R3H also clarified that "Voir l'exercice existant" is not the same as "S'entrainer maintenant".

## 3. What Remains Unproven

Still unproven:
- no implemented existing exercise detail view in REX;
- no audited safe route for exercise detail;
- no proof that reading an exercise has zero mutation;
- no anti-mutation smoke around existing exercise detail;
- no active Practice session;
- no practice_attempt lifecycle;
- no due_at scheduling;
- no Daily Plan integration;
- no training item creation from Forge;
- no scoring write;
- no complete loop from play to review to Forge to Practice to revision to transfer.

## 4. Product Options

| Option | Value | Risk | Verdict |
| --- | --- | --- | --- |
| Existing exercise read-only implementation | Turns Forge's "existing exercise detected" state into a concrete read-only detail | Medium: route safety must be proven first | Recommended next if scoped read-only |
| Active Practice first attempt | Moves toward real training value | High: creates attempts, scoring, due_at, and user-state risk | Too early |
| More contracts | Can reduce risk before code | Medium: may delay visible value | Use only for route audit gaps |
| UI polish | Makes Forge/detail surfaces clearer | Low to medium: can become cosmetic drift | Not primary |
| AgentOS hardening | Improves automation reliability | Low product risk | Valuable, but separate from product progress |
| Gemini visual judge | Improves visual QA later | Low to medium automation risk | Useful later, not product-critical now |

## 5. Recommended Next Product Mission

Recommended next product mission:
R3J_EXISTING_EXERCISE_READONLY_DETAIL_INTEGRATION_CONTRACT_OR_PREVIEW

Preferred direction:
- audit whether a safe existing exercise detail read route exists;
- if safe, integrate a read-only detail preview;
- if unsafe or unclear, stop at a route contract and do not code the view.

The next product step should stay read-only.

It may show:
- exercise identity;
- source game and moment;
- position preview;
- prompt text if already persisted;
- limitations;
- read-only proof.

It must not start active Practice.

## 6. Boundaries For R3J

R3J must forbid:
- creating practice_attempts;
- creating training_items;
- mutating due_at;
- mutating Daily Plan;
- scheduling revision;
- recording score;
- revealing hidden solution state;
- creating XP;
- creating rank;
- creating Transfer Score;
- calling `/games/{game_id}/review`;
- importing PGN;
- launching analysis.

Allowed only after proof:
- GET route for existing exercise detail;
- no write methods;
- no DB mutation before/after smoke;
- no Daily Plan route;
- no Practice route unless a later dedicated contract approves it.

## 7. Required Evidence Before Implementation

Before any implementation, R3J must provide:
- route inventory for exercise detail;
- proof of GET-only behavior;
- DB snapshot or equivalent no-mutation evidence;
- network smoke denying POST/PATCH/PUT/DELETE;
- explicit denial of `/games/{game_id}/review`;
- explicit denial of Practice and Daily Plan routes;
- copy review proving no "S'entrainer maintenant" unless a safe active flow exists.

If this evidence is missing, R3J should remain a contract.

## 8. UX Direction

Allowed copy:
- "Exercice existant detecte"
- "Detail en lecture seule"
- "Voir la position"
- "Aucune tentative creee"
- "Aucun planning modifie"

Forbidden copy:
- "Exercice cree"
- "Drill pret" without persisted proof
- "S'entrainer maintenant"
- "Revision programmee"
- "XP a gagner"
- "Score de transfert"
- "Plan genere"

## 9. Checks For This Docs Step

Required checks:
- `git diff --check`
- `.venv\Scripts\python.exe tools\plan_guard.py`

Expected result:
- only `docs/rebuild/21_R3I_NEXT_STEP_DECISION_AFTER_R3H_REX.md` changed;
- no frontend;
- no backend;
- no plan;
- no package files;
- no `App.tsx`.

## 10. GO / NO-GO

GO:
R3J can be prepared only as a bounded existing exercise read-only detail contract or preview mission.

NO-GO:
- active Practice implementation;
- practice_attempt creation;
- training_item creation;
- due_at mutation;
- Daily Plan mutation;
- scoring;
- XP/rank/Transfer;
- more than one autonomous product mission at a time.

Decision:
Proceed toward existing exercise read-only detail only if the route can be proven read-only.

GO_FOR_R3J_AFTER_HUMAN_REVIEW: pending
