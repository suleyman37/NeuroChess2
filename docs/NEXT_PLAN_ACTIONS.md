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

### P0. CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1

- ID: `CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1`
- Priorite: P0
- Titre: Prove and repair the real browser board interaction loop
- Etat: completed on 2026-05-04. `ChessBoardPanel` now supports click-click
  move input in addition to drag/drop, orientation is passed for Review/Practice,
  stable board selectors exist, and stalled-analysis retry copy is no longer
  duplicated.
- Justification Plan1/Plan2/Plan3: V1 Practice must be active learning
  (`Défi -> Tentative -> Correction -> Répétition`), not reveal-only. Plan3
  requires browser evidence for board UX before external users.
- Fichiers probables: `frontend/src/components/ChessBoardPanel.tsx`,
  `frontend/src/App.tsx`, `frontend/src/components/review/*`,
  `backend/neurochess/engines/fake_engine.py`,
  `scripts/browser_test_helpers.mjs`,
  `scripts/browser_core_board_interaction_smoke.mjs`,
  `scripts/browser_analysis_stall_recovery_smoke.mjs`,
  `backend/tests/test_core_board_practice_contract.py`,
  `backend/tests/test_frontend_core_board_interaction_static.py`,
  `docs/CORE_INTERACTION_CONTRACT.md`.
- Taille: M
- Risques: drag/drop-specific behavior is not separately proven across browsers;
  click-click is the stable V1 input contract.
- Dependances: Training Items/Daily Plan and Profile/Privacy already merged.
- Definition du done: Review board renders, Review moment selection keeps board
  stable, Practice from Review accepts real board moves, correct/wrong/illegal
  attempts persist, reveal persists, Daily Plan Practice accepts board moves,
  analysis timeout/failure recovery has one retry copy and completes after
  retry, no forbidden V1 UI appears.
- Tests a lancer: `cmd /c node scripts\browser_core_board_interaction_smoke.mjs`,
  `cmd /c node scripts\browser_analysis_stall_recovery_smoke.mjs`, backend
  full suite, frontend build/typecheck, existing browser smokes, plan guard.

### P0. REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1

- ID: `REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1`
- Priorite: P0
- Titre: Repair user-observed Review board exploration and real analysis loop
- Etat: completed on 2026-05-04. This mission continued on top of the
  uncommitted Core Board P0 diff because the user reported the previous PASS
  smokes were not representative of the real local app.
- Justification Plan1/Plan2/Plan3: Review must support active understanding and
  Practice must not be reveal-only. Analysis must never leave the user in an
  infinite spinner with no terminal or recoverable state.
- Fichiers probables: `frontend/src/App.tsx`,
  `frontend/src/components/ChessBoardPanel.tsx`, `frontend/src/styles.css`,
  `backend/neurochess/review_job_service.py`,
  `backend/tests/test_review_jobs.py`,
  `backend/tests/test_frontend_core_board_interaction_static.py`,
  `scripts/browser_review_exploration_real_smoke.mjs`,
  `scripts/browser_real_analysis_no_infinite_loop_smoke.mjs`,
  `docs/CORE_INTERACTION_CONTRACT.md`.
- Taille: M
- Risques: Review exploration is intentionally local-only and not an engine
  explorer. Drag/drop is still secondary; click-click is the required V1 input
  contract.
- Dependances: Core Board P0, Training Items/Daily Plan, Profile/Privacy.
- Definition du done: Review has `Exploration locale`, the user can make legal
  local moves, undo, reset, handle illegal moves calmly, and no Practice attempt
  is created during exploration. Practice still saves real attempts separately.
  Stale Review jobs are materialized as recoverable `stalled` jobs, and browser
  analysis smoke has a hard deadline.
- Tests a lancer: `cmd /c node scripts\browser_review_exploration_real_smoke.mjs`,
  `cmd /c node scripts\browser_real_analysis_no_infinite_loop_smoke.mjs`,
  existing browser board/profile/daily/V1 smokes, backend full suite, frontend
  build/typecheck, plan guard, `git diff --check`.

### P0. PRACTICE-FEEDBACK-CORRECTNESS-AND-LEGACY-REVIEW-REBUILD-V1

