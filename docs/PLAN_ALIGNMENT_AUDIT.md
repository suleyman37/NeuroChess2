# Plan Alignment Audit

Snapshot date: 2026-05-05.

Plan1/Plan2/Plan3 are the source of truth. Current code is implementation
state. Plan3 governs execution order, not a one-shot roadmap refactor.

## 2026-05-07 Review Trust Update

- Aligned: Review candidate generation now uses PV5 while preserving
  conservative accepted-move criteria.
- Aligned: legal try-moves outside cached candidates require stabilized
  resulting-position evidence before being called `wrong`; missing evidence is
  unknown-safe.
- Aligned: low-impact near-equal opening drift is gated out of forced Review
  retry selection.
- Preserved: no NeuroScore, visible formula, Daily Plan selection, or `due_at`
  semantic change.
- Still pending: manual Review mini-check and human pilot remain NO-GO.

## 2026-05-07 Review Cockpit UX Update

- Aligned: Review desktop layout moves toward a board-first cockpit, with a
  larger sticky board and viewport-scoped Review panel.
- Aligned: Practice feedback keeps the board, feedback, and primary CTA visible
  together for success and wrong states.
- Aligned: line playback stays docked near the board and remains frontend-only.
- Aligned: board attempt glyphs stay small, non-blocking, and anchored to the
  destination square without adding generated assets.
- Preserved: no backend, PV5, formula, NeuroScore, Daily Plan, scheduling,
  schema, or forbidden V1 UI change.
- Still pending: automated validation and manual Review mini-check decide the
  next GO/NO-GO; human pilot remains NO-GO.

## 2026-05-07 Review Decision Presentation Update

- Aligned: Review now separates historical move quality from current attempt
  quality in the frontend presentation layer.
- Aligned: Summary/Learn/Practice/Explorer can show existing move quality
  badges where backend Review data already provides reliable category data.
- Aligned: the new Decision Card and compact quality ribbon use existing Review
  fields only; missing quality is not invented.
- Aligned: symbol legend is collapsed by default and avoids forbidden V1 or
  overclaiming labels.
- Preserved: no backend, PV5, try-move, formula, NeuroScore, Daily Plan,
  scheduling, schema, LLM, Candidate Trainer, or Plan1/Plan2/Plan3 change.
- Still pending: full validation and manual Review mini-check; human pilot
  remains NO-GO.

## 2026-05-07 Review Moment Selection Intelligence Update

- Aligned: Review move annotations now expose a backend-authoritative,
  user-safe moment category for priority training, secondary training,
  micro-gap, good decision, informational, and review-level no-major-moment
  states.
- Aligned: Summary, Decision Card, Practice, and Explorer can display
  "Pourquoi ce moment ?" and the category label without exposing raw
  `criticality_score`, WDL, diagnostic gap, ETV, or FSRS.
- Aligned: new training item and Practice generation filters respect
  `is_training_recommended`; micro-gaps and good decisions are not forced into
  retry items by default.
- Preserved: no NeuroScore formula change, no `due_at` semantic change, no
  Daily Plan scoring rewrite, no LLM, no Candidate Trainer, and no
  Plan1/Plan2/Plan3 change.
- Limitation: good decisions are inferred from existing quality/category data;
  explicit positive-gain persistence remains future backend work.
- Still pending: full validation and manual Review mini-check; human pilot
  remains NO-GO.

## 2026-05-08 Metric Visibility Governance Update

- Aligned: `coach_neuro_score_v1` remains the public NeuroScore only as a coach
  communication score, with reference precision shown separately.
- Aligned: `diagnostic_gap_v1`, `neuro_score_diag_v1`, raw
  `criticality_score_v1`, raw Stockfish WDL, uncalibrated domain `/100` scores,
  SkillTrace mastery, ETV/FSRS/BKT/IRT/posterior values, and Evidence JSON stay
  out of normal V1 UI.
- Patched: legacy score details no longer return normal audit rows; diagnostic
  internals stay API/debug/documentation only.
