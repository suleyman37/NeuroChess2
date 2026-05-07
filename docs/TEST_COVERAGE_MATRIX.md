# Test Coverage Matrix

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW` + `P1.PROFILE-PRIVACY-V1` + `P1.TRAINING-ITEMS-DAILY-PLAN-V1` + `P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1` + `P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1` + `P1.DEGRADED-STATES-ANTI-TILT-V1` + `P1.MOBILE-RESPONSIVE-AND-A11Y-V1` + `P0.PRACTICE-FEEDBACK-CORRECTNESS-AND-LEGACY-REVIEW-REBUILD-V1` + `P1.I18N-STRINGS-CATALOG-V1` + `P1.REVIEW-MOMENT-SELECTION-INTELLIGENCE-V1`
Date: 2026-05-05

This matrix lists available automated tests, scripts, and smoke checks. It does
not count static tests as browser or end-to-end proof.

Mission Control reference: Golden Flow and anti-regression expectations are
centralized in `docs/mission_control/GOLDEN_FLOWS.md` and
`docs/mission_control/FAILURE_LEDGER.md`. Evidence-pack rules live in
`docs/mission_control/VISUAL_EVIDENCE_CONTRACT.md`.

## Latest Run Summary

- `tools/plan_guard.py`: PASS.
- Backend full suite: PASS, 495 tests.
- `scripts/review_regression_smoke.py`: PASS.
- `scripts/pgn_import_smoke.py`: PASS.
- `scripts/pgn_sindarov_real_flow_smoke.py`: PASS.
- Frontend build: PASS (`tsc && vite build`).
- `npm run typecheck`: unavailable; fallback `npx tsc --noEmit`: PASS.
- `npm run lint`: unavailable.
- Browser smoke: PASS via `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
  The script uses an isolated temp backend DB, fake engine, Vite, and Edge CDP
  to prove nav/import/ready Review/Practice/reveal attempt/due signal.
- Profile/privacy smoke: PASS via
  `cmd /c node scripts\browser_profile_privacy_smoke.mjs`.
  The script uses an isolated temp backend DB, Vite, and Edge CDP to prove the
  top-right profile panel, export JSON, non-destructive first delete click,
  typed delete confirmation, cleared local data, Plan2 nav integrity, and no
  forbidden V1 labels.
- Daily Plan browser smoke: PASS via
  `cmd /c node scripts\browser_daily_plan_smoke.mjs`.
  The script uses an isolated temp backend DB, fake engine, API PGN seed, Vite,
  and Edge CDP to prove durable `training_items`, deterministic Daily Plan,
  Training Plan du jour CTA, Practice from Daily Plan, recorded reveal attempt,
  `due_at`, export coverage, and no forbidden V1 labels.
- Core board interaction smoke: PASS via
  `cmd /c node scripts\browser_core_board_interaction_smoke.mjs`.
  It proves real browser click-click board attempts for Review Practice
  (`best`, `wrong`, `illegal`), reveal persistence, Daily Plan Practice board
  attempt, export coverage, and `learning_summary.practice_event_count=5`.
- Analysis stall recovery browser smoke: PASS via
  `cmd /c node scripts\browser_analysis_stall_recovery_smoke.mjs`.
  It proves controlled fake-engine timeout/failure, one retry copy, `Reprendre`
  recovery, and Review completion after retry.
- Review exploration real browser smoke: PASS via
  `cmd /c node scripts\browser_review_exploration_real_smoke.mjs`.
  It proves `Exploration locale` with real click-click board movement, undo,
  reset, illegal move feedback, no Practice attempt created during exploration,
  then a separate Review Practice attempt saved with `due_at`.
- Real analysis no-infinite-loop browser smoke: PASS via
  `cmd /c node scripts\browser_real_analysis_no_infinite_loop_smoke.mjs`.
  It restores a normal Review job in browser, enforces a 90s hard deadline, and
  observed `queued -> running -> completed` with progress `0/13 -> 12/13 -> 13/13`.
