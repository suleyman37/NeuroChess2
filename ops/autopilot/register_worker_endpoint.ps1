param(
  [string]$WorkerName = "gpu_worker",
  [Parameter(Mandatory = $true)]
  [string]$HostOrIp,
  [int]$OllamaPort = 11434
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$workersPath = Join-Path $repoRoot "ops\autopilot\workers.yaml"
$ollamaUrl = "http://${HostOrIp}:$OllamaPort"

$content = @"
workers:
  main:
    role: executor
    repo_path: C:\Users\suley\Documents\Dev\NeuroChess2_clean
    can_modify_repo: true
    can_commit: true
    can_push: true
    runs_scheduler: true
  ${WorkerName}:
    role: critic_worker
    host: $HostOrIp
    ollama_url: $ollamaUrl
    can_push: false
    can_commit: false
    can_modify_repo: false
    runs_scheduler: false
    runs_ollama: true
    serves_text_critic: true
    serves_vision_critic: true
    text_critic_enabled: true
    vision_critic_enabled: true
    notes:
      - PC2 is a critic worker only.
      - Do not commit or push from PC2.
      - Keep Ollama LAN-only and firewall-restricted.
"@

Set-Content -LiteralPath $workersPath -Value $content -Encoding UTF8

[pscustomobject]@{
  status = "updated"
  worker_name = $WorkerName
  host = $HostOrIp
  ollama_url = $ollamaUrl
  can_push = $false
  can_commit = $false
  can_modify_repo = $false
  workers_path = $workersPath
} | ConvertTo-Json -Depth 4
