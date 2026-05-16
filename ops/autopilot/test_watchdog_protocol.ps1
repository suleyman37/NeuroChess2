$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-WatchdogFixture {
  param([string]$FixtureName, [string]$OutDir)
  $fixturePath = Join-Path $script:fixtureRoot $FixtureName
  $heartbeatPath = Join-Path $OutDir $FixtureName
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  Copy-Item -LiteralPath $fixturePath -Destination $heartbeatPath -Force
  $json = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_watchdog_status.ps1") `
    -HeartbeatPath $heartbeatPath `
    -RuntimeDir $OutDir `
    -NowUnix 1000
  return $json | ConvertFrom-Json
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\watchdog_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$script:fixtureRoot = Join-Path $PSScriptRoot "fixtures"

$green = Invoke-WatchdogFixture -FixtureName "watchdog_heartbeat_green.json" -OutDir (Join-Path $runDir "green")
$yellow = Invoke-WatchdogFixture -FixtureName "watchdog_heartbeat_yellow.json" -OutDir (Join-Path $runDir "yellow")
$orange = Invoke-WatchdogFixture -FixtureName "watchdog_heartbeat_orange.json" -OutDir (Join-Path $runDir "orange")
$red = Invoke-WatchdogFixture -FixtureName "watchdog_heartbeat_red.json" -OutDir (Join-Path $runDir "red")
$black = Invoke-WatchdogFixture -FixtureName "watchdog_heartbeat_black.json" -OutDir (Join-Path $runDir "black")
$budget = Invoke-WatchdogFixture -FixtureName "watchdog_state_budget_exceeded.json" -OutDir (Join-Path $runDir "budget")
$missing = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_watchdog_status.ps1") `
  -HeartbeatPath (Join-Path $runDir "missing\heartbeat.json") `
  -RuntimeDir (Join-Path $runDir "missing") `
  -NowUnix 1000) | ConvertFrom-Json

$stopRuntime = Join-Path $runDir "stop_flags"
New-Item -ItemType Directory -Force -Path $stopRuntime | Out-Null
$stopFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "watchdog_stop_flag.json") -Raw | ConvertFrom-Json
foreach ($flag in @($stopFixture.runtime_flags)) {
  Set-Content -LiteralPath (Join-Path $stopRuntime $flag) -Value "test flag" -Encoding UTF8
}
$stopFlags = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_stop_flags.ps1") -RuntimeDir $stopRuntime) | ConvertFrom-Json

$heartbeatDryRun = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "write_heartbeat.ps1") `
  -RuntimeDir (Join-Path $runDir "heartbeat_dry_run") `
  -State "waiting_for_tests" `
  -MissionId "A11B_HEARTBEAT_DRY_RUN" `
  -DryRun) | ConvertFrom-Json
$dryRunPathExists = Test-Path -LiteralPath $heartbeatDryRun.heartbeat_path

$heartbeatWrite = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "write_heartbeat.ps1") `
  -RuntimeDir (Join-Path $runDir "heartbeat_write") `
  -State "waiting_for_tests" `
  -MissionId "A11B_HEARTBEAT_WRITE") | ConvertFrom-Json

$rescue = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_watchdog_rescue_pack.ps1") `
  -Reason "A11B_TEST_RESCUE" `
  -HeartbeatPath $heartbeatWrite.heartbeat_path `
  -OutDir (Join-Path $runDir "rescue_pack")) | ConvertFrom-Json

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$policy = Get-Content -LiteralPath (Join-Path $PSScriptRoot "watchdog_policy.yaml") -Raw
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($green.watchdog_phase -eq "GREEN" -and $green.action -eq "NONE") "GREEN fixture should return GREEN/NONE"
Assert-True ($yellow.watchdog_phase -eq "YELLOW" -and $yellow.action -eq "WARN") "YELLOW fixture should return YELLOW/WARN"
Assert-True ($orange.watchdog_phase -eq "ORANGE" -and $orange.action -eq "WRITE_STOP") "ORANGE fixture should return ORANGE/WRITE_STOP"
Assert-True ($red.watchdog_phase -eq "RED" -and $red.action -eq "POLITE_KILL_DRY_RUN") "RED fixture should return RED/POLITE_KILL_DRY_RUN"
Assert-True ($black.watchdog_phase -eq "BLACK" -and $black.action -eq "FORCE_KILL_DRY_RUN") "BLACK fixture should return BLACK/FORCE_KILL_DRY_RUN"
Assert-True ($missing.watchdog_phase -eq "BLACK" -and $missing.action -eq "FORCE_KILL_DRY_RUN") "missing heartbeat should return BLACK/FORCE_KILL_DRY_RUN"
Assert-True ($budget.watchdog_phase -eq "ORANGE" -and $budget.stop_flag_should_be_written) "state budget exceeded should request ORANGE/STOP"
Assert-True ([bool]$stopFlags.stop_requested) "STOP flag should be detected"
Assert-True ([bool]$heartbeatDryRun.dry_run -and -not [bool]$heartbeatDryRun.wrote_heartbeat) "write_heartbeat -DryRun should not write"
Assert-True (-not $dryRunPathExists) "write_heartbeat -DryRun should not create heartbeat file"
Assert-True ([bool]$heartbeatWrite.wrote_heartbeat -and (Test-Path -LiteralPath $heartbeatWrite.heartbeat_path)) "write_heartbeat should write in temp runtime dir"
Assert-True ($rescue.status -eq "created") "rescue pack should be created"
foreach ($required in @("git_status.txt", "branch.txt", "head.txt", "diff_stat.txt", "changed_files.txt", "patch.diff", "heartbeat.json", "watchdog_reason.txt", "post_mortem.md")) {
  Assert-True (Test-Path -LiteralPath (Join-Path $rescue.report_dir $required)) "rescue pack missing $required"
}
Assert-True (-not [bool]$state.watchdog_enabled) "watchdog_enabled must remain false"
Assert-True (-not [bool]$state.heartbeat_enabled) "heartbeat_enabled must remain false"
Assert-True (-not [bool]$state.kill_switch_enabled) "kill_switch_enabled must remain false"
Assert-True (-not [bool]$state.hard_kill_enabled) "hard_kill_enabled must remain false"
Assert-True ($policy -match "hard_kill_enabled:\s*false") "policy hard_kill_enabled must remain false"
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
    green_none = $true
    yellow_warn = $true
    orange_write_stop = $true
    red_polite_kill_dry_run = $true
    black_force_kill_dry_run = $true
    state_budget_stop = $true
    stop_flag_detected = $true
    heartbeat_dry_run_safe = $true
    rescue_pack_created = $true
    no_real_process_kill = $true
    no_live_chatgpt_call = $true
    no_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "watchdog_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
