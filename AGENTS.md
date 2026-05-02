# NeuroChess Codex Rules

Use these rules before and during AI work. Source docs remain authoritative:
`docs/PROJECT_STATE.md`, `docs/AI_COLLABORATION_PROTOCOL.md`,
`docs/METRIC_REGISTRY.md`, `docs/ACTION_REGISTRY.md`,
`docs/FORMULAS_AND_METRICS.md`, `docs/FORMULA_IMPLEMENTATION_AUDIT.md`,
`docs/data_model.md`, `docs/LEARNING_ENGINE_BLUEPRINT.md`, and
`docs/SCREEN_CONTRACTS.md`.

## General

- One agent modifies code at a time.
- Codex is the primary implementer.
- ChatGPT/Claude may help with strategy, audit, critique, or handoff, but must
  not modify the repo at the same time.
- Never put secrets, tokens, API keys, cookies, or `.env` content in prompts,
  logs, docs, tests, or Serena memories.
- Do not run a massive refactor as one mission.
- Use a branch or worktree for each important mission when possible.
- Start important missions with `git status --short --branch`.
- Inspect the diff after each AI mission.
- Use `/review` before merge or large modifications.
- If a user-visible bug survives two fixes, stop feature work and reproduce the
  real flow before another fix.

## Tool Use

- Activate NeuroChess2 with Serena before multi-file edits.
- Use Serena for symbol search, references, and architecture navigation.
- Use Context7 only for recent external API/library documentation.
- Use Playwright only for UI or browser-visible behavior changes.
- Do not use MCP/tool outputs to expose secrets.

## Architecture

- Frontend dumb, backend authoritative.
- The frontend never decides final grading.
- Chess rules, FEN/SAN, try-move grading, review scoring, and training decisions
  must be backend-authoritative.
- Do not put metric formulas in `frontend/src/App.tsx`.
- Any new metric must be added to `docs/METRIC_REGISTRY.md`.
- Any new action must be added to `docs/ACTION_REGISTRY.md`.
- Any new screen or tab must respect `docs/SCREEN_CONTRACTS.md`.
- Beginner screens must not show raw formulas, evidence JSON, debug panels, or
  engine details.

## Data And Engine

- Respect `docs/data_model.md`.
- `eval_cp` is always POV White.
- `mate_in` is always POV White.
- `eval_pov_side_to_move_cp` is derived and must not replace canonical eval.
- Deep analysis is the durable source for Review.
- Engine analyses must remain versioned by engine, engine_version, depth,
  multipv, analysis_kind, and schema_version.
- Do not mix shallow/live analysis with review stabilized deep snapshots.
- Do not reinterpret old analysis schema versions silently.

## Metrics And Scores

- Respect `docs/FORMULAS_AND_METRICS.md` and
  `docs/FORMULA_IMPLEMENTATION_AUDIT.md`.
- Do not change a formula without explicit decision.
- New or modified metrics require tests or golden tests.
- Do not expose research metrics as user truth.
- Visible Review NeuroScore must stay aligned with the documented product
  decision.
- Diagnostic Gap, NeuroDiagnostic, raw criticality, and raw domain scores belong
  in audit/debug/advanced contexts only unless docs say otherwise.

## Actions And Screens

- One prescriptive screen gets one primary action.
- Visible secondary actions are capped at two.
- Advanced actions are hidden by default.
- Debug actions are never visible in normal UI.
- Destructive actions require confirmation.
- Do not duplicate actions under different labels.

## Testing

- Add or update tests for every behavior change.
- Backend full suite: `.venv\Scripts\python.exe -m unittest discover backend/tests`.
- Target backend tests with `.venv\Scripts\python.exe -m unittest backend.tests.<module>`.
- Review smoke: `.venv\Scripts\python.exe scripts\review_regression_smoke.py`.
- Frontend build from `frontend/`: `cmd /c npm.cmd run build`.
- Use Playwright for browser-visible changes.
- Stop if base tests fail without a clear relation to the mission.

## Rollback

- Before a large mission, record `git status --short --branch`.
- After a mission, list modified files, tests run, results, and risks.
- Never revert user changes without explicit permission.
- If corruption or wrong direction appears, inspect `git status`, `git diff`,
  and `git reflog`, then choose targeted restore/reset/reflog recovery with
  human approval.

