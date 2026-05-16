param(
  [string]$RuntimeDir = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultWatchdogRuntimeDir {
  if ($env:USERPROFILE) {
    return (Join-Path $env:USERPROFILE "AgentOS\runtime")
  }
  return "C:\Users\suley\AgentOS\runtime"
}

if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultWatchdogRuntimeDir }

$flags = @("STOP", "PAUSE", "DRAIN", "KILL")
$found = [System.Collections.Generic.List[string]]::new()
foreach ($flag in $flags) {
  if (Test-Path -LiteralPath (Join-Path $RuntimeDir $flag)) {
    $found.Add($flag) | Out-Null
  }
}

$recommended = "continue"
if ($found -contains "KILL") {
  $recommended = "reserved hard stop requested; scaffold reports only"
} elseif ($found -contains "STOP") {
  $recommended = "graceful stop after current atomic operation"
} elseif ($found -contains "DRAIN") {
  $recommended = "finish session, write final report, exit"
} elseif ($found -contains "PAUSE") {
  $recommended = "finish current mission and do not start another"
}

[ordered]@{
  stop_requested = ($found -contains "STOP")
  pause_requested = ($found -contains "PAUSE")
  drain_requested = ($found -contains "DRAIN")
  kill_requested = ($found -contains "KILL")
  flags_found = @($found)
  recommended_action = $recommended
  runtime_dir = $RuntimeDir
  real_process_stop_performed = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 10
