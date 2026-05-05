# V1 Readiness Report

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW` + `P1.PROFILE-PRIVACY-V1` + `P1.TRAINING-ITEMS-DAILY-PLAN-V1` + `P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1` + `P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1` + `P1.DEGRADED-STATES-ANTI-TILT-V1` + `P1.MOBILE-RESPONSIVE-AND-A11Y-V1` + `P0.PRACTICE-FEEDBACK-CORRECTNESS-AND-LEGACY-REVIEW-REBUILD-V1`
Date: 2026-05-05

Mission Control note: `docs/mission_control/` now records Golden Flows,
trust-critical Failure Ledger entries, evidence-pack rules, release posture,
and the reusable Codex mission protocol. It is a governance overlay only and
does not replace Plan1/Plan2/Plan3.

## 1. Resume executif

- Alpha utilisable estimee: 96%.
- V1 reelle estimee: 91%.
- Decision premiers utilisateurs externes: NO-GO.

NeuroChess a maintenant une preuve browser automatisee du flow V1 minimal :
`/app -> navigation Plan2 -> import PGN UI -> Review prete -> Summary ->
Practice -> attempt reveal -> due_at/learning_summary scheduled signal`.
Le minimum Profile/Settings/Privacy est browser-proven avec export JSON et
suppression locale confirmee. Le backend a maintenant des `training_items`
durables et un Daily Plan deterministe, avec Practice lancee depuis
`Plan du jour` en browser smoke. Le core board est maintenant browser-proven
pour click-click correct, mauvais coup legal, illegal, reveal et Daily Plan
Practice. Le board Review a maintenant un mode `Exploration locale` prouve en
browser reel : legal move, undo, reset, illegal move calme, aucun attempt cree
pendant l'exploration. Les jobs Review stale sont materialises en `stalled`
recuperables et un smoke navigateur impose un hard deadline anti-boucle. Le P1
Degraded States ajoute maintenant un `StateNotice` commun, des copies
calmes pour PGN invalide/illegal, backend local indisponible, Daily Plan vide ou
partiel, Practice sans item, tentative non enregistree, coup illegal, session
terminee, reveal et tentative repetee difficile. Le smoke navigateur degraded
states prouve invalid PGN, PGN illegal, Daily Plan vide, backend offline,
export vide, confirmation delete et absence de network 500 en DB temporaire.
Le P1 Mobile / A11Y ajoute maintenant une preuve browser a 390x844: pas
d'overflow horizontal sur les ecrans critiques, Review exploration par
tap/click, Practice Review, Daily Plan Practice, Profile/Privacy visible, focus
clavier visible pour nav, import, PGN textarea, board Practice et boutons
Practice, et CSS `prefers-reduced-motion`. Le bug de confiance Practice
exact-best est maintenant corrige et browser-proven: un meilleur coup joue au
board est sauvegarde `best`, sans contradiction `Ton coup - Probleme` /
`Le meilleur coup etait`. La V1 externe reste NO-GO car
SkillTrace shadow manque, les strings francaises ne sont pas centralisees,
l'accessibilite n'est pas une certification WCAG complete, et les scenarios
Practice interrupted/repeated-wrong restent statiques ou couverts indirectement
plutot que par un smoke dedie complet.

## 2. Valide automatiquement

- Plan guard: PASS.
- Backend full suite: PASS, 495 tests.
- Review regression smoke: PASS.
- PGN import smoke: PASS.
- Sindarov real-flow smoke: PASS.
- Frontend production build: PASS.
- TypeScript fallback typecheck: PASS via `npx tsc --noEmit`.
- Browser V1 flow smoke: PASS via
  `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
- Profile/Privacy backend tests: PASS via
  `backend.tests.test_profile_privacy`.
- Profile/Privacy static guard: PASS via
  `backend.tests.test_frontend_profile_privacy_static`.
- Browser profile/privacy smoke: PASS via
  `cmd /c node scripts\browser_profile_privacy_smoke.mjs`.
- Training Items / Daily Plan backend tests: PASS via
  `backend.tests.test_training_items_daily_plan`.
- Browser Daily Plan smoke: PASS via
  `cmd /c node scripts\browser_daily_plan_smoke.mjs`.
