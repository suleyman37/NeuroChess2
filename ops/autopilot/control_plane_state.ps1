param(
  [ValidateSet("NewSession", "ReadState", "WriteStateAtomic", "UpdateState", "RecoverLastGood", "ValidateState")]
  [string]$Action = "ReadState",
  [string]$RuntimeDir = "",
  [string]$StatePath = "",
  [string]$InputPath = "",
  [string]$UpdateJson = "",
  [string]$SessionId = "",
  [int]$MaxSteps = 15,
  [int]$MaxHours = 8
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

function Get-DefaultControlPlaneRuntimeDir {
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE "AgentOS\runtime") }
  return "C:\Users\suley\AgentOS\runtime"
}

function Initialize-ControlPlaneRuntime {
  param([string]$Root)
  foreach ($relative in @(
    "state",
    "events\inbox",
    "events\processing",
    "events\processed",
    "events\failed",
    "logs",
    "locks",
    "reports"
  )) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $relative) | Out-Null
  }
}

function Get-StatePath {
  param([string]$Root, [string]$ExplicitPath)
  if ($ExplicitPath) { return $ExplicitPath }
  return (Join-Path $Root "state\night_session.json")
}

function Get-LastGoodPath {
  param([string]$Path)
  return (Join-Path (Split-Path -Parent $Path) "night_session.last_good.json")
}

function Get-RequiredStateFields {
  return @(
    "schema_version",
    "session_id",
    "started_at",
    "initial_head",
    "current_head",
    "branch",
    "status",
    "max_steps",
    "max_hours",
    "missions_attempted",
    "missions_succeeded",
    "missions_failed",
    "missions_quarantined",
    "current_step",
    "current_mission_id",
    "current_mission_hash",
    "mission_hashes_seen",
    "total_diff_lines",
    "total_failures",
    "consecutive_failures",
    "last_commit_sha",
    "last_successful_mission_id",
    "last_stop_reason",
    "active_branch",
    "active_risks",
    "disabled_features",
    "allowed_lanes",
    "forbidden_zones",
    "pending_events",
    "last_event_sequence",
    "last_state_update",
    "recommended_next_action"
  )
}

function Test-StateObject {
  param($State)
  $violations = [System.Collections.Generic.List[string]]::new()
  $names = if ($State -is [System.Collections.IDictionary]) { @($State.Keys) } else { @($State.PSObject.Properties.Name) }
  foreach ($field in Get-RequiredStateFields) {
    if ($names -notcontains $field) {
      $violations.Add("missing field: $field") | Out-Null
    }
  }
  $schemaVersion = if ($State -is [System.Collections.IDictionary]) { $State["schema_version"] } else { $State.schema_version }
  if (($names -contains "schema_version") -and $schemaVersion -ne "A16A_night_session_v1") {
    $violations.Add("schema_version must be A16A_night_session_v1") | Out-Null
  }
  foreach ($numberField in @("max_steps", "max_hours", "missions_attempted", "missions_succeeded", "missions_failed", "missions_quarantined", "current_step", "total_diff_lines", "total_failures", "consecutive_failures", "last_event_sequence")) {
    if ($names -contains $numberField) {
      $numberValue = if ($State -is [System.Collections.IDictionary]) { $State[$numberField] } else { $State.$numberField }
      try { [void][int]$numberValue } catch { $violations.Add("$numberField must be numeric") | Out-Null }
    }
  }
  return @($violations)
}

function Read-JsonChecked {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "JSON path not found: $Path" }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Write-StateAtomic {
  param($State, [string]$Path)
  $violations = @(Test-StateObject $State)
  if ($violations.Count -gt 0) {
    throw "Invalid night session state: $($violations -join '; ')"
  }
  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $tmp = Join-Path $parent ("night_session.{0}.tmp" -f ([guid]::NewGuid().ToString("N")))
  $State | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tmp -Encoding UTF8
  $roundTrip = Get-Content -LiteralPath $tmp -Raw | ConvertFrom-Json
  $roundTripViolations = @(Test-StateObject $roundTrip)
  if ($roundTripViolations.Count -gt 0) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "State temp file failed validation: $($roundTripViolations -join '; ')"
  }
  Move-Item -LiteralPath $tmp -Destination $Path -Force
  Copy-Item -LiteralPath $Path -Destination (Get-LastGoodPath $Path) -Force
}

