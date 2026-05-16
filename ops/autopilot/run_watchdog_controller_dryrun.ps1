param(
  [ValidateSet("Clean", "StopFlag", "DrainFlag", "StaleHeartbeat")]
  [string]$Scenario = "Clean",
  [string]$OutDir = "",
  [string]$RuntimeDir = "",
  [bool]$DryRun = $true
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $safeScenario = $Scenario -replace "[^A-Za-z0-9_.-]", "_"
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "watchdog_controller_dryrun\$safeScenario`_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $RuntimeDir) {
  $RuntimeDir = Join-Path $OutDir "runtime"
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$states = @(
  "REQUESTING_PROMPT",
  "VALIDATING_PROMPT_FIREWALL",
  "REGISTERING_MISSION_CONTRACT",
  "EXECUTING_MISSION",
  "RUNNING_POSTCHECKS",
  "CHECKING_CONTRACT_DIFF",
  "COMMITTING",
  "PUSHING",
  "GENERATING_DIGEST",
  "REQUESTING_PULSE",
  "COOLDOWN",
  "STOPPED_GRACEFUL"
)

$sessionId = "A11C_$($Scenario)_$([guid]::NewGuid().ToString('N'))"
$transitions = [System.Collections.Generic.List[object]]::new()
$finalDecision = "COMPLETED_DRY_RUN"
$rescueDir = ""
$heartbeatPath = Join-Path $RuntimeDir "heartbeat.json"

if ($Scenario -eq "StopFlag") {
  Set-Content -LiteralPath (Join-Path $RuntimeDir "STOP") -Value "A11C simulated STOP flag" -Encoding UTF8
} elseif ($Scenario -eq "DrainFlag") {
  Set-Content -LiteralPath (Join-Path $RuntimeDir "DRAIN") -Value "A11C simulated DRAIN flag" -Encoding UTF8
}

if ($Scenario -eq "StaleHeartbeat") {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "fixtures\watchdog_heartbeat_black.json") -Destination $heartbeatPath -Force
  $status = (& "$PSScriptRoot\check_watchdog_status.ps1" -HeartbeatPath $heartbeatPath -RuntimeDir $RuntimeDir -NowUnix 1000) | ConvertFrom-Json
  $finalDecision = "STALE_HEARTBEAT_RESCUE"
  $rescue = (& "$PSScriptRoot\build_watchdog_rescue_pack.ps1" -Reason "A11C stale heartbeat dry-run" -HeartbeatPath $heartbeatPath -OutDir (Join-Path $OutDir "rescue")) | ConvertFrom-Json
  $rescueDir = $rescue.report_dir
  $transitions.Add([ordered]@{
    from = "IDLE"
    to = "STALE_HEARTBEAT"
    decision = $finalDecision
    watchdog_phase = $status.watchdog_phase
    action = $status.action
  }) | Out-Null
} else {
  $current = "IDLE"
  foreach ($state in $states) {
    $transition = (& "$PSScriptRoot\simulate_controller_state_transition.ps1" `
      -CurrentState $current `
      -NextState $state `
      -RuntimeDir $RuntimeDir `
      -MissionId "A11C_$Scenario" `
      -RiskTier "green" `
      -StateMaxDurationSeconds 600 `
      -SessionId $sessionId `
      -OutDir (Join-Path $OutDir "transition_$($transitions.Count + 1)")) | ConvertFrom-Json
    $transitions.Add($transition) | Out-Null
    if ($transition.decision -ne "CONTINUE") {
      $finalDecision = $transition.decision
      $rescue = (& "$PSScriptRoot\build_watchdog_rescue_pack.ps1" -Reason "A11C $Scenario dry-run decision $finalDecision" -HeartbeatPath $transition.heartbeat_path -OutDir (Join-Path $OutDir "rescue")) | ConvertFrom-Json
      $rescueDir = $rescue.report_dir
      break
    }
    $current = $state
  }
}

$report = [ordered]@{
  schema_version = "A11C_watchdog_controller_dryrun_v1"
  scenario = $Scenario
  dry_run = $DryRun
  runtime_dir = $RuntimeDir
  heartbeat_path = $heartbeatPath
  transitions = @($transitions)
  transition_count = $transitions.Count
  final_decision = $finalDecision
  rescue_pack_dir = $rescueDir
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  real_process_kill_performed = $false
  product_mission_executed = $false
}

$jsonPath = Join-Path $OutDir "dryrun_session_report.json"
$mdPath = Join-Path $OutDir "dryrun_session_report.md"
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$md = @(
  "# Watchdog Controller Dry-Run Report",
  "",
  "Scenario: $Scenario",
  "Final decision: $finalDecision",
  "Transitions: $($transitions.Count)",
  "Runtime dir: $RuntimeDir",
  "Rescue pack: $rescueDir",
  "",
  "No ChatGPT call, Codex execution, commit, push, product mission, or process kill occurred."
)
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

$report | Add-Member -Force -NotePropertyName report_json -NotePropertyValue $jsonPath
$report | Add-Member -Force -NotePropertyName report_markdown -NotePropertyValue $mdPath
$report | ConvertTo-Json -Depth 20
