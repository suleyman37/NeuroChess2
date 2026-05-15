param(
  [string]$ScreenshotsDir = "",
  [string]$Brief = "",
  [string]$RunDir = "",
  [string]$WorkerName = "gpu_worker",
  [string]$Model = ""
)

$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $RunDir) {
  $RunDir = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\remote_vision_critic\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

function Emit-VisionJson {
  param([hashtable]$Payload, [int]$ExitCode = 0)
  $json = $Payload | ConvertTo-Json -Depth 8
  Set-Content -LiteralPath (Join-Path $RunDir "remote_vision_critic.json") -Value $json -Encoding UTF8
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
  Emit-VisionJson @{
    verdict = "critic_unavailable"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.0
    reasons = @("Remote vision critic worker is not registered.")
  }
}

if (-not $ScreenshotsDir -or -not (Test-Path $ScreenshotsDir)) {
  Emit-VisionJson @{
    verdict = "pass"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.7
    reasons = @("No screenshots directory provided; non-UI or deterministic-only run.")
  }
}

$ollamaUrl = $worker.ollama_url.TrimEnd("/")
try {
  $tags = Invoke-RestMethod -Method Get -Uri "$ollamaUrl/api/tags" -TimeoutSec 10
} catch {
  Emit-VisionJson @{
    verdict = "critic_unavailable"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.0
    reasons = @("Remote Ollama is unreachable: $($_.Exception.Message)")
  }
}

$names = @($tags.models | ForEach-Object { $_.name })
$candidates = if ($Model) { @($Model) } else { @("qwen2.5vl:7b", "llava:7b") }
$selected = $candidates | Where-Object { $names -contains $_ } | Select-Object -First 1
if (-not $selected) {
  Emit-VisionJson @{
    verdict = "critic_unavailable"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.0
    reasons = @("No configured remote vision critic model is installed on worker.", "Available models: $($names -join ', ')")
  }
}

$image = Get-ChildItem -LiteralPath $ScreenshotsDir -File -Include *.png,*.jpg,*.jpeg -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $image) {
  Emit-VisionJson @{
    verdict = "pass"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.7
    reasons = @("Screenshots directory has no supported image files.")
  }
}

$image64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($image.FullName))
$prompt = @"
You are the NeuroChess remote vision critic worker.
Return strict JSON only with keys:
verdict: pass | soft_fail | hard_fail
layout_issues: string[]
misleading_copy: string[]
cheap_rpg_risk: boolean
visual_regression_risk: boolean
confidence: number from 0 to 1

Design brief:
$Brief

Inspect the screenshot for layout overlap, misleading copy, cheap RPG/casino styling, visual regressions, and unreadable content.
"@

try {
  $body = @{
    model = $selected
    prompt = $prompt
    images = @($image64)
    stream = $false
    format = "json"
  } | ConvertTo-Json -Depth 6
  $response = Invoke-RestMethod -Method Post -Uri "$ollamaUrl/api/generate" -ContentType "application/json" -Body $body -TimeoutSec 240
  $parsed = $response.response | ConvertFrom-Json
  $payload = @{
    verdict = [string]$parsed.verdict
    layout_issues = @($parsed.layout_issues)
    misleading_copy = @($parsed.misleading_copy)
    cheap_rpg_risk = [bool]$parsed.cheap_rpg_risk
    visual_regression_risk = [bool]$parsed.visual_regression_risk
    confidence = [double]$parsed.confidence
    worker = $WorkerName
    model = $selected
    image = $image.FullName
  }
  $exitCode = if ($payload.verdict -eq "hard_fail") { 1 } else { 0 }
  Emit-VisionJson $payload $exitCode
} catch {
  Emit-VisionJson @{
    verdict = "soft_fail"
    layout_issues = @()
    misleading_copy = @()
    cheap_rpg_risk = $false
    visual_regression_risk = $false
    confidence = 0.1
    reasons = @("Remote vision critic call failed or returned invalid JSON: $($_.Exception.Message)")
    worker = $WorkerName
    model = $selected
  }
}
