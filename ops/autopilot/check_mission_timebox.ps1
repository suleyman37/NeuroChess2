param(
  [string]$MissionId = "",
  [string]$RiskTier = "green",
  [string]$WorkType = "",
  [string]$StartTime = "",
  [double]$ElapsedMinutes = -1,
  [double]$TestElapsedMinutes = 0,
  [int]$WarningAfterMinutes = 8,
  [int]$CheckpointAfterMinutes = 10,
  [int]$RepairAttempts = 0,
  [int]$MaxRepairAttempts = 2,
  [switch]$LongTestsAllowed,
  [string]$FixturePath = "",
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "timebox_decisions\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if ($FixturePath) {
  $fixture = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
  $MissionId = [string]$fixture.mission_id
  $RiskTier = [string]$fixture.risk_tier
  $WorkType = [string]$fixture.work_type
  $ElapsedMinutes = [double]$fixture.elapsed_minutes
  $TestElapsedMinutes = [double]$fixture.test_elapsed_minutes
  $RepairAttempts = [int]$fixture.repair_attempts
  $LongTestsAllowed = [bool]$fixture.long_tests_allowed
}

if ($ElapsedMinutes -lt 0) {
  if ($StartTime) {
    $start = [datetime]::Parse($StartTime)
    $ElapsedMinutes = [math]::Round(((Get-Date) - $start).TotalMinutes, 2)
  } else {
    $ElapsedMinutes = 0
  }
}

$reasons = [System.Collections.Generic.List[string]]::new()
$decision = "CONTINUE"
$suggested = "continue"

if ($RepairAttempts -ge $MaxRepairAttempts) {
  $decision = "STOP_FOR_SUPERVISOR"
  $reasons.Add("repair attempts reached policy limit: $RepairAttempts >= $MaxRepairAttempts") | Out-Null
  $suggested = "build checkpoint report and ask supervisor"
} elseif ($RiskTier.ToLowerInvariant() -eq "red" -and $ElapsedMinutes -ge $CheckpointAfterMinutes) {
  $decision = "STOP_FOR_SUPERVISOR"
  $reasons.Add("red-tier mission exceeded checkpoint threshold") | Out-Null
  $suggested = "stop for supervisor before retry"
} elseif ($ElapsedMinutes -ge $CheckpointAfterMinutes) {
  $decision = "CHECKPOINT_STOP"
  $reasons.Add("elapsed time reached checkpoint threshold: $ElapsedMinutes >= $CheckpointAfterMinutes") | Out-Null
  $suggested = "soft stop and build checkpoint report"
} elseif ($ElapsedMinutes -ge $WarningAfterMinutes) {
  $decision = "WARN"
  $reasons.Add("elapsed time reached warning threshold: $ElapsedMinutes >= $WarningAfterMinutes") | Out-Null
  $suggested = "prepare to checkpoint if the next step is not decisive"
}

if ($LongTestsAllowed -and $TestElapsedMinutes -gt $CheckpointAfterMinutes -and $ElapsedMinutes -lt $WarningAfterMinutes) {
  $reasons.Add("long test/check time is tracked separately from active work") | Out-Null
}

$payload = [ordered]@{
  timebox_decision = $decision
  elapsed_minutes = $ElapsedMinutes
  test_elapsed_minutes = $TestElapsedMinutes
  warning_due = ($ElapsedMinutes -ge $WarningAfterMinutes)
  checkpoint_due = ($ElapsedMinutes -ge $CheckpointAfterMinutes)
  reasons = @($reasons)
  suggested_next_action = $suggested
  mission_id = $MissionId
  risk_tier = $RiskTier
  work_type = $WorkType
  hard_kill_enabled = $false
}

$path = Join-Path $ReportDir "timebox_decision.json"
$payload | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
$payload | Add-Member -NotePropertyName report_path -NotePropertyValue $path -Force
$payload | ConvertTo-Json -Depth 10
exit 0
