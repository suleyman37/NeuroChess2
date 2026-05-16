param(
  [string]$RunMetadataJson = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $RunMetadataJson) {
  $RunMetadataJson = Join-Path $PSScriptRoot "fixtures\product_safe_night_mode_report_example.json"
}
if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "product_safe_night_mode\reports\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$metadata = Get-Content -LiteralPath $RunMetadataJson -Raw | ConvertFrom-Json
$recommendation = if ($metadata.morning_recommendation) { [string]$metadata.morning_recommendation } else { "NEEDS_REWORK" }
$allowedRecommendations = @("READY_TO_REVIEW", "NEEDS_REWORK", "ABANDON_BRANCH", "QUARANTINE_REQUIRED")
if ($allowedRecommendations -notcontains $recommendation) {
  $recommendation = "NEEDS_REWORK"
}

$report = [ordered]@{
  schema_version = "A13_product_safe_night_mode_morning_report"
  run_id = [string]$metadata.run_id
  base_branch = [string]$metadata.base_branch
  base_head = [string]$metadata.base_head
  final_branch = [string]$metadata.final_branch
  final_head = [string]$metadata.final_head
  missions_attempted = [int]$metadata.missions_attempted
  missions_succeeded = [int]$metadata.missions_succeeded
  missions_failed = [int]$metadata.missions_failed
  missions_quarantined = [int]$metadata.missions_quarantined
  branches = @($metadata.branches)
  commits = @($metadata.commits)
  stop_reason = [string]$metadata.stop_reason
  evidence_paths = @($metadata.evidence_paths)
  morning_recommendation = $recommendation
  product_code_auto_merged = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  report_dir = $OutDir
}

$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "product_safe_night_mode_report.json") -Encoding UTF8

$md = @(
  "# Product-Safe Night Mode Morning Report",
  "",
  "Run id: $($report.run_id)",
  "Base: $($report.base_branch) $($report.base_head)",
  "Final: $($report.final_branch) $($report.final_head)",
  "Missions attempted: $($report.missions_attempted)",
  "Missions succeeded: $($report.missions_succeeded)",
  "Missions failed: $($report.missions_failed)",
  "Missions quarantined: $($report.missions_quarantined)",
  "Stop reason: $($report.stop_reason)",
  "Morning recommendation: $($report.morning_recommendation)",
  "",
  "Product code auto-merged: false",
  "",
  "Evidence paths:",
  (($report.evidence_paths | ForEach-Object { "- $_" }) -join "`n")
)
$md | Set-Content -LiteralPath (Join-Path $OutDir "product_safe_night_mode_report.md") -Encoding UTF8

$report | ConvertTo-Json -Depth 10
