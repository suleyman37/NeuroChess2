# Night Mode Product Scope Policy

## Allowed Work Types

### Green Docs And Contracts

Allowed paths include `docs/autopilot/**` and safe `docs/rebuild/**` decision,
audit, and contract files. These may auto-merge to `road-to-V2` only when the
Mission Contract exact match passes and checks pass.

### Backend Read-Only

Backend-readonly work is allowed only on an ephemeral branch. It must be limited
to GET/read-only behavior and must include anti-mutation evidence.

Required evidence:

- no `training_items` insert/update/delete;
- no `practice_attempts` insert;
- no `due_at` mutation;
- no Daily Plan mutation;
- no scoring/result writes;
- repeated GETs preserve DB state.

Night Mode may not auto-merge backend code to `road-to-V2`.

### Frontend Read-Only

Frontend-readonly work is allowed only on an ephemeral branch. It must not call
backend write paths or imply active Practice.

Required evidence:

- screenshots or contact sheet;
- ChatGPT visual review brief;
- no backend writes;
- no active Practice CTA.

Night Mode may not auto-merge frontend code to `road-to-V2`.

### Smoke And Test-Only

Smoke/test-only missions are allowed when they do not mutate production state
and produce evidence. Tests that intentionally fail before implementation must
remain off `road-to-V2` until reviewed.

## Forbidden Work

Night Mode v0 forbids:

- red-tier work;
- active Practice;
- `training_items` create/update/delete;
- `practice_attempts` create/update/delete;
- `due_at` mutation;
- Daily Plan create/rebuild/update;
- scoring/result writes;
- XP/rank/league/Transfer;
- DB migrations;
- `package.json` or `package-lock.json` changes;
- GitHub runner changes;
- credential/session changes;
- scheduler changes;
- direct backend/frontend merge to `road-to-V2`;
- force push;
- `git add -A`.

## Red-Tier Exclusion

Any mission mentioning Practice execution, due dates, Daily Plan mutation,
training item writes, practice attempts, scoring, result recording, solution
reveal, XP/rank/Transfer, or learning-state writes is outside Product-Safe
Night Mode v0.
