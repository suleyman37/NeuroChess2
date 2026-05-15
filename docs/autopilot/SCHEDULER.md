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

## Distributed Worker Boundary

Only PC1 runs `NeuroChessCodexAutopilot`.

PC2 GPU workers do not install the scheduler by default and must not run product
missions. They serve remote text/vision critic calls through Ollama and return
JSON to PC1.
