param(
  [string]$InputPath,
  [string]$EvidenceIndexPath,
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-InputPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

if (-not $OutDir) {
  $OutDir = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\morning_report_dryrun"
}
$outFullDir = Resolve-InputPath -Path $OutDir
New-Item -ItemType Directory -Force -Path $outFullDir | Out-Null

if ($InputPath) {
  $inputFullPath = Resolve-InputPath -Path $InputPath
  $data = Get-Content -LiteralPath $inputFullPath -Raw | ConvertFrom-Json
} elseif ($EvidenceIndexPath) {
  $evidenceFullPath = Resolve-InputPath -Path $EvidenceIndexPath
  $evidence = @(Get-Content -LiteralPath $evidenceFullPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_ | ConvertFrom-Json })
  $data = [pscustomobject]@{
    run_id = "evidence-index-dryrun"
    summary = "Dry-run generated from evidence index."
    branches = @()
    commits = @()
    e2e_deliverables = @()
    evidence = $evidence
    risks = @("Evidence index input only; branch details unavailable in dry-run.")
    recommended_next_action = "REVIEW_MORNING_REPORT_INPUTS"
  }
} else {
  throw "InputPath or EvidenceIndexPath is required"
}

$sections = @(
  "Run summary",
  "Branches",
  "Commits",
  "E2E deliverables",
  "Evidence",
  "Risks",
  "Branch classifications",
  "Recommended next action"
)

$branchLines = if ($data.branches) {
  @($data.branches) | ForEach-Object { "- $($_.name): $($_.classification)" }
} else { @("- none") }
$commitLines = if ($data.commits) {
  @($data.commits) | ForEach-Object { "- $($_.sha) $($_.branch): $($_.message)" }
} else { @("- none") }
$e2eLines = if ($data.e2e_deliverables) {
  @($data.e2e_deliverables) | ForEach-Object { "- $($_.id): $($_.status)" }
} else { @("- none") }
$evidenceLines = if ($data.evidence) {
  @($data.evidence) | ForEach-Object { "- $($_.artifact_id) [$($_.artifact_type)]: $($_.artifact_path)" }
} else { @("- none") }
$riskLines = if ($data.risks) {
  @($data.risks) | ForEach-Object { "- $_" }
} else { @("- none") }
$classificationLines = if ($data.branches) {
  @($data.branches) | ForEach-Object { "- $($_.name): $($_.classification)" }
} else { @("- none") }

$report = @(
  "# A20A Morning Report Dry-Run",
  "",
  "## Run summary",
  "$($data.summary)",
  "",
  "## Branches",
  $branchLines,
  "",
  "## Commits",
  $commitLines,
  "",
  "## E2E deliverables",
  $e2eLines,
  "",
  "## Evidence",
  $evidenceLines,
  "",
  "## Risks",
  $riskLines,
  "",
  "## Branch classifications",
  $classificationLines,
  "",
  "## Recommended next action",
  "$($data.recommended_next_action)"
) -join "`n"

$reportPath = Join-Path $outFullDir "morning_report_dryrun.md"
Set-Content -LiteralPath $reportPath -Value $report -Encoding UTF8

$missingSections = New-Object System.Collections.Generic.List[string]
foreach ($section in $sections) {
  if ($report -notmatch ("(?m)^##\s+{0}$" -f [regex]::Escape($section))) {
    $missingSections.Add($section) | Out-Null
  }
}

$pass = ($missingSections.Count -eq 0)
$result = [ordered]@{
  morning_report_dryrun_result = $(if ($pass) { "PASS" } else { "FAIL" })
  report_path = $reportPath
  required_sections = $sections
  missing_sections = @($missingSections)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if (-not $pass) { exit 2 }
exit 0
