param(
  [ValidateSet("WriteEventAtomic", "ListInboxEvents", "MoveEventToProcessing", "MarkEventProcessed", "MarkEventFailed", "ValidateEvent")]
  [string]$Action = "ListInboxEvents",
  [string]$RuntimeDir = "",
  [string]$EventPath = "",
  [string]$EventJson = "",
  [string]$EventType = "",
  [string]$SessionId = "",
  [int]$Sequence = 0,
  [string]$MissionId = "",
  [string]$Reason = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultControlPlaneRuntimeDir {
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE "AgentOS\runtime") }
  return "C:\Users\suley\AgentOS\runtime"
}

function Initialize-EventDirs {
  param([string]$Root)
  foreach ($relative in @("events\inbox", "events\processing", "events\processed", "events\failed", "logs")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $relative) | Out-Null
  }
}

function Get-AllowedEventTypes {
  return @(
    "SESSION_STARTED",
    "SESSION_STOP_REQUESTED",
    "MISSION_PROPOSED",
    "MISSION_CONTRACT_REGISTERED",
    "MISSION_STARTED",
    "MISSION_COMPLETED",
    "MISSION_FAILED",
    "MISSION_CONTRACT_MISMATCH",
    "PROMPT_FIREWALL_REJECTED",
    "REQUEST_MORE_USED",
    "STRATEGIC_PULSE_RECEIVED",
    "BRIDGE_FAILURE",
    "WATCHDOG_WARNING",
    "WATCHDOG_RESCUE_CREATED",
    "TIMEBOX_CHECKPOINT",
    "BRANCH_CREATED",
    "COMMIT_CREATED",
    "PUSH_COMPLETED",
    "QUARANTINE_REQUIRED",
    "SESSION_DRAINED",
    "SESSION_STOPPED"
  )
}

function Test-EventObject {
  param($Event)
  $violations = [System.Collections.Generic.List[string]]::new()
  $names = if ($Event -is [System.Collections.IDictionary]) { @($Event.Keys) } else { @($Event.PSObject.Properties.Name) }
  foreach ($field in @("schema_version", "event_id", "session_id", "sequence", "event_type", "created_at", "payload")) {
    if ($names -notcontains $field) {
      $violations.Add("missing field: $field") | Out-Null
    }
  }
  $schemaVersion = if ($Event -is [System.Collections.IDictionary]) { $Event["schema_version"] } else { $Event.schema_version }
  $eventType = if ($Event -is [System.Collections.IDictionary]) { $Event["event_type"] } else { $Event.event_type }
  $sequenceValue = if ($Event -is [System.Collections.IDictionary]) { $Event["sequence"] } else { $Event.sequence }
  if (($names -contains "schema_version") -and $schemaVersion -ne "A16A_control_plane_event_v1") {
    $violations.Add("schema_version must be A16A_control_plane_event_v1") | Out-Null
  }
  if (($names -contains "event_type") -and ((Get-AllowedEventTypes) -notcontains [string]$eventType)) {
    $violations.Add("unsupported event_type: $eventType") | Out-Null
  }
  if ($names -contains "sequence") {
    try {
      if ([int]$sequenceValue -le 0) { $violations.Add("sequence must be positive") | Out-Null }
    } catch {
      $violations.Add("sequence must be numeric") | Out-Null
    }
  }
  return @($violations)
}

function New-ControlPlaneEvent {
  param([string]$Type, [string]$Session, [int]$Seq, [string]$Mission, [string]$Why)
  if (-not $Session) { $Session = "session_unknown" }
  if ($Seq -le 0) { $Seq = 1 }
  return [ordered]@{
    schema_version = "A16A_control_plane_event_v1"
    event_id = "evt_$([guid]::NewGuid().ToString('N'))"
    session_id = $Session
    sequence = $Seq
    event_type = $Type
    created_at = [DateTimeOffset]::UtcNow.ToString("o")
    mission_id = $Mission
    source = "control_plane_events.ps1"
    payload = [ordered]@{
      reason = $Why
    }
  }
}

function Read-EventFromInputs {
  if ($EventJson) { return ($EventJson | ConvertFrom-Json) }
  if ($EventPath) { return (Get-Content -LiteralPath $EventPath -Raw | ConvertFrom-Json) }
  if ($EventType) { return (New-ControlPlaneEvent -Type $EventType -Session $SessionId -Seq $Sequence -Mission $MissionId -Why $Reason) }
  throw "Provide -EventJson, -EventPath, or -EventType."
}

