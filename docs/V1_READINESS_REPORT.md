# V1 Readiness Report

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW` + `P1.PROFILE-PRIVACY-V1` + `P1.TRAINING-ITEMS-DAILY-PLAN-V1`
Date: 2026-05-04

## 1. Resume executif

- Alpha utilisable estimee: 90%.
- V1 reelle estimee: 78%.
- Decision premiers utilisateurs externes: NO-GO.

NeuroChess a maintenant une preuve browser automatisee du flow V1 minimal :
`/app -> navigation Plan2 -> import PGN UI -> Review prete -> Summary ->
Practice -> attempt reveal -> due_at/learning_summary scheduled signal`.
Le minimum Profile/Settings/Privacy est browser-proven avec export JSON et
suppression locale confirmee. Le backend a maintenant des `training_items`
durables et un Daily Plan deterministe, avec Practice lancee depuis
`Plan du jour` en browser smoke. La V1 externe reste NO-GO car SkillTrace
shadow manque, les etats degrades ne sont pas assez prouves en UI reelle, les
strings francaises ne sont pas centralisees, et le browser ne prouve pas encore
drag/drop, mobile/responsive et cas d'erreur.

## 2. Valide automatiquement

- Plan guard: PASS.
- Backend full suite: PASS, 476 tests.
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

## 4. Existe mais pas valide en browser

- Correct drag/drop Practice move attempt in browser.
- Practice hint, skip, summary, retry failed in browser.
- Rich 5-6 item Daily Plan browser fixture across several games/tags.
- Due review browser flow from Training/Revisions outside the Daily Plan path.
- Invalid PGN UI error state.
- Slow/stalled analysis UI state.
- Backend unavailable UI state.
- Empty-history UI state.

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

- Anti-tilt is missing as a dedicated UX behavior.
- Degraded states are partial and not browser-proven.
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
- Automated browser smokes exist for the minimal V1 loop, profile/privacy, and
  Daily Plan; release smoke still needs degraded/mobile coverage.

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
# PASS: Ran 476 tests in 86.801s, OK.
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

## 11. Tests non executes

- Browser drag/drop correct-move attempt was not run; the automated browser
  smoke validates a reveal/correction attempt because it is stable and records a
  real `practice_attempt`.
- Mobile/responsive browser check was not run.
- Invalid-PGN browser check was not run.
- Lint could not run because no `lint` script exists.

## 12. Risques critiques

| Priorite | Risque | Preuve | Action |
|---|---|---|---|
| P1 | SkillTrace shadow missing | Docs only | Add shadow-only after Daily Plan |
| P1 | Degraded states incomplete | Not browser-tested | `P1.DEGRADED-STATES-ANTI-TILT` |
| P1 | i18n strings not centralized | No `frontend/src/i18n/fr.ts` found | Centralize French strings |
| P1 | Strict Stockfish cache policy partial | Plan3 conditions not fully proved | Cache policy audit/sprint |
| P2 | Registries not code-checked | Manual docs only | Registry/code checker |
| P2 | `App.tsx` remains large | Serena overview shows many responsibilities | Safe extraction later |

## 13. Prochaine mission recommandee

One next mission: `P1.DEGRADED-STATES-ANTI-TILT`.

Reason: the core browser V1 loop and Profile/Privacy flow are now proven.
External V1 still needs calmer, browser-tested recovery states for invalid PGN,
backend unavailable, slow/stalled analysis, empty queues, and anti-tilt copy.

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
| Tests critiques | partial | Backend/build/smokes/browser V1 + profile/privacy + daily-plan flow pass | Needs degraded/mobile tests |
| Utilisateurs externes | missing | SkillTrace shadow/degraded states/i18n/mobile/drag-drop proof incomplete | NO-GO |
