# V5.1.3 Real Browser Pending And Engine Audit

## Scope

This audit targets the two manual failures still observed after V5.1.2:

- review can stay on `Analyse approfondie en cours...` for a game of exactly
  10 half-moves;
- the engine unavailable warning can reappear at the start of each new game.

No V5.2 or V6 work is included.

## Browser Reproduction Status

A real browser session could not be observed from this shell: no Playwright or
browser automation harness is configured in the repository, and launching a GUI
browser from PowerShell would not give this agent access to rendered state,
network requests, or console logs.

Fallback reproduction was done through backend/API and React state inspection.

## Scenario A - Review Pending At 10 Half-Moves

### Observed User Flow

1. Create a game.
2. Play exactly 10 half-moves.
3. Finish/abandon the game.
4. Open Review.
5. UI can show `Analyse approfondie en cours...` indefinitely.

### Code Path Before V5.1.3

- `MIN_HALF_MOVES_FOR_REVIEW = 10`.
- Backend used `len(moves) < MIN_HALF_MOVES_FOR_REVIEW`.
- Therefore exactly 10 half-moves was considered reviewable.
- If deep analyses were missing, `POST /review/generate` returned `pending`.
- The frontend polls pending for 60 seconds, but the user-observed browser state
  showed that this path could still feel like an infinite spinner.

### Product Decision

V5.1.3 chooses Option A:

- `half_moves_count <= 10` is too short;
- exactly 10 half-moves returns `not_reviewable`;
- review is available only for games with more than 10 half-moves.

This is intentionally conservative: 5 full moves is not enough for a useful
post-game review.

## Scenario B - Engine Warning At Each New Game

### Possible Sources

The warning can still come from:

- `analysis_engine_unavailable` returned by shallow evaluation in `POST /moves`;
- `live_analysis_unavailable` returned by live start in `POST /moves`;
- SSE `analysis_error`;
- `EventSource.onerror`;
- stale live events from an older session.

### Code Path Before V5.1.3

V5.1.2 added a startup grace period, but the user's manual test shows the issue
is not only application startup. It can happen at the beginning of each new game
or first moves of a new live session.

The correction must therefore be per game/session, not only per page load.

## Required Fix

- Start an engine warmup grace on app load, new game creation, move request, and
  new `live_analysis_session_id`.
- Suppress transient engine warnings during warmup/retry.
- Clear warmup on the first valid shallow or live evaluation.
- Confirm the real warning only after retries fail.
- Ignore stale warning updates from older sessions.

## Pre-Fix Verdict

V5.1.2 was not sufficient for the manual browser behavior. V5.1.3 must address:

- exact 10 half-move games;
- per-game/per-session engine warmup;
- explicit pending timeout instrumentation.
