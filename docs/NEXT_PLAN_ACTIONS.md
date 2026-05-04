# Next Plan Actions

Command recommended before and after UI/product missions:

```powershell
python tools/plan_guard.py
```

## P0

### P0. FULL-APP-EVIDENCE-QA-AUDIT-V1

- ID: `FULL-APP-EVIDENCE-QA-AUDIT-V1`
- Priorite: P0
- Titre: Full application evidence QA audit
- Etat: completed on 2026-05-04. This mission created
  `docs/FULL_APPLICATION_QA_AUDIT.md`, `docs/TEST_COVERAGE_MATRIX.md`,
  `docs/V1_READINESS_REPORT.md`, and `docs/QA_CHECKLIST.md`.
- Justification Plan1/Plan2/Plan3: Plan3 requires evidence before release
  confidence. The audit separates automatic tests, smokes, browser evidence,
  placeholders, partials, missing V1 work, and Plan gaps.
- Fichiers probables: docs only.
- Taille: M
- Risques: treating static/backend tests as browser proof.
- Dependances: Plan governance, App Shell, Training V1, Learning Loop V1.
- Definition du done: full suite/smokes/build/typecheck/browser smoke are run or
  blockers documented, and readiness report names one next mission.
- Tests a lancer: plan guard, backend full suite, review smoke, PGN smoke, real
  flow smoke, frontend build, typecheck fallback, browser smoke, `git diff --check`.

### P0. BROWSER-SMOKE-FLOW

- ID: `BROWSER-SMOKE-FLOW`
- Priorite: P0
- Titre: Automate browser smoke for the real V1 loop
- Etat: completed on 2026-05-04. `scripts/browser_v1_flow_smoke.mjs`
  starts an isolated temp backend DB, fake engine, Vite, and Edge CDP browser,
  then proves `/app -> Plan2 nav -> PGN import UI -> ready Review Summary ->
  Practice -> reveal attempt -> due_at/learning_summary scheduled signal`.
- Justification Plan1/Plan2/Plan3: backend/API evidence is strong, but external
  V1 confidence requires a browser-visible proof of the actual user loop.
- Fichiers probables: `scripts/browser_v1_flow_smoke.mjs`,
  `docs/FULL_APPLICATION_QA_AUDIT.md`, `docs/TEST_COVERAGE_MATRIX.md`,
  `docs/V1_READINESS_REPORT.md`, `docs/QA_CHECKLIST.md`,
  `docs/PROJECT_STATE.md`.
- Taille: M
- Risques: using the user's live local DB, running slow real Stockfish analysis,
  or creating a flaky browser test.
- Dependances: working local backend/frontend dev servers, stable fixture PGN or
  seeded ready Review fixture.
