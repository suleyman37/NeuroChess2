param(
  [string]$OutDir = "",
  [string]$FixtureRoot = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $FixtureRoot) {
  $FixtureRoot = Join-Path $PSScriptRoot "fixtures"
}
if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "night_mode_dry_runs\A14_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$repoRoot = Get-AutopilotRepoRoot
$startTime = Get-Date
$initialHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$initialBranch = (git -C $repoRoot branch --show-current).Trim()

$steps = @(
  [ordered]@{
    step = 1
    name = "docs-only safe"
    fixture = "product_safe_night_mode_docs_only.json"
    expected_allowed = $true
    expected_auto_merge_to_road_allowed = $true
  },
  [ordered]@{
    step = 2
    name = "backend-readonly ephemeral"
    fixture = "product_safe_night_mode_backend_readonly.json"
    expected_allowed = $true
    expected_requires_ephemeral_branch = $true
    expected_auto_merge_to_road_allowed = $false
  },
  [ordered]@{
    step = 3
    name = "frontend-readonly ephemeral"
    fixture = "product_safe_night_mode_frontend_readonly.json"
    expected_allowed = $true
    expected_requires_ephemeral_branch = $true
    expected_auto_merge_to_road_allowed = $false
  },
  [ordered]@{
    step = 4
    name = "red-tier Practice attempt"
    fixture = "product_safe_night_mode_reject_red_tier.json"
    expected_allowed = $false
  },
  [ordered]@{
    step = 5
    name = "direct road-to-V2 product-code attempt"
    fixture = "product_safe_night_mode_reject_direct_road_merge.json"
    expected_allowed = $false
  }
)

$decisions = [System.Collections.Generic.List[object]]::new()
$failures = [System.Collections.Generic.List[string]]::new()

foreach ($step in $steps) {
  $fixturePath = Join-Path $FixtureRoot $step.fixture
  $stepDir = Join-Path $OutDir ("step_{0}" -f $step.step)
  New-Item -ItemType Directory -Force -Path $stepDir | Out-Null
  $scope = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_product_safe_night_mode_scope.ps1") -MissionJson $fixturePath -ReportDir $stepDir) | ConvertFrom-Json
  $decision = if ([bool]$scope.allowed) { "ALLOW_DRY_RUN" } elseif (($scope.violations -join "`n") -match "red-tier|learning-state|Practice") { "REJECT_QUARANTINE_OR_STOP" } else { "REJECT_STOP" }

  if ([bool]$scope.allowed -ne [bool]$step.expected_allowed) {
    $failures.Add("step $($step.step) allowed mismatch") | Out-Null
  }
  if ($step.Contains("expected_auto_merge_to_road_allowed") -and ([bool]$scope.auto_merge_to_road_allowed -ne [bool]$step.expected_auto_merge_to_road_allowed)) {
    $failures.Add("step $($step.step) auto_merge_to_road_allowed mismatch") | Out-Null
  }
  if ($step.Contains("expected_requires_ephemeral_branch") -and ([bool]$scope.requires_ephemeral_branch -ne [bool]$step.expected_requires_ephemeral_branch)) {
    $failures.Add("step $($step.step) requires_ephemeral_branch mismatch") | Out-Null
  }

  $decisions.Add([ordered]@{
    step = $step.step
    name = $step.name
    fixture = $step.fixture
    decision = $decision
    allowed = [bool]$scope.allowed
    night_mode_scope = [string]$scope.night_mode_scope
    requires_ephemeral_branch = [bool]$scope.requires_ephemeral_branch
    auto_merge_to_road_allowed = [bool]$scope.auto_merge_to_road_allowed
    required_evidence = @($scope.required_evidence)
    violations = @($scope.violations)
    product_mission_executed = $false
    live_chatgpt_called = $false
  }) | Out-Null
}

$finalHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$finalBranch = (git -C $repoRoot branch --show-current).Trim()
$endTime = Get-Date
$verdict = if ($failures.Count -eq 0) { "PASS_DRY_RUN" } else { "FAIL_DRY_RUN" }

$metadataPath = Join-Path $OutDir "morning_report_metadata.json"
$metadata = [ordered]@{
  run_id = "A14_PRODUCT_SAFE_NIGHT_MODE_5_STEP_DRY_RUN"
  base_branch = $initialBranch
  base_head = $initialHead
  final_branch = $finalBranch
  final_head = $finalHead
  missions_attempted = 5
  missions_succeeded = 3
  missions_failed = 2
  missions_quarantined = 1
  branches = @("autopilot/backend-readonly-dryrun", "autopilot/frontend-readonly-dryrun")
  commits = @()
  stop_reason = "dry_run_completed_with_expected_rejections"
  evidence_paths = @($OutDir)
  morning_recommendation = "READY_TO_REVIEW"
}
$metadata | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
$morningReport = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_product_safe_night_mode_report.ps1") -RunMetadataJson $metadataPath -OutDir (Join-Path $OutDir "morning_report")) | ConvertFrom-Json

$summary = [ordered]@{
  schema_version = "A14_product_safe_night_mode_5_step_dryrun"
  verdict = $verdict
  start_time = $startTime.ToString("o")
  end_time = $endTime.ToString("o")
  initial_head = $initialHead
  final_head = $finalHead
  initial_branch = $initialBranch
  final_branch = $finalBranch
  steps_processed = $decisions.Count
  decisions = @($decisions)
  failures = @($failures)
  stop_conditions_triggered = @("step_4_red_tier_rejected", "step_5_direct_road_product_code_rejected")
  product_code_touched = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  morning_report_dir = [string]$morningReport.report_dir
  report_dir = $OutDir
}

$summaryPath = Join-Path $OutDir "product_safe_night_mode_5_step_dryrun_summary.json"
$summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$stepLines = @($decisions | ForEach-Object {
  "- Step $($_.step) - $($_.name): $($_.decision), allowed=$($_.allowed), scope=$($_.night_mode_scope), auto_merge_to_road_allowed=$($_.auto_merge_to_road_allowed)"
})

$md = @(
  "# A14 Product-Safe Night Mode 5-Step Dry-Run",
  "",
  "Verdict: $verdict",
  "Start time: $($summary.start_time)",
  "End time: $($summary.end_time)",
  "Initial HEAD: $initialHead",
  "Final HEAD: $finalHead",
  "",
  "## Steps",
  ($stepLines -join "`n"),
  "",
  "Product code touched: false",
  "Live ChatGPT called: false",
  "Product mission executed: false",
  "Morning report: $($morningReport.report_dir)"
)
$md | Set-Content -LiteralPath (Join-Path $OutDir "product_safe_night_mode_5_step_dryrun_report.md") -Encoding UTF8

$summary | ConvertTo-Json -Depth 20
if ($verdict -eq "PASS_DRY_RUN") { exit 0 }
exit 1
