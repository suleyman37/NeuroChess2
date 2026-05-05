# Golden Flows

Golden Flows are V1 trust paths that must not regress. They are not feature
requests. They define the minimum evidence future missions should preserve.

## GF-001 Import PGN -> Standard Analysis -> Review Terminal/Recoverable

- Purpose: prove the normal V1 Review path does not hang.
- User-visible success criteria: PGN imports, standard analysis starts, and the
  user reaches Review ready, partial Review, or a recoverable analysis state.
- Forbidden regression: spinner/timer forever at the last ply or after terminal
  backend status.
- Suggested automated smoke:
  `scripts/browser_standard_analysis_last_ply_no_hang_smoke.mjs`.
- Suggested evidence: job poll trace, progress_done/progress_total, final UI
  state, API snapshot, screenshot of terminal/recoverable state.
- Relevant docs/tests: `docs/ANALYSIS_LIFECYCLE_CONTRACT.md`,
  `backend/tests/test_review_jobs.py`.

## GF-002 Deep Analysis Remains Terminal/Recoverable

- Purpose: standard-analysis repairs must not break deep Review analysis.
- User-visible success criteria: deep analysis reaches completed,
  completed_with_warnings, partial, or recoverable failure.
- Forbidden regression: deep path waits forever or loses Review availability.
- Suggested automated smoke: standard/deep comparison inside analysis lifecycle
  smoke.
- Suggested evidence: deep job trace and final Review fetch.
- Relevant docs/tests: `docs/ANALYSIS_LIFECYCLE_CONTRACT.md`.

## GF-003 Review Exploration Local Move

- Purpose: let the user explore legal moves locally without playing an opponent.
- User-visible success criteria: user enters local exploration, plays a legal
  move, board changes, undo/reset/exit work, illegal move is calm.
- Forbidden regression: exploration creates a Practice attempt or modifies
  training/due data.
- Suggested automated smoke:
  `scripts/browser_review_exploration_real_smoke.mjs`.
- Suggested evidence: attempts count before/after exploration, screenshots of
  exploration state and reset.
- Relevant docs/tests: `docs/CORE_INTERACTION_CONTRACT.md`.

## GF-004 Practice From Review

- Purpose: close the Review -> Practice learning loop.
- User-visible success criteria: user starts Practice from Review, attempts or
  reveal are saved, feedback is shown, and `due_at` follows existing schedule.
- Forbidden regression: reveal-only Practice, unsaved attempts, or due_at loss.
- Suggested automated smoke:
  `scripts/browser_core_board_interaction_smoke.mjs`.
- Suggested evidence: practice_attempt row, due_at, exported attempt.
- Relevant docs/tests: `backend/tests/test_review_practice_sessions.py`.

## GF-005 Practice Best Move Feedback

- Purpose: preserve trust when the user finds the exact best move.
- User-visible success criteria: exact best move gets success feedback.
- Forbidden regression: `Ton coup - Probleme` or `Le meilleur coup etait X` as
  a reproach when X was played.
- Suggested automated smoke:
  `scripts/browser_practice_best_move_feedback_success_smoke.mjs`.
- Suggested evidence: screenshot after attempt, API classification payload,
  practice_attempt `result=best`.
- Relevant docs/tests: `docs/API_CONTRACTS.md`,
  `backend/tests/test_try_move_model.py`.

## GF-006 accepted_moves_json Feedback

- Purpose: accepted alternatives must not be punished.
- User-visible success criteria: accepted move is success-like, not wrong.
- Forbidden regression: accepted move marked as a problem because it is not the
  exact single best move.
- Suggested automated smoke: extend best-move smoke when a stable accepted
  fixture exists.
- Suggested evidence: accepted_moves_json, normalized UCI set, result.
- Relevant docs/tests: `backend/tests/test_try_move_model.py`.

## GF-007 Legacy/Rebuild-Safe Feedback

- Purpose: old or incomplete Review data must not produce false wrong feedback.
- User-visible success criteria: if enough data exists, classify safely; if not,
  show recoverable rebuild/reanalysis state.
- Forbidden regression: missing/unparseable FEN or best move shown as wrong.
- Suggested automated smoke: legacy scenario in best-move smoke when feasible.
- Suggested evidence: safe error payload and no practice_attempt insert.
- Relevant docs/tests: `backend/tests/test_review_practice_sessions.py`.

## GF-008 Practice No Live Spoiler

- Purpose: preserve Plan1's try-before-reveal learning loop.
- User-visible success criteria: no live eval, PV, or best move is visible before
  attempt/reveal in active Practice.
- Forbidden regression: live analysis spoils the answer or creates learning
  side effects.
- Suggested automated smoke:
  `scripts/browser_practice_no_live_spoiler_smoke.mjs`.
- Suggested evidence: DOM absence checks, no live side-effect DB rows.
- Relevant docs/tests: `docs/ANALYSIS_LIFECYCLE_CONTRACT.md`.

## GF-009 Daily Plan Practice

- Purpose: deterministic Daily Plan must open Practice and persist attempts.
- User-visible success criteria: Plan du jour opens a training item and attempt
  or reveal is saved with due data.
- Forbidden regression: Daily Plan becomes empty by mistake or opens a
  non-persistent Practice session.
- Suggested automated smoke: `scripts/browser_daily_plan_smoke.mjs`.
- Suggested evidence: training_item id, practice_session id, attempt row,
  due_at.
- Relevant docs/tests: `docs/CORE_INTERACTION_CONTRACT.md`.

## GF-010 Profile/Privacy Export/Delete

- Purpose: privacy controls must remain safe before external users.
- User-visible success criteria: export works; delete requires typed
  `SUPPRIMER`; project files are not deleted.
- Forbidden regression: destructive action without confirmation or missing
  export sections.
- Suggested automated smoke: `scripts/browser_profile_privacy_smoke.mjs`.
- Suggested evidence: export JSON, delete confirmation check, post-delete empty
  state.
- Relevant docs/tests: `docs/API_CONTRACTS.md`.

## GF-011 Degraded States

- Purpose: failures should answer what happened, data safety, next action, and
  recovery.
- User-visible success criteria: invalid PGN, backend offline, empty Daily Plan,
  and similar states show calm recovery without raw stack traces.
- Forbidden regression: raw technical error in normal UI, no CTA, or infinite
  loading.
- Suggested automated smoke: `scripts/browser_degraded_states_smoke.mjs`.
- Suggested evidence: state ids, DOM copy, network/page error capture.
- Relevant docs/tests: `docs/DEGRADED_STATES_CONTRACT.md`.

## GF-012 Mobile Minimum

- Purpose: V1 must remain usable on the tested mobile viewport.
- User-visible success criteria: main nav works, board visible, no horizontal
  overflow, Practice is tappable.
- Forbidden regression: clipped board, unreachable CTA, fourth main tab, or
  hidden Practice controls.
- Suggested automated smoke:
  `scripts/browser_mobile_responsive_smoke.mjs`.
- Suggested evidence: viewport, overflow assertions, board bounding box,
  screenshots on failure.
- Relevant docs/tests: `docs/SCREEN_CONTRACTS.md`.