- Browser core board interaction smoke: PASS via
  `cmd /c node scripts\browser_core_board_interaction_smoke.mjs`.
- Browser analysis stall recovery smoke: PASS via
  `cmd /c node scripts\browser_analysis_stall_recovery_smoke.mjs`.
- Browser Review exploration real smoke: PASS via
  `cmd /c node scripts\browser_review_exploration_real_smoke.mjs`.
- Browser real analysis no-infinite-loop smoke: PASS via
  `cmd /c node scripts\browser_real_analysis_no_infinite_loop_smoke.mjs`.
- Degraded states backend/static test: PASS via
  `.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_degraded_states_v1`.
- Browser degraded states smoke: PASS via
  `cmd /c node scripts\browser_degraded_states_smoke.mjs`.
- Mobile responsive smoke: PASS via
  `cmd /c node scripts\browser_mobile_responsive_smoke.mjs`.
- Keyboard/accessibility smoke: PASS via
  `cmd /c node scripts\browser_keyboard_accessibility_smoke.mjs`.
- Practice best-move feedback smoke: PASS via
  `cmd /c node scripts\browser_practice_best_move_feedback_success_smoke.mjs`.
- Learning Loop V1 service: attempt fields, due rules, due session, no-due
  summary all covered by backend tests.
- Training V1 static guard: exactly 3 entries and no forbidden labels.

## 3. Valide en browser

- `http://127.0.0.1:5173/app` loads with title `NeuroChess 2`.
- Main navigation visible: `Aujourd'hui`, `Mes parties`, `Entrainement`.
- Training tab opens and shows exactly: `Plan du jour`, `Mes positions ratees`,
  `Revisions`.
- Forbidden V1 labels absent in checked browser snapshots.
- Mes parties Import PGN form opens.
- Browser PGN paste/import succeeds against an isolated temp backend DB.
- Browser ready Review Summary renders with NeuroScore, key moments, and
  Practice CTA.
- Browser Practice starts from Review.
- Browser click `Voir la correction` records a `revealed` practice attempt.
- Backend evidence from the browser smoke: `game_id=1`, `session_id=1`,
  `attempt_id=1`, `due_at=2026-05-05T12:08:29+00:00`,
  `learning_summary.scheduled_count=1`.
- Profile/Privacy browser smoke opens the top-right panel, verifies the main
  nav remains exactly `Aujourd'hui`, `Mes parties`, `Entrainement`, exports JSON
  with `pgn_raw`, verifies the first delete click preserves data, requires
  typed `SUPPRIMER`, then clears local game/history/export data in a temp DB.
- Daily Plan browser smoke seeds a PGN through the API, completes Review with
  fake engine, materializes `training_items_available=1`, creates a real
  partial Daily Plan, opens Training, starts `Plan du jour` Practice, records a
  `revealed` attempt as `item_id=training_item:1`, and stores `due_at` J+1.
- Core board interaction browser smoke records:
  - correct Review Practice board move: `result=best`;
  - wrong legal Review Practice board move: `result=wrong`;
  - illegal Review Practice board move: `result=illegal`;
  - reveal fallback: `reveal_used=true`;
  - Daily Plan Practice board move: `item_id=training_item:2`,
    `result=best`;
  - `learning_summary.practice_event_count=5`;
  - export contains 5 practice attempts.
- Analysis stall recovery browser smoke injects a controlled fake-engine
  timeout/failure at 12/13 positions, shows one retry copy, clicks `Reprendre`,
  and reaches Review `done`.
- Review exploration browser smoke proves `Exploration locale` from a Review
  board position: legal move `d4c5` changed board FEN, undo returned to the
  original FEN, reset returned to the original FEN, illegal move `a1a3` showed a
  calm illegal message, attempts stayed `0 -> 0`, then a separate Review
  Practice attempt saved `result=best` with `due_at`.
- Real analysis no-infinite-loop browser smoke proves a browser-restored Review
  job cannot wait forever silently under the tested fixture: statuses observed
  `queued -> running -> completed`, progress `0/13 -> 12/13 -> 13/13`, hard
  deadline 90s, no network 500.
