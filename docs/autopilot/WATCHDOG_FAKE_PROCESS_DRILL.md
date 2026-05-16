# Watchdog Fake Process Drill

A11D adds a fake-process watchdog drill. The drill simulates process health with
runtime files and heartbeat data instead of launching or killing real Codex,
Chrome, or product processes.

## Why This Exists

The watchdog needs proof that it can observe a controller-like process before it
is allowed near live automation. A fake process gives us that proof without
risking a real Codex session, browser session, product mission, or Night Mode
run.

## What It Proves

The fake-process drill proves:

- a healthy fake process can produce a fresh heartbeat;
- a STOP flag can be detected;
- a hung fake process can be represented by a stale heartbeat;
- watchdog status can request a soft stop for stale heartbeat cases;
- rescue packs can be generated from drill runtime evidence;
- the drill can run entirely in external artifact directories.

## What It Does Not Prove

The drill does not prove:

- live Codex process supervision;
- real process termination;
- real Night Mode safety;
- live ChatGPT Web behavior;
- product mission execution;
- backend/frontend safety under live autonomy.

## No Real Process Policy

A11D does not call `Stop-Process` against Codex, Chrome, or any production
process. It does not start real product work. The fake PID is metadata only and
must never be used as a target for production process control.

## Runtime

The drill writes under:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\watchdog_fake_drills\
```

Each scenario has an isolated runtime directory and report directory.

## Scenarios

- Healthy: fresh heartbeat, GREEN watchdog phase, no rescue.
- STOP flag: STOP file detected, graceful stop recommendation, no hard kill.
- Hung process: stale heartbeat, ORANGE or stronger watchdog phase, STOP would
  be written, rescue pack generated.
- Rescue pack: preserves heartbeat, git status, branch, head, diff stat, changed
  files, patch, reason, and post-mortem.

## Preparation For Future Work

After A11D passes, a later mission can drill against a real but disposable fake
subprocess. Live watchdog integration and Night Mode remain disabled until
explicitly approved by later missions.
