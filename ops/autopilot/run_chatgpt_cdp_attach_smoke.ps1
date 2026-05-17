param(
  [switch]$DryRun,
  [switch]$Live,
  [string]$FixturePath = "",
  [string]$OutputDir = "",
  [string]$Endpoint = "http://127.0.0.1:9222"
)

$ErrorActionPreference = "Stop"

if (-not $OutputDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_cdp_attach"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutputDir = Join-Path $root ("A18I_cdp_attach_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$summary = [ordered]@{
  mode = if ($Live) { "live" } elseif ($FixturePath) { "fixture" } else { "dry_run" }
  output_dir = $OutputDir
  endpoint = $Endpoint
  browser_launched = $false
  cdp_attach_attempted = [bool]$Live
  live_chatgpt_called = [bool]$Live
  live_gemini_called = $false
  product_mission_executed = $false
  micro_prompt_requested = $false
  chrome_closed_by_codex = $false
  commit = $false
  push = $false
}

$nodeScript = Join-Path $PSScriptRoot "browser\chatgpt_cdp_attach_loop.mjs"
$nodeArgs = @($nodeScript, "--out", $OutputDir)
if ($FixturePath) {
  $nodeArgs += @("--fixture", $FixturePath)
} elseif ($Live) {
  $nodeArgs += @("--live", "--endpoint", $Endpoint)
} else {
  $nodeArgs += "--dry-run"
}

node @nodeArgs
$code = $LASTEXITCODE
$summary.node_exit_code = $code
if (Test-Path -LiteralPath (Join-Path $OutputDir "cdp_attach_result.json")) {
  $summary.cdp_attach_result = Get-Content -LiteralPath (Join-Path $OutputDir "cdp_attach_result.json") -Raw | ConvertFrom-Json
}
$summary.status = if ($code -eq 0) { "pass" } else { "fail" }
$summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $OutputDir "cdp_attach_wrapper_summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 14
exit $code
