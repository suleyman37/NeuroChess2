# Watchdog Controller Dry-Run Integration

A11C integrates the A11B watchdog primitives into a controller-style dry-run
simulator. It does not integrate them into the live controller loop.

The purpose is to prove that a controller can:

- write heartbeat files;
- transition through known controller states;
- observe STOP, PAUSE, DRAIN, and KILL flags;
- produce rescue evidence when a stop or stale heartbeat condition appears;
- stop gracefully in simulation;
- avoid ChatGPT, Codex execution, commits, pushes, product work, and real
  process termination.

## Discovery Summary

Existing autopilot scripts include a simple `loop.ps1` that repeatedly invokes
`run_once.ps1`. `run_once.ps1` can perform a non-executing dry run and can run a
task through worktree preparation, execution, checks, critics, and reporting.

There is not yet a dedicated watchdog-aware controller. Therefore A11C creates a
dry-run controller simulator instead of wiring watchdog behavior into live
execution.

Runtime and report conventions already exist:

- external artifacts use `Get-AutopilotArtifactRoot`;
- mutable runtime files are kept out of the repo;
- tests write to external timestamped directories;
- state flags stay disabled until a later integration pilot.

## Simulated States

The dry-run controller simulates these states:

- `IDLE`
- `REQUESTING_PROMPT`
- `VALIDATING_PROMPT_FIREWALL`
- `REGISTERING_MISSION_CONTRACT`
- `EXECUTING_MISSION`
- `RUNNING_POSTCHECKS`
- `CHECKING_CONTRACT_DIFF`
- `COMMITTING`
- `PUSHING`
- `GENERATING_DIGEST`
- `REQUESTING_PULSE`
- `COOLDOWN`
- `STOPPED_GRACEFUL`

Each state transition writes a heartbeat to the temporary runtime directory and
checks stop flags before continuing.

## Stop Flag Handling

Flag decisions:

- `STOP`: `STOP_GRACEFUL`
- `PAUSE`: `PAUSE_AFTER_MISSION`
- `DRAIN`: `DRAIN_SESSION`
- `KILL`: `KILL_REQUESTED`

`KILL_REQUESTED` is detection only. No real process is killed in A11C.

## Rescue Pack Dry Run

If a scenario reaches a stop condition or stale heartbeat, the dry-run controller
creates a rescue pack through the A11B rescue builder. The pack preserves:

- heartbeat;
- simulated state;
- git status;
- diff stat;
- changed files;
- reason;
- post-mortem notes.

The rescue path never runs `git stash`, `git reset`, `git clean`, branch
deletion, push, or process termination.

## What Remains Not Integrated

Still not integrated:

- live controller loop watchdog heartbeats;
- real Night Mode;
- real Codex process observation;
- real process termination;
- live ChatGPT Web supervision;
- product mission execution;
- backend/frontend scopes.

Live watchdog behavior remains disabled in `ops/autopilot/state.json`.

## Preparation For A11D

A11C prepares A11D by proving the controller shape with fake state transitions.
A11D can drill against a fake process or fake long-running operation without
touching product work or real Codex processes.