- Definition du done: automated/browser-verifiable flow:
  `/app` loads -> nav works -> import/seed PGN -> ready Review Summary visible
  -> Practice starts -> one attempt records -> due revision signal appears; no
  forbidden V1 labels; app console has no major errors. Done with
  `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
- Tests a lancer: plan guard, backend full suite, Review smoke, PGN smoke,
  real-flow smoke, frontend build, typecheck fallback, browser smoke,
  `git diff --check`.

### P0. INTEGRATE-PLAN3-MD

- ID: `INTEGRATE-PLAN3-MD`
- Priorite: P0
- Titre: Integrate Plan3 as execution-order master plan
- Etat: completed on 2026-05-04. `plan/Plan3.md` is now part of the official
  source of truth and governs sprint order, Codex mission discipline, tests, and
  V1 delivery without replacing Plan1/Plan2.
- Justification Plan1/Plan2/Plan3: Plan3 prevents scope creep by enforcing one
  sprint/objective/diff/tests/report at a time.
- Fichiers probables: `AGENTS.md`, `docs/PLAN_SOURCE_OF_TRUTH.md`,
  `docs/PLAN_CONTEXT_MIN.md`, `docs/PLAN_FEATURE_BOUNDARIES.md`,
  `docs/NEXT_PLAN_ACTIONS.md`, `docs/PLAN_ALIGNMENT_AUDIT.md`,
  `docs/PROJECT_STATE.md`.
- Taille: S
- Risques: treating Plan3 as permission for a huge roadmap refactor.
- Dependances: `plan/Plan1.txt`, `plan/Plan2.txt`, `plan/Plan3.md`.
- Definition du done: governance docs name Plan3, distinguish its role, and
  preserve Plan1/Plan2 as product truth.
- Tests a lancer: `python tools/plan_guard.py`, `git diff --check`.

### P0. RESTORE-PYTHON-TEST-ENV

- ID: `RESTORE-PYTHON-TEST-ENV`
- Priorite: P0
- Titre: Restore reliable backend Python test environment
- Etat: completed / OK on 2026-05-03 with a local repair environment.
- Justification Plan1/Plan2: backend tests and Review smoke must pass before
  continuing feature work that touches Review, Practice, or training flows.
- Fichiers probables: `.venv`, `.venv_repair_local`, `.manual_pydeps`,
  `.wheelhouse`, `requirements.txt`, `docs/PROJECT_STATE.md`.
- Taille: S
- Risques: the original `.venv` still points to Python 3.12.10 under
  `C:\Users\bahij\AppData\Local\Programs\Python\Python312`, which exists but
  returns `Access denied` in this Codex session. Do not replace `.venv`
  automatically without human confirmation.
- Dependances: root `requirements.txt`.
- Definition du done: backend dependencies import correctly, plan guard passes,
  full backend unittest suite passes, Review smoke passes, and frontend build is
  rechecked.
- Tests a lancer:

```powershell
$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe -m unittest discover backend/tests
.venv_repair_local\Scripts\python.exe scripts\review_regression_smoke.py
```

### P0. RESTORE-SERENA-MCP

- ID: `RESTORE-SERENA-MCP`
- Priorite: P0
- Titre: Restore Serena MCP availability for Codex sessions
- Justification Plan1/Plan2: `AGENTS.md` asks Codex to activate NeuroChess2
  with Serena before multi-file edits when Serena is available.
- Etat: completed / OK on 2026-05-03 after Codex/MCP restart. Serena MCP is
  exposed, project activation works, onboarding is already done, and active
  languages are `typescript` and `python`. Serena TypeScript semantic inspection
  OK after restart for `frontend/src/App.tsx`, `AppShellPage`,
  `ReviewCockpitSummary`, `ReviewPanel`, `ReviewPracticeSessionPanel`, and
  `ReviewPracticePanel`.
- Fichiers probables: `.serena/project.yml`; `%USERPROFILE%\.codex\config.toml`
  only after explicit human confirmation.
- Taille: S
- Risques: editing global Codex config without confirmation could affect other
  projects.
- Dependances: local `uvx` availability and Codex MCP restart.
- Definition du done: Serena MCP is exposed, activates
  `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2`, passes
  onboarding check, and can semantically inspect TypeScript symbols in
  `frontend/src/App.tsx`, `ReviewCockpitSummary`, `ReviewPanel`, and
  Practice-related components. Large refactors should begin by activating
  Serena and reading symbol overview.
- Tests a lancer: Serena project activation, onboarding check,
  `get_symbols_overview` on `frontend/src/App.tsx`, `find_symbol` for
  `ReviewCockpitSummary` / `ReviewPanel`, and Practice symbol checks.
- Config recommandee a verifier:

```toml
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context=codex"]
startup_timeout_sec = 60
tool_timeout_sec = 180
```

Verified CLI config:

```toml
[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd", "--context=codex"]
startup_timeout_sec = 60
tool_timeout_sec = 180
```

### P0. PLAN-GOVERNANCE-INSTALLED

- ID: `PLAN-GOVERNANCE-INSTALLED`
- Priorite: P0
- Titre: Install permanent Plan1/Plan2 operating system
- Justification Plan1/Plan2: Plan1/Plan2 are the project constitution; future
  Codex sessions must not treat current code as product truth.
- Fichiers probables: `AGENTS.md`, `docs/PLAN_SOURCE_OF_TRUTH.md`,
  `docs/PLAN_CONTEXT_MIN.md`, `docs/PLAN_FEATURE_BOUNDARIES.md`,
  `docs/PLAN_ALIGNMENT_AUDIT.md`, `docs/NEXT_PLAN_ACTIONS.md`,
  `tools/plan_guard.py`.
- Taille: S
- Risques: docs drift if future missions skip the protocol.
- Dependances: `plan/Plan1.txt`, `plan/Plan2.txt`.
- Definition du done: governance docs exist, root `AGENTS.md` points to plans,
  plan guard passes, future missions have a prioritized queue.
- Tests a lancer: `python tools/plan_guard.py`; frontend/backend checks only if
  code changed.

### P0. REMOVE-NEUROMONITOR-V1

- ID: `REMOVE-NEUROMONITOR-V1`
- Priorite: P0
- Titre: Keep NeuroMonitor and brain visuals out of V1 normal UI
- Justification Plan1/Plan2: "Neuro" is a metaphor; Plan2 forbids spectacular
  dashboards and uncalibrated cognitive displays in normal UI.
- Fichiers probables: `frontend/src`, `docs/RESEARCH_BACKLOG.md`,
  `tools/plan_guard.py`.
- Taille: S
- Risques: a future visual polish pass reintroduces brain/atlas/cortex language
  or dependencies.
- Dependances: none.
- Definition du done: no normal frontend references to NeuroMonitor, brain,
  cortex, atlas, cognitive map, or neuro3d; research concept remains docs-only.
- Tests a lancer: `python tools/plan_guard.py`; frontend build.

### P0. REVIEW-SUMMARY-PLAN2

- ID: `REVIEW-SUMMARY-PLAN2`
- Priorite: P0
- Titre: Keep Review Summary aligned with Plan2 hierarchy
- Justification Plan1/Plan2: Review Summary is the V1 comprehension surface and
  must not become a technical cockpit.
- Fichiers probables: `frontend/src/components/review/ReviewCockpitSummary.tsx`,
  `frontend/src/components/review/ReviewPanel.tsx`, `frontend/src/styles.css`,
  `backend/tests/test_frontend_lesson_flow_static.py`.
- Taille: M
- Risques: hidden technical details may leak into the normal Summary; too many
  CTAs may reappear.
- Dependances: Review payload and practice launch remain stable.
- Definition du done: Summary shows coach NeuroScore, one interpretation,
  secondary/collapsed reference precision, max 3 key moments, one training CTA,
  and discreet advanced details.
- Tests a lancer: frontend build, plan guard, targeted frontend static tests.

## P1

### P1. APP-SHELL-PLAN2-1

- ID: `APP-SHELL-PLAN2-1`
- Priorite: P1
- Titre: Migrate app shell to Aujourd'hui / Mes parties / Entrainement
- Etat: implemented as a progressive shell, not a full refactor.
- Justification Plan1/Plan2: Plan2 says Review opens from user flows and is not
  a permanent main navigation tab; the board must not be the permanent center.
- Fichiers probables: `frontend/src/App.tsx`, `frontend/src/styles.css`,
  focused app shell components, `docs/SCREEN_CONTRACTS.md`,
  `docs/ACTION_REGISTRY.md`.
- Taille: M
- Risques: `App.tsx` is large and board-centered; broad refactor can break
  import, Review, and Practice flows.
- Dependances: stable Review Summary and existing history/import flows.
- Definition du done: three main destinations exist, a profile/settings
  placeholder stays outside main nav, Review opens from context, one primary
  action per screen, and no formula or Stockfish changes were made.
- Tests a lancer: frontend build, plan guard, Playwright smoke, backend tests.

### P1. APP-SHELL-PLAN2-2

- ID: `APP-SHELL-PLAN2-2`
- Priorite: P1
- Titre: Stabilize Plan2 shell routes and reduce legacy board dominance
- Etat: implemented on 2026-05-03. Today now uses real Review/Practice/import
  and analysis-state signals for one hero CTA. Mes parties prioritizes PGN
  import/history in the page header. Entrainement still exposes exactly Plan du
  jour, Mes positions ratees, and Revisions while reusing existing Practice
  session/history signals.
- Justification Plan1/Plan2: V5.5-1 creates the shell; the next step should
  make Mes parties, Aujourd'hui, and Entrainement cleaner without a large
  rewrite.
- Fichiers probables: `frontend/src/App.tsx`, possible focused components under
  `frontend/src/components/app-shell/`, `docs/SCREEN_CONTRACTS.md`,
  `docs/ACTION_REGISTRY.md`.
- Taille: M
- Risques: extracting too much from `App.tsx` can break Review replay, import,
  or Practice state.
- Dependances: V5.5-1 shell passing build/plan guard/tests.
- Definition du done: Review remains contextual, Mes parties keeps import and
  history reliable, Aujourd'hui uses real available Review/Practice signals,
  and no new V2/research feature appears.
- Tests a lancer: plan guard, frontend build, Playwright smoke, backend tests if
  touched.

### P1. TRAINING-V1

- ID: `TRAINING-V1`
- Priorite: P1
- Titre: Stabilize Entrainement page with only V1 training entries
- Etat: implemented on 2026-05-03. Entrainement keeps exactly Plan du jour,
  Mes positions ratees, and Revisions; the hero has one primary
  `Commencer` / `Reprendre` action; missed positions use existing Practice
  history/session signals; Revisions stays an honest non-productized state.
- Justification Plan1/Plan2: V1 training should be simple: Plan du jour, missed
  positions, revisions.
- Fichiers probables: `frontend/src/App.tsx`,
  `frontend/src/components/review/ReviewPracticePanel.tsx`,
  `backend/neurochess/review_practice_service.py`.
- Taille: M
- Risques: exposing SkillTrace, ETV, or domain scores too early.
- Dependances: `APP-SHELL-PLAN2-2`, practice result events.
- Definition du done: Entrainement has exactly the V1 entries, one primary CTA,
  no formulas, no research metrics, and no fourth mode.
- Tests a lancer: frontend build, plan guard, practice service tests.

### P1. LEARNING-LOOP-MINIMUM

- ID: `LEARNING-LOOP-MINIMUM`
- Priorite: P1
- Titre: Stabilize practice_result_event, simple revisions, compact progression
- Etat: implemented on 2026-05-03. Practice attempts now store V1 event fields
  (`item_id`, time spent, hint/reveal flags, source context, `due_at`), simple
  due/scheduled revision counts are computed backend-side, and Aujourd'hui /
  Entrainement consume only honest counts. Plan3 names this scheduling layer
  `simple_spaced_repetition_v1`; do not call it FSRS-lite.
- Justification Plan1/Plan2: learning must close the loop from Review Practice
  to later review and measured progression.
- Fichiers probables: `backend/neurochess/review_practice_service.py`,
  learning/user model modules, `frontend/src/App.tsx`, training components.
- Taille: M
- Risques: premature calibrated claims; exposing internal ETV/SkillTrace; making
  SkillTrace visible or prescriptive before V1.1; showing mastery scores or
  Transfer Gap.
- Dependances: `TRAINING-V1`, stable practice attempt schema.
- Definition du done: attempts/hints/reveals are stored, due review can be shown
  plainly, compact progress exists without raw formulas, domain scores, mastery
  scores, FSRS labels, or visible Transfer Gap. Daily Plan remains
  deterministic; SkillTrace, when added, is shadow only.
- Tests a lancer: backend unit tests, frontend build, plan guard.

### P1. DEGRADED-STATES-ANTI-TILT

- ID: `DEGRADED-STATES-ANTI-TILT`
- Priorite: P1
- Titre: Make degraded states and anti-tilt copy calm and actionable
- Justification Plan1/Plan2: Plan2 asks for sane dopamine, recovery states, and
  emotional regulation after losses or blocked analysis.
- Fichiers probables: `frontend/src/reviewState.ts`,
  `frontend/src/components/review/ReviewTechnicalDetails.tsx`,
  `frontend/src/App.tsx`.
- Taille: M
- Risques: hiding actionable recovery behind too much soft copy.
- Dependances: app shell states.
- Definition du done: PGN invalid, Stockfish absent, slow/partial/stalled review,
  and recent-loss states have clear next actions with no jargon.
- Tests a lancer: frontend build, static tests, backend review tests if state
  contracts change.

### P1. PROFILE-PRIVACY

- ID: `PROFILE-PRIVACY`
- Priorite: P1
- Titre: Add minimal Profile/Settings privacy controls for V1
- Etat: next recommended mission after `BROWSER-SMOKE-FLOW`.
- Justification Plan1/Plan2/Plan3: Plan3 requires privacy/export/delete before
  first external users; Plan2 keeps Profile/Settings outside the main nav.
- Fichiers probables: `frontend/src/App.tsx`, a small profile/settings
  component if extraction is useful, backend data/export/delete routes if
  needed, `docs/API_CONTRACTS.md`, `docs/SCREEN_CONTRACTS.md`,
  `docs/ACTION_REGISTRY.md`.
- Taille: M
- Risques: turning Profile into a dashboard or adding account/cloud scope that
  is not in V1.
- Dependances: browser smoke proof of the core V1 loop.
- Definition du done: Profile/Settings exposes only V1 privacy controls,
  export, delete/reset local data, clear copy, no cloud/account promise, and no
  research metrics.
- Tests a lancer: plan guard, backend tests for export/delete if backend is
  touched, frontend build, browser smoke.

## P2

### P2. OFFLINE-PARTIAL

- ID: `OFFLINE-PARTIAL`
- Priorite: P2
- Titre: Add modest offline state
- Justification Plan1/Plan2: offline can show calculated Reviews, downloaded
  Practice, local progress, and queued PGN import only.
- Fichiers probables: app shell components, storage helpers, import queue code.
- Taille: M
- Risques: implying full cloud/sync/offline-engine support.
- Dependances: app shell.
- Definition du done: discreet offline badge and allowed/blocked actions.
- Tests a lancer: frontend build, browser smoke.

## RESEARCH

### RESEARCH. CANDIDATE-TRAINER

- ID: `CANDIDATE-TRAINER`
- Priorite: RESEARCH
- Titre: Candidate Trainer opt-in concept
- Justification Plan1/Plan2: V2 differentiator, not V1 normal UI.
- Fichiers probables: future Review/Lesson/Practice modules.
- Taille: L
- Risques: bloats Review and adds cognitive load.
- Dependances: stable Review/Practice and explicit V2 decision.
- Definition du done: stays out of V1 UI.
- Tests a lancer: none until implementation mission.

### RESEARCH. INTENT-LAYER-DEEP

- ID: `INTENT-LAYER-DEEP`
- Priorite: RESEARCH
- Titre: Deep Intent Layer
- Justification Plan1/Plan2: optional/future; not normal V1.
- Fichiers probables: future intention/candidate flows.
- Taille: L
- Risques: asks too much from users and pollutes Review.
- Dependances: app shell and user testing.
- Definition du done: no normal V1 exposure.
- Tests a lancer: none until implementation mission.

### RESEARCH. LLM-COACH

- ID: `LLM-COACH`
- Priorite: RESEARCH
- Titre: Evidence-grounded LLM coach
- Justification Plan1/Plan2: future only with verifier and source evidence.
- Fichiers probables: future `backend/neurochess/llm/*`, evidence verifier docs.
- Taille: L
- Risques: hallucinated chess truth.
- Dependances: verifier, evidence contracts, privacy decision.
- Definition du done: no public LLM coach until every claim is grounded.
- Tests a lancer: none until implementation mission.

### RESEARCH. TRANSFER-GAP

- ID: `TRANSFER-GAP`
- Priorite: RESEARCH
- Titre: Transfer Gap metric
- Justification Plan1/Plan2: V2 after enough Practice and future-game data.
- Fichiers probables: learning engine/user model.
- Taille: L
- Risques: false precision with insufficient samples.
- Dependances: practice history and future game matching.
- Definition du done: remains hidden until data sufficiency rules exist.
- Tests a lancer: none until implementation mission.

### RESEARCH. BRAIN-VISUAL-CONCEPT

- ID: `BRAIN-VISUAL-CONCEPT`
- Priorite: RESEARCH
- Titre: Brain/atlas/cortex visual concept
- Justification Plan1/Plan2: possible identity work only after validation; never
  a V1 normal UI promise.
- Fichiers probables: `docs/RESEARCH_BACKLOG.md`.
- Taille: L
- Risques: overclaiming direct brain measurement.
- Dependances: calibrated metrics, user testing, explicit product decision.
- Definition du done: remains research-only; no frontend dependency or normal UI
  entry.
- Tests a lancer: `python tools/plan_guard.py`.
