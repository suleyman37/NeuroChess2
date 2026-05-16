param(
  [ValidateSet("Healthy", "Hung", "StopFlag")]
  [string]$Mode = "Healthy",
  [string]$RuntimeDir = "",
  [string]$OutDir = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "watchdog_fake_drills\fake_process_$($Mode)_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $RuntimeDir) {
  $RuntimeDir = Join-Path $OutDir "runtime"
}
if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
}

$fakePid = 900000 + (Get-Random -Minimum 1000 -Maximum 9999)
$heartbeatPath = Join-Path $RuntimeDir "heartbeat.json"
$statePath = Join-Path $RuntimeDir "fake_process_state.json"
$now = [DateTimeOffset]::UtcNow
$status = "healthy"

if ($Mode -eq "StopFlag") {
  $status = "stop_observed"
} elseif ($Mode -eq "Hung") {
  $status = "hung"
}

$state = [ordered]@{
  schema_version = "A11D_fake_watchdog_process_v1"
  mode = $Mode
  fake_pid = $fakePid
  fake_process_owned_by_drill = $true
  status = $status
  runtime_dir = $RuntimeDir
  heartbeat_path = $heartbeatPath
  started_at_iso = $now.ToString("o")
  real_process_started = $false
  real_process_kill_performed = $false
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  product_mission_executed = $false
}

if (-not $DryRun) {
  if ($Mode -eq "Hung") {
    $stale = $now.AddSeconds(-120)
    $heartbeat = [ordered]@{
      schema_version = "A11B_watchdog_heartbeat_v1"
      timestamp_iso = $stale.ToString("o")
      timestamp_unix = $stale.ToUnixTimeSeconds()
      controller_pid = $fakePid
      controller_started_at_iso = $now.AddMinutes(-10).ToString("o")
      state = "FAKE_PROCESS_HUNG"
      state_entered_at_iso = $now.AddMinutes(-10).ToString("o")
      state_max_duration_seconds = 60
      current_mission_id = "A11D_FAKE_PROCESS_HUNG"
      current_mission_risk_tier = "green"
      current_mission_timebox_minutes = 10
      missions_completed_this_session = 0
      missions_failed_this_session = 0
      missions_quarantined_this_session = 0
      session_id = "A11D_fake_hung"
      session_started_at_iso = $now.AddMinutes(-10).ToString("o")
      branch = (git -C (Get-AutopilotRepoRoot) branch --show-current).Trim()
      last_commit_sha = (git -C (Get-AutopilotRepoRoot) rev-parse --short HEAD).Trim()
      stop_flag_observed = $false
      next_heartbeat_due_iso = $stale.AddSeconds(30).ToString("o")
      anomalies = @("simulated stale heartbeat")
    }
    $heartbeat | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $heartbeatPath -Encoding UTF8
  } else {
    if ($Mode -eq "StopFlag") {
      Set-Content -LiteralPath (Join-Path $RuntimeDir "STOP") -Value "A11D fake process STOP flag" -Encoding UTF8
    }
    & "$PSScriptRoot\write_heartbeat.ps1" `
      -RuntimeDir $RuntimeDir `
      -HeartbeatPath $heartbeatPath `
      -State "FAKE_PROCESS_$($Mode.ToUpperInvariant())" `
      -MissionId "A11D_FAKE_PROCESS_$($Mode.ToUpperInvariant())" `
      -RiskTier "green" `
      -StateMaxDurationSeconds 300 | Out-Null
  }
  $state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

$result = [ordered]@{
  status = if ($DryRun) { "dry_run" } else { "simulated" }
  mode = $Mode
  fake_pid = $fakePid
  runtime_dir = $RuntimeDir
  out_dir = $OutDir
  heartbeat_path = $heartbeatPath
  state_path = $statePath
  fake_process_state = $state
  real_process_started = $false
  real_process_kill_performed = $false
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 12
