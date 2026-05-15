param(
  [string]$WorkerName = "gpu_worker",
  [string]$Model = ""
)

$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$artifactRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\remote_worker_tests"
$runDir = Join-Path $artifactRoot (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Write-Result {
  param([hashtable]$Result)
  $json = $Result | ConvertTo-Json -Depth 8
  Set-Content -LiteralPath (Join-Path $runDir "remote_worker_test.json") -Value $json -Encoding UTF8
  Write-Output $json
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
  Write-Result @{
    verdict = "critic_unavailable"
    worker = $WorkerName
    reasons = @("Worker endpoint is not registered in workers.yaml.")
    ollama_tags = "not_attempted"
    text_test = "skipped"
    vision_test = "skipped"
    report_dir = $runDir
  }
  exit 0
}

$ollamaUrl = $worker.ollama_url.TrimEnd("/")
$tags = $null
try {
  $tags = Invoke-RestMethod -Method Get -Uri "$ollamaUrl/api/tags" -TimeoutSec 10
} catch {
  Write-Result @{
    verdict = "fail"
    worker = $WorkerName
    ollama_url = $ollamaUrl
    reasons = @("Ollama endpoint did not respond: $($_.Exception.Message)")
    ollama_tags = "fail"
    text_test = "skipped"
    vision_test = "skipped"
    report_dir = $runDir
  }
  exit 0
}

$names = @($tags.models | ForEach-Object { $_.name })
$textCandidates = if ($Model) { @($Model) } else { @("qwen2.5-coder:14b", "qwen2.5-coder:7b", "llama3.1:8b", "gpt-oss:20b") }
$visionCandidates = @("qwen2.5vl:7b", "llava:7b")
$textModel = $textCandidates | Where-Object { $names -contains $_ } | Select-Object -First 1
$visionModel = $visionCandidates | Where-Object { $names -contains $_ } | Select-Object -First 1

$textStatus = "skipped_no_model"
if ($textModel) {
  try {
    $body = @{
      model = $textModel
      prompt = "Return strict JSON: {`"verdict`":`"pass`",`"reason`":`"remote text critic reachable`"}"
      stream = $false
      format = "json"
    } | ConvertTo-Json -Depth 5
    $null = Invoke-RestMethod -Method Post -Uri "$ollamaUrl/api/generate" -ContentType "application/json" -Body $body -TimeoutSec 120
    $textStatus = "pass"
  } catch {
    $textStatus = "fail: $($_.Exception.Message)"
  }
}

$visionStatus = "skipped_no_model"
if ($visionModel) {
  $visionStatus = "available_not_exercised_no_image_fixture"
}

$verdict = if ($textStatus -eq "pass" -or $visionStatus -like "available*") { "pass" } else { "critic_unavailable" }
Write-Result @{
  verdict = $verdict
  worker = $WorkerName
  ollama_url = $ollamaUrl
  reasons = @("Remote endpoint reachable.", "Text model: $textModel", "Vision model: $visionModel")
  models = $names
  ollama_tags = "pass"
  text_test = $textStatus
  vision_test = $visionStatus
  report_dir = $runDir
}
exit 0
