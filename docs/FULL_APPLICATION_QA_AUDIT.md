# Full Application QA Audit V1

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW` + `P1.PROFILE-PRIVACY-V1` + `P1.TRAINING-ITEMS-DAILY-PLAN-V1` + `P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1` + `P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1`
Date: 2026-05-04

This is an evidence audit, not a product implementation pass. Plan1, Plan2, and
Plan3 remain the source of truth. Existing code is implementation state only.

## Baseline

- Branch: `road-to-V2...origin/road-to-V2 [ahead 2]`.
- Worktree before this audit: dirty, with many pre-existing modified/untracked
  files from prior Plan governance, App Shell, Training, and Learning Loop work.
- New files created by this audit: this file, `docs/TEST_COVERAGE_MATRIX.md`,
  `docs/V1_READINESS_REPORT.md`, `docs/QA_CHECKLIST.md`.
- Product code changed by this audit: none.
- Commit/stage: none.
- `rg.exe` was unavailable in this session (`Access denied`), so text searches
  used PowerShell `Select-String`.

## Evidence Levels

- A = browser or end-to-end smoke plus automated tests.
- B = integration/API/backend smoke or service tests.
- C = unit/static/build/typecheck only.
- D = code present but not tested directly.
- E = doc or placeholder only.
- F = broken or contradictory with Plan1/Plan2/Plan3.

## P0.BROWSER-SMOKE-FLOW Update

Date: 2026-05-04.

New evidence added after the full audit:

- Script: `scripts/browser_v1_flow_smoke.mjs`.
- Command: `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
- Strategy: isolated temporary backend working directory/SQLite DB, existing
  fake engine (`NEUROCHESS_ENGINE_MODE=fake`), temporary Vite server, Edge
  controlled through CDP, no Playwright dependency added.
- Result: PASS.
- Proven browser flow:
  `/app -> Plan2 nav -> Entrainement exactly 3 entries -> Mes parties import
  surface -> PGN import through UI -> ready Review API -> Review Summary visible
  -> Practice opened -> click Voir la correction -> practice_attempt recorded
  -> due_at J+1 -> learning_summary.scheduled_count=1 -> forbidden V1 labels
  absent`.
- Evidence from latest run:
  `game_id=1`, `review_job_status=completed`, `review_status=done`,
  `review_moment_count=1`, `session_id=1`, `attempt_id=1`,
  `attempt_result=revealed`, `due_at=2026-05-05T12:08:29+00:00`,
  `learning_summary.practice_event_count=1`,
  `learning_summary.scheduled_count=1`.
- Remaining browser gaps at that point: correct drag/drop move attempt,
  hint/skip/retry, invalid PGN, backend unavailable, slow/stalled analysis, and
  mobile/responsive. Later P0/P1 missions added dedicated board, degraded-state,
  mobile, and keyboard/focus browser proofs; drag/drop-specific and full WCAG
  certification remain outside this report's proven V1 surface.

## P1.PROFILE-PRIVACY-V1 Update

Date: 2026-05-04.

New evidence added after the browser V1 flow:

- Backend: `GET /api/export` and `DELETE /api/user-data?confirm=SUPPRIMER`.
- Frontend: top-right `Profil / Paramètres` panel, outside the main Plan2 nav.
- Tests added: `backend/tests/test_profile_privacy.py`,
  `backend/tests/test_frontend_profile_privacy_static.py`,
  `scripts/browser_profile_privacy_smoke.mjs`.
- Browser strategy: isolated temp backend DB, seeded PGN via API, Vite, Edge CDP.
- Result: PASS.
- Proven browser flow: `/app` loads, Plan2 nav still has exactly
  `Aujourd'hui / Mes parties / Entrainement`, Profile/Privacy panel opens,
  export button returns JSON with `pgn_raw`, first delete click preserves data,
  typed confirmation `SUPPRIMER` is required, confirmed delete clears local
  games/history/export in the temp DB, forbidden V1 labels remain absent.
- Evidence from latest run:
  `game_id=1`, `export_games_count=1`, `export_has_pgn_raw=true`,
  `history_count_before_confirm=1`, `history_count_after_delete=0`,
  `export_games_after_delete=0`.

## P1.TRAINING-ITEMS-DAILY-PLAN-V1 Update

Date: 2026-05-04.

New evidence added after Profile/Privacy:

- Backend: durable `training_items`, deterministic `daily_plan_items`, and
  endpoints `GET /api/training/daily-plan/today`,
  `POST /api/training/daily-plan`,
  `POST /api/training/daily-plan/practice`.
- Services: `TrainingItemService` materializes at most five active items from
  `review_moments`; `DailyPlanService` selects due, failed recent, recent
  critical, then diversity-fill candidates with stable deterministic sorting.
- Tests added: `backend/tests/test_training_items_daily_plan.py` and
  `scripts/browser_daily_plan_smoke.mjs`.
- Browser strategy: isolated temp backend DB, fake engine, API PGN seed, Vite,
  Edge CDP.
- Result: PASS.
- Proven browser flow: PGN seed -> Review done -> `training_items_available=1`
  -> Daily Plan partial with real item id -> Training Plan du jour CTA ->
  Practice opens -> `Voir la correction` records attempt
  `item_id=training_item:1` -> `due_at` J+1 -> forbidden V1 labels absent.
- Remaining gaps: full 5-6 item plan variety depends on richer user history;
  browser proof uses a compact fixture that produces a valid partial one-item
  plan.

## P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1 Update

Date: 2026-05-04.

New evidence added after Daily Plan:

- Frontend board contract: `ChessBoardPanel` now supports drag/drop plus
  click-source/click-target attempts, stable board selectors, orientation
  props, selected-square highlighting, and safe illegal-click handling.
- Backend QA hook: fake engine has test-only timeout environment hooks to
  reproduce a recoverable analysis failure without touching Stockfish or
  formulas.
- Tests added: `backend/tests/test_core_board_practice_contract.py`,
  `backend/tests/test_frontend_core_board_interaction_static.py`,
  `scripts/browser_core_board_interaction_smoke.mjs`, and
  `scripts/browser_analysis_stall_recovery_smoke.mjs`.
- Browser strategy: isolated temp backend DB, fake engine, Vite, Edge CDP,
  controlled QA seed for a ready Review/training item, no real user DB writes.
