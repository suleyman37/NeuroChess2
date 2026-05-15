# Local And Remote Models

Local and remote models are critics, not primary executors.

## Text Critic

Primary target:

- provider: Ollama
- model: `gpt-oss:20b`
- job: inspect diff, logs, scope, forbidden changes, and promotion risk

Remote GPU worker candidates:

- `qwen2.5-coder:14b`
- `qwen2.5-coder:7b`
- `llama3.1:8b`
- `gpt-oss:20b` if already available

Fallback:

- deterministic checks only
- verdict records `critic_unavailable`

## Vision Critic

Primary target:

- provider: Ollama
- model: `qwen2.5vl:7b`
- job: inspect screenshots for layout, copy, RPG cheapness, and visual
  regressions

Remote GPU worker candidates:

- `qwen2.5vl:7b`
- `llava:7b`

Fallback:

- no-op pass for non-UI tasks without screenshots
- soft fail or quarantine for UI tasks when screenshots exist but the model is
  unavailable

## Install

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/install_local_stack.ps1
```

Model pulls are intentionally optional because they are large. Use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/install_local_stack.ps1 -PullModels
```

## PC2 GPU Worker

For a second PC, use:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/bootstrap_gpu_worker.ps1 -PullModels
```

Then register it from PC1:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/register_worker_endpoint.ps1 -WorkerName gpu_worker -HostOrIp 192.168.1.50
```

Remote critics degrade to `critic_unavailable` when PC2 or a model is missing.
They must never block docs/tooling missions by crashing the queue.
