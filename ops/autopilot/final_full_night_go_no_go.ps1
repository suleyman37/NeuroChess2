param(
    [string]$MissionId = "A20AX",
    [string]$A20AWReportPath = "",
    [string]$ProposedFullNightBranch = "",
    [string]$OutPath = "",
    [switch]$DryRunAlerts
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($A20AWReportPath)) {
    $A20AWReportPath = Join-Path $RepoRoot "docs\autopilot\A20AW_FULL_NIGHT_PIXEL_REHEARSAL_REPORT.md"
}
if ([string]::IsNullOrWhiteSpace($ProposedFullNightBranch)) {
    $ProposedFullNightBranch = "auto/a20ay-full-night-real-pixel-run-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    $json = if ($start -ge 0) { $text.Substring($start) | ConvertFrom-Json } else { $null }
    if ($AcceptExitCodes -notcontains $exit) {
        throw "Unexpected exit code $exit from $ScriptPath`: $text"
    }
    return $json
}

$requiredFiles = @(
    "ops/autopilot/full_night_control_policy.yaml",
    "ops/autopilot/full_night_branch_policy.yaml",
    "ops/autopilot/full_night_kill_switch.ps1",
    "ops/autopilot/full_night_alerts.ps1",
    "ops/autopilot/morning_report_schema.json",
    "ops/autopilot/full_night_meta_drift_guard.ps1",
    "ops/autopilot/full_night_score_guard.ps1",
    "docs/autopilot/FULL_NIGHT_CONTROL_CONTRACT.md",
    "docs/autopilot/FULL_NIGHT_KILL_SWITCH.md",
    "docs/autopilot/FULL_NIGHT_BRANCH_QUARANTINE.md",
    "docs/autopilot/FULL_NIGHT_MORNING_REPORT_CONTRACT.md",
    "docs/autopilot/FULL_NIGHT_GO_NO_GO.md"
)
$missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $RepoRoot $_) -PathType Leaf) })

$reportText = if (Test-Path -LiteralPath $A20AWReportPath -PathType Leaf) { Get-Content -LiteralPath $A20AWReportPath -Raw } else { "" }
$a20awCandidate = $reportText -match "FULL_NIGHT_PIXEL_REHEARSAL_PASS_19_5_CANDIDATE" -and $reportText -match "NIGHT_READY"

$night = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "night_readiness_v2.ps1") -Arguments @("-MissionId", "A20AW", "-MaxIterations", "12", "-MaxRuntimeMinutes", "480") -AcceptExitCodes @(0,3)
$kill = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "full_night_kill_switch.ps1") -Arguments @("-Action", "Check", "-MissionId", $MissionId)
$alertArgs = @("-Event", "Started", "-MissionId", $MissionId, "-Reason", "go_no_go_dry_run", "-DryRun")
$alerts = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "full_night_alerts.ps1") -Arguments $alertArgs
$meta = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "full_night_meta_drift_guard.ps1") -Arguments @("-ObjectiveId", "A20AY_BUILD_NORTH_STAR_REVIEW_MICRO_FLOW", "-VisualProductionBottleneck") -AcceptExitCodes @(0,4)
$score = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "full_night_score_guard.ps1") -Arguments @("-PreviousOverall", "19.5", "-NewOverall", "19.5", "-ScreenshotCount", "6", "-MissionDoctorPassCount", "6", "-TestsPassed", "-RequestedLabel", "FULL_NIGHT_REHEARSAL_CONFIRMED")

$branchPattern = '^auto/a20ay-full-night-real-pixel-run-[0-9]{8}(-[0-9]{6})?$'
$branchValid = $ProposedFullNightBranch -match $branchPattern
$schema = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\morning_report_schema.json") -Raw | ConvertFrom-Json
$morningReportValid = @("runtime", "iterations", "pixel_deltas", "useful_pixel_deltas", "weak_deltas", "screenshots_path", "mission_doctor_summary", "failure_ledger_summary", "protocol_memory_update", "score_before_after", "night_readiness_v2_result", "safety_scan", "final_git_status", "recommended_next_step", "go_no_go") | Where-Object { @($schema.required) -notcontains $_ }
$statusLines = & git -C $RepoRoot status --short
$forbiddenStatus = @($statusLines | Where-Object { $_ -match ' (backend/|package\.json|package-lock\.json|ops/autopilot/local/|ops/autopilot/runtime/|qa_artifacts/|.*\.(png|jpg|jpeg|webp|gif)$|\.serena/)' })

$violations = @()
if ($missing.Count -gt 0) { $violations += "missing_required_hardening_files" }
if (-not $a20awCandidate) { $violations += "a20aw_not_full_night_candidate" }
if ([string]$night.status -ne "NIGHT_READY") { $violations += "night_readiness_not_ready" }
if ([string]$kill.status -ne "FULL_NIGHT_RUN_ALLOWED") { $violations += "kill_switch_active" }
if ([string]$alerts.status -notin @("ALERT_DRY_RUN", "ALERT_WRITTEN_LOCAL", "ALERT_SENT_NTFY", "ALERT_SUPPRESSED_COOLDOWN")) { $violations += "alert_dry_run_not_ready" }
if (-not $branchValid) { $violations += "branch_quarantine_invalid" }
if ($morningReportValid.Count -gt 0) { $violations += "morning_report_contract_invalid" }
if ([string]$meta.status -ne "META_DRIFT_GUARD_PASS") { $violations += "meta_drift_guard_not_pass" }
if ([string]$score.status -ne "SCORE_GUARD_PASS") { $violations += "score_guard_not_pass" }
if ($forbiddenStatus.Count -gt 0) { $violations += "forbidden_paths_in_git_status" }

$resultStatus = if ($violations.Count -eq 0) {
    "READY_FOR_FULL_NIGHT"
} elseif ($a20awCandidate -and [string]$night.status -like "NIGHT_READY*") {
    "READY_FOR_LIMITED_SECOND_REHEARSAL"
} else {
    "NO_GO"
}

$result = [ordered]@{
    schema_version = "final_full_night_go_no_go_v1"
    mission_id = $MissionId
    status = $resultStatus
    proposed_full_night_branch = $ProposedFullNightBranch
    a20aw_full_night_candidate = $a20awCandidate
    night_readiness = $night.status
    kill_switch = $kill.status
    alerts = $alerts.status
    branch_quarantine_valid = $branchValid
    morning_report_contract_valid = ($morningReportValid.Count -eq 0)
    meta_drift_guard = $meta.status
    score_guard = $score.status
    violations = $violations
    forbidden_git_status = $forbiddenStatus
    ready_for_full_night = ($resultStatus -eq "READY_FOR_FULL_NIGHT")
    allowed_next_mission = if ($resultStatus -eq "READY_FOR_FULL_NIGHT") { "A20AY_FULL_NIGHT_REAL_PIXEL_RUN" } elseif ($resultStatus -eq "READY_FOR_LIMITED_SECOND_REHEARSAL") { "A20AY_SECOND_FULL_NIGHT_REHEARSAL" } else { "A20AY_FIX_FINAL_HARDENING" }
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 40
if ($resultStatus -eq "NO_GO") { exit 9 }
exit 0
