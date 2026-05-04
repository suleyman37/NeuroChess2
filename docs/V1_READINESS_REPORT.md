# V1 Readiness Report

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW`
Date: 2026-05-04

## 1. Resume executif

- Alpha utilisable estimee: 84%.
- V1 reelle estimee: 62%.
- Decision premiers utilisateurs externes: NO-GO.

NeuroChess a maintenant une preuve browser automatisee du flow V1 minimal :
`/app -> navigation Plan2 -> import PGN UI -> Review prete -> Summary ->
Practice -> attempt reveal -> due_at/learning_summary scheduled signal`.
La V1 externe reste NO-GO car Privacy/export/delete manque, Daily Plan
deterministe backend manque, `training_items` durable manque, SkillTrace shadow
manque, et les etats degrades ne sont pas assez prouves en UI reelle.

## 2. Valide automatiquement

- Plan guard: PASS.
- Backend full suite: PASS, 459 tests.
- Review regression smoke: PASS.
- PGN import smoke: PASS.
- Sindarov real-flow smoke: PASS.
- Frontend production build: PASS.
- TypeScript fallback typecheck: PASS via `npx tsc --noEmit`.
- Browser V1 flow smoke: PASS via
  `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
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

## 4. Existe mais pas valide en browser

- Correct drag/drop Practice move attempt in browser.
- Practice hint, skip, summary, retry failed in browser.
- Due review browser flow from Training/Revisions.
- Invalid PGN UI error state.
- Slow/stalled analysis UI state.
- Backend unavailable UI state.
- Empty-history UI state.

## 5. Partiel

- Aujourd'hui uses real local signals, but not a backend deterministic Daily
  Plan.
- Entrainement uses Practice/session signals, but Daily Plan is not a durable
  Plan3 service.
- Review is contextual and the ready Review Summary is browser-proven; broader
  lesson/explorer paths remain partial.
- Compact progress and due counts are based on real Practice counters, but only
  per available game/session signal, not a global learning queue.
- Profile/settings is only a placeholder.
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
- `training_items` durable model is missing.
- Transfer validation is future/not implemented.
- Real FSRS remains future; current implementation is correctly named
  `simple_spaced_repetition_v1`.
- Domain scores and Transfer Gap are not visible, correctly, but also not
  calibrated/productized.

## 8. Gaps Plan2

- Anti-tilt is missing as a dedicated UX behavior.
- Degraded states are partial and not browser-proven.
- Profile/Settings/Privacy is not a real screen yet.
- Ready Review Summary and reveal Practice attempt are browser-proven; lesson,
  explorer, hint/skip/retry, and drag/drop move attempts still need browser
  evidence.
- `App.tsx` remains board/history heavy; the shell is aligned but not yet
  ergonomically final.

## 9. Gaps Plan3

- No durable `training_items`.
- No backend deterministic `Daily Plan`.
- No SkillTrace shadow.
- No privacy/export/delete.
- No centralized French strings.
- No strict cache policy proof matching all Plan3 conditions.
- Automated browser smoke exists for the minimal V1 loop; release smoke still
  needs degraded/mobile/privacy coverage.
- No `API_CONTRACTS.md` or `DB_SCHEMA.md`.

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
# PASS: Ran 459 tests in 75.572s, OK.
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
| P1 | Privacy/export/delete missing | No API/UI found | `P1.PROFILE-PRIVACY` |
| P1 | Daily Plan is not backend deterministic | Search found no backend daily plan API/service | `P1.DAILY-PLAN-DETERMINISTIC` |
| P1 | Durable `training_items` missing | Search found no implementation | Add training item model after browser smoke |
| P1 | SkillTrace shadow missing | Docs only | Add shadow-only after Daily Plan |
| P1 | Degraded states incomplete | Not browser-tested | `P1.DEGRADED-STATES-ANTI-TILT` |
| P1 | i18n strings not centralized | No `frontend/src/i18n/fr.ts` found | Centralize French strings |
| P1 | Strict Stockfish cache policy partial | Plan3 conditions not fully proved | Cache policy audit/sprint |
| P2 | Registries not code-checked | Manual docs only | Registry/code checker |
| P2 | `App.tsx` remains large | Serena overview shows many responsibilities | Safe extraction later |

## 13. Prochaine mission recommandee

One next mission: `P1.PROFILE-PRIVACY`.

Reason: the core browser V1 loop is now proven. Plan3 still blocks external V1
until a minimal Profile/Settings privacy surface exists with export/delete or
local-data reset semantics.

## 14. Critere de sortie V1 Plan3

| Critere Plan3 | Statut | Preuve | Commentaire |
|---|---|---|---|
| Import PGN | pass | Backend tests, PGN smoke, browser import | Works, but browser should use isolated DB fixture next |
| Analyze | pass | Review smoke, real-flow review start, browser smoke cached/fake job completion | Browser smoke uses fake engine/temp DB, not real Stockfish |
| Review | pass | Backend review tests/smoke and browser ready Summary | Broader Lesson/Explorer browser paths partial |
| Practice | partial | Backend/API tests and browser reveal attempt | Correct drag/drop move, hint/skip/retry not browser-proven |
| Daily Plan | missing | No backend daily plan service/API found | Frontend-derived action only |
| Revision J+3 | pass | Backend learning loop tests for hint success -> 3 days; browser reveal creates J+1 scheduled due | Browser Training/Revisions due-flow not proven |
| Export/delete | missing | No API/UI found | Release blocker |
| Tests critiques | partial | Backend/build/smokes/browser V1 flow pass | Needs degraded/mobile/privacy tests |
| Utilisateurs externes | missing | No release/browser/privacy gate complete | NO-GO |
