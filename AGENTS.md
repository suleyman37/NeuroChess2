# NeuroChess Agent Rules

Use these rules before and during AI work. Source docs remain authoritative.

## Source Of Truth

The project is governed by:

- `plan/Plan1.txt` - only scientific source of truth, Plan1 v3.0 FINAL - Codex-ready
- `plan/Plan2.txt` - only UX/product/interface source of truth, Plan2 v4.0 FINAL - 20/20 - Codex-ready
- `plan/Plan3.md` - only technical execution/release/testing/governance source
  of truth, Plan3 v4.0 FINAL - 20/20 - Codex-ready
- `docs/PLAN_CONTEXT_MIN.md`
- `docs/PLAN_FEATURE_BOUNDARIES.md`
- `docs/NEXT_PLAN_ACTIONS.md`

Priority:

1. Plan1, Plan2, and Plan3.
2. Plan governance docs.
3. Existing code.

Existing code is implementation state, not product truth. If code contradicts
Plan1, Plan2, or Plan3, treat the code as non-aligned.

Older plan versions, downloaded copies, previous summaries, old prompts,
backups, and model memory must be ignored if they conflict with
`plan/Plan1.txt`, `plan/Plan2.txt`, or `plan/Plan3.md`.

Plan roles:

- Plan1 governs science, engine, metrics, formulas, and the user model.
- Plan2 governs UX, screens, navigation, and user journeys.
- Plan3 governs sprint order, technical roadmap, Codex governance, tests, and
  V1 delivery.

Plan1, Plan2, and Plan3 are constitutions, not implementation missions. Never
apply a full plan as one large mission. Execute only the explicitly requested
sprint or narrowly scoped task.

## Product Loop

NeuroChess must follow:

PGN import -> Stockfish analysis -> Win% -> win_loss -> NeuroScore coach -> key
moments -> Review -> Practice -> revision -> progression.

## V1 Boundaries

Forbidden in V1 user-facing UI:

- NeuroMonitor / brain / cortex / atlas
- Candidate Trainer
- deep Intent Layer
- LLM coach
- visible Transfer Gap
- raw `criticality_score`
- `diagnostic_gap`
- `neuro_score_diag`
- Stockfish WDL as public metric
- domain score /100 without calibration

V2, V3, and research features must be hidden, documented, or placed in backlog.
Do not improve forbidden V1 UI features; remove, hide, or backlog them.

## UX Rules

Plan2 requires:

- Aujourd'hui
- Mes parties
- Entrainement
- Profile/settings outside main nav
- Review opened from those flows, not a permanent main tab
- one screen = one intent
- one primary CTA per screen
- no technical dashboard as main UX
- beginner screens hide formulas, evidence JSON, debug panels, and engine internals

## Architecture

- Frontend dumb, backend authoritative.
- Chess rules, FEN/SAN/UCI, try-move grading, review scoring, and training
  decisions must be backend-authoritative.
- Do not put metric formulas in `frontend/src/App.tsx`.
- Any new metric must be added to `docs/METRIC_REGISTRY.md`.
- Any new action must be added to `docs/ACTION_REGISTRY.md`.
- Any new screen or tab must respect `docs/SCREEN_CONTRACTS.md`.

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

## Work Protocol

Before coding:

1. Read `AGENTS.md`.
2. Read `docs/PLAN_SOURCE_OF_TRUTH.md`.
3. Read `docs/PLAN_CONTEXT_MIN.md`.
4. Read the relevant canonical plan files for the mission:
   `plan/Plan1.txt`, `plan/Plan2.txt`, and/or `plan/Plan3.md`.
5. Read `docs/NEXT_PLAN_ACTIONS.md`.
6. Check `docs/PLAN_FEATURE_BOUNDARIES.md` if touching product behavior.
7. Start important missions with `git status --short --branch`.

During coding:

1. Do not add out-of-plan features.
2. Do not improve forbidden V1 UI features; hide, remove, or backlog them.
3. Do not expose internal metrics as user truth.
4. Prefer small, verifiable missions.
5. Do not run a massive refactor as one mission.
6. Do not stage or commit by default unless explicitly authorized.
7. Never use `git add -A`; stage only explicit mission files.
8. Never put secrets, tokens, API keys, cookies, or `.env` content in prompts,
   logs, docs, tests, or memories.

After coding:

1. Run frontend build/typecheck if frontend changed.
2. Run backend tests if backend changed.
3. Run `python tools/plan_guard.py` if available.
4. Update `docs/PLAN_ALIGNMENT_AUDIT.md`.
5. Update `docs/NEXT_PLAN_ACTIONS.md`.
6. Inspect the diff.

## Tool Use

- Activate NeuroChess2 with Serena before multi-file edits when Serena is
  available.
- Use Serena for symbol search, references, and architecture navigation when
  available.
- Use Context7 only for recent external API/library documentation.
- Use Playwright only for UI or browser-visible behavior changes.
- Do not use MCP/tool outputs to expose secrets.

## Testing

- Add or update tests for every behavior change.
- Backend full suite: `.venv\Scripts\python.exe -m unittest discover backend/tests`.
- Target backend tests with `.venv\Scripts\python.exe -m unittest backend.tests.<module>`.
- Review smoke: `.venv\Scripts\python.exe scripts\review_regression_smoke.py`.
- Frontend build from `frontend/`: `cmd /c npm.cmd run build`.
- Use Playwright for browser-visible changes.
- Stop if base tests fail without a clear relation to the mission.

## Done Means

A task is not done until:

- code compiles;
- behavior matches Plan1/Plan2;
- no forbidden V1 UI was added;
- docs reflect the new state;
- tests/checks were run or blockers are documented.

## Rollback

- Before a large mission, record `git status --short --branch`.
- After a mission, list modified files, tests run, results, and risks.
- Never revert user changes without explicit permission.
- If corruption or wrong direction appears, inspect `git status`, `git diff`,
  and `git reflog`, then choose targeted restore/reset/reflog recovery with
  human approval.

## NeuroChess AgentOS Autopilot

The repo-native autopilot lives in `ops/autopilot/` and is governed by
`.agent/PLANS.md`, `.codex/rules/`, and the skills in `.agents/skills/`.

Autopilot rules:

- One queue item per run.
- One controlled diff per queue item.
- Use Git worktrees under `C:\Users\suley\Documents\Dev\NeuroChess2_worktrees`.
- Write run logs and QA artifacts under
  `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot`.
- Never use `git add -A`.
- Never stage `.serena/project.yml`, `.venv/`, `qa_artifacts/`, or
  `backend/neurochess/data/openings_book.json`.
- Public GitHub repositories must not register self-hosted runners by default.
  Use the Windows scheduler as the primary automation mechanism unless a private
  repo or private mirror is proven.
- `write_sensitive` tasks are quarantined to `autopilot/<task-id>` and are not
  promoted directly to `road-to-V2` during bootstrap.
