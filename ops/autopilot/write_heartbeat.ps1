param(
  [string]$RuntimeDir = "",
  [string]$HeartbeatPath = "",
  [string]$State = "idle",
  [int]$StateMaxDurationSeconds = 600,
  [string]$MissionId = "",
  [string]$RiskTier = "green",
  [int]$MissionTimeboxMinutes = 10,
  [int]$MissionsCompleted = 0,
  [int]$MissionsFailed = 0,
  [int]$MissionsQuarantined = 0,
  [string]$SessionId = "",
  [string]$ControllerStartedAtIso = "",
  [string]$SessionStartedAtIso = "",
  [string]$StateEnteredAtIso = "",
  [string[]]$Anomalies = @(),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

function Get-DefaultWatchdogRuntimeDir {
  if ($env:USERPROFILE) {
    return (Join-Path $env:USERPROFILE "AgentOS\runtime")
  }
  return "C:\Users\suley\AgentOS\runtime"
}

if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultWatchdogRuntimeDir }
if (-not $HeartbeatPath) { $HeartbeatPath = Join-Path $RuntimeDir "heartbeat.json" }
if (-not $SessionId) { $SessionId = "session_$([guid]::NewGuid().ToString('N'))" }

$now = [DateTimeOffset]::UtcNow
$nowIso = $now.ToString("o")
if (-not $ControllerStartedAtIso) { $ControllerStartedAtIso = $nowIso }
if (-not $SessionStartedAtIso) { $SessionStartedAtIso = $nowIso }
if (-not $StateEnteredAtIso) { $StateEnteredAtIso = $nowIso }

$repoRoot = Get-AutopilotRepoRoot
$branch = ""
$head = ""
try { $branch = (git -C $repoRoot branch --show-current).Trim() } catch { $branch = "unknown" }
try { $head = (git -C $repoRoot rev-parse --short HEAD).Trim() } catch { $head = "unknown" }

$nextDue = $now.AddSeconds(30).ToString("o")
$stopObserved = $false
if (Test-Path -LiteralPath (Join-Path $RuntimeDir "STOP")) { $stopObserved = $true }

$heartbeat = [ordered]@{
  schema_version = "A11B_watchdog_heartbeat_v1"
  timestamp_iso = $nowIso
  timestamp_unix = $now.ToUnixTimeSeconds()
  controller_pid = $PID
  controller_started_at_iso = $ControllerStartedAtIso
  state = $State
  state_entered_at_iso = $StateEnteredAtIso
  state_max_duration_seconds = $StateMaxDurationSeconds
  current_mission_id = $MissionId
  current_mission_risk_tier = $RiskTier
  current_mission_timebox_minutes = $MissionTimeboxMinutes
  missions_completed_this_session = $MissionsCompleted
  missions_failed_this_session = $MissionsFailed
  missions_quarantined_this_session = $MissionsQuarantined
  session_id = $SessionId
  session_started_at_iso = $SessionStartedAtIso
  branch = $branch
  last_commit_sha = $head
  stop_flag_observed = $stopObserved
  next_heartbeat_due_iso = $nextDue
  anomalies = @($Anomalies)
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $HeartbeatPath) | Out-Null
  $tmp = "$HeartbeatPath.tmp"
  $heartbeat | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tmp -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $HeartbeatPath -Force
}

[ordered]@{
  status = if ($DryRun) { "dry_run" } else { "written" }
  heartbeat_path = $HeartbeatPath
  wrote_heartbeat = (-not [bool]$DryRun)
  dry_run = [bool]$DryRun
  heartbeat = $heartbeat
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 12