- Degraded states browser smoke proves invalid PGN (`PGN non reconnu`), illegal
  PGN (`Un coup n'est pas legal`), empty Daily Plan (`Plan en construction`),
  backend offline (`NeuroChess local ne repond pas`), export empty DB, delete
  confirmation required, confirmed temp-DB deletion, no page errors and no
  network 500.
- Mobile responsive browser smoke proves viewport `390x844`, main nav exactly
  `Aujourd'hui / Mes parties / Entrainement`, no horizontal overflow on Today,
  Games, Review, Practice, Training and Profile, Review board width 358px,
  Review exploration move `d4c5`, Review Practice attempt `result=best`, Daily
  Plan Practice attempt `result=best`, Training exactly 3 entries, and
  forbidden labels absent. It observed one harmless 404 resource request and no
  page errors or network 500.
- Keyboard/accessibility browser smoke proves visible focus rings for main nav,
  Importer PGN, PGN textarea, import primary action, Practice board, Indice,
  Voir la correction, Passer and Profile/Settings; it also verifies
  `prefers-reduced-motion` CSS and no network 500.
- Practice best-move feedback smoke proves a real board exact-best move
  (`f3g5` / `Ng5` in the fixture) is saved as `result=best`, `due_at` J+7 is
  present, the UI shows success feedback, no `Ton coup - Probleme` nor
  `Le meilleur coup etait` reproach appears, and legacy SAN `Bxf7+` normalizes
  to `c4f7` as `best`.

## 4. Existe mais pas valide en browser

- Drag/drop Practice move attempt across browsers.
- Drag/drop Review exploration across browsers.
- Practice hint, skip, summary, retry failed in browser.
- Rich 5-6 item Daily Plan browser fixture across several games/tags.
- Due review browser flow from Training/Revisions outside the Daily Plan path.
- Engine missing/path invalid settings UX.
- Practice interrupted resume state in browser.
- Repeated wrong anti-tilt state in browser; static guard exists.
- Empty-history UI state.
- Physical-device mobile QA and full screen-reader/WCAG audit; automated smoke
  covers the 390x844 browser viewport and keyboard focus basics only.

## 5. Partiel

- Aujourd'hui uses real local signals and can prioritize backend Daily Plan, but
  not every priority branch is browser-proven.
- Entrainement uses the durable backend Daily Plan for `Plan du jour`; richer
  multi-item variety still depends on more user history.
- Review is contextual and the ready Review Summary is browser-proven; broader
  lesson/explorer paths remain partial.
- Compact progress and due counts are based on real Practice counters, but only
  per available game/session signal, not a global learning queue.
- Profile/settings is minimal and real for V1 privacy controls; preferences and
  engine controls remain honest placeholders.
- i18n is French in visible UI, but strings are not centralized.
- ACTION_REGISTRY and SCREEN_CONTRACTS are maintained manually, not checked
  against code.

## 6. Casse

- No product-breaking failure was found in automated tests.
- `rg.exe` could not run in this Codex session (`Access denied`), so the audit
  used `Select-String`.
- `npm run typecheck` and `npm run lint` scripts are missing. Typecheck fallback
  passes; lint is unavailable.
- Browser plugin emitted non-app Statsig/network noise during two calls, but
  app browser console logs were empty.

## 7. Gaps Plan1

- SkillTrace Beta shadow is missing.
- `training_items` durable model is implemented for Review-derived moments.
- Transfer validation is future/not implemented.
- Real FSRS remains future; current implementation is correctly named
  `simple_spaced_repetition_v1`.
- Domain scores and Transfer Gap are not visible, correctly, but also not
  calibrated/productized.

## 8. Gaps Plan2

- Anti-tilt is implemented lightly for repeated wrong attempts and reveal-used
  recovery copy; browser proof is still indirect/static for repeated wrongs.
- Degraded states are partially browser-proven for invalid/illegal PGN, backend
  unavailable, empty Daily Plan and export/delete safety.
- Mobile/responsive and keyboard focus basics are browser-proven at 390x844.
  This is a V1 minimum proof, not a full accessibility certification.
- Profile/Settings/Privacy is now a minimal top-right panel, not a main tab.
- Ready Review Summary and reveal Practice attempt are browser-proven; lesson,
  explorer, hint/skip/retry, and drag/drop move attempts still need browser
  evidence.
