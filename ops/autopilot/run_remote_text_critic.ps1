param(
  [string]$Cwd = (Get-Location).Path,
  [string]$RunDir = "",
  [string]$TaskJson = "",
  [string]$WorkerName = "gpu_worker",
  [string]$Model = ""
)

$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $RunDir) {
  $RunDir = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\remote_text_critic\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

function Emit-CriticJson {
  param([hashtable]$Payload, [int]$ExitCode = 0)
  $json = $Payload | ConvertTo-Json -Depth 8
  Set-Content -LiteralPath (Join-Path $RunDir "remote_text_critic.json") -Value $json -Encoding UTF8
  Write-Output $json
  exit $ExitCode
}

function Get-WorkerConfig {
  param([string]$Name)
  $path = Join-Path $repoRoot "ops\autopilot\workers.yaml"
  if (-not (Test-Path $path)) { return $null }
  $map = @{}
  $inTarget = $false
  foreach ($line in Get-Content -LiteralPath $path) {
    if ($line -match "^\s{2}([A-Za-z0-9_-]+):\s*$") {
      $inTarget = ($matches[1] -eq $Name)
      continue
    }
    if ($inTarget -and $line -match "^\s{4}([A-Za-z0-9_]+):\s*(.*?)\s*$") {
      $map[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  if ($map.Count -eq 0) { return $null }
  return [pscustomobject]$map
}

$worker = Get-WorkerConfig -Name $WorkerName
if (-not $worker -or -not $worker.ollama_url -or $worker.ollama_url -match "CHANGE_ME") {
  Emit-CriticJson @{
    verdict = "critic_unavailable"
    reasons = @("Remote text critic worker is not registered.")
    forbidden_change_detected = $false
    scope_violation = $false
    confidence = 0.0
    suggested_next_action = "Continue deterministic checks; register GPU worker when available."
  }
}

$ollamaUrl = $worker.ollama_url.TrimEnd("/")
try {
  $tags = Invoke-RestMethod -Method Get -Uri "$ollamaUrl/api/tags" -TimeoutSec 10
} catch {
  Emit-CriticJson @{
    verdict = "critic_unavailable"
    reasons = @("Remote Ollama is unreachable: $($_.Exception.Message)")
    forbidden_change_detected = $false
    scope_violation = $false
    confidence = 0.0
    suggested_next_action = "Keep local deterministic gate; retry after PC2 worker is online."
  }
}

$names = @($tags.models | ForEach-Object { $_.name })
$candidates = if ($Model) { @($Model) } else { @("qwen2.5-coder:14b", "qwen2.5-coder:7b", "llama3.1:8b", "gpt-oss:20b") }
$selected = $candidates | Where-Object { $names -contains $_ } | Select-Object -First 1
if (-not $selected) {
  Emit-CriticJson @{
    verdict = "critic_unavailable"
    reasons = @("No configured remote text critic model is installed on worker.", "Available models: $($names -join ', ')")
    forbidden_change_detected = $false
    scope_violation = $false
    confidence = 0.0
    suggested_next_action = "Install qwen2.5-coder:14b, qwen2.5-coder:7b, llama3.1:8b, or gpt-oss:20b on PC2."
  }
}

$status = (& git -C $Cwd status --short --branch 2>&1) -join "`n"
$diffStat = (& git -C $Cwd diff --stat 2>&1) -join "`n"
$diffName = (& git -C $Cwd diff --name-only 2>&1) -join "`n"
$cachedName = (& git -C $Cwd diff --cached --name-only 2>&1) -join "`n"
$diff = (& git -C $Cwd diff -- . 2>&1) -join "`n"
if ($diff.Length -gt 18000) { $diff = $diff.Substring(0, 18000) + "`n[diff truncated]" }

$prompt = @"
You are the NeuroChess remote text critic worker.
Return strict JSON only with keys:
verdict: pass | soft_fail | hard_fail
reasons: string[]
forbidden_change_detected: boolean
scope_violation: boolean
confidence: number from 0 to 1
suggested_next_action: string

Review this task context, git status, file list, and diff for scope, forbidden files, secrets, and unsafe product changes.

Task JSON:
$TaskJson

Git status:
$status

Diff stat:
$diffStat

Diff names:
$diffName

Cached names:
$cachedName

Diff:
$diff
"@

try {
  $body = @{
    model = $selected
    prompt = $prompt
    stream = $false
    format = "json"
  } | ConvertTo-Json -Depth 6
  $response = Invoke-RestMethod -Method Post -Uri "$ollamaUrl/api/generate" -ContentType "application/json" -Body $body -TimeoutSec 180
  $parsed = $response.response | ConvertFrom-Json
  $payload = @{
    verdict = [string]$parsed.verdict
    reasons = @($parsed.reasons)
    forbidden_change_detected = [bool]$parsed.forbidden_change_detected
    scope_violation = [bool]$parsed.scope_violation
    confidence = [double]$parsed.confidence
    suggested_next_action = [string]$parsed.suggested_next_action
    worker = $WorkerName
    model = $selected
  }
  $exitCode = if ($payload.verdict -eq "hard_fail") { 1 } else { 0 }
  Emit-CriticJson $payload $exitCode
} catch {
  Emit-CriticJson @{
    verdict = "soft_fail"
    reasons = @("Remote text critic call failed or returned invalid JSON: $($_.Exception.Message)")
    forbidden_change_detected = $false
    scope_violation = $false
    confidence = 0.1
    suggested_next_action = "Use deterministic checks and inspect diff manually before promotion."
    worker = $WorkerName
    model = $selected
  }
}