- Degraded states backend/static test: PASS via
  `.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_degraded_states_v1`.
  It verifies `StateNotice`, import/Daily Plan/Practice degraded-state wiring,
  calm anti-tilt copy, no new forbidden V1 labels, PGN invalid/illegal/duplicate
  backend behavior, and `DEGRADED_STATES_CONTRACT.md` state IDs.
- Degraded states browser smoke: PASS via
  `cmd /c node scripts\browser_degraded_states_smoke.mjs`.
  It proves invalid PGN, illegal PGN, empty Daily Plan, backend unavailable,
  export empty DB, delete confirmation safety, temp DB deletion, forbidden-label
  absence, no page errors, and no network 500.
- Mobile responsive browser smoke: PASS via
  `cmd /c node scripts\browser_mobile_responsive_smoke.mjs`.
  It proves a 390x844 mobile viewport, Plan2 nav integrity, no horizontal
  overflow on Today/Games/Review/Practice/Training/Profile, Review exploration
  tap/click move, Review Practice attempt, Daily Plan Practice attempt, Profile
  export/delete visibility, and forbidden-label absence.
- Keyboard/accessibility browser smoke: PASS via
  `cmd /c node scripts\browser_keyboard_accessibility_smoke.mjs`.
  It proves visible keyboard focus for main nav, Importer, PGN textarea,
  Practice board, Indice, Voir la correction, Passer, Profile/Settings focus,
  reduced-motion CSS presence, and no network 500.
- Practice feedback correctness browser smoke: PASS via
  `cmd /c node scripts\browser_practice_best_move_feedback_success_smoke.mjs`.
  It proves exact-best Practice board move success feedback, no contradictory
  problem/best-was copy, saved `practice_attempt.result=best`, `due_at`
  present, legacy SAN `Bxf7+` API normalization, and no review job/moment or
  training item side effect from feedback classification.
- Review Correction contradiction browser smoke: PASS via
  `cmd /c node scripts\browser_review_correction_no_contradiction_smoke.mjs`.
  It proves a legacy Review/Lesson Correction payload with displayed move
  `Nxe4` equal to best move `Nxe4` renders success/accepted feedback and does
  not render problem, missed-opportunity, or missed-best reproach copy.
- Review success-state UX browser smoke: PASS via
  `cmd /c node scripts\browser_review_success_state_ux_smoke.mjs`.
  It proves exact-best Review try feedback uses `Tentative reussie`,
  `Continuer`, and `Voir pourquoi ca marche`, then shows recovered historical
  gain without negative delta, `Qualite : Moyenne`, duplicate `important`, or
  retry/correction success CTAs.
- Review attempt-specific feedback and line-action browser smoke: added via
  `cmd /c node scripts\browser_review_attempt_specific_feedback_and_line_smoke.mjs`.
  It proves a current wrong Review try-move uses attempt-safe feedback instead
  of stale historical reply text, exact-best retry remains success, and
  `Voir la ligne` opens a visible line panel only when a line exists.
- Review Training continuation and line playback user-contract smoke: added via
  `cmd /c node scripts\browser_review_training_continuation_and_line_playback_user_contract_smoke.mjs`.
  It proves best/accepted Review Training feedback exposes local
  `Position suivante`, clicking it advances the position and resets feedback
  without duplicate attempts, the last item exposes `Terminer la session`, and
  internal line actions visibly open/step/switch a line player with board/FEN
  changes.
- Review user-POV focus layout contract smoke: added via
  `cmd /c node scripts\browser_review_user_pov_focus_layout_contract_smoke.mjs`.
  It proves `Les deux` resolves board orientation per current White/Black
  moment/item, unknown `Moi` is not presented as certain, and Review Training
  keeps board, feedback, primary next CTA, and line player controls visible in
  the same focused desktop flow.
- French V1 strings catalog static suite: PASS via
  `.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_frontend_i18n_strings_static ...`.
  It proves `frontend/src/i18n/fr.ts`, critical V1 strings, Plan2 nav labels,
  Training labels, Practice feedback catalog usage, forbidden-label absence and
  no raw metric labels in normal critical UI paths.