- ID: `PRACTICE-FEEDBACK-CORRECTNESS-AND-LEGACY-REVIEW-REBUILD-V1`
- Priorite: P0
- Titre: Prevent contradictory Practice feedback when the user played the best
  move
- Etat: implemented on 2026-05-05 in the working tree. The mission centralizes
  Practice/Review try-move feedback classification in the backend, normalizes
  user/best/accepted moves to UCI from FEN, and adds a browser smoke for exact
  best-move success feedback.
- Justification Plan1/Plan2/Plan3: V1 learning trust requires objective,
  backend-authoritative feedback. A move equal to the best/accepted move must
  never be shown as a problem, and legacy incomplete Review data must be
  rebuildable instead of producing false negative feedback.
- Fichiers probables: `backend/neurochess/metrics/try_move.py`,
  `backend/neurochess/review_practice_service.py`,
  `backend/neurochess/api/game_routes.py`, `frontend/src/App.tsx`,
  `frontend/src/components/review/ReviewLessonPanel.tsx`,
  `frontend/src/components/review/ReviewPracticePanel.tsx`,
  `scripts/browser_practice_best_move_feedback_success_smoke.mjs`,
  docs and targeted tests.
- Taille: M
- Risques: legacy Reviews may still require explicit rebuild if FEN or best move
  is missing/unparseable; do not silently mutate old reviews.
- Definition du done: targeted backend/static tests pass, browser smoke proves
  exact best move success with no contradictory labels, evidence pack is written,
  no formulas/Stockfish/NeuroScore change, no stage/commit/push unless later
  explicitly authorized.
- Tests a lancer: plan guard, targeted backend Practice/try-move/static tests,
  frontend build/typecheck, `cmd /c node
  scripts\browser_practice_best_move_feedback_success_smoke.mjs`, impacted
  Practice browser smokes, `git diff --check`.

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

### P1. MISSION-CONTROL-GOLDEN-FLOWS-AND-FAILURE-LEDGER-V1

- ID: `MISSION-CONTROL-GOLDEN-FLOWS-AND-FAILURE-LEDGER-V1`
- Priorite: P1
- Titre: Create Mission Control governance docs for Golden Flows and known
  trust-critical failures
- Etat: implemented on 2026-05-05 as a docs-only governance layer under
  `docs/mission_control/`.
- Justification Plan3: future Codex missions need a stable protocol, Golden
  Flow anti-regression list, visual evidence contract, Failure Ledger, and
  Release Radar to avoid false confidence after runtime/browser fixes.
- Fichiers touches: `docs/mission_control/MISSION_PROTOCOL.md`,
  `docs/mission_control/GOLDEN_FLOWS.md`,
  `docs/mission_control/FAILURE_LEDGER.md`,
  `docs/mission_control/VISUAL_EVIDENCE_CONTRACT.md`,
  `docs/mission_control/RELEASE_RADAR.md`, plus narrow references in QA docs.
- Taille: S
- Risques: treating Mission Control as product truth. It is only an operational
  checklist layer; Plan1/Plan2/Plan3 remain authoritative.
- Definition du done: docs created, references added, plan guard passes, no
  product code touched, no stage/commit/push unless separately authorized.
- Tests a lancer: plan guard, `git diff --check`.

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

### P1. TRAINING-ITEMS-DAILY-PLAN-V1

- ID: `TRAINING-ITEMS-DAILY-PLAN-V1`
- Priorite: P1
- Titre: Implement durable training_items and deterministic Daily Plan V1
- Etat: completed on 2026-05-04 by `P1.TRAINING-ITEMS-DAILY-PLAN-V1`.
- Justification Plan1/Plan2/Plan3: Plan3 requires durable `training_items`,
  `simple_spaced_repetition_v1`, a deterministic Daily Plan, and Practice from
  that plan before V1 release.
- Fichiers touches: `backend/neurochess/training_item_service.py`,
  `backend/neurochess/daily_plan_service.py`,
  `backend/neurochess/data/migrations.py`,
  `backend/neurochess/api/game_routes.py`,
  `backend/neurochess/review_practice_service.py`,
  `backend/neurochess/privacy_service.py`, `frontend/src/App.tsx`,
  `frontend/src/api/client.ts`, `backend/tests/test_training_items_daily_plan.py`,
  `scripts/browser_daily_plan_smoke.mjs`, governance/QA docs.
