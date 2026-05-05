# Core Interaction Contract

Mission source: `P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1`.

This document defines the V1 browser interaction contract for the chessboard,
Review, Practice, and Daily Plan Practice. Plan1, Plan2, and Plan3 remain
authoritative.

## Board V1 Contract

- The board renders from a valid FEN.
- Invalid or missing FEN must not crash the app; it may render the start board
  or a safe empty/degraded state.
- Board orientation follows the active context:
  - Review/Practice for black uses black orientation.
  - Review/Practice for white uses white orientation.
  - Unknown context falls back to white.
- The board supports two V1 input methods when enabled:
  - click source square, then click target square;
  - drag/drop source to target when the browser/library supports it.
- Selecting a piece highlights the selected square and legal targets.
- Clicking the same square deselects.
- Clicking another own turn piece changes selection.
- Illegal target clicks must not crash. They are sent through the normal attempt
  path so the backend can return `illegal` feedback safely.
- Drag cancel or illegal drag returns the piece to the original square.
- The board exposes stable selectors for QA:
  - `review-board`
  - `practice-board`
  - `game-board`

## Review Board Contract

- Review board displays the selected Review position.
- Selecting a Review moment updates the board state.
- Review next/previous controls may move the board between positions.
- Passive Review board is not a full free-play game.
- Review remains contextual and is not a permanent main navigation tab.

## Review Local Exploration Mode - V1

- Review board can enter local exploration mode from the currently selected
  Review position.
- Local exploration means:
  - the user can play legal chess moves for both sides from that position;
  - no engine analysis is required;
  - no AI reply is generated;
  - no opponent exists;
  - no move is saved as a Practice attempt;
  - no score is modified;
  - no Review data is modified;
  - no Daily Plan data is modified.
- User-facing label: `Exploration locale`.
- User-facing copy must make the separation explicit:
  `Tu peux tester des coups. Rien n'est enregistre comme exercice.`
- Allowed controls:
  - `Explorer la position`
  - `Annuler le coup`
  - `Reinitialiser`
  - `Quitter l'exploration`
- Illegal moves are rejected calmly with:
  `Ce coup n'est pas legal dans cette position.`
- Promotion defaults to queen in V1 if no promotion picker exists.
- Switching Review moment exits/reset local exploration to avoid mixing states.
- Exploration mode must never call the Practice attempt endpoint and must never
  create `due_at` or update `learning_summary`.

## Practice Board Contract

- Practice item displays the item `fen_before`.
- The user can attempt a move before correction.
- Correct move produces backend-authored success feedback.
- Wrong legal move produces backend-authored wrong feedback.
- Illegal move produces calm illegal feedback or a safe rejection.
- Reveal/correction remains available as fallback.
- Attempts are persisted by the backend with enriched V1 fields:
  - `session_id`
  - `item_id`
  - `attempted_uci`
  - `attempted_san`
  - `result`
  - `time_spent_ms`
  - `hint_used`
  - `reveal_used`
  - `source_context`
  - `due_at`
- `simple_spaced_repetition_v1` scheduling must remain active.
- `learning_summary` updates after attempts.

## Daily Plan Practice Contract

- Daily Plan can create/open Practice through `POST /api/training/daily-plan/practice`.
- Daily Plan items use `item_id = training_item:{id}`.
- User can attempt a move on a Daily Plan item through the board.
- Daily Plan attempts persist with `source_context = daily_plan` or an equivalent
  backend context.
- Daily Plan must not use SkillTrace in V1.
- Daily Plan must not expose `selection_score`, ETV, FSRS, or mastery scores in
  normal UI.

## Analysis Stall / Recovery Contract

- A failed, incomplete, or stalled Review job must show one clear recovery path.
- Stale `queued`, `running`, or `finalizing` jobs must become terminal or
  recoverable; the frontend must not spin forever with only a timer.
- Frontend polling tracks `job_id`, progress, status, and phase, and has a
  no-progress watchdog that turns a frozen active job into a recoverable UI
  state.
- The retry copy must not be duplicated when the backend message already says:
  `Vous pouvez reprendre l'analyse.`
- A retryable job must expose a `Reprendre` action.
- Timeout/failure evidence must not be cached as strict-valid analysis.
- Retry/recovery should complete if only one controlled timeout/failure was
  injected and the remaining analyses are available.

## Live Analysis Board Contract

- Live analysis is a lightweight analysis of the current displayed board FEN.
- It is enabled by default on the Review static board and Review local
  exploration, including Review positions rendered through historical/replay
  board state.
- The first live update may be applied from `/live-analysis/start.latest_payload`
  before the SSE stream emits, so the Review board does not remain on a stale
  stable snapshot while live analysis is active.
- It pauses while a standard/deep Review job is active and may show:
  `Analyse live en pause pendant la Review`.
- It is hidden/paused during active Practice before attempt/reveal so the user
  can try before seeing a solution.
- Live analysis must not create Practice attempts, `due_at`, training items,
  Review moments, or learning summary updates.
- Live analysis is not AI play, not an opponent, and not durable Review
  analysis.

## Non-Goals

- Full free-play game mode is not this contract.
- AI opponent is not this contract.
- Multiplayer is not V1.
- Candidate Trainer is not V1.
- Deep Intent Layer is not V1.
- LLM coach is not V1.
- NeuroMonitor/brain/cortex/atlas/Cognitive Map visuals are not V1.

## QA Evidence

- `scripts/browser_core_board_interaction_smoke.mjs`: PASS on 2026-05-04.
  Proves real browser click-click board attempts for:
  - correct move from Review Practice;
  - wrong legal move from Review Practice;
  - illegal move from Review Practice;
  - reveal fallback;
  - correct move from Daily Plan Practice;
  - exported persisted attempts;
  - `learning_summary.practice_event_count = 5`.
- `scripts/browser_analysis_stall_recovery_smoke.mjs`: PASS on 2026-05-04.
  Proves controlled fake-engine timeout/failure, one retry copy in UI, `Reprendre`
  recovery, and Review completion after retry.
- `scripts/browser_review_exploration_real_smoke.mjs`: PASS on 2026-05-04.
  Proves Review `Exploration locale` with a real click-click move, board FEN
  change, undo, reset, calm illegal move feedback, no Practice attempt during
  exploration, then a separate Review Practice attempt with `due_at`.
- `scripts/browser_real_analysis_no_infinite_loop_smoke.mjs`: PASS on
  2026-05-04. Proves a browser-restored Review job reaches terminal/recoverable
  state under a hard 90s deadline; latest evidence observed `queued -> running
  -> completed` and `0/13 -> 12/13 -> 13/13`.
- `scripts/browser_review_analysis_from_ui_no_infinite_timer_smoke.mjs`: added
  in P0 live-analysis mission. Proves a UI-started Review analysis reaches a
  terminal/recoverable state under a hard deadline.
- `scripts/browser_live_analysis_default_smoke.mjs`: added in P0 live-analysis
  mission. Proves live analysis appears on Review board and updates after local
  exploration.
- `scripts/browser_live_analysis_pauses_during_review_smoke.mjs`: added in P0
  live-analysis mission. Proves live analysis pauses during Review job.
- `scripts/browser_practice_no_live_spoiler_smoke.mjs`: added in P0
  live-analysis mission. Proves Practice hides live eval/best-move spoilers
  before attempt.
- Backend contract tests:
  - `backend/tests/test_core_board_practice_contract.py`
  - `backend/tests/test_engine_config.py`
  - `backend/tests/test_frontend_core_board_interaction_static.py`
