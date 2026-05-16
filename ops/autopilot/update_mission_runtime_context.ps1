param(
  [string]$CurrentTask = "",
  [string]$RiskTier = "",
  [string]$WorkType = "",
  [string]$NextExpectedStep = "",
  [string[]]$ActiveConstraints = @(),
  [string[]]$RecentDecisions = @(),
  [string[]]$ActiveRisks = @(),
  [string[]]$DoNotTouch = @(),
  [string]$OutPath = "",
  [string]$ReportDir = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$repoRoot = Get-AutopilotRepoRoot
if (-not $OutPath) {
  $OutPath = Join-Path $repoRoot "ops\autopilot\runtime\current_mission_context.json"
}
if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "runtime_context\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$context = [ordered]@{
  current_task = $CurrentTask
  base_head = (git -C $repoRoot rev-parse --short HEAD).Trim()
  current_branch = (git -C $repoRoot branch --show-current).Trim()
  risk_tier = $RiskTier
  work_type = $WorkType
  active_constraints = @($ActiveConstraints)
  recent_decisions = @($RecentDecisions)
  active_risks = @($ActiveRisks)
  do_not_touch = @($DoNotTouch)
  last_successful_commit = (git -C $repoRoot rev-parse --short HEAD).Trim()
  next_expected_step = $NextExpectedStep
  source_of_truth_note = "Runtime context is not source of truth. Use Git, committed docs, and evidence packs."
}

$report = [ordered]@{
  status = "pass"
  dry_run = [bool]$DryRun
  out_path = $OutPath
  context = $context
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutPath) | Out-Null
  $context | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutPath -Encoding UTF8
  $report.wrote_context = $true
} else {
  $report.wrote_context = $false
}

$reportPath = Join-Path $ReportDir "mission_runtime_context_report.json"
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report | ConvertTo-Json -Depth 12
exit 0
