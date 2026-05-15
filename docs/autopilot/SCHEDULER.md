# Scheduler

The primary runner is a local Windows Scheduled Task:

```text
NeuroChessCodexAutopilot
```

Install:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/install_scheduler.ps1
```

Run once manually:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/run_once.ps1
```

Fallback loop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/loop.ps1
```

The scheduled task runs one queue item and exits. It is designed for a fast
cadence without a fragile long-running process.
