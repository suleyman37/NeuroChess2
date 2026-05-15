# NeuroChess AgentOS Autopilot

AgentOS is the repo-native automation layer for NeuroChess micro-missions.

It is intentionally small:

- queue: `ops/autopilot/queue.yaml`
- policy: `ops/autopilot/policies.yaml`
- runtime logs: external QA artifact root
- scheduler: local Windows Scheduled Task
- worktrees: `C:\Users\suley\Documents\Dev\NeuroChess2_worktrees`
- optional GPU critic worker: `ops/autopilot/workers.yaml`

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

## Distributed Critics

AgentOS can use a second Windows PC as a GPU critic worker. The main PC remains
the only executor that can modify, commit, and push. The worker only runs Ollama
text/vision critics over LAN and returns JSON verdicts.

Setup flow:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/register_worker_endpoint.ps1 -WorkerName gpu_worker -HostOrIp 192.168.1.50
powershell -ExecutionPolicy Bypass -File ops/autopilot/test_remote_worker.ps1
```

If the worker is not registered or offline, remote critics return
`critic_unavailable` and deterministic checks remain authoritative for safe
docs/tooling tasks.

## Safety Defaults

- No `git add -A`.
- No `.serena/project.yml`.
- No `.venv/`.
- No repo-local QA artifacts.
- No public self-hosted runner.
- `write_sensitive` tasks quarantine.
- PC2 critic workers cannot commit, push, or run the scheduler.