- Result: PASS for the core board interaction smoke.
- Proven browser flow:
  `/app -> Plan2 nav -> Review board visible -> Review moment stable ->
  Practice from Review -> correct click-click board move saved -> wrong legal
  click-click board move saved -> illegal move recorded safely -> reveal saved
  -> Daily Plan Practice -> real board move saved -> reload safe -> export
  contains attempts -> forbidden V1 labels absent`.
- Latest evidence:
  `game_id=1`, `review_status=done`, `review_moment_count=1`,
  `review_session_id=5`, `daily_plan_session_id=6`,
  `item_id=training_item:2`, `accepted_move=f3g5`,
  `correct_attempt_id=1`, `correct_attempt_result=best`,
  `wrong_attempt_id=2`, `wrong_attempt_result=wrong`,
  `illegal_attempt_id=3`, `illegal_attempt_result=illegal`,
  `reveal_attempt_id=4`, `reveal_used=true`,
  `daily_plan_attempt_id=5`, `daily_plan_attempt_result=best`,
  `due_at=2026-05-11T15:22:43+00:00`,
  `learning_summary.practice_event_count=5`.
- Analysis stall recovery smoke result: PASS for controlled fake-engine
  timeout. It proves a single retry message and successful resume to Review
  done; it does not prove every possible real Stockfish stall mode.
- Remaining gaps: drag/drop-specific browser path is still not separately
  exercised because click-click is the V1 reliable input method; invalid PGN,
  backend-offline, physical-device mobile QA, full accessibility certification,
  and hint/skip browser proofs remain.

## P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1 Update

Date: 2026-05-04.

New evidence added after the user reported that previous PASS smokes did not
match the real local app:

- Runtime reproduction: `/app -> Voir la Review` showed a Review board but no
  `Explorer la position` action. The board was disabled outside Practice/Try
  Move, so the user could not explore legal moves from a Review position.
- Frontend repair: Review board now has `Exploration locale`, local legal moves
  via `chess.js`, undo, reset, exit, illegal-move feedback, and a clear copy
  saying these moves are not saved as exercises.
- Separation guarantee: exploration does not call the Practice attempt endpoint,
  does not create `due_at`, and does not update `learning_summary`.
- Analysis repair: stale `running/finalizing` Review jobs are materialized as
  retryable `stalled` jobs when the watchdog detects timeout, so polling does
  not keep presenting stale work as active forever.
- Tests added: `scripts/browser_review_exploration_real_smoke.mjs`,
  `scripts/browser_real_analysis_no_infinite_loop_smoke.mjs`, and static/backend
  assertions in `backend/tests/test_frontend_core_board_interaction_static.py`
  and `backend/tests/test_review_jobs.py`.
- Browser exploration result: PASS. Evidence:
  `game_id=1`, `review_status=done`, `review_moment_count=1`,
  `original_fen=r1bq1rk1/pp2bppp/4pn2/2pp4/3P4/3BPN2/PPP2PPP/RNBQR1K1 w - - 0 7`,
  `explored_move=d4c5`, board changed, undo OK, reset OK,
  `illegal_exploration_move=a1a3`, attempts stayed `0 -> 0`, then Practice
  saved `practice_attempt_id=1`, `practice_attempt_result=best`,
  `practice_due_at=2026-05-11T17:35:54+00:00`.
- Browser no-infinite-loop result: PASS. Evidence:
  `review_job_id=7e72dcc5ea4149eb8d39c90185b375e1`, statuses
  `queued -> running -> completed`, progress `0/13 -> 12/13 -> 13/13`, hard
  deadline 90s, no network 500.
- Remaining gaps: drag/drop-specific exploration is not separately proven;
  broader degraded states, physical-device mobile QA, full accessibility
  certification, invalid PGN browser errors, and real user DB long-running
  Stockfish edge cases still need release hardening.

## P1.MOBILE-RESPONSIVE-AND-A11Y-V1 Update

Date: 2026-05-05.

New evidence added for mobile and keyboard readiness:

- Mobile responsive smoke result: PASS at 390x844 with device scale factor 2.
  It proves the V1 main nav remains exactly 3 entries, no horizontal overflow on
  critical screens, Review board visibility, Review local exploration by real
  tap/click, reset, Review Practice real move feedback, Daily Plan Practice real
  move feedback, Training exactly 3 entries, and Profile/Privacy export/delete
  visibility.
- Keyboard/accessibility smoke result: PASS. It proves visible focus for the
  main nav, Import PGN action, PGN textarea, Practice board, Practice actions,
  and Profile/Settings, plus presence of reduced-motion CSS.
- Static coverage added:
  `backend/tests/test_frontend_mobile_accessibility_static.py` checks mobile CSS
  markers, focus/reduced-motion markers, board accessibility, the two browser
  smoke scripts, V1 nav/training contracts, and absence of forbidden V1 labels in
  the touched mobile/accessibility surface.
- Scope limitation: this is a V1 minimum accessibility proof, not a full WCAG
  certification, screen-reader audit, or physical-device QA campaign.

## Matrix