- Added: static metric visibility guard and validation doc for V1 governance.
- Preserved: no formula, NeuroScore calculation, Review selection, Daily Plan,
  `due_at`, LLM, Candidate Trainer, or Plan1/Plan2/Plan3 change.
- Still pending: manual Review mini-check; human pilot remains NO-GO.

## 2026-05-08 Explorer Stable Move Feedback Update

- Aligned: Review Explorer can keep local branch moves separate from original
  game moves and evaluate the latest explored move only on explicit user action.
- Aligned: Explorer move feedback reuses backend try-move quality bands and the
  stabilized resulting-position fallback; unavailable stable evidence remains
  unknown-safe as `needs_rebuild`, never a default `wrong`.
- Aligned: Explorer feedback is labeled as local exploration and is not saved as
  Practice, training, `due_at`, or Daily Plan state.
- Aligned: the Explorer board orientation toggle is pure frontend state and
  does not alter analyzed-player POV or Practice orientation.
- Preserved: no formula, NeuroScore, PV5 Review classification, Review moment
  selection, Daily Plan, `due_at`, LLM, Candidate Trainer, raw metric exposure,
  or Plan1/Plan2/Plan3 change.
- Limitation: V1 supports explicit analysis of the latest local move only;
  branch-wide batch analysis remains a future product decision.
- Still pending: manual Review mini-check; human pilot remains NO-GO.

