$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\watchdog_fake_drills" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"

$healthyFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_fake_process_healthy.json") -Raw | ConvertFrom-Json
$hungFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_fake_process_hung.json") -Raw | ConvertFrom-Json
$stopFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_fake_process_stop_flag.json") -Raw | ConvertFrom-Json
$rescueFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_fake_process_rescue_expected.json") -Raw | ConvertFrom-Json

$summary = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run_watchdog_fake_process_drill.ps1") `
  -Scenario "All" `
  -OutDir (Join-Path $runDir "all") `
  -RuntimeRoot (Join-Path $runDir "all\runtime")) | ConvertFrom-Json

$healthy = @($summary.scenarios | Where-Object { $_.scenario -eq "Healthy" })[0]
$stop = @($summary.scenarios | Where-Object { $_.scenario -eq "StopFlag" })[0]
$hung = @($summary.scenarios | Where-Object { $_.scenario -eq "Hung" })[0]

Assert-True ($healthy.watchdog_phase -eq $healthyFixture.expected_phase) "healthy scenario phase mismatch"
Assert-True ($healthy.watchdog_action -eq $healthyFixture.expected_action) "healthy scenario action mismatch"
Assert-True (-not [bool]$healthy.stop_requested) "healthy scenario should not request STOP"
Assert-True (-not [bool]$healthy.rescue_created) "healthy scenario should not create rescue"
Assert-True (Test-Path -LiteralPath $healthy.heartbeat_path) "healthy heartbeat missing"
Assert-True (Test-Path -LiteralPath $healthy.state_path) "healthy fake state missing"

Assert-True ([bool]$stop.stop_requested) "STOP flag scenario should detect STOP"
Assert-True ($stop.flags_found -contains $stopFixture.expected_flag) "STOP flag scenario should report STOP"
Assert-True ([bool]$stop.rescue_created) "STOP flag scenario should create rescue report"
Assert-True (-not [bool]$stop.real_process_kill_performed) "STOP flag scenario must not kill process"

$acceptableHungPhases = @("ORANGE", "RED", "BLACK")
Assert-True ($acceptableHungPhases -contains $hung.watchdog_phase) "hung scenario should be ORANGE or stronger"
Assert-True ([bool]$hung.stop_flag_should_be_written -or $hung.watchdog_action -match "KILL_DRY_RUN") "hung scenario should request STOP or dry-run kill action"
Assert-True ([bool]$hung.rescue_created) "hung scenario should create rescue pack"
Assert-True (-not [bool]$hung.real_process_kill_performed) "hung scenario must not kill process"

foreach ($required in @($rescueFixture.required_files)) {
  Assert-True (Test-Path -LiteralPath (Join-Path $hung.rescue_pack_dir $required)) "hung rescue pack missing $required"
}

foreach ($scenario in @($healthy, $stop, $hung)) {
  Assert-True (-not [bool]$scenario.live_chatgpt_called) "drill must not call ChatGPT"
  Assert-True (-not [bool]$scenario.codex_execution) "drill must not execute Codex"
  Assert-True (-not [bool]$scenario.commit -and -not [bool]$scenario.push) "drill must not commit/push"
  Assert-True (-not [bool]$scenario.product_mission_executed) "drill must not execute product mission"
  Assert-True (-not [bool]$scenario.real_process_kill_performed) "drill must not kill real process"
}

Assert-True (-not [bool]$summary.live_chatgpt_called) "summary must report no live ChatGPT"
Assert-True (-not [bool]$summary.codex_execution) "summary must report no Codex execution"
Assert-True (-not [bool]$summary.commit -and -not [bool]$summary.push) "summary must report no commit/push"
Assert-True (-not [bool]$summary.product_mission_executed) "summary must report no product mission"
Assert-True (-not [bool]$summary.real_process_kill_performed) "summary must report no real process kill"
Assert-True (Test-Path -LiteralPath $summary.report_json) "drill summary json missing"
Assert-True (Test-Path -LiteralPath $summary.report_markdown) "drill summary markdown missing"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True (-not [bool]$state.live_watchdog_integrated) "live_watchdog_integrated must remain false"
Assert-True (-not [bool]$state.live_watchdog_enabled) "live_watchdog_enabled must remain false"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    healthy_scenario = "PASS"
    stop_flag_scenario = "PASS"
    stale_heartbeat_scenario = "PASS"
    rescue_pack_scenario = "PASS"
    no_real_process_kill = $true
    no_live_chatgpt_call = $true
    no_codex_execution = $true
    no_product_mission = $true
  }
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "watchdog_fake_process_drill_test_result.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
exit 0