| Domaine | Fonctionnalite | Attendu Plan1/Plan2/Plan3 | Etat reel observe dans le code | Fichiers concernes | Endpoint/API concerne si applicable | Test automatique existant | Test ajoute pendant cette mission | Smoke test effectue | Browser test effectue | Niveau de preuve | Resultat | Risque | Action recommandee | Priorite |
|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|
| Gouvernance | Plans maitres | Plan1/Plan2/Plan3 > governance docs > code | Plan3 est reference dans AGENTS et docs; plans presents | `plan/Plan1.txt`, `plan/Plan2.txt`, `plan/Plan3.md`, `AGENTS.md` | n/a | static/doc checks via plan guard boundaries | no | plan_guard PASS | no | C | PASS | Drift si missions futures ignorent Plan3 | Relire docs courts avant chaque mission | P0 |
| Gouvernance | PLAN_CONTEXT_MIN | Memoire courte utilisable sans relire tous les plans | Contient doctrine Plan3, loop, V1/V2 boundaries | `docs/PLAN_CONTEXT_MIN.md` | n/a | none dedicated | no | no | no | C | PASS | Peut diverger si non tenu a jour | Update apres missions produit | P0 |
| Gouvernance | PLAN_FEATURE_BOUNDARIES | Separations V1/V2/research explicites | Table couvre features critiques, Plan3 inclus | `docs/PLAN_FEATURE_BOUNDARIES.md` | n/a | plan_guard references boundaries indirectly | no | plan_guard PASS | no | C | PASS | Coverage manuelle seulement | Garder synchronise avec UI/registry | P0 |
| Gouvernance | NEXT_PLAN_ACTIONS | File de missions courtes et priorisees | Contient missions P0/P1 recentes; audit ajoute ci-dessous | `docs/NEXT_PLAN_ACTIONS.md` | n/a | none | no | no | no | C | PARTIAL | Devient vite long et manuel | Garder une seule prochaine mission prioritaire | P0 |
| Gouvernance | PLAN_ALIGNMENT_AUDIT | Etat code vs plans | Audit existant a jour jusqu'a Plan3/Learning Loop | `docs/PLAN_ALIGNMENT_AUDIT.md` | n/a | none | no | no | no | C | PASS | Ne remplace pas l'audit de capacites | Revoir apres chaque mission produit | P0 |
| Gouvernance | plan_guard | Bloquer UI V1 interdite | Script passe | `tools/plan_guard.py` | n/a | `python tools/plan_guard.py` | no | PASS | no | C | PASS | Ne prouve pas les flows | Garder dans validations | P0 |
| Gouvernance | No V2/V3 visible | Aucun NeuroMonitor/Candidate/LLM/TransferGap normal | Search frontend Serena/Select-String: pas de labels interdits visibles | `frontend/src` | n/a | static tests + plan_guard | no | plan_guard PASS | forbidden labels absent in browser snapshots | A | PASS | Faux negatifs si nouveau label non liste | Etendre plan_guard si nouveaux interdits | P0 |
| Gouvernance | Worktree hygiene | QA doit distinguer pre-existing vs new | Worktree sale avant mission; audit ne stage/commit rien | repo root | n/a | `git status --short --branch` | no | no | no | C | PARTIAL | Difficile d'attribuer certains diffs | Commit de consolidation humain apres revue | P0 |
| App Shell | Navigation Plan2 | Aujourd'hui / Mes parties / Entrainement | Present dans `App.tsx` et browser | `frontend/src/App.tsx` | n/a | `test_frontend_app_shell_static.py` | no | no | PASS | A | PASS | `App.tsx` reste tres large | Refactor seulement mission dediee | P1 |
| App Shell | Profile/settings hors nav | Hors nav principale | Top-right Profile/Settings panel, not a fourth nav tab | `frontend/src/App.tsx`, `frontend/src/styles.css` | `/api/export`, `/api/user-data` | `test_frontend_profile_privacy_static.py`, `test_profile_privacy.py` | yes | profile/privacy smoke PASS | PASS | A | PASS | Panel remains minimal; settings are mostly honest placeholders | Keep Profile out of main nav | P1 |
| App Shell | Review non onglet permanent | Review ouverte depuis flows | Main nav ne contient pas Review; context header existe | `frontend/src/App.tsx`, `ReviewPanel.tsx` | review APIs | static app shell test | no | no | contextual opening partial | A | PASS | Context opening peut arriver sur Review non prete | Browser smoke complet Review needed | P0 |
| App Shell | Review contextuelle | Accessible depuis games/today/training | Handler `openReviewContext` et buttons existent | `frontend/src/App.tsx` | `/games/{game_id}/review` | static + backend review tests | no | review smoke PASS | opened in browser, but only preparation state validated | A | PARTIAL | Ready Review UI not proven in browser | Build deterministic browser fixture | P0 |
| App Shell | Responsive minimal | Plan2 mobile/desktop stable | Not exercised in this audit | CSS/app shell | n/a | none dedicated | no | no | no | D | NOT_TESTED | Layout regressions possible | Browser smoke desktop + mobile | P1 |
| Aujourd'hui | Hero unique | One main intent / one CTA | Code derives `todayHero`; browser saw Today and one import CTA in empty state | `frontend/src/App.tsx` | n/a | static tests partial | no | no | PASS basic | A | PARTIAL | Priorities not all browser-tested | Browser fixture matrix | P1 |
| Aujourd'hui | Priority signals | Practice/Daily Plan/Review/analyse/revision/import | Uses real state variables and backend Daily Plan when available | `frontend/src/App.tsx`, `daily_plan_service.py` | practice/review/Daily Plan APIs | static + Daily Plan tests | yes | browser_daily_plan_smoke PASS | Daily Plan path PASS | A | PARTIAL | Other priority branches still need browser matrix | Browser fixture matrix | P1 |
| Aujourd'hui | Derniere Review card | Show last review if data exists | Code/docs indicate card; not browser-validated with ready fixture | `frontend/src/App.tsx` | `/games/{game_id}/review` | static only | no | no | no | C | PARTIAL | Could show stale/ambiguous Review | Browser fixture with ready review | P1 |
| Aujourd'hui | Progression cette semaine | Real practice counters only | Wired to learning summary counts | `frontend/src/App.tsx`, `review_practice_service.py` | practice session list | learning loop tests | no | no | no | B | PARTIAL | Not validated with browser due data | Add browser fixture with attempts | P1 |
| Aujourd'hui | A revoir | Due count from simple revision | Backend counts due/scheduled; Daily Plan also prioritizes globally due `training_items` | same | revisions route, `/api/training/daily-plan` | learning loop + Daily Plan tests | yes | browser_daily_plan_smoke PASS | partial | B | PARTIAL | Due card itself not browser-proven with multiple items | Browser due-ready fixture | P1 |
| Aujourd'hui | No fake numbers | No invented progress | Static copy says profile/building when missing | `frontend/src/App.tsx` | n/a | static test | no | no | visible empty state honest | A | PASS | Future copy may drift | Keep static guard | P1 |
| Aujourd'hui | No dashboard technique | Plan2 calm/actionable | No raw metric dashboard seen | `frontend/src/App.tsx` | n/a | plan_guard | no | plan_guard PASS | PASS basic | A | PASS | Hidden explorer still dense | Keep complexity folded | P1 |
| Mes parties | Import PGN backend | V1 PGN import | Service/routes exist and pass tests/smoke | `pgn_import_service.py`, `game_routes.py` | `/games/import-pgn`, `/preview` | `test_pgn_import_service.py` | no | PGN smoke PASS, real flow PASS | PASS import UI | A | PASS | UI can pollute local data in manual smoke | Add isolated browser DB fixture | P0 |
| Mes parties | Coller PGN UI | User can paste PGN | Browser filled `Coller PGN` and imported local QA PGN | `frontend/src/App.tsx` | `/games/import-pgn` | static + backend import tests | no | PGN smoke PASS | PASS | A | PASS | Browser smoke uses live local DB | Use temp backend DB for browser smoke | P0 |
| Mes parties | Historique | Show games and statuses | Browser saw history with many rows/buttons | `frontend/src/App.tsx`, `game_routes.py` | `/games/history` | pgn real flow tests | no | real flow PASS | PASS visible | A | PASS | History dense, many repeated CTAs | UX cleanup later, not QA mission | P1 |
| Mes parties | Ouvrir une partie | Open selected game | Code and buttons exist; smoke says open flow OK | `frontend/src/App.tsx` | `/games/{game_id}` | pgn real file tests | no | real flow PASS | not clicked separately | B | PARTIAL | Browser open not isolated | Add browser fixture | P0 |
| Mes parties | Lancer analyse | Analyze game if no review | Routes/buttons exist; not run in browser to avoid slow engine | `game_routes.py`, `analysis_service.py`, `App.tsx` | `/games/{game_id}/review/jobs`, `/review/generate` | review/job tests | no | review smoke PASS | not executed | B | PARTIAL | Real Stockfish latency/flakiness | Stubbed browser/API test | P0 |
| Mes parties | Analyse en cours | Clear pending state | Review job state exists | `review_job_service.py`, `reviewState.ts`, `App.tsx` | review job endpoints | review job tests | no | review smoke PASS | not browser-tested | B | PARTIAL | User may see ambiguous state | Browser job-state fixture | P1 |
| Mes parties | Review prete | Open ready Review | Browser saw "Analyse - Review disponible" labels and buttons | `frontend/src/App.tsx` | `/games/{game_id}/review` | backend review tests | no | review smoke PASS | opened context but not final summary | A | PARTIAL | First visible Review button opened preparation state | P0 browser smoke with known fixture | P0 |
| Mes parties | Etat vide | Honest empty state | Present in code/contracts; not browser-tested with empty DB | `frontend/src/App.tsx` | `/games/history` | static partial | no | no | no | C | NOT_TESTED | Current local DB not empty | Browser temp DB fixture | P1 |
| Mes parties | PGN invalide | Error handling | Backend parser tests include invalid/bad PGN | `pgn_import_service.py`, tests | `/games/import-pgn` | `test_pgn_import_service.py` | no | no | not browser-tested | B | PASS | UI error copy not browser-proven | Browser invalid PGN smoke | P1 |
| Mes parties | Dedup/import repair | Avoid duplicates where supported | PGN smoke and tests cover import repair/dedup paths | `pgn_import_service.py` | import APIs | `test_pgn_import_service.py` | no | PGN smoke PASS | not directly | B | PASS | UI may not explain repaired existing | Browser import duplicate fixture | P1 |
| Review | Summary hierarchy | NeuroScore, one interpretation, max 3 moments | Components aligned; browser final summary not proven | `ReviewCockpitSummary.tsx`, `ReviewPanel.tsx` | `/games/{game_id}/review` | frontend static + review tests | no | review smoke PASS | only preparation context | B | PARTIAL | UX can regress without browser fixture | Add ready-review browser smoke | P0 |
| Review | NeuroScore visible | Coach NeuroScore main score | Review component has NeuroScore; backend metrics tests pass | `ReviewCockpitSummary.tsx`, `review_metrics.py` | review response | metric/review tests | no | review smoke PASS | not final-summary validated | B | PASS | Browser not yet proves final rendering | Browser fixture | P0 |
| Review | Precision reference folded | Secondary/repliee | Component and docs align | `ReviewCockpitSummary.tsx` | review response | static lesson tests | no | no | not browser-final | C | PASS | Static only | Browser summary fixture | P1 |
| Review | Max 3 moments | Summary must cap visible cards | Component maps `visibleMoments` | `ReviewCockpitSummary.tsx` | review response | static tests | no | no | not browser-final | C | PASS | Static only | Keep static test | P1 |
| Review | Lecture rapide | V1 quick reading | Review tabs/components exist | `ReviewFocusTabs.tsx`, `ReviewLessonPanel.tsx` | review response | static lesson tests | no | no | not browser | C | PARTIAL | Flow not browser-validated | Browser lesson smoke | P1 |
| Review | Lecon complete | Active lesson path | Lesson components/tests exist | review components | review response | lesson/static/backend tests | no | no | not browser | C | PARTIAL | Board/lesson edge cases | Browser lesson smoke | P1 |
| Review | Explorer details folded | Technical details not default | Explorer/technical details component exists | `ReviewTechnicalDetails.tsx`, `ReviewPanel.tsx` | review response | static/plan_guard | no | no | not browser | C | PASS | Could be visible via copy drift | Static + browser fixture | P1 |
| Review | Training CTA | `S'entrainer sur cette Review` | Component/action registry present and browser smoke opens Practice from ready Review | `ReviewCockpitSummary.tsx`, `ACTION_REGISTRY.md`, `scripts/browser_core_board_interaction_smoke.mjs` | practice APIs | static tests | yes | core board smoke PASS | PASS | A | PASS | Lesson/Explorer CTAs not fully browser-proven | Broader Review browser fixture later | P1 |
| Review | Internal metrics hidden | No raw criticality/diagnostic normal UI | plan_guard/static tests pass; Search shows internals in types/debug only | `frontend/src`, `tools/plan_guard.py` | n/a | plan_guard/static tests | no | plan_guard PASS | forbidden snapshots clear | A | PASS | Guard can miss synonyms | Keep expanding guard | P0 |
| Review | Local exploration | User can explore legal moves from Review without AI/opponent and without saving attempts | Implemented in `App.tsx` with `Exploration locale`, undo/reset/exit, illegal feedback, and local `chess.js` state | `frontend/src/App.tsx`, `ChessBoardPanel.tsx`, `styles.css`, `docs/CORE_INTERACTION_CONTRACT.md` | none; explicitly local-only | static test | yes | no | `browser_review_exploration_real_smoke.mjs` PASS | A | PASS | Drag/drop exploration not separately proven; promotion picker is queen-default V1 | Keep click-click as V1 contract; add drag/promotion only if user testing requires | P1 |
| Practice | Start from Review | Review-derived session | Backend service/route/frontend client exist and browser smoke starts Review Practice | `review_practice_service.py`, `ReviewPracticePanel.tsx`, `scripts/browser_core_board_interaction_smoke.mjs` | `/review/practice/sessions` | practice session tests | yes | core board smoke PASS | PASS | A | PASS | Drag/drop-specific path still not separately exercised | Keep click-click as V1 reliable input; add drag smoke later if needed | P1 |
| Practice | Focus mode | Practice should reduce distractions | Component exists; global nav may still be visible | `ReviewPracticePanel.tsx`, `App.tsx` | practice APIs | static partial | no | no | not browser | C | PARTIAL | Plan3 focus mode not fully proven | Practice browser smoke | P1 |
| Practice | Correct attempt | Attempts graded/stored | Backend tests and browser click-click board attempt save `result=best` | `review_practice_service.py`, `ChessBoardPanel.tsx`, `scripts/browser_core_board_interaction_smoke.mjs` | `/attempts` | practice tests | yes | core board smoke PASS | PASS | A | PASS | Drag/drop not separately proven | Add optional drag/drop proof later if UX requires it | P1 |
| Practice | Incorrect attempt | Wrong/illegal recorded | Browser click-click saves wrong legal and illegal attempts without crash | same | `/attempts` | learning loop tests | yes | core board smoke PASS | PASS | A | PASS | Illegal UX copy can still be improved | Degraded states/copy mission | P1 |
| Practice | Hint | Hint flag stored | Frontend client sends `hint_used`, backend stores | `client.ts`, `review_practice_service.py` | `/attempts` | learning loop tests | no | no | not browser | B | PASS | Hint UX not browser-proven | Browser practice smoke | P1 |
| Practice | Reveal/correction | Reveal flag/result due tomorrow | Browser smoke records reveal after attempts with `reveal_used=true` | same | `/attempts` | reveal/skip + learning loop tests | yes | core board smoke PASS | PASS | A | PASS | Correction teaching copy still not deeply assessed | Lesson/feedback browser fixture later | P1 |
| Practice | Skip | Skipped no due V1 | Delay rule test covers no due | `review_practice_service.py` | attempt/skip path | learning loop tests | no | no | not browser | B | PASS | Browser skip not tested | Browser practice smoke | P1 |
| Practice | Session summary | Session result counts | Service and component exist | `review_practice_service.py`, `ReviewPracticePanel.tsx` | session detail/complete | summary tests | no | no | not browser | B | PASS | UX not browser-proven | Browser practice smoke | P1 |
| Practice | Retry failed | Failed retry route/session | Backend route/service exists and tests cover retry | `review_practice_service.py`, `game_routes.py` | `/retry-failed` | practice session tests | no | no | not browser | B | PASS | UX not browser-proven | Browser practice smoke | P1 |
| Practice | Due review session | Start revisions from due positions | `create_due_review_session` and API route exist | `review_practice_service.py`, `game_routes.py` | `/games/{id}/review/practice/revisions` | learning loop tests | no | no | not browser | B | PASS | Game-scoped only | Global due queue later | P1 |
| Entrainement | Exactly 3 entries | Plan du jour, Mes positions ratees, Revisions only | Browser Training tab shows exactly those 3 labels | `frontend/src/App.tsx` | practice APIs | static app shell/learning tests | no | no | PASS | A | PASS | Future mode creep | Static guard stays | P0 |
| Entrainement | Plan du jour | Deterministic daily action | Backend Daily Plan service exists; Training uses real plan count/CTA and opens Daily Plan Practice | `frontend/src/App.tsx`, `daily_plan_service.py`, `game_routes.py` | `/api/training/daily-plan*` | `test_training_items_daily_plan.py`, static tests | yes | browser_daily_plan_smoke PASS | PASS | A | PASS | Rich 5-6 item plans need more user history | Degraded/mobile browser fixtures later | P1 |
| Entrainement | Mes positions ratees | Use Practice history | Frontend uses failed session/history signals | `App.tsx`, practice service | session list | learning/practice tests | no | no | label only | B | PARTIAL | Not browser-proven with failures | Browser fixture | P1 |
| Entrainement | Revisions | Use due items | Backend due count/session exists; Daily Plan also prioritizes due items globally by latest attempt | `App.tsx`, `review_practice_service.py`, `daily_plan_service.py` | revisions route, `/api/training/daily-plan` | learning loop + Daily Plan tests | yes | browser_daily_plan_smoke PASS | partial plan PASS | B | PARTIAL | Dedicated due-revision browser path still not proven | Browser due-empty/due-ready fixture | P1 |
| Entrainement | Forbidden modes absent | No Candidate/Intent/LLM/TransferGap/fourth card | Static tests and browser pass | `App.tsx` | n/a | static tests + plan_guard | no | plan_guard PASS | PASS | A | PASS | Guard terms only | Keep tests updated | P0 |
| Learning Loop | practice_result_event fields | item/session/result/move/time/hint/reveal/source/timestamp/due | Implemented in attempts schema/service/client and browser core smoke verifies saved attempts/export | `review_practice_service.py`, `schemas.py`, `client.ts`, `scripts/browser_core_board_interaction_smoke.mjs` | `/attempts` | learning loop tests | yes | core board smoke PASS | PASS | A | PASS | Event model not promoted to dedicated table name | Align docs/schema naming later | P1 |
| Learning Loop | simple_spaced_repetition_v1 rules | wrong/illegal/reveal 1d, hint 3d, success 7d, skip none | `practice_revision_delay_days` tests pass | `review_practice_service.py` | service | `test_review_practice_learning_loop.py` | no | no | no | B | PASS | Repeated success multiplier not implemented | Backlog as Plan3 gap | P1 |
| Learning Loop | learning_summary | Real counters, not fake progress | Service returns due/scheduled/week counters | `review_practice_service.py` | session list | learning loop tests | no | no | no | B | PASS | Per-game summary, not global Today API | Daily Plan/training API later | P1 |
| Learning Loop | Compact progression UI | Real counts only | App consumes learning summary | `frontend/src/App.tsx` | session list | static tests | no | no | not data-browser | C | PARTIAL | Browser data fixture missing | Browser fixture | P1 |
| Learning Loop | training_items | Plan3 V1 durable items from moments | Implemented as durable `training_items`, generated from `review_moments`, max 5 per Review, idempotent by game/ply | `training_item_service.py`, `migrations.py`, `game_routes.py` | Review get/generate/rebuild materialization | `test_training_items_daily_plan.py` | yes | browser_daily_plan_smoke PASS | PASS | A | PASS | Full corpus variety not yet browser-proven | Keep idempotency tests and expand fixtures later | P1 |
| Learning Loop | Daily Plan backend | Deterministic plan API/service | Implemented as `DailyPlanService` + `/api/training/daily-plan*`; uses due, failed_recent, recent_critical, diversity_fill | `daily_plan_service.py`, `game_routes.py`, `client.ts`, `App.tsx` | `/api/training/daily-plan/today`, `/api/training/daily-plan`, `/api/training/daily-plan/practice` | `test_training_items_daily_plan.py` | yes | browser_daily_plan_smoke PASS | PASS | A | PASS | Browser fixture validates partial one-item plan, not rich plan variety | Add richer browser fixture after more data | P1 |
| Learning Loop | SkillTrace shadow | V1 shadow only, not visible | Not implemented in backend; hidden in UI | docs/backend search | n/a | none | no | no | no | E | MISSING | Plan3 says V1 shadow should exist before release | Add shadow-only sprint after Daily Plan | P1 |
| Backend/API | FastAPI app health | Backend launchable | `backend.app:app` launched, `/health` OK | `backend/app.py` | `/health` | API tests | no | browser support server | n/a | A | PASS | Needs standard dev command docs | Add setup docs later | P1 |
| Backend/API | Games routes | Create/list/get/moves/history | Routes exposed and tested | `game_routes.py` | `/games*` | game API tests | no | real flow PASS | browser history PASS | A | PASS | Per-game delete is not productized; whole local-data delete exists | Keep destructive actions confirmed | P1 |
| Backend/API | Review routes/jobs | Generate/jobs/reconcile/cancel/get | Routes exist and tests pass; stale running/finalizing jobs materialize as retryable `stalled` when watchdog detects timeout | `game_routes.py`, `review_job_service.py` | `/review/jobs`, `/games/{id}/review` | review tests | yes | review smoke PASS | `browser_real_analysis_no_infinite_loop_smoke.mjs` PASS | A | PASS | Real Stockfish OS-level hang on a user's live DB still needs human spot check | Keep no-infinite smoke and add broader degraded states | P0 |
| Backend/API | Practice routes | sessions/attempts/retry/due/plan | Routes exist and tests pass; Daily Plan Practice returns normal practice session with `scope=daily_plan` | `game_routes.py`, `review_practice_service.py` | `/review/practice/*`, `/api/training/daily-plan/practice` | practice tests + Daily Plan tests | yes | browser_daily_plan_smoke PASS | PASS | A | PASS | Correct drag/drop move still not browser-proven | Browser practice move fixture | P1 |
| Backend/API | Schemas/contracts | Pydantic shapes plus V1 API contract doc | Attempt schema includes V1 fields; DailyPlanRequest and export/delete contracts documented | `schemas.py`, `docs/API_CONTRACTS.md` | API models | backend tests | yes | browser_daily_plan_smoke PASS | PASS | B | PASS | Contract doc remains manual | Keep API contract updated with new endpoints | P1 |
| Backend/API | Migrations/schema doc | Durable schema evolution | Learning loop plus `0019_v5_6_training_items_daily_plan` migrations documented | `migrations.py`, `test_database.py`, `docs/DB_SCHEMA.md` | n/a | database/Daily Plan tests | yes | no | no | B | PASS | DB_SCHEMA doc remains manual | Update after schema migrations | P1 |
| Backend/API | Old data compatibility | Do not break old sessions | Tests cover migration/compat paths | migrations/repos/tests | n/a | database/practice tests | no | no | no | B | PASS | Not every legacy DB path proven | Add migration fixture pack | P1 |
| Backend/API | Error handling | Clear API errors | Many errors mapped; degraded state incomplete | routes/services/frontend state | API | backend tests partial | no | no | partial browser | B | PARTIAL | UX may show generic errors | Degraded states sprint | P1 |
| Stockfish/Metrics | Stockfish unchanged | No engine/formula changes in QA mission | `stockfish_service.py` not modified in diff | engine files | n/a | engine tests | no | review smoke PASS | no | B | PASS | Strict cache still partial | Cache policy sprint | P1 |
| Stockfish/Metrics | eval_cp POV White | Canonical convention | Tests and docs align | `evaluation_display.py`, `review_service.py` | n/a | evaluation/review tests | no | no | no | B | PASS | Formula drift if changed later | Golden tests remain | P0 |
| Stockfish/Metrics | Win% | Lichess-like chance language | Implemented/tested | metrics/core docs/code | review payload | metric tests | no | no | no | B | PASS | Engine-depth sensitivity | Keep as support signal | P1 |
| Stockfish/Metrics | player_win_percent | Player POV chance | Present in payload/client | `review_service.py`, `client.ts` | review response | review tests | no | no | no | B | PASS | UI copy may overstate | Keep qualitative copy | P1 |
| Stockfish/Metrics | win_loss/move/game accuracy | Core Plan1 metrics | Tests cover formulas | `review_metrics.py` | review response | metric/calibration tests | no | no | no | B | PASS | Calibration still heuristic | Keep docs explicit | P0 |
| Stockfish/Metrics | Coach NeuroScore | Visible coach score | Backend/docs/components align | `review_metrics.py`, `ReviewCockpitSummary.tsx` | review response | review/metric tests | no | review smoke PASS | not final-summary browser | B | PASS | Browser fixture missing | Add browser ready Review | P0 |
| Stockfish/Metrics | Cache/versioning strict | Plan3 strict cache | Existing analysis schema has versioning; Plan3 strict policy not fully proven | `analysis_service.py`, migrations | analysis APIs | analysis tests | no | review smoke PASS | no | B | PARTIAL | Cache compatibility ambiguity | P1.CACHE-POLICY-STRICT | P1 |
| Stockfish/Metrics | Stockfish WDL public absent | WDL not public metric | No forbidden WDL in UI; WDL remains docs/future | frontend/docs | n/a | plan_guard/search | no | plan_guard PASS | PASS forbidden scan | A | PASS | Search-term based | Add UI snapshot guard | P1 |
| Registries/docs | ACTION_REGISTRY | Buttons/actions registered | Core new actions present | `docs/ACTION_REGISTRY.md` | n/a | none | no | no | no | C | PARTIAL | Not automatically checked against UI | Build action registry checker later | P2 |
| Registries/docs | SCREEN_CONTRACTS | Screens documented | App shell/training contracts updated | `docs/SCREEN_CONTRACTS.md` | n/a | static tests partial | no | no | no | C | PARTIAL | Contract vs JSX not automated | Contract/static checker | P2 |
| Registries/docs | METRIC/FORMULAS | Metrics documented and separated | Registry/formulas align with current metric families | docs/metrics | n/a | calibration tests | no | no | no | B | PASS | Some future metrics planned | Keep no formula changes | P0 |
| Registries/docs | PROJECT_STATE | Current state clear | Updated through Plan3/Learning Loop; QA appended | `docs/PROJECT_STATE.md` | n/a | none | no | no | no | C | PARTIAL | Manual chronology can bloat | Keep high-signal summaries | P1 |
| Interdits V1 | NeuroMonitor/brain/cortex/atlas | Forbidden normal UI | Removed from frontend src; plan_guard passes | deleted files, `frontend/src` | n/a | plan_guard/static tests | no | plan_guard PASS | PASS snapshots | A | PASS | Reintroduction risk | Keep plan_guard | P0 |
| Interdits V1 | Candidate/Intent/LLM/TransferGap visible | Forbidden in V1 UI | No normal UI labels in browser snapshots | `frontend/src` | n/a | plan_guard/static tests | no | plan_guard PASS | PASS | A | PASS | `opening intention note` exists but not deep mode | Keep isolated | RESEARCH |
| Interdits V1 | SkillTrace/ETV/FSRS visible | Not visible to user | Static tests prevent labels in App | `frontend/src/App.tsx` | n/a | `test_frontend_learning_loop_static.py` | no | no | PASS snapshots | A | PASS | Future docs labels can leak into UI | Keep guard | P0 |
| Etats degrades | PGN invalide | Calm actionable error | Backend parser error tested; browser invalid not tested | `pgn_import_service.py`, `App.tsx` | import APIs | pgn tests | no | no | no | B | PARTIAL | UI copy unknown | Browser invalid PGN smoke | P1 |
| Etats degrades | Stockfish absent | Clear fallback | Engine unavailable warnings exist | engine/review state | analysis/review APIs | engine/review tests | no | no | no | B | PARTIAL | Browser copy not proven | Degraded states sprint | P1 |
| Etats degrades | Analyse lente/partielle | User sees progress/recovery | Controlled fake-engine timeout shows one retry message and resume to Review done | `review_job_service.py`, `reviewState.ts`, `fake_engine.py`, `scripts/browser_analysis_stall_recovery_smoke.mjs` | job APIs | review job tests + fake engine timeout test | yes | analysis stall smoke PASS | PASS controlled timeout | A | PARTIAL | Real Stockfish 17/18 stall modes still need production observation | Degraded states sprint with real-engine fixture | P1 |
| Etats degrades | Backend indisponible | Frontend should degrade calmly | Not tested in browser | frontend API client/App | all fetches | none dedicated | no | no | no | D | NOT_TESTED | Hard crash/toast unknown | Browser offline-backend smoke | P1 |
| Etats degrades | Session interrompue | Resume or honest fallback | Practice state/resume exists | `App.tsx`, `ReviewPracticePanel.tsx` | practice session | practice tests | no | no | no | B | PARTIAL | Browser state not tested | Practice browser smoke | P1 |
| Etats degrades | Due queue empty | Honest no due state | Service raises `no_due_items` with learning summary | `review_practice_service.py` | revisions route | learning loop tests | no | no | no | B | PASS | UI copy not browser-proven | Browser due-empty fixture | P1 |
| Profil/Privacy | Profil minimal | V1 top-right profile/settings | Minimal top-right panel: local profile, preferences, engine note, privacy controls | `frontend/src/App.tsx`, `frontend/src/styles.css` | n/a | `test_frontend_profile_privacy_static.py` | yes | profile/privacy smoke PASS | PASS | A | PASS | No real user profile table yet | Keep copy honest until `local_profile` exists | P1 |
| Profil/Privacy | Export/delete | Required before external V1 | Export/delete backend service and frontend controls implemented with explicit confirmation | `privacy_service.py`, `game_routes.py`, `client.ts`, `App.tsx` | `GET /api/export`, `DELETE /api/user-data?confirm=SUPPRIMER` | `test_profile_privacy.py` | yes | profile/privacy smoke PASS | PASS | A | PASS | Delete is all local user data; no per-section restore | Keep destructive confirmation and temp-DB browser smoke | P1 |
| Telemetry | Practice events | Local learning events | Attempt rows store rich event fields | `review_practice_service.py` | attempt APIs | learning loop tests | no | no | no | B | PASS | Not generic telemetry table | Future telemetry registry | P2 |
| Telemetry | Import/review/training events | Plan3 telemetry future/local | No broad telemetry_events implementation found | backend/frontend | missing | none | no | no | no | E | MISSING | Product learning blind spots | Add after core V1 | later |
| i18n | French UI | V1 French | UI strings largely French | `frontend/src` | n/a | static tests partial | no | browser snapshots French | PASS basic | A | PASS | Mixed ASCII/no central file | Centralize strings | P1 |
| i18n | Strings centralisees | Plan3 hygiene | No `frontend/src/i18n/fr.ts` or equivalent found | frontend | n/a | none | no | no | no | E | MISSING | Copy drift and harder QA | P1.I18N-STRINGS-FR | P1 |
| Browser/UX | `/app` charge | User can open app | Vite served `/app`, title `NeuroChess 2` | frontend | n/a | build/typecheck | no | no | PASS | A | PASS | Uses local dev server only | Add automated browser smoke | P0 |
| Browser/UX | Nav clicks | Aujourd'hui/Games/Training work | Training clicked and rendered 3 labels; Games clicked | `App.tsx` | n/a | static app shell | no | no | PASS | A | PASS | Today click not separately repeated | Automated browser smoke | P0 |
| Browser/UX | Import PGN UI | Paste/preview/import works | Browser filled and imported QA PGN | `App.tsx`, backend routes | import APIs | pgn tests | no | PGN smoke PASS | PASS | A | PASS | Writes to live local DB | Isolated browser DB fixture | P0 |
| Browser/UX | Ready Review UI | Open a completed Review | Automated browser smoke opens a ready contextual Review and sees Summary/CTA | `App.tsx`, Review components, `scripts/browser_v1_flow_smoke.mjs` | review APIs | review smoke/backend tests | `scripts/browser_v1_flow_smoke.mjs` | review smoke PASS | PASS | A | PASS | Lesson/Explorer paths still need browser proof | Add broader browser fixtures later | P1 |
| Browser/UX | Practice UI | Start and submit Practice in browser | Core browser smoke starts Practice and records correct, wrong, illegal, reveal, and Daily Plan board attempts | Practice components, `scripts/browser_v1_flow_smoke.mjs`, `scripts/browser_core_board_interaction_smoke.mjs` | practice APIs | backend practice tests | core board smoke | browser smokes PASS | PASS click-click + reveal | A | PASS | Drag/drop-specific, hint, skip, retry still not browser-proven | Add optional browser coverage after degraded states | P1 |
| Browser/UX | Profile/privacy UI | Export/delete are visible, confirmed, and local-first | Automated browser smoke opens Profile panel, exports JSON, verifies no first-click delete, confirms deletion, and verifies empty history/export | `scripts/browser_profile_privacy_smoke.mjs`, `App.tsx`, `privacy_service.py` | `/api/export`, `/api/user-data` | profile/privacy backend/static tests | `scripts/browser_profile_privacy_smoke.mjs` | profile/privacy smoke PASS | PASS | A | PASS | One favicon 404 in browser smoke, non-app blocking | Ignore favicon or add asset later | P2 |
| Browser/UX | Daily Plan flow | Start Practice from deterministic Daily Plan | Browser smokes seed a game, materialize `training_items`, create Daily Plan, open Training, start Plan du jour Practice, and save both reveal and real board-move attempts | `scripts/browser_daily_plan_smoke.mjs`, `scripts/browser_core_board_interaction_smoke.mjs`, `App.tsx`, `daily_plan_service.py` | `/api/training/daily-plan*`, `/api/export` | Daily Plan backend/static tests | daily plan + core board smokes | browser smokes PASS | PASS | A | PASS | Fixture proves compact one-item plan, not rich 5-6 item day | Add richer history fixture later | P1 |
| Browser/UX | Board interaction | V1 board must be truly usable | Review and Practice boards render with stable selectors; click-click move input saves real attempts; orientation prop is wired | `ChessBoardPanel.tsx`, `App.tsx`, `scripts/browser_core_board_interaction_smoke.mjs` | practice APIs | `test_core_board_practice_contract.py`, static board test | yes | core board smoke PASS | PASS | A | PASS | Drag/drop-specific smoke remains optional gap | Add drag/drop smoke only if user reports drag-specific bug | P1 |
| Browser/UX | Analysis stall recovery | User should not be trapped by a stalled/failed position | Controlled fake-engine timeout produces retryable state, one recovery copy, and successful resume | `fake_engine.py`, `ReviewPanel.tsx`, `scripts/browser_analysis_stall_recovery_smoke.mjs` | review job APIs | `test_engine_config.py`, static retry-copy test | yes | analysis stall smoke PASS | PASS controlled | A | PARTIAL | Real Stockfish timeout diversity not exhaustively proven | Degraded states/real-engine recovery mission | P1 |
| Browser/UX | Console errors | No major app crash | Browser `tab.dev.logs(error)` returned empty | frontend runtime | n/a | no | no | no | PASS | A | PASS | Browser plugin printed non-app Statsig/network noise | Ignore plugin noise unless app logs appear | P1 |

