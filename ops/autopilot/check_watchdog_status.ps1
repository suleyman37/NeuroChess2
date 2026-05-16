param(
  [string]$HeartbeatPath = "",
  [string]$RuntimeDir = "",
  [long]$NowUnix = -1,
  [switch]$WriteStopFlag
)

$ErrorActionPreference = "Stop"

function Get-DefaultWatchdogRuntimeDir {
  if ($env:USERPROFILE) {
    return (Join-Path $env:USERPROFILE "AgentOS\runtime")
  }
  return "C:\Users\suley\AgentOS\runtime"
}

function Get-UnixFromIso {
  param([string]$Iso)
  if (-not $Iso) { return $null }
  try {
    return ([DateTimeOffset]::Parse($Iso)).ToUnixTimeSeconds()
  } catch {
    return $null
  }
}

function Get-PhaseFromAge {
  param([double]$AgeSeconds)
  if ($AgeSeconds -lt 60) { return "GREEN" }
  if ($AgeSeconds -lt 90) { return "YELLOW" }
  if ($AgeSeconds -lt 300) { return "ORANGE" }
  if ($AgeSeconds -le 360) { return "RED" }
  return "BLACK"
}

function Get-ActionFromPhase {
  param([string]$Phase)
  switch ($Phase) {
    "GREEN" { return "NONE" }
    "YELLOW" { return "WARN" }
    "ORANGE" { return "WRITE_STOP" }
    "RED" { return "POLITE_KILL_DRY_RUN" }
    default { return "FORCE_KILL_DRY_RUN" }
  }
}

if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultWatchdogRuntimeDir }
if (-not $HeartbeatPath) { $HeartbeatPath = Join-Path $RuntimeDir "heartbeat.json" }
if ($NowUnix -lt 0) { $NowUnix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

$reasons = [System.Collections.Generic.List[string]]::new()
$heartbeatAge = $null
$stateAge = $null
$stateBudgetExceeded = $false

if (-not (Test-Path -LiteralPath $HeartbeatPath)) {
  $phase = "BLACK"
  $action = "FORCE_KILL_DRY_RUN"
  $reasons.Add("heartbeat missing") | Out-Null
} else {
  $heartbeat = Get-Content -LiteralPath $HeartbeatPath -Raw | ConvertFrom-Json
  $timestampUnix = $null
  if ($heartbeat.PSObject.Properties.Name -contains "timestamp_unix") {
    $timestampUnix = [long]$heartbeat.timestamp_unix
  }
  if ($null -eq $timestampUnix) {
    $timestampUnix = Get-UnixFromIso ([string]$heartbeat.timestamp_iso)
  }
  if ($null -eq $timestampUnix) {
    $phase = "BLACK"
    $action = "FORCE_KILL_DRY_RUN"
    $reasons.Add("heartbeat timestamp missing or invalid") | Out-Null
  } else {
    $heartbeatAge = [math]::Max(0, [double]($NowUnix - $timestampUnix))
    $phase = Get-PhaseFromAge $heartbeatAge
    $action = Get-ActionFromPhase $phase
    $reasons.Add("heartbeat age phase: $phase") | Out-Null
  }

  $enteredUnix = Get-UnixFromIso ([string]$heartbeat.state_entered_at_iso)
  if ($null -ne $enteredUnix) {
    $stateAge = [math]::Max(0, [double]($NowUnix - $enteredUnix))
    $stateMax = 0
    if ($heartbeat.PSObject.Properties.Name -contains "state_max_duration_seconds") {
      $stateMax = [double]$heartbeat.state_max_duration_seconds
    }
    if ($stateMax -gt 0 -and $stateAge -gt $stateMax) {
      $stateBudgetExceeded = $true
      $reasons.Add("state budget exceeded: $stateAge > $stateMax") | Out-Null
      if ($phase -eq "GREEN" -or $phase -eq "YELLOW") {
        $phase = "ORANGE"
        $action = "WRITE_STOP"
      }
    }
  }
}

$stopFlagShouldBeWritten = ($action -eq "WRITE_STOP")
if ($WriteStopFlag -and $stopFlagShouldBeWritten) {
  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
  Set-Content -LiteralPath (Join-Path $RuntimeDir "STOP") -Value "watchdog requested soft stop" -Encoding UTF8
}

[ordered]@{
  watchdog_phase = $phase
  action = $action
  reasons = @($reasons)
  heartbeat_age_seconds = $heartbeatAge
  state_age_seconds = $stateAge
  state_budget_exceeded = $stateBudgetExceeded
  stop_flag_should_be_written = $stopFlagShouldBeWritten
  stop_flag_written = ([bool]$WriteStopFlag -and $stopFlagShouldBeWritten)
  heartbeat_path = $HeartbeatPath
  runtime_dir = $RuntimeDir
  real_process_kill_performed = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 10
