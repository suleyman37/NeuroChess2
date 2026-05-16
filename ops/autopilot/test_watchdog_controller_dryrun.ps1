$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-DryRunScenario {
  param([string]$Scenario, [string]$OutDir)
  $json = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run_watchdog_controller_dryrun.ps1") `
    -Scenario $Scenario `
    -OutDir $OutDir `
    -RuntimeDir (Join-Path $OutDir "runtime")
  return $json | ConvertFrom-Json
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\watchdog_controller_dryrun_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"

$cleanFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_controller_dryrun_clean.json") -Raw | ConvertFrom-Json
$stopFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_controller_dryrun_stop_flag.json") -Raw | ConvertFrom-Json
$drainFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_controller_dryrun_drain_flag.json") -Raw | ConvertFrom-Json
$staleFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_controller_dryrun_stale_heartbeat.json") -Raw | ConvertFrom-Json

$clean = Invoke-DryRunScenario -Scenario $cleanFixture.scenario -OutDir (Join-Path $runDir "clean")
$stop = Invoke-DryRunScenario -Scenario $stopFixture.scenario -OutDir (Join-Path $runDir "stop")
$drain = Invoke-DryRunScenario -Scenario $drainFixture.scenario -OutDir (Join-Path $runDir "drain")
$stale = Invoke-DryRunScenario -Scenario $staleFixture.scenario -OutDir (Join-Path $runDir "stale")

$pauseRuntime = Join-Path $runDir "pause_transition\runtime"
New-Item -ItemType Directory -Force -Path $pauseRuntime | Out-Null
Set-Content -LiteralPath (Join-Path $pauseRuntime "PAUSE") -Value "pause drill" -Encoding UTF8
$pause = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "simulate_controller_state_transition.ps1") `
  -CurrentState "IDLE" `
  -NextState "REQUESTING_PROMPT" `
  -RuntimeDir $pauseRuntime `
  -OutDir (Join-Path $runDir "pause_transition")) | ConvertFrom-Json

$killRuntime = Join-Path $runDir "kill_transition\runtime"
New-Item -ItemType Directory -Force -Path $killRuntime | Out-Null
Set-Content -LiteralPath (Join-Path $killRuntime "KILL") -Value "kill drill" -Encoding UTF8
$kill = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "simulate_controller_state_transition.ps1") `
  -CurrentState "IDLE" `
  -NextState "REQUESTING_PROMPT" `
  -RuntimeDir $killRuntime `
  -OutDir (Join-Path $runDir "kill_transition")) | ConvertFrom-Json

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($clean.final_decision -eq $cleanFixture.expected_final_decision) "clean scenario final decision mismatch"
Assert-True ($clean.transition_count -ge 12) "clean scenario should complete all simulated states"
Assert-True (Test-Path -LiteralPath $clean.heartbeat_path) "clean scenario should write heartbeat"
Assert-True (Test-Path -LiteralPath $clean.report_json) "clean scenario report json missing"
Assert-True (Test-Path -LiteralPath $clean.report_markdown) "clean scenario report md missing"
Assert-True (-not [bool]$clean.live_chatgpt_called) "clean scenario must not call ChatGPT"
Assert-True (-not [bool]$clean.codex_execution) "clean scenario must not execute Codex"
Assert-True (-not [bool]$clean.commit -and -not [bool]$clean.push) "clean scenario must not commit/push"

Assert-True ($stop.final_decision -eq $stopFixture.expected_final_decision) "STOP scenario final decision mismatch"
Assert-True (Test-Path -LiteralPath $stop.rescue_pack_dir) "STOP scenario rescue pack missing"
Assert-True (-not [bool]$stop.real_process_kill_performed) "STOP scenario must not kill process"

Assert-True ($pause.decision -eq "PAUSE_AFTER_MISSION") "PAUSE flag should produce PAUSE_AFTER_MISSION"
Assert-True ($pause.stop_flags_detected -contains "PAUSE") "PAUSE flag should be reported"

Assert-True ($drain.final_decision -eq $drainFixture.expected_final_decision) "DRAIN scenario final decision mismatch"
Assert-True (Test-Path -LiteralPath $drain.rescue_pack_dir) "DRAIN scenario rescue pack missing"

Assert-True ($kill.decision -eq "KILL_REQUESTED") "KILL flag should produce KILL_REQUESTED"
Assert-True ($kill.stop_flags_detected -contains "KILL") "KILL flag should be reported"
Assert-True (-not [bool]$kill.real_process_kill_performed) "KILL flag drill must not kill process"

Assert-True ($stale.final_decision -eq $staleFixture.expected_final_decision) "stale heartbeat final decision mismatch"
Assert-True (Test-Path -LiteralPath $stale.rescue_pack_dir) "stale heartbeat rescue pack missing"

foreach ($scenario in @($clean, $stop, $drain, $stale)) {
  Assert-True (-not [bool]$scenario.live_chatgpt_called) "dry-run must not call ChatGPT"
  Assert-True (-not [bool]$scenario.codex_execution) "dry-run must not execute Codex"
  Assert-True (-not [bool]$scenario.commit -and -not [bool]$scenario.push) "dry-run must not commit/push"
  Assert-True (-not [bool]$scenario.product_mission_executed) "dry-run must not execute product mission"
  Assert-True (-not [bool]$scenario.real_process_kill_performed) "dry-run must not kill process"
}

Assert-True (-not [bool]$state.live_watchdog_integrated) "live_watchdog_integrated must remain false"
Assert-True (-not [bool]$state.live_watchdog_enabled) "live_watchdog_enabled must remain false"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    clean_scenario_completed = $true
    stop_flag_stop_graceful = $true
    pause_flag_pause_after_mission = $true
    drain_flag_drain_session = $true
    kill_flag_detected_no_kill = $true
    stale_heartbeat_rescue = $true
    no_live_chatgpt_call = $true
    no_codex_execution = $true
    no_commit_push = $true
    no_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "watchdog_controller_dryrun_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