## Summary Counts

- PASS: 73
- PARTIAL: 27
- FAIL: 0
- NOT_TESTED: 3
- MISSING: 3
- PLACEHOLDER: 0

## P1 Degraded States / Anti-Tilt Update - 2026-05-05

This update supersedes the older degraded-state rows above where they mention
invalid PGN, backend unavailable, empty Daily Plan, and anti-tilt copy as not
browser-tested.

| Area | New evidence | Status | Remaining risk |
|---|---|---|---|
| Import invalid PGN | `StateNotice` + `buildPgnImportNotice` + `backend/tests/test_degraded_states_v1.py` + `scripts/browser_degraded_states_smoke.mjs` | PASS | Duplicate-only import browser path is statically covered but not separately clicked in browser. |
| Import illegal PGN | Parser error remains backend-authored; UI maps illegal SAN to `Un coup n’est pas légal` | PASS | Exact parser detail remains collapsed. |
| Backend unavailable | Offline frontend smoke uses wrong API base and expects `NeuroChess local ne répond pas` | PASS | Full offline mode is intentionally not implemented. |
| Daily Plan empty | Empty temp DB browser smoke verifies `Plan en construction` and import CTA | PASS | Rich partial plan variety remains a later fixture. |
| Practice save/illegal/no-items/completed | Static tests verify `StateNotice` wiring and no forbidden copy | PARTIAL | Runtime save-failure simulation is not browser-proven. |
| Repeated wrong anti-tilt | Calm copy exists and static tests guard against blame/shame copy | PARTIAL | Browser repeated-wrong flow is deferred because core move flows are already covered by P0. |
| Export/delete after degraded states | Browser smoke verifies export on temp DB, wrong confirmation fails, confirmed delete succeeds | PASS | UI Profile smoke remains the richer export/delete browser proof. |

Updated conservative readiness effect: degraded-state coverage improves from
`PARTIAL` to `PARTIAL+`. The later mobile/a11y mission adds V1 mobile and
keyboard/focus browser proof, but External V1 remains NO-GO until i18n
centralization, SkillTrace shadow, full accessibility certification, physical
device QA, and release hardening are handled.
