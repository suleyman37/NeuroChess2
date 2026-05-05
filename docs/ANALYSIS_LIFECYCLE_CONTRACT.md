# Analysis Lifecycle Contract

Mission source: `P0.REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1`.

Plan1, Plan2, and Plan3 remain authoritative. This contract only stabilizes the
runtime behavior for Review analysis jobs and lightweight board live analysis.

## Review Analysis Modes

- `standard_review`: durable Review analysis used to build Review, moments and
  Practice.
- `deep_review`: durable deeper Review analysis when explicitly requested.
- `live_analysis`: lightweight, non-durable board-position analysis for the
  currently displayed FEN in allowed contexts.

## Review Job Statuses

Frontend and backend must handle:

- `queued`
- `running`
- `finalizing`
- `stalled`
- `completed`
- `completed_with_warnings`
- `partial`
- `failed`
- `failed_recoverable`
- `failed_final`
- `cancelled`
- `incomplete`

V1 accepts legacy `failed`, `stalled`, and `incomplete` payloads as
recoverable/final UI states when the payload exposes retry or recovery copy.

## Frontend Analysis UI States

- `idle`
- `starting`
- `running`
- `slow`
- `stalled_resumable`
- `partial_ready`
- `done`
- `failed_recoverable`
- `failed_final`

## Hard Rules

1. No infinite spinner.
2. No analysis timer without status/progress.
3. Every Review job must reach a terminal or recoverable state.
4. Stale `queued`, `running`, or `finalizing` jobs must become retryable
   `stalled`/recoverable payloads.
5. Frontend polling tracks `job_id`, status, phase and progress.
6. Frontend polling stops on terminal or recoverable states.
7. Frontend polling has a no-progress watchdog; if progress does not change, it
   shows a recoverable state instead of spinning forever.
8. If the backend says completed, the frontend fetches Review.
9. If Review fetch fails after a completed job, the frontend shows a Review
   incomplete/retry state.
10. If a job is stalled, the UI shows `Reprendre`.
11. Debug details stay collapsed by default.
12. Recovery copy must not duplicate `Vous pouvez reprendre l'analyse.`
13. Live analysis pauses while `standard_review` or `deep_review` is running.

## Live Analysis V1 Contract

Definition: live analysis is a lightweight, non-Review, non-training,
low-priority analysis of the board position currently displayed.

Allowed contexts:

- Review static board.
- Review local exploration.
- Game replay board if a safe board context exists.
- Future sandbox only when explicitly implemented by a later mission.

Forbidden/hidden contexts:

- Active Practice challenge before attempt.
- Active Practice challenge before reveal.
- Any screen where live eval or best move would reveal the answer.
- While standard/deep Review analysis is running.

Behavior:

- Live analysis runs automatically for the current displayed FEN in allowed
  contexts.
- Requests are tied to FEN and obsolete responses are ignored by the frontend.
- `POST /live-analysis/start` may return an immediate `latest_payload` so the
  UI can display live state before the SSE stream receives its first event.
- Standard/deep Review jobs have priority; live analysis stops/pauses during
  them.
- Live analysis does not create Review jobs, Review moments, training items,
  Practice attempts, `due_at`, `learning_summary`, or NeuroScore.
- Live analysis must not write strict Review/deep cache entries.
- Live analysis must not block the UI.
- If unavailable, the UI shows small non-blocking copy:
  `analyse live indisponible`.
- If paused by Review, the UI shows:
  `Analyse live en pause pendant la Review`.
- If hidden by Practice, the UI shows no live eval or best move spoiler.

Display:

- V1 may show a compact eval strip and best move only in allowed contexts.
- Practice challenge hides/pauses live analysis before the user attempts or
  reveals the position.
- Raw WDL, debug internals, cache keys, and raw metric values are not visible in
  normal UI.

## QA Evidence

- `backend/tests/test_review_jobs.py` includes stale queued job materialization.
- `backend/tests/test_game_api.py` verifies live analysis start does not create
  Review/training/Practice rows.
- `backend/tests/test_frontend_review_analysis_live_static.py` verifies the
  frontend watchdog, live pause copy, Practice no-spoiler guard, and browser
  smoke coverage.
- `scripts/browser_review_analysis_from_ui_no_infinite_timer_smoke.mjs` proves
  UI-started Review analysis reaches terminal/recoverable state under a hard
  deadline.
- `scripts/browser_live_analysis_default_smoke.mjs` proves live analysis appears
  on Review board and updates after local exploration.
- `scripts/browser_live_analysis_pauses_during_review_smoke.mjs` proves live
  analysis pauses during a standard Review job.
- `scripts/browser_practice_no_live_spoiler_smoke.mjs` proves live analysis is
  hidden before active Practice attempts.

## Remaining Risks

- The browser smokes use temp DB and fake engine by default; they guard the
  runtime contract but do not mutate the user's real local DB.
- Real Stockfish availability still depends on local engine configuration.
- Live analysis is lightweight and must never be treated as durable Review
  analysis.
