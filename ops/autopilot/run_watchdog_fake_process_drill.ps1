param(
  [ValidateSet("All", "Healthy", "StopFlag", "Hung")]
  [string]$Scenario = "All",
  [string]$OutDir = "",
  [string]$RuntimeRoot = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "watchdog_fake_drills\A11D_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $RuntimeRoot) {
  $RuntimeRoot = Join-Path $OutDir "runtime"
}
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null

$scenarios = if ($Scenario -eq "All") { @("Healthy", "StopFlag", "Hung") } else { @($Scenario) }
$results = [System.Collections.Generic.List[object]]::new()

foreach ($scenarioName in $scenarios) {
  $scenarioDir = Join-Path $OutDir $scenarioName
  $runtimeDir = Join-Path $RuntimeRoot $scenarioName
  New-Item -ItemType Directory -Force -Path $scenarioDir | Out-Null
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

  $fake = (& "$PSScriptRoot\start_fake_watchdog_process.ps1" -Mode $scenarioName -RuntimeDir $runtimeDir -OutDir $scenarioDir) | ConvertFrom-Json
  $watchdog = (& "$PSScriptRoot\check_watchdog_status.ps1" -HeartbeatPath $fake.heartbeat_path -RuntimeDir $runtimeDir -WriteStopFlag) | ConvertFrom-Json
  $flags = (& "$PSScriptRoot\check_stop_flags.ps1" -RuntimeDir $runtimeDir) | ConvertFrom-Json
  $rescueDir = ""
  $rescueCreated = $false

  if ($scenarioName -eq "Hung" -or $flags.stop_requested) {
    $rescue = (& "$PSScriptRoot\build_watchdog_rescue_pack.ps1" -Reason "A11D fake process $scenarioName drill" -HeartbeatPath $fake.heartbeat_path -OutDir (Join-Path $scenarioDir "rescue")) | ConvertFrom-Json
    $rescueDir = $rescue.report_dir
    $rescueCreated = $true
  }

  $result = [ordered]@{
    scenario = $scenarioName
    mode = $fake.mode
    fake_pid = $fake.fake_pid
    runtime_dir = $runtimeDir
    heartbeat_path = $fake.heartbeat_path
    state_path = $fake.state_path
    watchdog_phase = $watchdog.watchdog_phase
    watchdog_action = $watchdog.action
    stop_flag_should_be_written = $watchdog.stop_flag_should_be_written
    stop_requested = $flags.stop_requested
    flags_found = @($flags.flags_found)
    rescue_created = $rescueCreated
    rescue_pack_dir = $rescueDir
    real_process_started = $false
    real_process_kill_performed = $false
    live_chatgpt_called = $false
    codex_execution = $false
    commit = $false
    push = $false
    product_mission_executed = $false
  }
  $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $scenarioDir "scenario_result.json") -Encoding UTF8
  $results.Add($result) | Out-Null
}

$summary = [ordered]@{
  schema_version = "A11D_watchdog_fake_process_drill_v1"
  scenario = $Scenario
  out_dir = $OutDir
  runtime_root = $RuntimeRoot
  scenarios = @($results)
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  real_process_kill_performed = $false
  product_mission_executed = $false
}

$jsonPath = Join-Path $OutDir "fake_process_drill_summary.json"
$mdPath = Join-Path $OutDir "fake_process_drill_summary.md"
$summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$md = @(
  "# Watchdog Fake Process Drill Summary",
  "",
  "Scenario: $Scenario",
  "Runtime root: $RuntimeRoot",
  "",
  "No real process was started or killed. No ChatGPT, Codex, commit, push, or product mission occurred.",
  "",
  "## Results"
)
foreach ($result in $results) {
  $md += "- $($result.scenario): phase=$($result.watchdog_phase), action=$($result.watchdog_action), rescue=$($result.rescue_created)"
}
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

$summary | Add-Member -Force -NotePropertyName report_json -NotePropertyValue $jsonPath
$summary | Add-Member -Force -NotePropertyName report_markdown -NotePropertyValue $mdPath
$summary | ConvertTo-Json -Depth 20
