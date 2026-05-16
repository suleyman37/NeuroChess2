# Prompt Linter Rules

## Fail-Closed

The NC-MP/2 linter fails closed. It does not auto-correct dangerous prompts and
does not invent missing safety constraints.

## Broad Language

The linter rejects broad or vague wording:

- improve
- polish
- optimize
- refactor
- finalize
- stabilize
- as needed
- if necessary
- clean up everything
- handle everything
- continue the roadmap
- make it better
- fix all

## Work Type Restrictions

Docs-only prompts may not allow code or package paths. Backend-readonly and
frontend-readonly prompts must encode ephemeral branch requirements. Frontend
read-only prompts must include screenshot/contact and visual review evidence.

Mixed frontend/backend prompts fail unless a future explicit policy permits
that combination.

## Red-Tier Detection

Red-tier terms are rejected outside red/quarantine scope:

- Practice
- `due_at`
- Daily Plan
- `training_items`
- `practice_attempts`
- scoring
- XP
- rank
- Transfer

## Required Fields

`checks`, `stop`, and `commit` are mandatory. Missing fields, duplicate fields,
missing `DONE`, hidden prose, and invalid tier/type values all fail lint.
