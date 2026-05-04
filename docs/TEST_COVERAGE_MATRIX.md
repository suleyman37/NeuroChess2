# Test Coverage Matrix

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW`
Date: 2026-05-04

This matrix lists available automated tests, scripts, and smoke checks. It does
not count static tests as browser or end-to-end proof.

## Latest Run Summary

- `tools/plan_guard.py`: PASS.
- Backend full suite: PASS, 459 tests.
- `scripts/review_regression_smoke.py`: PASS.
- `scripts/pgn_import_smoke.py`: PASS.
- `scripts/pgn_sindarov_real_flow_smoke.py`: PASS.
- Frontend build: PASS (`tsc && vite build`).
- `npm run typecheck`: unavailable; fallback `npx tsc --noEmit`: PASS.
- `npm run lint`: unavailable.
- Browser smoke: PASS via `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
  The script uses an isolated temp backend DB, fake engine, Vite, and Edge CDP
  to prove nav/import/ready Review/Practice/reveal attempt/due signal.

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
| `backend/tests/test_engine_profiles.py` | unit | Engine profiles | Live/standard/deep profile semantics | Full engine cost budget | PASS in full suite | medium | Plan3 cache/profile compatibility |
| `backend/tests/test_engine_real.py` | integration | Stockfish executable | Real Stockfish smoke/availability | Browser, full Review pipeline | PASS in full suite | medium | Flaky across machines if engine missing |
| `backend/tests/test_evaluation_display.py` | unit | Evaluation semantics | POV White eval, mate/eval display, player POV | UI wording in browser | PASS in full suite | high | Add golden docs examples if formulas change |
| `backend/tests/test_frontend_app_shell_static.py` | static | App Shell | Plan2 nav, Review not main tab, Training labels, forbidden labels | Runtime browser and state branches | PASS in full suite | medium | Browser shell fixture |
| `backend/tests/test_frontend_learning_loop_static.py` | static | Learning UI | Learning counters wired, no FSRS/ETV/SkillTrace labels | Real due data in browser | PASS in full suite | medium | Browser due/revision fixture |
| `backend/tests/test_frontend_lesson_flow_static.py` | static | Review lesson UI | Review tabs/copy/internal details hidden | Browser interaction and board moves | PASS in full suite | medium | Browser Review/Lesson smoke |
| `backend/tests/test_game_api.py` | API/integration | Games API | Create/list/open/moves/analysis-related API paths | Browser UX, real user import | PASS in full suite | high | Add delete/export when implemented |
| `backend/tests/test_game_recorder.py` | unit | Game recorder | Move recording, state persistence | PGN import and browser | PASS in full suite | high | None immediate |
| `backend/tests/test_live_analysis_service.py` | unit/integration | Live analysis | Live session state, streaming helpers | Review stabilized snapshots | PASS in full suite | medium | Degraded UI for backend unavailable |
| `backend/tests/test_move_categories.py` | unit | Taxonomy V0 | Move categories, labels | Browser Review tags | PASS in full suite | high | Keep taxonomy simple |
| `backend/tests/test_opening_reality_evidence.py` | unit | Opening evidence | Opening reality evidence and linked moments | Normal V1 Training | PASS in full suite | medium | Keep not overpromoted |
| `backend/tests/test_opening_service.py` | unit/API | Opening service | Book import/classification, API paths | Opening UX browser | PASS in full suite | medium | License/data source governance |
| `backend/tests/test_pedagogical_explanations.py` | unit | Pedagogy | Explanation generation | Browser copy/lesson flow | PASS in full suite | medium | Browser lesson smoke |
| `backend/tests/test_pgn_import_service.py` | unit/API | PGN import | Preview/import/dedup/invalid PGN/API with TestClient | Browser form | PASS in full suite | high | Browser invalid/duplicate PGN smoke |
| `backend/tests/test_pgn_sindarov_real_file.py` | integration | Real PGN file | Sindarov real PGN import/review job start | Browser | PASS in full suite | high | Keep fixture stable |
| `backend/tests/test_pv_contrast_evidence.py` | unit | PV evidence | PV contrast structures | Browser PV disclosure | PASS in full suite | medium | Explorer browser smoke |
| `backend/tests/test_rating_math.py` | unit | Math helpers | Rating/math utilities | Product flows | PASS in full suite | medium | None immediate |
| `backend/tests/test_review_coach_summary.py` | unit | Review coach summary | Coach headline summary | Browser Summary | PASS in full suite | high | Browser ready Review |
| `backend/tests/test_review_jobs.py` | integration | Review jobs | Job lifecycle, reconcile/cancel/stalled states | Browser progress UI | PASS in full suite | high | Browser job-state smoke |
| `backend/tests/test_review_metrics.py` | unit | Review metrics | Accuracy/NeuroScore-related calculations | Browser presentation | PASS in full suite | high | Golden corpus later |
| `backend/tests/test_review_practice_items.py` | unit | Practice items | Review-to-practice item generation | Browser start Practice | PASS in full suite | high | Browser Practice start |
| `backend/tests/test_review_practice_learning_loop.py` | unit/integration | Learning Loop V1 | Attempt fields, delay rules, due session, no-due summary | Browser due UI | PASS in full suite | high | Global daily plan/due queue |
| `backend/tests/test_review_practice_no_engine.py` | unit/integration | Practice no-engine | Practice remains available without Stockfish calls | Browser degraded state | PASS in full suite | high | Browser no-engine practice |
| `backend/tests/test_review_practice_reveal_skip.py` | unit | Practice reveal/skip | Reveal and skip event paths | Browser buttons | PASS in full suite | high | Browser reveal/skip |
| `backend/tests/test_review_practice_sessions.py` | integration/API | Practice sessions | Start/attempt/complete/retry/abandon API | Browser board interactions | PASS in full suite | high | Browser full Practice flow |
| `backend/tests/test_review_practice_summary.py` | unit | Practice summary | Summary counts and messages | Browser summary presentation | PASS in full suite | high | Browser session summary |
| `backend/tests/test_review_service.py` | unit/API | Review service | Review generation, scoring, jobs, API error states | Browser full Review path | PASS in full suite | high | Ready-review browser fixture |
| `backend/tests/test_stockfish_service.py` | unit/integration | Stockfish service | UCI service wrapper/engine executable | UI states | PASS in full suite | medium | Strict cache policy |
| `backend/tests/test_try_move_model.py` | unit | Try move | Legal/illegal move model | Browser board input | PASS in full suite | medium | Browser try-move |
| `backend/tests/test_v3_7_full_system_qa.py` | integration/API | Full-system legacy QA | Broad API/review/game integration | Current Plan2 browser shell | PASS in full suite | medium | Rename/split by V1 domains later |
| `scripts/review_regression_smoke.py` | smoke | Review regression | Normal deep job and last-position hang recovery | Browser, Practice UI | PASS | high | Add ready Review browser smoke |
| `scripts/pgn_import_smoke.py` | smoke | PGN import | PGN import smoke through backend | Browser form | PASS | high | Run with browser temp DB |
| `scripts/pgn_sindarov_real_flow_smoke.py` | smoke | Real PGN flow | 14 Sindarov games, import/open/replay/review start | Browser Review/Practice | PASS | high | Browser E2E with one fixture |
| `scripts/browser_v1_flow_smoke.mjs` | browser smoke | V1 user loop | `/app`, Plan2 nav, Training 3 entries, PGN import UI, Review ready, Summary visible, Practice start, reveal attempt, `due_at`, learning summary scheduled signal, forbidden labels absent | Correct drag/drop move attempt, invalid PGN, mobile/responsive, privacy/export/delete | PASS | high | Extend later for invalid/degraded/mobile states |
| `cmd /c npm.cmd run build` | build/typecheck | Frontend compile | `tsc` and Vite production build | Runtime browser data states | PASS | high | Bundle size/perf budgets later |
| `cmd /c npx tsc --noEmit` | typecheck | Frontend TS | TypeScript no emit | Vite/browser runtime | PASS | high | Add `typecheck` npm script |
| `cmd /c npm.cmd run lint` | lint | Frontend style | Not available | All lint coverage | unavailable | low | Add lint script only if project wants it |
| Browser manual smoke `/app` | browser | App Shell/Training/Games | `/app` load, nav, Training 3 entries, PGN preview/import, forbidden labels absent | Full release matrix/mobile | superseded by automated browser smoke | medium | Keep for quick human spot checks |

## Coverage Gaps

- No browser invalid-PGN/degraded-state smoke.
- No backend `training_items`, deterministic `Daily Plan`, privacy/export/delete,
  or SkillTrace shadow coverage because those capabilities are not implemented.
- No `docs/API_CONTRACTS.md`, `docs/DB_SCHEMA.md`, or registry-vs-code checker.
- No `npm run lint` or `npm run typecheck` script; build does include `tsc`.