function New-NightSessionState {
  param([string]$Root, [string]$Id, [int]$Steps, [int]$Hours)
  $repoRoot = Get-AutopilotRepoRoot
  $head = "unknown"
  $branch = "unknown"
  try { $head = (git -C $repoRoot rev-parse --short HEAD).Trim() } catch {}
  try { $branch = (git -C $repoRoot branch --show-current).Trim() } catch {}
  if (-not $Id) { $Id = "night_$([guid]::NewGuid().ToString('N'))" }
  $now = [DateTimeOffset]::UtcNow.ToString("o")
  return [ordered]@{
    schema_version = "A16A_night_session_v1"
    session_id = $Id
    started_at = $now
    initial_head = $head
    current_head = $head
    branch = $branch
    status = "INITIALIZED"
    max_steps = $Steps
    max_hours = $Hours
    missions_attempted = 0
    missions_succeeded = 0
    missions_failed = 0
    missions_quarantined = 0
    current_step = 0
    current_mission_id = ""
    current_mission_hash = ""
    mission_hashes_seen = @()
    total_diff_lines = 0
    total_failures = 0
    consecutive_failures = 0
    last_commit_sha = $head
    last_successful_mission_id = ""
    last_stop_reason = ""
    active_branch = $branch
    active_risks = @()
    disabled_features = @("live_control_plane", "live_night_mode", "red_tier", "product_code_auto_merge")
    allowed_lanes = @("docs_only", "backend_readonly_ephemeral", "frontend_readonly_ephemeral", "smoke_test_only")
    forbidden_zones = @("Practice", "due_at", "Daily Plan", "training_items writes", "practice_attempts writes", "scoring writes", "XP/rank/Transfer")
    pending_events = @()
    last_event_sequence = 0
    last_state_update = $now
    recommended_next_action = "await_control_plane_integration"
  }
}

if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultControlPlaneRuntimeDir }
Initialize-ControlPlaneRuntime -Root $RuntimeDir
$resolvedStatePath = Get-StatePath -Root $RuntimeDir -ExplicitPath $StatePath

try {
  switch ($Action) {
    "NewSession" {
      $state = New-NightSessionState -Root $RuntimeDir -Id $SessionId -Steps $MaxSteps -Hours $MaxHours
      Write-StateAtomic -State $state -Path $resolvedStatePath
      $payload = [ordered]@{ status = "created"; state_path = $resolvedStatePath; last_good_path = (Get-LastGoodPath $resolvedStatePath); state = $state }
    }
    "ReadState" {
      $state = Read-JsonChecked -Path $resolvedStatePath
      $payload = [ordered]@{ status = "read"; state_path = $resolvedStatePath; state = $state }
    }
    "WriteStateAtomic" {
      if (-not $InputPath) { throw "WriteStateAtomic requires -InputPath" }
      $state = Read-JsonChecked -Path $InputPath
      Write-StateAtomic -State $state -Path $resolvedStatePath
      $payload = [ordered]@{ status = "written"; state_path = $resolvedStatePath; last_good_path = (Get-LastGoodPath $resolvedStatePath) }
    }
    "UpdateState" {
      if (-not $UpdateJson) { throw "UpdateState requires -UpdateJson" }
      $state = Read-JsonChecked -Path $resolvedStatePath
      $updates = $UpdateJson | ConvertFrom-Json
      foreach ($property in $updates.PSObject.Properties) {
        $state | Add-Member -Force -NotePropertyName $property.Name -NotePropertyValue $property.Value
      }
      $state.last_state_update = [DateTimeOffset]::UtcNow.ToString("o")
      Write-StateAtomic -State $state -Path $resolvedStatePath
      $payload = [ordered]@{ status = "updated"; state_path = $resolvedStatePath; state = $state }
    }
    "RecoverLastGood" {
      $lastGood = Get-LastGoodPath $resolvedStatePath
      $state = Read-JsonChecked -Path $lastGood
      $violations = @(Test-StateObject $state)
      if ($violations.Count -gt 0) { throw "last_good invalid: $($violations -join '; ')" }
      Copy-Item -LiteralPath $lastGood -Destination $resolvedStatePath -Force
      $payload = [ordered]@{ status = "recovered"; state_path = $resolvedStatePath; last_good_path = $lastGood; state = $state }
    }
    "ValidateState" {
      $path = if ($InputPath) { $InputPath } else { $resolvedStatePath }
      try {
        $state = Read-JsonChecked -Path $path
        $violations = @(Test-StateObject $state)
        $valid = $violations.Count -eq 0
      } catch {
        $state = $null
        $violations = @($_.Exception.Message)
        $valid = $false
      }
      $payload = [ordered]@{ status = if ($valid) { "valid" } else { "invalid" }; valid = $valid; state_path = $path; violations = @($violations) }
      $payload.live_chatgpt_called = $false
      $payload.product_mission_executed = $false
      $payload.codex_execution = $false
      $payload.commit = $false
      $payload.push = $false
      $payload | ConvertTo-Json -Depth 20
      if ($valid) { exit 0 } else { exit 1 }
    }
  }
  $payload.live_chatgpt_called = $false
  $payload.product_mission_executed = $false
  $payload.codex_execution = $false
  $payload.commit = $false
  $payload.push = $false
  $payload | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    action = $Action
    error = $_.Exception.Message
    state_path = $resolvedStatePath
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
