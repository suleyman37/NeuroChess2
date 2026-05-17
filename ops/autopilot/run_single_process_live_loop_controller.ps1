param(
  [switch]$DryRun,
  [switch]$Live,
  [string]$FixturePath = "",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$configPath = Join-Path $PSScriptRoot "config.json"
$sessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"

if (-not $OutputDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\single_process_live_loop"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutputDir = Join-Path $root ("A18H_single_process_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$summary = [ordered]@{
  mode = if ($Live) { "live" } elseif ($FixturePath) { "fixture" } else { "dry_run" }
  output_dir = $OutputDir
  browser_called = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  micro_prompt_requested = $false
  commit = $false
  push = $false
}

if ($Live) {
  if (-not (Test-Path -LiteralPath $sessionPath)) {
    $summary.status = "fail"
    $summary.reason = "ACTIVE_SESSION_URL_CONFIG_MISSING"
    $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutputDir "single_process_wrapper_summary.json") -Encoding UTF8
    $summary | ConvertTo-Json -Depth 10
    exit 1
  }
  $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$session.active_session_url)) {
    $summary.status = "fail"
    $summary.reason = "ACTIVE_SESSION_URL_MISSING"
    $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutputDir "single_process_wrapper_summary.json") -Encoding UTF8
    $summary | ConvertTo-Json -Depth 10
    exit 1
  }

  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $profilePath = if ($config.chatgpt_web_bridge.chrome_profile_path) {
    [string]$config.chatgpt_web_bridge.chrome_profile_path
  } else {
    "C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile"
  }

  $lockJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $profilePath -OutDir $OutputDir -JsonOnly
  $lock = $lockJson | ConvertFrom-Json
  $summary.profile_lock_initial = $lock
  if ([bool]$lock.locked) {
    $cleanupJson = & "$PSScriptRoot\close_chatgpt_profile_processes.ps1" -ProfilePath $profilePath -ForceClose -OutDir $OutputDir
    $summary.profile_cleanup = ($cleanupJson | ConvertFrom-Json)
    $lockJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $profilePath -OutDir $OutputDir -JsonOnly
    $lock = $lockJson | ConvertFrom-Json
    $summary.profile_lock_after_cleanup = $lock
    if ([bool]$lock.locked) {
      $summary.status = "fail"
      $summary.reason = "CHATGPT_CHROME_PROFILE_LOCKED"
      $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutputDir "single_process_wrapper_summary.json") -Encoding UTF8
      $summary | ConvertTo-Json -Depth 12
      exit 1
    }
  }
}

$nodeScript = Join-Path $PSScriptRoot "browser\chatgpt_single_process_loop.mjs"
$nodeArgs = @($nodeScript, "--out", $OutputDir, "--config", $configPath)
if ($FixturePath) {
  $nodeArgs += @("--fixture", $FixturePath)
} elseif ($Live) {
  $nodeArgs += "--live"
  $summary.browser_called = $true
  $summary.live_chatgpt_called = $true
} else {
  $nodeArgs += "--dry-run"
}

node @nodeArgs
$code = $LASTEXITCODE
$summary.node_exit_code = $code
if (Test-Path -LiteralPath (Join-Path $OutputDir "single_process_result.json")) {
  $summary.single_process_result = Get-Content -LiteralPath (Join-Path $OutputDir "single_process_result.json") -Raw | ConvertFrom-Json
}
$summary.status = if ($code -eq 0) { "pass" } else { "fail" }
$summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $OutputDir "single_process_wrapper_summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 14
exit $code
