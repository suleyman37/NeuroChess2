param(
  [Parameter(Mandatory = $true)][string]$CurrentState,
  [Parameter(Mandatory = $true)][string]$NextState,
  [string]$RuntimeDir = "",
  [string]$MissionId = "A11C_DRY_RUN",
  [string]$RiskTier = "green",
  [int]$StateMaxDurationSeconds = 600,
  [string]$SessionId = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$validStates = @(
  "IDLE",
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

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "watchdog_controller_transitions\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $RuntimeDir) {
  $RuntimeDir = Join-Path $OutDir "runtime"
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$transitionValid = ($validStates -contains $CurrentState) -and ($validStates -contains $NextState)
$heartbeatWritten = $false
$decision = "CONTINUE"
$flags = @()
$heartbeatPath = Join-Path $RuntimeDir "heartbeat.json"

if ($transitionValid) {
  $heartbeat = & "$PSScriptRoot\write_heartbeat.ps1" `
    -RuntimeDir $RuntimeDir `
    -HeartbeatPath $heartbeatPath `
    -State $NextState `
    -MissionId $MissionId `
    -RiskTier $RiskTier `
    -StateMaxDurationSeconds $StateMaxDurationSeconds `
    -SessionId $SessionId
  $heartbeatObj = $heartbeat | ConvertFrom-Json
  $heartbeatWritten = [bool]$heartbeatObj.wrote_heartbeat

  $stop = & "$PSScriptRoot\check_stop_flags.ps1" -RuntimeDir $RuntimeDir
  $stopObj = $stop | ConvertFrom-Json
  $flags = @($stopObj.flags_found)

  if ($stopObj.kill_requested) {
    $decision = "KILL_REQUESTED"
  } elseif ($stopObj.stop_requested) {
    $decision = "STOP_GRACEFUL"
  } elseif ($stopObj.drain_requested) {
    $decision = "DRAIN_SESSION"
  } elseif ($stopObj.pause_requested) {
    $decision = "PAUSE_AFTER_MISSION"
  }
}

$result = [ordered]@{
  transition_valid = $transitionValid
  from = $CurrentState
  to = $NextState
  heartbeat_written = $heartbeatWritten
  heartbeat_path = $heartbeatPath
  stop_flags_detected = @($flags)
  decision = if ($transitionValid) { $decision } else { "INVALID_STATE" }
  runtime_dir = $RuntimeDir
  out_dir = $OutDir
  real_process_kill_performed = $false
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "state_transition.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
if ($transitionValid) { exit 0 }
exit 1