- `App.tsx` remains board/history heavy; the shell is aligned but not yet
  ergonomically final.

## 9. Gaps Plan3

- Durable `training_items` implemented for V1 Review moments.
- Backend deterministic `Daily Plan` implemented and browser-smoked.
- No SkillTrace shadow.
- No centralized French strings.
- No strict cache policy proof matching all Plan3 conditions.
- Automated browser smokes exist for the minimal V1 loop, profile/privacy,
  Daily Plan, degraded states, mobile responsive flow, and keyboard/focus
  basics.

## 10. Tests executes

```powershell
C:\Users\bahij\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\plan_guard.py
# PASS: Plan guard passed.
```

```powershell
$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe -m unittest discover backend/tests
# PASS: Ran 486 tests in 128.963s, OK.
```

```powershell
$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe scripts\review_regression_smoke.py
# PASS: review-smoke normal deep job + last-position hang recovery.
```

```powershell
.venv_repair_local\Scripts\python.exe scripts\pgn_import_smoke.py
# PASS: PGN import smoke PASS.
```

```powershell
.venv_repair_local\Scripts\python.exe scripts\pgn_sindarov_real_flow_smoke.py
# PASS: 14 games imported, history/open/replay/review start OK.
```

```powershell
cmd /c npm.cmd run build
# PASS: tsc && vite build, 55 modules transformed.
```

```powershell
cmd /c npm.cmd run typecheck
# FAIL/unavailable: missing npm script "typecheck".

cmd /c npx tsc --noEmit
# PASS.
```

```powershell
cmd /c npm.cmd run lint
# FAIL/unavailable: missing npm script "lint".
```

Browser smoke:

- Backend temporary server: `/health` OK.
- Frontend temporary Vite server: `/app` HTTP 200.
- In-app browser: shell/nav/training/import PASS.
- Ready Review + Practice: superseded by automated browser smoke below.

```powershell
cmd /c node scripts\browser_v1_flow_smoke.mjs
# PASS: /app, nav Plan2, Training 3 entries, PGN import UI, Review ready,
# Summary visible, Practice opened, reveal attempt recorded, due_at created,
# learning_summary scheduled_count=1, forbidden labels absent.
```

```powershell
$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_profile_privacy backend.tests.test_frontend_profile_privacy_static
# PASS: Ran 11 tests, OK.
```

```powershell
cmd /c node scripts\browser_profile_privacy_smoke.mjs
# PASS: Profile panel, export JSON, delete confirmation, confirmed local data
# deletion in isolated temp DB, Plan2 nav intact, forbidden labels absent.
```

```powershell
$env:PYTHONPATH=(Resolve-Path .manual_pydeps\site-packages).Path
$env:TEMP=(Resolve-Path .tmp\test-run-local).Path
$env:TMP=$env:TEMP
$env:TMPDIR=$env:TEMP
.venv_repair_local\Scripts\python.exe -m unittest backend.tests.test_training_items_daily_plan
# PASS: training_items, deterministic Daily Plan, Practice from plan,
# diversity, export/delete coverage.
```

```powershell
cmd /c node scripts\browser_daily_plan_smoke.mjs
# PASS: temp DB/fake engine seed, training_items materialized, Daily Plan
# created, Training CTA opens Practice, reveal attempt stored with due_at.
```

```powershell
cmd /c node scripts\browser_core_board_interaction_smoke.mjs
# PASS: Review board visible, moment selection, Practice from Review,
# click-click correct/wrong/illegal board attempts persisted, reveal persisted,
# Daily Plan board attempt persisted, export includes attempts.
```

```powershell
cmd /c node scripts\browser_analysis_stall_recovery_smoke.mjs
# PASS: controlled fake-engine timeout/failure, one retry copy, Reprendre
# recovery, Review done after retry.
```

```powershell
cmd /c node scripts\browser_review_exploration_real_smoke.mjs
# PASS: Review exploration locale, tap/click move, undo/reset, illegal message,
# no attempt during exploration, separate Practice attempt saved.
```

