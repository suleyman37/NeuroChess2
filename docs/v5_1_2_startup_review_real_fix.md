# V5.1.2 Startup Warning And Short Review Real Fix

## Goal

V5.1.2 fixes two UX bugs that were still observable manually after V5.1.1:

- transient startup engine failures could still appear as a yellow unavailable
  warning;
- very short finished games could still display an endless review spinner.

No V6 feature, opening learning feature, engine formula change, Stockfish change,
`cp_loss` change or `importance_score` change is included.

## Cause - Short Game Spinner

`POST /games/{game_id}/review/generate` already rejected short games with a
`not_reviewable` payload.

The remaining bug was in `GET /games/{game_id}/review`: if an old
`game_reviews` row already existed with status `pending`, the service returned
that stale pending review before applying the short-game guard. The frontend
then kept polling a review that could never become valid.

There was also a render-priority issue: `ReviewPanel` rendered `loading` before
checking `review.status === "not_reviewable"`, so a valid short-game payload
could still be visually hidden behind the spinner while loading was true.

## Fix - Short Game Review

For completed games with fewer than `MIN_HALF_MOVES_FOR_REVIEW` half-moves:

- `POST /review/generate` returns `status="not_reviewable"`;
- `GET /review` returns `status="not_reviewable"` before looking at any stored
  review row;
- stale `pending` rows are ignored for short games;
- `ReviewPanel` renders `not_reviewable` before `loading`;
- polling stops as soon as `not_reviewable` is received.

The user-facing message is:

`Partie trop courte pour générer une review fiable.`

## Cause - Startup Engine Warning

V5.1.1 handled live-analysis startup failures with retry/grace state, but a
startup warning could still arrive through the normal `POST /moves` payload:

- shallow evaluation can return `analysis_engine_unavailable`;
- live start from the move response can return `live_analysis_unavailable`;
- those warnings were rendered from `warnings` before the live retry state had
  activated.

That explains the manual symptom: a yellow warning can flash early, then vanish
once Stockfish is ready.

## Fix - Startup Engine Warning

The frontend now has a startup engine grace window that also covers
`POST /moves` warnings:

- startup grace lasts `3500 ms`;
- board evaluation retries are `500 ms`, `1500 ms`, then `3000 ms`;
- during grace/retry, engine-unavailable warnings are filtered from the yellow
  warning block;
- if a warning exists during grace, the UI can show the discrete state
  `Initialisation du moteur...`;
- a successful shallow or live evaluation clears stale engine warnings and the
  transient startup state;
- if the engine stays unavailable after retries and no valid evaluation exists,
  the real warning remains visible.

The existing warning is not removed. It is delayed until the failure is likely
to be real.

## Instrumentation

Dev-only logs were added with `console.debug` behind `import.meta.env.DEV`:

- `engine_warning_received`;
- `engine_warning_suppressed_startup`;
- `engine_warning_confirmed_unavailable`;
- `live_update_success_clears_warning`;
- `shallow_update_success_clears_warning`;
- `review_poll_started`;
- `review_poll_stopped`;
- `review_not_reviewable_received`.

They are meant for browser reproduction and do not change production UI.

## Manual Test Protocol

### Startup engine warning

1. Stop backend and frontend.
2. Start backend.
3. Start frontend.
4. Open the app immediately.
5. Create or open a game and play a move quickly.
6. Expected: no persistent yellow `Moteur d'analyse indisponible` warning if
   the engine becomes ready shortly after startup.
7. Expected: either no message or a discrete `Initialisation du moteur...`.
8. Expected: after a valid shallow/live update, obsolete engine warnings are
   gone.

### Short game review

1. Create a game.
2. Play fewer than 10 half-moves.
3. Finish the game.
4. Open Review.
5. Expected: `Partie trop courte pour générer une review fiable.`
6. Expected: no `Analyse approfondie en cours...` spinner.
7. Expected: no polling loop.

### Normal review

1. Play at least 10 half-moves.
2. Finish the game.
3. Generate review.
4. Expected: normal pending/partial/done behavior remains available.

## Test Status

Manual browser execution is not available from this shell because no browser
automation harness is configured and the agent cannot inspect a GUI browser
started from PowerShell.

The fallback validation is:

- API/unit test for short game `POST`;
- API/unit test for short game `GET`;
- regression test for stale pending row ignored by `GET`;
- static React tests for no yellow startup warning before grace/retry expires;
- static React tests for `not_reviewable` render priority and polling logs;
- frontend production build.

## Remaining Limit

The final visual confirmation still needs a human browser pass. The code path
now explicitly covers the two manual failure sources identified above.
