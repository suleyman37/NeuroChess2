# V5.3.A4b - Engine Profiles + Live Continuous Audit

## Scope

This audit covers the engine boundary after V5.3.A4. It separates:

- LIVE_CONTINUOUS: ephemeral, cancellable analysis for the displayed board.
- REVIEW_QUICK / REVIEW_STANDARD / REVIEW_DEEP: persisted, time-budgeted
  post-game analysis used by Review, score and moment selection.

No V5.3.B, V6, Study Mode, move categories or Syzygy Trainer were started.

## Findings

### Stockfish instantiation

`StockfishService` owns one `python-chess` `SimpleEngine` instance guarded by a
lock. Live analysis uses its own short-lived `SimpleEngine` per live session in
`StockfishLiveAnalyzer`.

### Engine options before A4b

Before A4b, normal Review/live paths did not consistently apply or expose:

- `Threads`
- `Hash`
- `UCI_AnalyseMode`
- `UCI_LimitStrength`
- `Skill Level`
- optional `SyzygyPath`

Calibration reported some engine options, but Review payloads could mostly show
only a profile label, MultiPV and limit mode.

### Review standard/deep limit mode

V5.3.A4 already created Review analyses with:

- `analysis_profile=standard|deep`
- `analysis_limit_mode=time`
- `requested_depth=None`
- `requested_time_ms=per_position_time_ms`

`AnalysisService._call_engine` only passes `min_depth` when
`analysis_limit_mode != "time"`, so standard/deep are not limited by depth 12.
`StockfishService.analyze_stabilized_fen` uses `chess.engine.Limit(time=...)`
for `limit_mode="time"`.

### MultiPV before A4b

The Review rows requested MultiPV 3, but stabilized streaming was still called
with `multipv=1`. A4b fixes this by passing the requested MultiPV to
`engine.analysis(...)` and keeping the rank-1 line as the canonical stabilized
score.

### Live before A4b

`live_analysis_service.py` used `LIVE_ANALYSIS_MAX_SECONDS = 30.0` and
`chess.engine.Limit(time=self.max_seconds)`. That was a bounded live search, not
a continuous analysis that runs until the displayed FEN changes.

The frontend already had strong stale-result guards:

- `session_id` must match the current live session.
- `update.fen` must match the displayed board FEN.
- `update.context` must match the current board context.

### Storage contamination

Live updates are ephemeral SSE payloads. They are not inserted into
`position_analyses`, so they do not pollute Review cache. A4b also marks live
payloads with `analysis_profile=live_continuous` and `analysis_limit_mode=continuous`.

### Concurrency

Before A4b, route-level code stopped game live sessions before starting a new
game live session. A4b also makes `LiveAnalysisService.start_session()` stop
all running live sessions before starting another one. Standard/deep Review
generation stops live sessions for that game before scheduling heavy work.

## Root Cause

The main gap was semantic: live was implemented like a bounded analysis request,
while the product expectation is a local continuous search that improves until
the position changes. Review standard/deep were mostly time-budgeted already,
but engine settings and MultiPV application were not fully auditable.

## Outcome

A4b hardens the engine boundary:

- LIVE is continuous, cancellable and stale-protected.
- Review standard/deep remain time-only and profile-gated.
- Live/shallow/legacy cannot satisfy standard/deep cache quality.
- Engine settings are applied and exposed where available.