```powershell
cmd /c node scripts\browser_real_analysis_no_infinite_loop_smoke.mjs
# PASS: hard deadline, status/progress evidence, final/recoverable state.
```

```powershell
cmd /c node scripts\browser_degraded_states_smoke.mjs
# PASS: invalid PGN, illegal PGN, empty Daily Plan, backend offline,
# export/delete temp DB safety.
```

```powershell
cmd /c node scripts\browser_mobile_responsive_smoke.mjs
# PASS: 390x844 viewport, no horizontal overflow, Review exploration,
# Review Practice, Daily Plan Practice, Profile/Privacy visible.
```

```powershell
cmd /c node scripts\browser_keyboard_accessibility_smoke.mjs
# PASS: keyboard focus rings, Practice board/buttons focusable, reduced motion.
```

```powershell
cmd /c node scripts\browser_practice_best_move_feedback_success_smoke.mjs
# PASS: exact-best Practice board move saved as best, no contradictory
# problem/best-was copy, due_at present, legacy Bxf7+ API probe PASS.
```

## 11. Tests non executes

- Browser drag/drop-specific path was not run; click-click board input is now
  browser-proven for correct, wrong legal, and illegal attempts.
- Mobile/responsive browser check now passes at 390x844, but physical-device QA
  was not run.
- Invalid-PGN browser check now passes through the degraded-states smoke.
- Review analysis live mission adds targeted browser proof for UI-started
  analysis no-infinite-timer, live default, live pause during Review job, and
  Practice no-spoiler. These must PASS before raising readiness.
- Lint could not run because no `lint` script exists.

## 12. Risques critiques

| Priorite | Risque | Preuve | Action |
|---|---|---|---|
| P1 | SkillTrace shadow missing | Docs only | Add shadow-only after Daily Plan |
| P1 | Degraded states incomplete | Browser-tested for key import/offline/daily-plan states, but not every contract state | Extend focused degraded smoke only when fixtures are stable |
| P1 | i18n strings not centralized | No `frontend/src/i18n/fr.ts` found | Centralize French strings |
| P1 | Strict Stockfish cache policy partial | Plan3 conditions not fully proved | Cache policy audit/sprint |
| P2 | Registries not code-checked | Manual docs only | Registry/code checker |
| P2 | `App.tsx` remains large | Serena overview shows many responsibilities | Safe extraction later |

## 13. Prochaine mission recommandee

One next mission after P0 live-analysis validations pass:
`P1.I18N-STRINGS-CATALOG-V1`.

Reason: the core browser V1 loop, board interaction, analysis recovery,
Profile/Privacy, Daily Plan, key degraded states, mobile responsive flow, and
keyboard/focus basics are now proven. External V1 still needs French string
centralization/catalog coverage before inviting non-technical users.

## 14. Critere de sortie V1 Plan3

| Critere Plan3 | Statut | Preuve | Commentaire |
|---|---|---|---|
| Import PGN | pass | Backend tests, PGN smoke, browser import | Works, but browser should use isolated DB fixture next |
| Analyze | pass | Review smoke, real-flow review start, browser smoke cached/fake job completion | Browser smoke uses fake engine/temp DB, not real Stockfish |
| Review | pass | Backend review tests/smoke and browser ready Summary | Broader Lesson/Explorer browser paths partial |
| Practice | partial | Backend/API tests and browser reveal attempt | Correct drag/drop move, hint/skip/retry not browser-proven |
| Daily Plan | pass | Backend Daily Plan tests and browser daily-plan smoke | Browser proof uses a valid partial one-item plan, not a rich 5-6 item day |
| Revision J+3 | pass | Backend learning loop tests for hint success -> 3 days; browser reveal creates J+1 scheduled due | Browser Training/Revisions due-flow not proven |
| Export/delete | pass | Backend tests and browser profile/privacy smoke | Deletes only after typed `SUPPRIMER` in tested temp DB |
| Tests critiques | partial | Backend/build/smokes/browser V1 + profile/privacy + daily-plan + degraded + mobile/a11y basics pass | Needs physical-device and full a11y/manual release QA |
| Utilisateurs externes | missing | SkillTrace shadow/i18n incomplete; repeated-wrong anti-tilt browser fixture partial; full a11y certification absent | NO-GO |