function Write-EventAtomic {
  param($Event, [string]$Root)
  $violations = @(Test-EventObject $Event)
  if ($violations.Count -gt 0) { throw "Invalid event: $($violations -join '; ')" }
  $inbox = Join-Path $Root "events\inbox"
  New-Item -ItemType Directory -Force -Path $inbox | Out-Null
  $name = "{0:D6}_{1}_{2}.json" -f ([int]$Event.sequence), ([string]$Event.event_type), ([string]$Event.event_id)
  $tmp = Join-Path $inbox "$name.tmp"
  $path = Join-Path $inbox $name
  $Event | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tmp -Encoding UTF8
  $roundTrip = Get-Content -LiteralPath $tmp -Raw | ConvertFrom-Json
  $roundTripViolations = @(Test-EventObject $roundTrip)
  if ($roundTripViolations.Count -gt 0) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "Event temp file failed validation: $($roundTripViolations -join '; ')"
  }
  Move-Item -LiteralPath $tmp -Destination $path -Force
  return $path
}

function Get-EventSequence {
  param([string]$Path)
  try {
    $event = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    return [int]$event.sequence
  } catch {
    return -1
  }
}

function Get-InboxSummary {
  param([string]$Root)
  $inbox = Join-Path $Root "events\inbox"
  $files = @(Get-ChildItem -LiteralPath $inbox -Filter "*.json" -File -ErrorAction SilentlyContinue | Sort-Object Name)
  $events = @()
  $sequences = @()
  foreach ($file in $files) {
    $seq = Get-EventSequence -Path $file.FullName
    if ($seq -gt 0) { $sequences += $seq }
    $events += [ordered]@{ path = $file.FullName; sequence = $seq; name = $file.Name }
  }
  $gap = $false
  $missing = @()
  if ($sequences.Count -gt 1) {
    $sorted = @($sequences | Sort-Object)
    for ($i = $sorted[0]; $i -le $sorted[-1]; $i++) {
      if ($sorted -notcontains $i) {
        $gap = $true
        $missing += $i
      }
    }
  }
  return [ordered]@{ events = @($events); sequence_gap_detected = $gap; missing_sequences = @($missing) }
}

function Move-EventFile {
  param([string]$Path, [string]$DestinationDir)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Event path not found: $Path" }
  New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
  $destination = Join-Path $DestinationDir (Split-Path -Leaf $Path)
  Move-Item -LiteralPath $Path -Destination $destination -Force
  return $destination
}

function Append-MissionLog {
  param([string]$Root, [string]$Path, [string]$Status)
  $event = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  $line = [ordered]@{
    logged_at = [DateTimeOffset]::UtcNow.ToString("o")
    status = $Status
    event_id = $event.event_id
    sequence = $event.sequence
    event_type = $event.event_type
    session_id = $event.session_id
    mission_id = $event.mission_id
  } | ConvertTo-Json -Compress -Depth 10
  $logPath = Join-Path $Root "logs\mission_log.jsonl"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  return $logPath
}

if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultControlPlaneRuntimeDir }
Initialize-EventDirs -Root $RuntimeDir

try {
  switch ($Action) {
    "WriteEventAtomic" {
      $event = Read-EventFromInputs
      $path = Write-EventAtomic -Event $event -Root $RuntimeDir
      $payload = [ordered]@{ status = "written"; event_path = $path; event = $event }
    }
    "ListInboxEvents" {
      $summary = Get-InboxSummary -Root $RuntimeDir
      $payload = [ordered]@{ status = "listed"; inbox = (Join-Path $RuntimeDir "events\inbox"); events = $summary.events; sequence_gap_detected = $summary.sequence_gap_detected; missing_sequences = $summary.missing_sequences }
      if ($summary.sequence_gap_detected) { $payload.recommended_action = "STOP_FOR_SUPERVISOR" } else { $payload.recommended_action = "CONTINUE" }
    }
    "MoveEventToProcessing" {
      $destination = Move-EventFile -Path $EventPath -DestinationDir (Join-Path $RuntimeDir "events\processing")
      $payload = [ordered]@{ status = "processing"; event_path = $destination }
    }
    "MarkEventProcessed" {
      $destination = Move-EventFile -Path $EventPath -DestinationDir (Join-Path $RuntimeDir "events\processed")
      $logPath = Append-MissionLog -Root $RuntimeDir -Path $destination -Status "processed"
      $payload = [ordered]@{ status = "processed"; event_path = $destination; mission_log_path = $logPath }
    }
    "MarkEventFailed" {
      $destination = Move-EventFile -Path $EventPath -DestinationDir (Join-Path $RuntimeDir "events\failed")
      $reasonPath = "$destination.reason.txt"
      Set-Content -LiteralPath $reasonPath -Value $Reason -Encoding UTF8
      $logPath = Append-MissionLog -Root $RuntimeDir -Path $destination -Status "failed"
      $payload = [ordered]@{ status = "failed"; event_path = $destination; reason_path = $reasonPath; mission_log_path = $logPath }
    }
    "ValidateEvent" {
      $event = Read-EventFromInputs
      $violations = @(Test-EventObject $event)
      $valid = $violations.Count -eq 0
      $payload = [ordered]@{ status = if ($valid) { "valid" } else { "invalid" }; valid = $valid; violations = @($violations) }
      $payload.live_chatgpt_called = $false
      $payload.product_mission_executed = $false
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
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