- Review Decision Card / quality ribbon browser smoke: PASS via
  `cmd /c node scripts\browser_review_decision_card_quality_ribbon_smoke.mjs`.
  It proves Summary historical badge/ribbon, Learn Decision Card no-spoiler
  before correction, best row only in correction, Explorer historical badge
  without attempt classification, Practice attempt badge only after a real board
  move, collapsed/open legend, mobile no-overflow, and forbidden-label absence.
- Review moment selection intelligence backend tests: added via
  `.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_review_moment_importance`.
  They cover opening negligible moves, early tactical priority despite opening
  ply, middlegame priority, secondary/small-loss routing, inferred good
  decisions, no-major summaries, and Practice filtering of non-training
  moments.
- Review moment selection intelligence browser smoke: PASS via
  `cmd /c node scripts\browser_review_moment_selection_intelligence_smoke.mjs`.
  It proves API category fields/summary, priority/good-decision category
  presentation, `Pourquoi ce moment ?`, Practice filtering of non-training
  moments, no pre-attempt best/attempt spoiler, Explorer historical category
  separation, mobile no-overflow, and no raw metric labels.

## Matrix

| Test file / script | Type | Domaine couvert | Fonctionnalites couvertes | Ce qu'il ne couvre pas | Dernier resultat | Niveau de confiance | Gaps a combler |
|---|---|---|---|---|---|---|---|
| `tools/plan_guard.py` | static guard | V1 forbidden UI | NeuroMonitor/brain/cortex/atlas, Candidate/Intent/LLM/TransferGap/raw metrics guard | User flows, aliases not listed | PASS | high | Add terms when new forbidden labels appear |
| `backend/tests/test_analysis_reliability.py` | unit | Analysis reliability | Depth/source/reliability helpers | Browser, full Review UI | PASS in full suite | medium | Add cache strict Plan3 tests |
| `backend/tests/test_analysis_service.py` | unit/integration | Analysis service | Engine analysis persistence, cache-like analysis flows, error states | Browser and UI loading | PASS in full suite | high | Strict cache compatibility per Plan3 |
| `backend/tests/test_calibration_logic.py` | unit/static | Metrics/calibration/static guards | Win%, accuracy, review score, criticality, frontend static assertions | Browser; should not host app-shell-only tests | PASS in full suite | high | Keep calibration-only over time |
| `backend/tests/test_capabilities_api.py` | API | Capabilities | `/capabilities` product contracts | Real UI consumption | PASS in full suite | medium | Expand after registry automation |
| `backend/tests/test_contrast_coach_explanation.py` | unit | Review pedagogy | Contrast coach copy/evidence | Browser lesson UX | PASS in full suite | medium | Browser lesson smoke |
| `backend/tests/test_database.py` | integration | DB/migrations | Schema migrations, review/practice tables, learning loop fields | Legacy real DB fixture pack | PASS in full suite | high | Add DB_SCHEMA.md and fixture migrations |
| `backend/tests/test_engine_config.py` | unit | Engine config | Stockfish config helpers | Real engine availability | PASS in full suite | medium | Browser degraded engine state |
| `backend/tests/test_core_board_practice_contract.py` | integration | Core board/Practice contract | Legal FEN/best moves, correct/wrong/illegal attempt persistence, enriched fields, due_at | Browser pointer events | PASS targeted | high | Keep aligned with browser board smoke |
| `backend/tests/test_engine_profiles.py` | unit | Engine profiles | Live/standard/deep profile semantics | Full engine cost budget | PASS in full suite | medium | Plan3 cache/profile compatibility |
| `backend/tests/test_engine_real.py` | integration | Stockfish executable | Real Stockfish smoke/availability | Browser, full Review pipeline | PASS in full suite | medium | Flaky across machines if engine missing |
| `backend/tests/test_evaluation_display.py` | unit | Evaluation semantics | POV White eval, mate/eval display, player POV | UI wording in browser | PASS in full suite | high | Add golden docs examples if formulas change |
| `backend/tests/test_frontend_app_shell_static.py` | static | App Shell | Plan2 nav, Review not main tab, Training labels, forbidden labels | Runtime browser and state branches | PASS in full suite | medium | Browser shell fixture |
| `backend/tests/test_frontend_learning_loop_static.py` | static | Learning UI | Learning counters wired, no FSRS/ETV/SkillTrace labels | Real due data in browser | PASS in full suite | medium | Browser due/revision fixture |
| `backend/tests/test_frontend_core_board_interaction_static.py` | static | Board/Practice UI contract | Board selectors, click-click support, Practice attempt path, no duplicate retry copy, forbidden labels absent, smoke scripts present | Runtime board movement | PASS targeted | medium | Keep selectors stable |
| `backend/tests/test_degraded_states_v1.py` | unit/static | Degraded states / anti-tilt V1 | `StateNotice`, safe import/Daily Plan/Practice degraded copy, repeated-wrong anti-tilt copy, forbidden-label guard, invalid/illegal/duplicate PGN behavior, contract doc state IDs | Browser pointer behavior; full engine-missing UI | PASS targeted | high | Add richer simulated API failure tests as endpoints evolve |
| `backend/tests/test_frontend_mobile_accessibility_static.py` | static | Mobile/a11y V1 | Final responsive CSS overrides, focus-visible, reduced motion, board tab focus, mobile/keyboard smoke scripts, Plan2 nav and Training contracts | Real browser rendering and keyboard traversal | PASS targeted | medium | Keep paired with browser smokes |
| `backend/tests/test_frontend_profile_privacy_static.py` | static | Profile/Privacy UI | Profile outside main nav, export/delete labels, typed confirmation, forbidden labels absent | Runtime API/browser behavior | PASS targeted | medium | Keep aligned with browser smoke |
| `backend/tests/test_frontend_lesson_flow_static.py` | static | Review lesson UI | Review tabs/copy/internal details hidden | Browser interaction and board moves | PASS in full suite | medium | Browser Review/Lesson smoke |
| `backend/tests/test_frontend_i18n_strings_static.py` | static | French V1 strings catalog | Catalog existence, critical nav/Training/feedback/degraded/analysis/live/Profile strings, component usage, no contradiction labels for best/accepted, no forbidden labels | Browser runtime copy rendering in every branch; full multilingual i18n | PASS targeted | high | Expand only as more critical strings are migrated |
| `backend/tests/test_game_api.py` | API/integration | Games API | Create/list/open/moves/analysis-related API paths | Browser UX, real user import | PASS in full suite | high | Keep separate from profile/privacy destructive tests |
| `backend/tests/test_game_recorder.py` | unit | Game recorder | Move recording, state persistence | PGN import and browser | PASS in full suite | high | None immediate |
| `backend/tests/test_live_analysis_service.py` | unit/integration | Live analysis | Live session state, streaming helpers | Review stabilized snapshots | PASS in full suite | medium | Degraded UI for backend unavailable |
| `backend/tests/test_move_categories.py` | unit | Taxonomy V0 | Move categories, labels | Browser Review tags | PASS in full suite | high | Keep taxonomy simple |
| `backend/tests/test_opening_reality_evidence.py` | unit | Opening evidence | Opening reality evidence and linked moments | Normal V1 Training | PASS in full suite | medium | Keep not overpromoted |
| `backend/tests/test_opening_service.py` | unit/API | Opening service | Book import/classification, API paths | Opening UX browser | PASS in full suite | medium | License/data source governance |
| `backend/tests/test_pedagogical_explanations.py` | unit | Pedagogy | Explanation generation | Browser copy/lesson flow | PASS in full suite | medium | Browser lesson smoke |
| `backend/tests/test_pgn_import_service.py` | unit/API | PGN import | Preview/import/dedup/invalid PGN/API with TestClient | Browser form | PASS in full suite | high | Browser invalid/duplicate PGN smoke |
| `backend/tests/test_profile_privacy.py` | API/integration | Profile/Privacy | Export empty/data, `pgn_raw`, delete confirmation, idempotent delete, no Stockfish/analysis dependency | Browser download behavior | PASS targeted | high | Keep temp DB isolation |
| `backend/tests/test_training_items_daily_plan.py` | integration/API/static | Training Items / Daily Plan V1 | `training_items` migration/generation/idempotency, max 5 per Review, accepted moves, deterministic Daily Plan, due/failed/recent/diversity buckets, Daily Plan Practice attempt, export/delete coverage, no SkillTrace influence | Rich multi-game user history and real-engine browser variety | PASS targeted | high | Add richer corpus fixture later |
| `backend/tests/test_pgn_sindarov_real_file.py` | integration | Real PGN file | Sindarov real PGN import/review job start | Browser | PASS in full suite | high | Keep fixture stable |
| `backend/tests/test_pv_contrast_evidence.py` | unit | PV evidence | PV contrast structures | Browser PV disclosure | PASS in full suite | medium | Explorer browser smoke |
| `backend/tests/test_rating_math.py` | unit | Math helpers | Rating/math utilities | Product flows | PASS in full suite | medium | None immediate |
| `backend/tests/test_review_coach_summary.py` | unit | Review coach summary | Coach headline summary | Browser Summary | PASS in full suite | high | Browser ready Review |
| `backend/tests/test_review_jobs.py` | integration | Review jobs | Job lifecycle, reconcile/cancel/stalled states | Browser progress UI | PASS in full suite | high | Browser job-state smoke |
| `backend/tests/test_review_metrics.py` | unit | Review metrics | Accuracy/NeuroScore-related calculations | Browser presentation | PASS in full suite | high | Golden corpus later |
| `backend/tests/test_review_moment_importance.py` | unit | Review moment selection intelligence | `priority_training`, `secondary_training`, `micro_gap`, `good_decision`, `no_major_moment`, Practice filtering of non-training moments | Full-game corpus calibration and browser layout | added in P1 moment intelligence mission | high if PASS | Add positive_gain persistence once backend stores it explicitly |
| `backend/tests/test_review_practice_items.py` | unit | Practice items | Review-to-practice item generation | Browser start Practice | PASS in full suite | high | Browser Practice start |
| `backend/tests/test_review_practice_learning_loop.py` | unit/integration | Learning Loop V1 | Attempt fields, delay rules, due session, no-due summary | Browser due UI | PASS in full suite | high | Global daily plan/due queue |
| `backend/tests/test_review_practice_no_engine.py` | unit/integration | Practice no-engine | Practice remains available without Stockfish calls | Browser degraded state | PASS in full suite | high | Browser no-engine practice |
| `backend/tests/test_review_practice_reveal_skip.py` | unit | Practice reveal/skip | Reveal and skip event paths | Browser buttons | PASS in full suite | high | Browser reveal/skip |
| `backend/tests/test_review_practice_sessions.py` | integration/API | Practice sessions | Start/attempt/complete/retry/abandon API, exact-best SAN legacy success, original move not reused as user attempt, rebuild required for unparseable legacy best move | Browser board interactions | PASS targeted | high | Keep paired with browser Practice smoke |
| `backend/tests/test_review_practice_summary.py` | unit | Practice summary | Summary counts and messages | Browser summary presentation | PASS in full suite | high | Browser session summary |
| `backend/tests/test_review_service.py` | unit/API | Review service | Review generation, scoring, jobs, API error states | Browser full Review path | PASS in full suite | high | Ready-review browser fixture |
| `backend/tests/test_stockfish_service.py` | unit/integration | Stockfish service | UCI service wrapper/engine executable | UI states | PASS in full suite | medium | Strict cache policy |
| `backend/tests/test_try_move_model.py` | unit | Try move / feedback correctness | Legal/illegal move model, SAN/UCI normalization, accepted moves, missing accepted list, legacy rebuild state | Browser board input | PASS targeted | high | Keep paired with best-move feedback smoke |
| `backend/tests/test_v3_7_full_system_qa.py` | integration/API | Full-system legacy QA | Broad API/review/game integration | Current Plan2 browser shell | PASS in full suite | medium | Rename/split by V1 domains later |
| `scripts/review_regression_smoke.py` | smoke | Review regression | Normal deep job and last-position hang recovery | Browser, Practice UI | PASS | high | Add ready Review browser smoke |
| `scripts/pgn_import_smoke.py` | smoke | PGN import | PGN import smoke through backend | Browser form | PASS | high | Run with browser temp DB |
| `scripts/pgn_sindarov_real_flow_smoke.py` | smoke | Real PGN flow | 14 Sindarov games, import/open/replay/review start | Browser Review/Practice | PASS | high | Browser E2E with one fixture |
| `scripts/browser_v1_flow_smoke.mjs` | browser smoke | V1 user loop | `/app`, Plan2 nav, Training 3 entries, PGN import UI, Review ready, Summary visible, Practice start, reveal attempt, `due_at`, learning summary scheduled signal, forbidden labels absent | Correct drag/drop move attempt, invalid PGN, mobile/responsive | PASS | high | Extend later for invalid/degraded/mobile states |
| `scripts/browser_profile_privacy_smoke.mjs` | browser smoke | Profile/Privacy | `/app`, Plan2 nav exactly 3 entries, top-right Profile panel, export JSON with `pgn_raw`, first delete click preserves data, typed `SUPPRIMER`, confirmed delete clears temp local data, forbidden labels absent | Real user DB, browser download file contents beyond API payload, mobile/responsive | PASS | high | Keep port range within backend CORS regex |
| `scripts/browser_daily_plan_smoke.mjs` | browser smoke | Training Items / Daily Plan V1 | Temp DB API seed, fake-engine Review, `training_items_available`, Daily Plan create, export includes new tables, Training 3 entries, Plan du jour Practice, reveal attempt stored as `training_item:{id}`, `due_at`, forbidden labels absent | Rich 5-6 item day, drag/drop move attempt, mobile/responsive | PASS | high | Add richer history fixture later |
| `scripts/browser_core_board_interaction_smoke.mjs` | browser smoke | Core board interaction V1 | Temp DB, fake engine, Review board, Review Practice real click-click correct/wrong/illegal moves, reveal fallback, Daily Plan Practice real board move, attempt export, learning summary, forbidden labels absent | Mobile/responsive, full drag/drop path across browsers | PASS | high | Add drag/drop-specific variant if click-click ever regresses |
| `scripts/browser_analysis_stall_recovery_smoke.mjs` | browser smoke | Analysis stall/recovery UI | Controlled fake-engine timeout/failure, retryable Review job, no duplicate retry copy, Reprendre recovery, Review done after retry | Real Stockfish OS-level hang | PASS | high | Add slow real-engine degraded smoke only if stable |
| `scripts/browser_review_exploration_real_smoke.mjs` | browser smoke | Review local exploration | Review `Exploration locale`, real click-click move from Review board, board FEN changes, undo, reset, illegal move feedback, no Practice attempt during exploration, separate Practice attempt saved afterward | Drag/drop exploration, promotion picker | PASS | high | Manual real DB spot check still useful |
| `scripts/browser_real_analysis_no_infinite_loop_smoke.mjs` | browser smoke | Analysis no-infinite-loop | Browser-restored Review job, hard deadline, terminal/recoverable state, statuses/progress evidence, no network 500 | Real Stockfish OS-level hang on a user's live DB | PASS | high | Add slow real-engine local smoke only if stable |
| `scripts/browser_degraded_states_smoke.mjs` | browser smoke | Degraded states / recovery UX | Temp DB invalid PGN, illegal PGN, empty Daily Plan, backend offline notice, export empty DB, delete confirmation safety, no network 500, forbidden labels absent | Practice interrupted resume, repeated-wrong anti-tilt in browser, full engine-missing settings UI, mobile/responsive | PASS | high | Expand with practice interruption only after stable fixture exists |
| `scripts/browser_mobile_responsive_smoke.mjs` | browser smoke | Mobile responsive V1 | 390x844 viewport, no horizontal overflow, Plan2 nav exactly 3, Review board fits, Review exploration tap, Review Practice tap attempt, Training exactly 3, Daily Plan Practice tap attempt, Profile/Privacy visible, forbidden labels absent | Real physical devices, landscape/tablet matrix, visual design certification | PASS | high | Add manual device pass before broad external release |
| `scripts/browser_keyboard_accessibility_smoke.mjs` | browser smoke | Keyboard/focus a11y V1 | Tab focus for nav/import/PGN textarea/Practice board/Practice buttons/Profile, focus ring evidence, reduced-motion CSS, forbidden labels absent, no network 500 | Full WCAG audit, screen reader semantics, every modal/route branch | PASS | medium | Full a11y audit remains future |
| `backend/tests/test_frontend_review_analysis_live_static.py` | static | Review analysis lifecycle / live analysis UI | Frontend no-progress watchdog, one recovery copy, live enabled on Review, live paused during Review jobs, live hidden in Practice, browser smoke scripts present | Runtime browser behavior | added in P0 live mission | medium | Keep aligned with live browser smokes |
| `scripts/browser_review_analysis_from_ui_no_infinite_timer_smoke.mjs` | browser smoke | Review analysis UI lifecycle | UI click starts Review analysis, job API statuses/progress collected, hard deadline rejects infinite spinner, terminal/recoverable UI required | Real user DB and real Stockfish OS hangs | added in P0 live mission | high if PASS | Add real local DB spot check if user issue persists |
| `scripts/browser_live_analysis_default_smoke.mjs` | browser smoke | Live analysis Review board | Live analysis visible by default on Review board, updates after local exploration FEN change | Real Stockfish latency and long navigation sessions | added in P0 live mission | high if PASS | Add manual check on user machine after commit |
| `scripts/browser_live_analysis_pauses_during_review_smoke.mjs` | browser smoke | Live analysis priority | Live analysis pause copy while standard Review job runs, Review job reaches terminal/recoverable state | Long real-engine queue contention | added in P0 live mission | medium/high if PASS | Add real Stockfish stress test later |
| `scripts/browser_practice_no_live_spoiler_smoke.mjs` | browser smoke | Practice spoiler protection | Practice hides live eval/best move before attempt, then normal attempt persists | Every Practice branch after reveal | added in P0 live mission | high if PASS | Extend after richer Practice fixture |
| `scripts/browser_practice_best_move_feedback_success_smoke.mjs` | browser smoke | Practice feedback trust | Exact best move through real board is success, no contradictory problem copy, attempt saved as best with due_at, legacy Bxf7+ API probe, no feedback classification side effects | Rich chess explanation quality and future LLM wording | PASS | high | Keep evidence pack for regression review |
| `scripts/browser_review_correction_no_contradiction_smoke.mjs` | browser smoke | Review Correction feedback trust | Legacy Review/Lesson Correction payload with displayed move equal to best move shows success/accepted feedback and suppresses `Ton coup - Probleme`, `Opportunite manquee`, and missed-best reproach copy | Real user DB payload variety and future LLM commentary quality | PASS | high | Keep paired with F002/GF-005b anti-regression checks |
| `scripts/browser_review_success_state_ux_smoke.mjs` | browser smoke | Review success-state CTA / historical context | Exact-best Review try move shows `Tentative reussie`, primary `Continuer`, `Voir pourquoi ca marche`, recovered gain copy, and no retry/correction success CTA, negative delta, `Qualite : Moyenne`, duplicate `important`, or problem labels | Real user DB payload variety and richer future explanation quality | added in P1 success UX mission | high if PASS | Pair with player-POV impact smoke |
| `scripts/browser_review_attempt_specific_feedback_and_line_smoke.mjs` | browser smoke | Review try-move feedback / line action | Current wrong Review try-move shows the attempted move and safe generic feedback instead of stale historical reply text; exact-best retry stays success; `Voir la ligne` opens a visible line panel when a line exists | Rich attempt-specific engine PV for every wrong move; full manual animation perception | added in P1 attempt feedback mission | high if PASS | Keep paired with F002/GF-005b anti-regression checks |
| `scripts/browser_review_training_continuation_and_line_playback_user_contract_smoke.mjs` | browser smoke | Review Training continuation / line playback contract | Success/accepted Review Training feedback shows local `Position suivante`; next advances item label and clears feedback/user move without duplicate attempts; last success shows `Terminer la session`; internal `Lire la ligne jouee`/`Lire la ligne solution` opens a visible line player, advances active move/FEN on `Suivant`, and switches context | Manual perceptual smoothness and broad real-user PGN variety | added in P1 Review Training continuation mission | high if PASS | Manual Nxe4/Na6/Bxc5 spot check before pilot |
| `scripts/browser_review_user_pov_focus_layout_contract_smoke.mjs` | browser smoke | Review POV / identity / focused layout | `Les deux` orientation follows current White/Black moment or item; unknown `Moi` is hidden/explained; board, feedback, primary next action, and line player controls remain visible together on desktop | Real user identity persistence beyond `review.user_color`, broad responsive visual polish | added in P1 Review user POV/focus layout mission | high if PASS | Manual real-game White/Black/Moi spot check before pilot |
| `scripts/browser_review_trust_pv5_stable_classification_smoke.mjs` | browser/API smoke | Review trust PV5 / stable try-move classification | No pre-attempt overlay on app load; HTTP try-move classification proves stable out-of-list `playable`, `imprecise`, and `wrong` bands; legal out-of-list attempts are not auto-wrong; PV5 candidate `playable`/`imprecise` mappings are exercised | Full real-board playable fixture and clean-opening UI screenshot remain manual/future | added in P1 Review trust mission | high if PASS | Pair with backend unit tests for gate, timeout, DB result bands, and scheduling safety |
| `scripts/browser_review_decision_card_quality_ribbon_smoke.mjs` | browser smoke | Review decision presentation / move quality UX | Summary historical badge and quality ribbon; Learn Decision Card with no attempt/best spoiler before correction and best row after correction; Explorer historical badge without local attempt classification; Practice current-attempt badge only after real board attempt; legend collapsed/open; mobile no horizontal overflow | Broad real-user PGN variety, manual visual taste, and full-game quality for every unreviewed move | PASS | high | Manual Review mini-check remains required before pilot |
| `scripts/browser_review_moment_selection_intelligence_smoke.mjs` | browser smoke | Review moment selection intelligence | API category fields/summary; priority label and `Pourquoi ce moment ?`; good-decision group when fixture supports it; Practice excludes micro/good/informational items; no current-attempt or best-row spoiler before attempt; Explorer uses historical category only; mobile no overflow; raw metrics absent | The current browser fixture does not expose a micro-gap or clean/no-major state; those are covered by backend unit tests | PASS | high | Add richer browser fixture when a stable clean/micro-gap PGN is available |
| `cmd /c npm.cmd run build` | build/typecheck | Frontend compile | `tsc` and Vite production build | Runtime browser data states | PASS | high | Bundle size/perf budgets later |
| `cmd /c npx tsc --noEmit` | typecheck | Frontend TS | TypeScript no emit | Vite/browser runtime | PASS | high | Add `typecheck` npm script |
| `cmd /c npm.cmd run lint` | lint | Frontend style | Not available | All lint coverage | unavailable | low | Add lint script only if project wants it |
| Browser manual smoke `/app` | browser | App Shell/Training/Games | `/app` load, nav, Training 3 entries, PGN preview/import, forbidden labels absent | Full release matrix/mobile | superseded by automated browser smoke | medium | Keep for quick human spot checks |

## Coverage Gaps

- Practice interrupted resume is not browser-proven.
- Repeated-wrong anti-tilt is statically guarded, not browser-proven.
- Engine missing/path invalid settings UX remains partial; analysis stall recovery is covered.
- Mobile/responsive basics are browser-proven at 390x844, but real device
  manual QA and full WCAG accessibility certification remain open.
- SkillTrace shadow coverage is still absent because that capability is not
  implemented.
- French critical strings are centralized for V1 flows, but this is not a
  multi-language runtime or full extraction of every incidental string.
- No registry-vs-code checker.
- No `npm run lint` or `npm run typecheck` script; build does include `tsc`.
