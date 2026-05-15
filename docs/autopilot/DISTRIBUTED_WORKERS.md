# Distributed GPU Critic Workers

AgentOS supports a two-PC architecture:

- PC1: executor. Runs Codex, Git, the scheduler, worktrees, commits, pushes, and
  deterministic checks.
- PC2: GPU critic worker. Runs Ollama for text and vision criticism only.

PC2 must not commit, push, modify `road-to-V2`, create product branches, or run
product missions. It only receives diff/log/screenshot material from PC1 and
returns JSON critic verdicts.

## Install PC2

On PC2, open PowerShell and run from any checkout or copied script location:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/bootstrap_gpu_worker.ps1
```

Optional model pull:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/bootstrap_gpu_worker.ps1 -PullModels
```

Optional LAN firewall opening for Ollama, only when you understand the network
exposure:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/bootstrap_gpu_worker.ps1 -AllowLanOllama
```

The bootstrap script:

- creates `C:\Users\$env:USERNAME\Documents\Dev`;
- installs Git, Node LTS, Python 3.12, and Ollama through winget when absent;
- clones the repo into `NeuroChess2_worker`;
- checks out `road-to-V2`;
- installs frontend dependencies;
- creates `.venv`;
- installs root `requirements.txt` if present;
- disables Git push URL for worker safety;
- writes setup report to
  `C:\Users\$env:USERNAME\Documents\Dev\NeuroChess_QA_Artifacts\worker_setup\setup_report.txt`.

## Register PC2 From PC1

On PC1:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/register_worker_endpoint.ps1 -WorkerName gpu_worker -HostOrIp 192.168.1.50
```

This updates `ops/autopilot/workers.yaml` with:

- role `critic_worker`;
- `can_push: false`;
- `can_commit: false`;
- `can_modify_repo: false`;
- Ollama URL `http://<host>:11434`.

Then test:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/test_remote_worker.ps1
```

## Runtime Flow

1. PC1 executes a queue mission in a worktree.
2. PC1 writes diff, logs, reports, and screenshots under external QA artifacts.
3. PC1 calls `run_remote_text_critic.ps1` and/or
   `run_remote_vision_critic.ps1`.
4. PC2 answers with strict JSON.
5. PC1 decides promotion or quarantine according to `policies.yaml`.

## Security

- Keep Ollama LAN-only.
- Do not expose Ollama to the public Internet.
- Restrict firewall access to the local subnet only if required.
- Do not configure GitHub self-hosted runners for the public repo.
- Do not store secrets in workers.yaml, logs, prompts, or reports.
- Do not push from PC2.

## Remote Critic Commands

Text:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_remote_text_critic.ps1
```

Vision:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_remote_vision_critic.ps1 -ScreenshotsDir C:\path\to\screenshots
```

If PC2 is not registered, offline, or missing a model, the scripts return
`critic_unavailable` instead of crashing.