- Taille: L
- Risques: plan selection could become opaque if internal scores leak; browser
  proof currently uses fake engine and a compact seeded PGN producing a partial
  one-item plan.
- Dependances: completed Profile/Privacy export/delete, Learning Loop V1,
  browser V1 flow smoke.
- Definition du done: `training_items` are durable/idempotent, Daily Plan uses
  due/failed/recent critical/diversity buckets deterministically, Training keeps
  exactly three entries, Practice can start from Daily Plan, attempts preserve
  enriched fields and `due_at`, export/delete covers new tables, and browser
  Daily Plan smoke passes.
- Tests a lancer: plan guard, backend full suite, review/PGN/real-flow smokes,
  browser V1/profile/daily plan smokes, frontend build, `npx tsc --noEmit`,
  `git diff --check`.
- Resultat: plan guard PASS, backend full suite PASS (`476 tests`), Review/PGN
  Sindarov smokes PASS, browser V1/profile/daily plan smokes PASS, frontend
  build PASS, `npx tsc --noEmit` PASS. Active Daily Plan Practice now renders
  even without a preselected Review.

### P1. DEGRADED-STATES-ANTI-TILT

- ID: `DEGRADED-STATES-ANTI-TILT`
- Priorite: P1
- Titre: Make degraded states and anti-tilt copy calm and actionable
- Etat: implemented on 2026-05-05 by
  `P1.DEGRADED-STATES-ANTI-TILT-V1`.
- Justification Plan1/Plan2: Plan2 asks for sane dopamine, recovery states, and
  emotional regulation after losses or blocked analysis.
- Fichiers touches: `frontend/src/components/StateNotice.tsx`,
  `frontend/src/degradedStates.ts`, `frontend/src/App.tsx`,
  `frontend/src/components/review/ReviewPracticePanel.tsx`,
  `scripts/browser_degraded_states_smoke.mjs`,
  `docs/DEGRADED_STATES_CONTRACT.md`, docs QA/governance.
- Taille: M
- Risques: hiding actionable recovery behind too much soft copy, or turning
  errors into a technical dashboard. Backend unavailable, invalid/illegal PGN,
  Daily Plan empty, and export/delete temp-DB safety are browser-proven by the
  new smoke. Engine stalled recovery and real board Practice remain covered by
  the P0 smokes.
- Dependances: app shell states, browser V1 flow smoke, profile/privacy smoke,
  browser Daily Plan smoke.
- Definition du done: invalid PGN, illegal PGN, duplicate import, backend
  unavailable, Daily Plan empty/partial/unavailable, no Practice item, illegal
  Practice move, save failure, reveal-used reassurance, repeated-wrong copy,
  and session-completed states have clear next actions with no jargon and no
  forbidden V1 UI. Full mobile/i18n/offline mode remains deferred.
- Tests a lancer: plan guard, frontend build/typecheck, static tests, backend
  review/API tests if state contracts change, browser degraded-state smoke plus
  existing browser V1/profile smokes.

### P1. MOBILE-RESPONSIVE-AND-A11Y-V1

- ID: `MOBILE-RESPONSIVE-AND-A11Y-V1`
- Priorite: P1
- Titre: Prove mobile/responsive and keyboard/accessibility basics for V1
- Etat: completed on 2026-05-05. Mobile responsive and keyboard/focus basics
  are now covered by dedicated browser smokes.
- Justification Plan2/Plan3: V1 is browser-usable, but mobile/responsive and
  accessibility are not yet proven by a dedicated smoke.
- Fichiers touches: focused responsive CSS in `frontend/src/styles.css`,
  board focus/width in `frontend/src/components/ChessBoardPanel.tsx`,
  browser helper additions, `scripts/browser_mobile_responsive_smoke.mjs`,
  `scripts/browser_keyboard_accessibility_smoke.mjs`, static tests, and QA docs.
- Taille: M
- Risques: turning the mission into a redesign instead of a proof/repair pass.
- Dependances: P0 board/runtime, P1 degraded states.
- Definition du done: done for V1 minimum. App shell, Import, Review, Review
  exploration, Practice, Daily Plan, Profile/Privacy and board controls are
  browser-smoked at 390x844 with no horizontal overflow. Keyboard focus basics
  and `prefers-reduced-motion` are browser-smoked. Full WCAG certification and
  physical-device QA remain out of scope.
