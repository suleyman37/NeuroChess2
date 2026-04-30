# V5.3.A4b - Engine Profiles Hardening + Continuous Live Analysis

## Goal

V5.3.A4b separates two engine families:

- LIVE_CONTINUOUS: local analysis of the displayed board, progressive and
  cancellable.
- REVIEW_TIME_BUDGETED: quick/standard/deep Review analyses persisted for
  moments, score and audit.

LIVE never feeds the final Review score and never satisfies standard/deep cache.

## Engine Profiles

Profiles are centralized in `backend/neurochess/engines/engine_profiles.py`.

LIVE_CONTINUOUS:

- `analysis_profile=live_continuous`
- Threads 4
- Hash 512 MB
- MultiPV 1
- `analysis_limit_mode=continuous`
- `UCI_AnalyseMode=true` when exposed
- `UCI_LimitStrength=false` when exposed
- Skill Level kept at max/default when exposed

REVIEW_QUICK:

- Threads 2
- Hash 256 MB
- MultiPV 2
- `analysis_limit_mode=time`
- indicative only

REVIEW_STANDARD:

- Threads 6
- Hash 1024 MB
- MultiPV 3
- `analysis_limit_mode=time`
- score can be reliable only with sufficient coverage

REVIEW_DEEP:

- Threads 8
- Hash 2048 MB
- MultiPV 3
- `analysis_limit_mode=time`
- satisfies standard and deep

## Live Continuous

When the displayed FEN becomes active, the frontend starts a live session. When
the FEN, context or session changes, the previous session is stopped.

The backend live analyzer uses:

```text
engine.analysis(board, chess.engine.Limit(), multipv=1)
```

This is intentionally not a 300-800 ms budget. It runs until the session is
cancelled. If the architecture or engine stops early, the frontend can start a
new session for the next displayed FEN.

Each live update exposes:

- `live_session_id`
- `fen_key`
- `elapsed_ms`
- `depth`
- `nodes`
- `nps`
- `eval_cp` POV White
- `mate_in`
- `best_move_uci`
- `threads`
- `hash_mb`
- `multipv`
- `analysis_profile=live_continuous`
- `analysis_limit_mode=continuous`

The frontend rejects stale updates when:

- `session_id` differs from the current session;
- `fen` differs from the displayed FEN;
- `context` differs from the active board context.

## Review Time-Budgeted

V5.3.A4 budgets are preserved:

Standard total budget:

- `<= 40` half-moves: 80 s
- `41..70`: 140 s
- `71..110`: 220 s
- `> 110`: 300 s

Deep budget:

- `1.5 * standard`
- capped at 450 s

Quick budget:

- `max(20, min(45, 0.7 * half_moves_count))`

Per-position clamp:

- quick: 300-1500 ms
- standard: 1000-10000 ms
- deep: 2000-15000 ms

For standard/deep, Stockfish is called with:

```text
chess.engine.Limit(time=per_position_time_seconds)
```

Depth 12 is not passed as an early stopping limit for standard/deep.

## Cache Quality Gate

The profile hierarchy is:

```text
legacy/null < live_continuous < quick < standard < deep
```

Rules:

- live never satisfies quick/standard/deep;
- legacy/null never satisfies standard/deep;
- quick never satisfies standard/deep;
- standard satisfies standard;
- deep satisfies standard and deep;
- standard does not satisfy deep;
- standard/deep require time-compatible limit mode and requested time.

## Metadata

Review analysis payloads and persisted analysis JSON expose settings when
available:

- `analysis_profile`
- `requested_time_ms`
- `actual_time_ms`
- `requested_depth`
- `achieved_depth`
- `requested_multipv`
- `analysis_limit_mode`
- `threads`
- `hash_mb`
- `uci_analyse_mode`
- `uci_limit_strength`
- `skill_level`
- `syzygy_path_active`
- `nodes`
- `nps`

`settings_json` is updated after analysis with the engine option report.

## UI

The Review summary shows:

- profile;
- completed/required positions;
- budget;
- Threads;
- Hash;
- MultiPV;
- limit mode;
- min/avg/max depth in dev debug.

The evaluation bar shows live details for live-like sources:

- continuous live label;
- depth;
- elapsed seconds;
- Threads;
- Hash;
- limit mode.

Historical board positions may start a live session for the displayed FEN, but
only exact-FEN updates are accepted. Review mode keeps using Review snapshots.

## Manual Checklist

LIVE:

1. Open a position.
2. Verify depth keeps increasing while the position is unchanged.
3. Play or navigate.
4. Verify the old session stops and stale results do not appear.
5. Launch a standard/deep Review and verify live is stopped/suspended.

REVIEW:

1. Launch standard on a game without standard cache.
2. Verify X/Y progress and expected budget.
3. Verify Threads 6, Hash 1024 MB, MultiPV 3, `time`.
4. Verify legacy/depth12 cache is ignored for standard.
5. Reopen after standard cache completion and verify cached response is
   explained.

## Explicit Non-Scope

No V5.3.B, no move categories, no Study Mode, no V6 and no Syzygy Trainer were
started. Optional SyzygyPath is only a safe engine option if
`NEUROCHESS_SYZYGY_PATH` is configured.
