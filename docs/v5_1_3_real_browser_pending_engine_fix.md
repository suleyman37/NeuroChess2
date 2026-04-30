# V5.1.3 Real Browser Pending And Engine Fix

## Summary

V5.1.3 fixes the remaining review pending loop and per-game engine warning
issues without starting V5.2 or V6.

## Review Policy

Decision: Option A.

- `MIN_HALF_MOVES_FOR_REVIEW = 10` remains the threshold constant.
- A game is reviewable only when `half_moves_count > 10`.
- `half_moves_count <= 10` returns `status="not_reviewable"`.

The user-facing message remains:

`Partie trop courte pour générer une review fiable.`

## Backend Review Fix

`POST /games/{game_id}/review/generate` and
`GET /games/{game_id}/review` now apply the short-game guard with
`<= MIN_HALF_MOVES_FOR_REVIEW`.

The guard has priority over any stored `game_review`, including stale
`pending` rows. Therefore a game considered too short cannot return `pending`.

When a game is reviewable but deep analyses are missing, the pending payload now
also includes:

- `missing_deep_count`;
- `total_required_deep_count`;
- a message describing the remaining deep positions.

## Frontend Review Fix

The Review button is gated with:

`moves.length > MIN_REVIEW_HALF_MOVES`

`ReviewPanel` keeps `not_reviewable` above `loading`, so the short-game message
cannot be hidden by a spinner.

Pending still polls for at most 60 seconds. If it remains pending after that,
the UI shows:

`L’analyse prend plus de temps que prévu. Réessayez plus tard.`

Dev logs were added:

- `review_pending_received`;
- `review_pending_timeout`;
- `review_not_reviewable_received`;
- `review_missing_deep_count`;
- `review_poll_started`;
- `review_poll_stopped`.

## Engine Warmup Fix

The old startup-only grace is now a per-game/session warmup grace.

Warmup starts on:

- app startup;
- new game request;
- game id change;
- move request;
- new live analysis session.

During warmup, transient engine warnings are filtered from the yellow warning
block and the UI can show only:

`Initialisation du moteur...`

Retries are:

- 500 ms;
- 1500 ms;
- 3000 ms;
- 5000 ms.

Warmup is cleared by:

- a valid shallow evaluation;
- a valid live update.

If retries are exhausted and no valid evaluation exists, the real warning is
shown.

Dev logs were added:

- `engine_warmup_started_for_game`;
- `engine_warmup_warning_suppressed`;
- `engine_warmup_cleared_by_shallow`;
- `engine_warmup_cleared_by_live`;
- `engine_warning_confirmed_after_retries`;
- `stale_engine_warning_ignored`.

## Manual Test Protocol

### Review at 10 half-moves

1. Create a game.
2. Play exactly 10 half-moves.
3. Finish the game.
4. Open Review.
5. Expected: `Partie trop courte pour générer une review fiable.`
6. Expected: no `Analyse approfondie en cours...` spinner.

### Review above 10 half-moves

1. Play more than 10 half-moves.
2. Finish the game.
3. Generate review.
4. Expected: normal pending/partial/done flow.
5. If pending lasts too long: timeout message, not infinite spinner.

### Engine warning per new game

1. Open the app.
2. Create a new game.
3. Play the first move quickly.
4. Expected: no persistent yellow engine unavailable warning if the engine
   becomes ready during warmup.
5. Create a second game and repeat.
6. Expected: same warmup behavior applies again.

## Browser Status

The shell still cannot observe a real browser because no browser automation
harness is configured. The code is instrumented to make the next manual browser
pass easier to diagnose.

## Scope Confirmation

No Stockfish behavior, evaluation formula, `cp_loss`, `importance_score`,
opening book, opening classification, shallow/deep/live/calibration semantics,
V5.2, or V6 work was changed.