- Tests a lancer: plan guard, frontend build/typecheck, backend static tests,
  existing browser smokes, `cmd /c node scripts\browser_mobile_responsive_smoke.mjs`,
  and `cmd /c node scripts\browser_keyboard_accessibility_smoke.mjs`.

### P1. I18N-STRINGS-CATALOG-V1

- ID: `I18N-STRINGS-CATALOG-V1`
- Priorite: P1
- Titre: Centralize V1 French strings without changing product behavior
- Etat: recommended next mission after Mobile/A11Y.
- Justification Plan2/Plan3: the V1 surface is now browser-proven across core,
  degraded, mobile and keyboard flows, but visible French strings remain
  scattered. Centralizing strings reduces copy drift without adding features.
- Fichiers probables: a focused frontend strings module, limited component
  imports, static tests, and QA docs.
- Taille: M
- Risques: accidentally rewriting UX copy, changing i18n scope into a product
  redesign, or touching forbidden V2/V3 labels.
- Dependances: completed P0/P1 browser smokes.
- Definition du done: critical V1 labels/copy move to a small catalog while UI
  behavior, nav labels, Training entries, degraded-state messages, board flows,
  and forbidden-label guards remain unchanged.
- Tests a lancer: plan guard, backend static tests, frontend build/typecheck,
  existing browser smokes, mobile/accessibility smokes.

### P1. PROFILE-PRIVACY

- ID: `PROFILE-PRIVACY`
- Priorite: P1
- Titre: Add minimal Profile/Settings privacy controls for V1
- Etat: completed on 2026-05-04 by `P1.PROFILE-PRIVACY-V1`.
- Justification Plan1/Plan2/Plan3: Plan3 requires privacy/export/delete before
  first external users; Plan2 keeps Profile/Settings outside the main nav.
- Fichiers touches: `backend/neurochess/privacy_service.py`,
  `backend/neurochess/api/game_routes.py`, `frontend/src/App.tsx`,
  `frontend/src/api/client.ts`, `frontend/src/styles.css`,
  `backend/tests/test_profile_privacy.py`,
  `backend/tests/test_frontend_profile_privacy_static.py`,
  `scripts/browser_profile_privacy_smoke.mjs`, governance/QA docs.
- Taille: M
- Risques: turning Profile into a dashboard or adding account/cloud scope that
  is not in V1.
- Dependances: browser smoke proof of the core V1 loop.
- Definition du done: Profile/Settings exposes only V1 privacy controls,
  export, delete/reset local data, clear copy, no cloud/account promise, and no
  research metrics. Done with backend/static tests and browser smoke.
- Tests a lancer: plan guard, backend full suite, browser V1 smoke,
  browser profile/privacy smoke, frontend build, typecheck, diff check.
- Resultat: `GET /api/export` returns local JSON with metadata and available
  sections; `DELETE /api/user-data?confirm=SUPPRIMER` refuses missing/wrong
  confirmation and deletes local user data only after typed confirmation.

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

## Hotfix ajoute - P0 REVIEW ANALYSIS LIVE

### P0. REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1

- ID: `REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1`
- Priorite: P0
- Etat: implementation candidate 2026-05-05, commit seulement si validations
  PASS.
- Titre: Fix Review analysis no-infinite-timer and activate safe live board
  analysis.
- Justification: le retour utilisateur reel prime sur les smokes optimistes.
  Review analysis ne doit jamais rester en spinner/timer indefini; l'analyse
  live doit aider sur board Review/exploration sans spoiler Practice.
- Fichiers probables: `backend/neurochess/review_job_service.py`,
  `backend/neurochess/live_analysis_service.py`, `frontend/src/App.tsx`,
  browser smokes, docs lifecycle/contracts.
- Definition du done: UI-started Review job reaches terminal/recoverable state;
  live analysis visible in Review/exploration; live paused during Review job;
  live hidden before Practice attempt/reveal; backend tests and browser smokes
  pass.
- Tests a lancer: full backend suite, frontend build/typecheck, existing smokes,
  and the four new browser smokes.
- Prochaine mission recommandee apres PASS: `P1.I18N-STRINGS-CATALOG-V1`.
