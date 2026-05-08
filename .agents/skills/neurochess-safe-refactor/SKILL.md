---
name: neurochess-safe-refactor
description: Refactor NeuroChess safely without hidden behavior changes. Use for extraction, de-duplication, module boundary cleanup, service split, or large-file reduction where behavior should remain stable.
---

# NeuroChess Safe Refactor

## When To Use

- A task asks for refactor, extraction, de-duplication, service split, or
  boundary cleanup.
- A change touches multiple files or risky hotspots such as `App.tsx`,
  `review_service.py`, metrics, review jobs, practice, engine, or migrations.

## When Not To Use

- Feature work that intentionally changes behavior.
- Bug fixes that need reproduction first; use replay/debug when relevant.
- Formula, metric, or action changes; use the matching NeuroChess skill first.

## Required Docs And Tools

- `docs/AI_COLLABORATION_PROTOCOL.md`
- `docs/PROJECT_STATE.md`
- `docs/METRIC_REGISTRY.md`
- `docs/ACTION_REGISTRY.md`
- `docs/SCREEN_CONTRACTS.md`
- Serena symbol overview, references, and search before multi-file edits.

## Mandatory Steps

1. Start with `git status --short --branch`.
2. State the behavior-preservation boundary.
3. Use Serena to map symbols and references before editing.
4. Split the refactor into small reversible steps.
5. Keep each step behavior-preserving unless explicitly approved.
6. Avoid big-bang file moves or broad rewrites.
7. Do not alter formulas, action contracts, screen contracts, migrations, or
   engine schema as incidental cleanup.
8. Run focused tests after each meaningful step when practical.
9. Inspect diff before final report.
10. Finish with `/review` or explicit review request for large changes.

## Validation

- Tests remain green at each step or failures are explained immediately.
- Public API, DB schema, payload contracts, and score semantics are unchanged.
- No hidden frontend/backend authority shift occurred.
- Rollback is easy because changes are small and localized.
- Final report lists files, tests, behavior boundary, and risks.

## Stop Conditions

- Refactor scope expands beyond the approved boundary.
- Tests fail without clear relation to the step.
- Behavior changes are discovered but not approved.
- Serena reference mapping shows too many coupled call sites for a safe slice.
- Dirty user changes overlap the intended edits in risky files.