| Element du plan | Attendu Plan1/Plan2 | Etat actuel dans le code | Fichiers concernes | Statut | Action recommandee | Priorite |
|---|---|---|---|---|---|---|
| Backend chess data | Durable games, moves, evaluations, review/practice state | Backend data layer and migrations exist | `backend/neurochess/data/*`, `backend/neurochess/models.py`, migrations | aligned | Preserve schema/version discipline | P0 |
| Plan3 execution governance | Plan3 official, sprint order enforced, no all-at-once execution | Integrated in governance docs; no code feature changed | `plan/Plan3.md`, `AGENTS.md`, `docs/PLAN_SOURCE_OF_TRUTH.md`, `docs/PLAN_CONTEXT_MIN.md`, `docs/NEXT_PLAN_ACTIONS.md` | aligned | Use Plan3 to scope one mission at a time | P0 |
| PGN import | V1 import/copy PGN into Mes parties/Review flow | Import, preview/history/dedup/from-position support exists and is reachable from the Plan2 Mes parties shell | `backend/neurochess/pgn_import_service.py`, `frontend/src/App.tsx` | aligned | Keep import in Mes parties; do not auto-launch analysis | P1 |
| Stockfish analysis | Backend-authoritative, versioned engine analysis | Analysis service/jobs and engine adapters exist | `backend/neurochess/analysis_service.py`, `backend/neurochess/review_job_service.py`, `backend/neurochess/engines/*` | aligned | Do not change engine behavior in UI missions | P0 |
| Eval POV White convention | `eval_cp` and `mate_in` canonical POV White | Implemented/test-covered in display/review logic | `backend/neurochess/core/evaluation_display.py`, `backend/neurochess/review_service.py`, tests | aligned | Keep `eval_pov_side_to_move_cp` derived only | P0 |
| Win% | Convert engine eval to human chance language | Present through evaluation display/review metrics | `backend/neurochess/core/evaluation_display.py`, `backend/neurochess/metrics/review_metrics.py` | aligned | Keep as support signal, not raw dashboard | P1 |
| player_win_percent | Player POV chance signal | Present in review payload/types and view model | `backend/neurochess/review_service.py`, `frontend/src/api/client.ts`, `reviewViewModel.ts` | aligned | Keep translated in copy | P1 |
| win_loss | Chance loss drives moments/impact | Present in metrics/review payload | `backend/neurochess/metrics/review_metrics.py`, `frontend/src/components/review/*` | aligned | Avoid raw overload in normal UI | P1 |
| move_accuracy | Move-level reference accuracy | Present as backend metric/supporting field | `backend/neurochess/metrics/review_metrics.py`, `frontend/src/api/client.ts` | aligned | Keep secondary/internal unless Plan says visible | P1 |
| game_accuracy | Reference precision secondary score | Folded as reference precision in Summary details | `backend/neurochess/metrics/review_metrics.py`, `frontend/src/components/review/ReviewCockpitSummary.tsx` | aligned | Keep collapsed/secondary | P0 |
| NeuroScore coach | Main visible Review score | Visible in Review Summary | `ReviewCockpitSummary.tsx`, `reviewViewModel.ts`, `review_metrics.py` | aligned | Keep as single main score | P0 |
| criticality / moment selection | Criticality internal; user sees selected moments | Raw fields remain types/debug; Summary shows max 3 moments | `backend/neurochess/review_service.py`, `frontend/src/api/client.ts`, `ReviewCockpitSummary.tsx` | partial | Guard raw `criticality_score` from normal UI | P0 |
| taxonomy V0 | Simple pedagogical tags | Labels exist in backend/frontend | `backend/neurochess/metrics/pedagogy.py`, `frontend/src/components/review/reviewLabels.ts` | aligned | Keep tags simple, no formulas | P1 |
| Review generation | Deep/stabilized Review source | Review service/job flow exists; controlled fake-engine timeout browser smoke proves retryable recovery without caching timeout as valid | `backend/neurochess/review_service.py`, `backend/neurochess/review_job_service.py`, `backend/neurochess/engines/fake_engine.py`, `scripts/browser_analysis_stall_recovery_smoke.mjs` | aligned | Keep live/shallow out of final Review truth; continue real-engine degraded-state hardening | P0 |
| Review UX | Summary -> learn -> practice -> explorer, calm hierarchy | Summary simplified, Review is contextual, and the board now has local-only `Exploration locale` for legal move testing without saving attempts | `frontend/src/App.tsx`, `ReviewPanel.tsx`, `ReviewFocusTabs.tsx`, `ReviewCockpitSummary.tsx`, `scripts/browser_review_exploration_real_smoke.mjs` | partial | Keep reducing technical density inside Review without changing formulas | P1 |
| Practice | Review moments become linear exercises | Sessions/attempts/reveals/skips/retries exist; browser smoke proves real click-click correct, wrong, illegal, reveal, Daily Plan attempts, and exact-best feedback trust. Backend now canonicalizes attempted/best/accepted moves from FEN and refuses false wrong labels for exact/accepted moves. | `backend/neurochess/review_practice_service.py`, `backend/neurochess/metrics/try_move.py`, `ReviewPracticePanel.tsx`, `ReviewLessonPanel.tsx`, `ChessBoardPanel.tsx`, `scripts/browser_core_board_interaction_smoke.mjs`, `scripts/browser_practice_best_move_feedback_success_smoke.mjs` | aligned | Keep backend authoritative grading; add drag/drop-specific proof only if needed | P1 |
| Board interaction V1 | Review/Practice board must be usable, not reveal-only | Board supports drag/drop plus click-source/click-target, stable selectors, orientation prop, selected-square/target hints, safe illegal Practice submission, and local Review exploration with undo/reset | `frontend/src/components/ChessBoardPanel.tsx`, `frontend/src/App.tsx`, `docs/CORE_INTERACTION_CONTRACT.md`, `scripts/browser_review_exploration_real_smoke.mjs` | aligned | Preserve click-click as reliable V1 input and keep board contract tested | P0 |
| practice_result_event | Attempt event data for learning loop | V1 event fields now include item_id, time spent, hint/reveal flags, source context, due_at, and backend tests | `review_practice_service.py`, `api/game_routes.py`, `api/schemas.py`, backend tests | aligned | Keep optional item difficulty/self-confidence future-only | P1 |
| SkillTrace Beta | V1 shadow mode only | Not durable/productized yet; Plan3 requires shadow-only when added | docs only | missing | Implement after Practice events with no visible mastery score and no Daily Plan authority before V1.1 | P1 |
| simple_spaced_repetition_v1 / revisions | Simple V1 spaced repetition; do not call it FSRS-lite | Simple V1 due/scheduled counts exist from Practice events; real FSRS remains hidden/future | `review_practice_service.py`, `frontend/src/App.tsx`, docs | partial | Keep UI copy plain and avoid FSRS/ETV/SkillTrace labels | P1 |
| Daily Plan deterministic | Due items, recent failures, critical recent items, diversity, anti-redundancy | Implemented as durable backend Daily Plan using training_items; Training/Today consume real plan signals and browser smoke proves Daily Plan Practice with board attempt | `backend/neurochess/daily_plan_service.py`, `backend/neurochess/training_item_service.py`, `frontend/src/App.tsx`, `scripts/browser_daily_plan_smoke.mjs`, `scripts/browser_core_board_interaction_smoke.mjs` | aligned | Keep SkillTrace out of selection until a later shadow-mode mission | P1 |
| ETV / plan du jour | Internal prioritization only after enough data | Blueprint/docs only; Plan3 keeps ETV out of V1 UI | `docs/LEARNING_ENGINE_BLUEPRINT.md`, `docs/NEXT_PLAN_ACTIONS.md` | missing | Keep formula hidden; use deterministic plan first | P2 |
| Aujourd'hui page | Main "what should I do now?" screen | Uses one hero from real Review/Practice/import/analysis/due-revision state; progress and A revoir cards consume Practice learning counts | `frontend/src/App.tsx`, `frontend/src/styles.css` | partial | Add anti-tilt/degraded states next without turning it into a dashboard | P1 |
| Mes parties page | V1 game library and import/review entry | Main nav destination exists; header now prioritizes PGN import and history while the board stays inside the games workspace | `frontend/src/App.tsx`, `pgn_import_service.py` | partial | Extract from large `App.tsx` later only if safe | P1 |
| Entrainement page | Plan du jour, missed positions, revisions | Keeps exactly three V1 entries; Plan du jour uses deterministic backend plan and can start Daily Plan Practice with real board attempts | `frontend/src/App.tsx`, `backend/tests/test_frontend_app_shell_static.py`, `backend/tests/test_frontend_learning_loop_static.py`, `scripts/browser_core_board_interaction_smoke.mjs` | aligned | Keep only one primary CTA and avoid adding modes | P1 |
| Profil / parametres | Minimal settings/privacy/data/engine entry top right | Header opens a minimal Profile/Settings panel outside main nav, with local profile, preferences note, engine note, and privacy controls | `frontend/src/App.tsx`, `frontend/src/styles.css`, `backend/tests/test_frontend_profile_privacy_static.py` | aligned | Keep preferences honest until real settings tables exist | P1 |
| Privacy/export/delete | Required V1 release capability | Implemented with `GET /api/export`, `DELETE /api/user-data?confirm=SUPPRIMER`, backend tests, and browser smoke in isolated temp DB | `backend/neurochess/privacy_service.py`, `backend/neurochess/api/game_routes.py`, `frontend/src/api/client.ts`, `scripts/browser_profile_privacy_smoke.mjs`, `backend/tests/test_profile_privacy.py` | aligned | Keep destructive confirmation and update docs when new local-data tables appear | P1 |
| Anti-tilt | Gentle recent-loss/recovery states | Light V1 copy exists for repeated wrong Practice attempts and reveal-used recovery; static tests guard against blame/shame copy | `frontend/src/degradedStates.ts`, `frontend/src/components/review/ReviewPracticePanel.tsx`, `backend/tests/test_degraded_states_v1.py` | partial | Add browser fixture for repeated wrong attempts later if stable | P1 |
| degraded states | Clear recovery for PGN/engine/slow/partial states | `StateNotice` and degraded-state mapping cover invalid/illegal/duplicate PGN, backend unavailable, empty/partial Daily Plan, Practice no-items/save-failed/illegal/completed, and key anti-tilt copy. Browser smoke proves invalid PGN, illegal PGN, empty Daily Plan, backend offline, export/delete safety, no page errors and no network 500. Analysis stall/no-infinite-loop remains covered by P0 smokes. | `frontend/src/components/StateNotice.tsx`, `frontend/src/degradedStates.ts`, `frontend/src/App.tsx`, `frontend/src/components/review/ReviewPracticePanel.tsx`, `docs/DEGRADED_STATES_CONTRACT.md`, `scripts/browser_degraded_states_smoke.mjs`, `backend/tests/test_degraded_states_v1.py` | partial | Keep engine settings, Practice interrupted resume, and full offline out of this mission | P1 |
| mobile responsive / a11y minimum | Critical V1 screens usable on mobile; keyboard/focus basics; no full redesign | Browser smoke now proves 390x844 mobile viewport with no horizontal overflow on Today/Games/Review/Practice/Training/Profile, Review exploration tap/click, Review Practice attempt, Daily Plan Practice attempt, Training exactly 3 entries, Profile visible, and forbidden labels absent. Keyboard smoke proves focus rings for nav/import/textarea/Practice board/buttons/Profile and reduced-motion CSS. | `frontend/src/styles.css`, `frontend/src/components/ChessBoardPanel.tsx`, `scripts/browser_test_helpers.mjs`, `scripts/browser_mobile_responsive_smoke.mjs`, `scripts/browser_keyboard_accessibility_smoke.mjs`, `backend/tests/test_frontend_mobile_accessibility_static.py` | aligned | Keep this as V1 minimum; full WCAG and physical-device QA remain future release hardening | P1 |
| offline mode | Partial offline for calculated Reviews/Practice/import queue | Not explicit | frontend/backend | missing | Add modest offline badge/state later | P2 |
| NeuroMonitor / brain visuals | Forbidden in normal V1 UI; research only | Removed from `frontend/src`; research backlog records it | deleted visual/neuro files, `docs/RESEARCH_BACKLOG.md`, `tools/plan_guard.py` | aligned | Keep out via plan guard | P0 |
| Candidate Trainer | V2 opt-in / not V1 normal UI | Not visible | none | aligned | Keep as research/backlog | RESEARCH |
| Intent Layer | Optional/deeper future mode | Only limited opening intention note exists in Review/lab flow | `frontend/src/App.tsx`, `ReviewLaboratoryPanel.tsx` | partial | Keep discreet; no deep V1 Intent Layer | RESEARCH |
| LLM | Future/verifier/evidence-grounded only | Backend placeholder only | `backend/neurochess/llm/__init__.py` | aligned | Do not expose in UI | RESEARCH |
| Transfer Gap | V2 after enough data | Docs only; visible copy removed | docs | aligned | Keep hidden until data sufficiency exists | RESEARCH |
| domain scores | Future calibrated only | Brain/domain visual UI removed; docs mention future | docs, removed frontend visual model | aligned | Do not show numeric domain /100 in V1 | RESEARCH |
| app shell/navigation | Aujourd'hui/Mes parties/Entrainement, Review contextual | Main nav has Aujourd'hui/Mes parties/Entrainement; Review is contextual with return-to-source, and V5.5-2 reduces board dominance outside Mes parties/Review | `frontend/src/App.tsx`, `frontend/src/styles.css`, `ReviewFocusTabs.tsx` | partial | Next stabilize Training data and degraded states, then extract only if safe | P1 |
| debug/internal metrics exposure | Internal metrics folded/debug only | API/types/folded debug remain; plan guard blocks Summary/UI leaks | `frontend/src/api/client.ts`, `ReviewTechnicalDetails.tsx`, `tools/plan_guard.py` | partial | Keep debug isolated and folded | P0 |

## P0 Review Analysis Lifecycle / Live Analysis Alignment

- Plan1 alignment: live analysis is lightweight board assistance only. It does
  not change formulas, NeuroScore, Practice scheduling, training item creation,
  or durable Review metrics.
- Plan2 alignment: live analysis is contextual to the Review board/exploration,
  not a new main nav tab or product mode. Practice challenge hides live eval to
  preserve attempt-before-reveal.
- Plan3 alignment: mission is bounded to Review lifecycle/live analysis, tests,
  browser smokes, and docs. No broad refactor or full plan implementation.
- Forbidden V1 surfaces remain absent: no Candidate Trainer, LLM coach, Intent
  Layer, Transfer Gap, ETV, FSRS, NeuroMonitor, brain/cortex/atlas/Cognitive Map.
