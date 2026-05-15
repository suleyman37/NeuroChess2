# Local Models

Local models are critics, not primary executors.

## Text Critic

Primary target:

- provider: Ollama
- model: `gpt-oss:20b`
- job: inspect diff, logs, scope, forbidden changes, and promotion risk

Fallback:

- deterministic checks only
- verdict records `critic_unavailable`

## Vision Critic

Primary target:

- provider: Ollama
- model: `qwen2.5vl:7b`
- job: inspect screenshots for layout, copy, RPG cheapness, and visual
  regressions

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
