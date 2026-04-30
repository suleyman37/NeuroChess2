# V5.1.2 Manual Reproduction Audit

## Scope

This audit was written before the V5.1.2 fix. The goal is to identify why two
manual browser issues can still happen after V5.1.1:

- a yellow engine unavailable warning can appear during startup;
- a very short finished game can still show an endless review pending state.

No V6 feature is part of this audit.

## Manual Browser Reproduction

Manual browser interaction could not be executed from this shell: there is no
configured browser automation harness in the repository, and opening a browser
window from the terminal would not let this agent observe the rendered UI,
console, or network panel.

Fallback reproduction was done with code inspection plus API/UI state analysis.
The two user-observed failures are reproducible from the current control flow.

## Test A - Startup Engine Warning

### Possible warning sources

The yellow warning can come from two frontend states in `frontend/src/App.tsx`:

1. `warnings`, rendered through `visibleWarnings`;
2. `liveStatus`, rendered as a `.warning`.

Backend warning codes can be produced by:

- `analysis_engine_unavailable` from shallow evaluation in
  `POST /games/{game_id}/moves`;
- `live_analysis_unavailable` from `_try_start_live_analysis()` in
  `POST /games/{game_id}/moves`;
- live SSE `analysis_error` or an `EventSource.onerror` in the frontend.

### Current V5.1.1 behavior

The live-analysis path already schedules retries and sets a discrete
`Initialisation du moteur...` state before showing `analyse live indisponible`.

The gap is the `POST /moves` shallow/live warning path. If the API response
contains `analysis_engine_unavailable` before a live retry has activated
`engineWarningGraceActive`, `visibleWarnings` can still render the yellow
warning immediately when no evaluation is visible yet.

This matches the manual symptom: a warning appears briefly at the beginning,
then disappears after the engine succeeds.

### Expected correction

Startup/transient warning suppression must apply to both:

- live-analysis failures;
- shallow warnings returned by `POST /moves`.

The warning should become definitive only after the startup grace/retry window.
Any successful shallow or live evaluation must clear obsolete engine warnings.

## Test B - Short Game Review Spinner

### Current backend behavior

`POST /games/{game_id}/review/generate` already rejects short games with a
`not_reviewable` payload.

`GET /games/{game_id}/review` only returns `not_reviewable` when no current
review exists. If an old `game_reviews` row exists with status `pending`, the
GET path returns that pending review before checking the short-game guard.

This means a stale pending review can still make the frontend poll forever on a
game that is too short to review.

### Current frontend behavior

`ReviewPanel` renders `loading` before checking `review.status ===
"not_reviewable"`. If `reviewLoading` remains true while a `not_reviewable`
payload is already available, the spinner can still win the render priority.

The polling loop stops on `not_reviewable`, but it depends on the backend never
returning stale `pending` for short games.

### Expected correction

For completed games with fewer than `MIN_REVIEW_HALF_MOVES`:

- `POST /review/generate` must never return `pending`;
- `GET /review` must never return `pending`, even if an old pending row exists;
- `ReviewPanel` must render `not_reviewable` before any spinner state;
- polling must stop immediately on `not_reviewable`.

## Instrumentation Needed

Non-intrusive dev logs should make future manual checks easier:

- `engine_warning_received`;
- `engine_warning_suppressed_startup`;
- `engine_warning_confirmed_unavailable`;
- `live_update_success_clears_warning`;
- `review_poll_started`;
- `review_poll_stopped`;
- `review_not_reviewable_received`.

These logs should be gated behind `import.meta.env.DEV` and should not affect
production UI.

## Pre-Fix Verdict

V5.1.1 was partial. It covered the clean path, but not:

- startup warnings arriving through `POST /moves` before live retry state exists;
- stale pending review rows on short games;
- render priority where `loading` can hide `not_reviewable`.
