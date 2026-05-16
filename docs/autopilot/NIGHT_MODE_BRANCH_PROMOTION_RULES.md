# Night Mode Branch Promotion Rules

## Auto-Promotion Allowed

Night Mode v0 may auto-commit and push to `road-to-V2` only for:

- green docs-only missions;
- safe `docs/rebuild/**` contracts;
- safe autopilot docs;
- exact Mission Contract matches;
- passing required checks;
- no Strategic Pulse objection.

## Auto-Promotion Forbidden

Night Mode v0 must not auto-merge or push product code to `road-to-V2`.

Forbidden for direct promotion:

- backend code;
- frontend code;
- tests that are meant to fail before implementation;
- amber/backend-readonly implementation;
- frontend UI changes;
- anything touching product code.

## Product Code Branch Rule

Backend-readonly and frontend-readonly output must remain on an ephemeral
branch. The morning report must name the branch, commits, checks, evidence, and
recommended disposition.

## Morning Review Outcomes

Allowed morning review recommendations:

- `READY_TO_REVIEW`
- `NEEDS_REWORK`
- `ABANDON_BRANCH`
- `QUARANTINE_REQUIRED`

No unattended product branch may promote itself to `road-to-V2`.

## Git Rules

- No merge commits during Night Mode.
- No force push.
- No `git add -A`.
- No direct road push for backend/frontend work.
- Quarantine any branch that touches red-tier scope.
