# NeuroChess AgentOS Autopilot

AgentOS is the repo-native automation layer for NeuroChess micro-missions.

It is intentionally small:

- queue: `ops/autopilot/queue.yaml`
- policy: `ops/autopilot/policies.yaml`
- runtime logs: external QA artifact root
- scheduler: local Windows Scheduled Task
- worktrees: `C:\Users\suley\Documents\Dev\NeuroChess2_worktrees`

## One Cycle

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/run_once.ps1
```

One cycle selects one runnable queue item, prepares a worktree, executes it,
runs checks and critics, writes a report, then exits.

## Local Scheduler

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/install_scheduler.ps1
```

The scheduler is the primary mechanism because the GitHub repository is public
unless a private mirror is explicitly proven.

## Safety Defaults

- No `git add -A`.
- No `.serena/project.yml`.
- No `.venv/`.
- No repo-local QA artifacts.
- No public self-hosted runner.
- `write_sensitive` tasks quarantine.
