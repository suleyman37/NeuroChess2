# Watchdog Dry-Run Drill Results

A11C defines the expected drill results for the watchdog controller dry-run
simulator.

The drill is offline only. It must not run Night Mode, call ChatGPT Web, execute
Codex, commit, push, kill a process, or modify product files.

## Clean Scenario

Expected:

- controller transitions through all simulated states;
- heartbeat files are written to a temp/external runtime directory;
- no stop flags are detected;
- final decision is `COMPLETED_DRY_RUN`;
- no rescue pack is required.

Required artifacts:

- `dryrun_session_report.json`;
- `dryrun_session_report.md`;
- `runtime/heartbeat.json`.

## STOP Flag Scenario

Expected:

- controller detects `STOP`;
- decision is `STOP_GRACEFUL`;
- rescue pack is written;
- no real process stop occurs.

Required artifacts:

- session report;
- heartbeat;
- rescue pack with git status, diff stat, changed files, heartbeat, reason, and
  post-mortem.

## DRAIN Flag Scenario

Expected:

- controller detects `DRAIN`;
- decision is `DRAIN_SESSION`;
- rescue pack or final session report is written;
- no new mission begins after the current simulated boundary.

## PAUSE Flag Scenario

Expected:

- state transition detects `PAUSE`;
- decision is `PAUSE_AFTER_MISSION`;
- no new mission would start in a live controller.

## KILL Flag Scenario

Expected:

- state transition detects `KILL`;
- decision is `KILL_REQUESTED`;
- no real process kill occurs.

## Stale Heartbeat Scenario

Expected:

- controller detects BLACK watchdog status from a stale heartbeat;
- action is `FORCE_KILL_DRY_RUN`;
- rescue pack is written;
- no real process kill occurs.

## A11C Result Requirement

`ops/autopilot/test_watchdog_controller_dryrun.ps1` must pass before
`watchdog_controller_dryrun_passed` may be set to `true`.
