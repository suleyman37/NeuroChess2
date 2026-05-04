# QA Checklist

Mission: `P0.FULL-APP-EVIDENCE-QA-AUDIT-V1` + `P0.BROWSER-SMOKE-FLOW`
Date: 2026-05-04

## Baseline

- [x] Read AGENTS and Plan governance docs.
- [x] Confirm `plan/Plan1.txt`, `plan/Plan2.txt`, `plan/Plan3.md` exist.
- [x] Capture `git status --short --branch`.
- [x] Capture `git diff --stat`.
- [x] Treat pre-existing dirty worktree as baseline, not as audit edits.

## Serena

- [x] Activate `C:\Users\bahij\OneDrive\Desktop\NeuroChess2_vraie\NeuroChess2`.
- [x] Confirm active languages: `typescript`, `python`.
- [x] Inspect `frontend/src/App.tsx`.
- [x] Inspect `ReviewCockpitSummary`.
- [x] Inspect `ReviewPanel`.
- [x] Inspect `ReviewPracticePanel` and `ReviewPracticeSessionPanel`.
- [x] Inspect Today/Training/PGN/Practice/due-review symbols.
- [x] Inspect backend Review Practice service/routes/schemas/migrations.

## Automated Validation

- [x] `tools/plan_guard.py` PASS.
- [x] Backend full suite PASS, 459 tests.
- [x] Review smoke PASS.
- [x] PGN import smoke PASS.
- [x] Sindarov real-flow smoke PASS.
- [x] Frontend build PASS.
- [x] TypeScript fallback typecheck PASS.
- [ ] Lint unavailable: no `lint` npm script.
- [ ] `npm run typecheck` unavailable: no `typecheck` npm script.

## Browser Validation

- [x] Temporary backend `/health` PASS.
- [x] Temporary frontend `/app` HTTP 200.
- [x] Browser loaded `/app`, title `NeuroChess 2`.
- [x] Browser sees main nav: `Aujourd'hui`, `Mes parties`, `Entrainement`.
- [x] Browser Training page shows exactly 3 entries.
- [x] Browser forbidden V1 labels absent in checked snapshots.
- [x] Automated browser smoke script added:
  `cmd /c node scripts\browser_v1_flow_smoke.mjs`.
- [x] Browser PGN paste/import works in an isolated temp backend DB.
- [x] Browser ready Review Summary visible.
- [x] Browser Practice starts from Review.
- [x] Browser reveal attempt is recorded as `practice_attempt`.
- [x] Browser/API proof includes `due_at` J+1 and
  `learning_summary.scheduled_count=1`.
- [x] Browser app console errors empty.
- [x] Browser ready Review Summary validated.
- [x] Browser Practice flow validated for reveal/correction attempt.
- [ ] Browser invalid PGN state not validated.
- [ ] Mobile/responsive not validated.

## V1 Boundaries

- [x] No NeuroMonitor / brain / cortex / atlas in checked UI snapshots.
- [x] No Candidate Trainer visible.
- [x] No deep Intent Layer visible.
- [x] No LLM coach visible.
- [x] No Transfer Gap visible.
- [x] No SkillTrace / ETV / FSRS visible in Training/App static guard.
- [x] Internal metrics are kept out of normal checked UI paths.

## Release Readiness

- [x] Core backend Review/Practice tests pass.
- [x] Core PGN smoke passes.
- [x] App shell browser smoke passes for the minimal V1 loop.
- [x] Automated browser E2E smoke exists for the minimal V1 loop.
- [ ] Deterministic backend Daily Plan missing.
- [ ] Durable `training_items` missing.
- [ ] SkillTrace shadow missing.
- [ ] Privacy/export/delete missing.
- [ ] Centralized French strings missing.
- [ ] Strict Stockfish cache proof incomplete.

## Documentation

- [x] Create/update `docs/FULL_APPLICATION_QA_AUDIT.md`.
- [x] Create/update `docs/TEST_COVERAGE_MATRIX.md`.
- [x] Create/update `docs/V1_READINESS_REPORT.md`.
- [x] Create/update this checklist.
- [x] Update `docs/NEXT_PLAN_ACTIONS.md`.
- [x] Update `docs/PROJECT_STATE.md`.

## Decision

- Alpha: usable internally with strong backend evidence.
- External V1: NO-GO until privacy/export/delete, deterministic Daily Plan,
  degraded states, and release hardening are handled.
