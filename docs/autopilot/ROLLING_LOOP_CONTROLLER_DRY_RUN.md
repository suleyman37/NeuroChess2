# Rolling Loop Controller Dry Run

A18 proves the local Rolling Loop Controller can repeatedly process simulated
mission proposals through deterministic Control Plane gates without running
Night Mode live.

This is different from A17 because A17 proved one integrated lifecycle. A18
proves queue behavior: mission proposal, skill selection, NC-MP/2 lint,
Mission Contract, Shadow Plan, Product Gate, Mission Hash, Goldilocks, simulated
result, E2E score, Forward Progress, Prompt Ledger, phase transition, and the
next loop decision.

The dry run is fixture-only. It does not call ChatGPT, Gemini, Codex product
execution, live Night Mode, or live rolling-loop automation. Runtime state is
created under a temp directory and reports are written outside the repo.

A18 prepares A18B by proving the local controller can stop deterministically for
repeat hashes, no progress, red-tier scope, rollover, and low product value
before any live bridge is involved.
