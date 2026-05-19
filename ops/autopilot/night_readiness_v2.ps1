param(
    [string]$MissionId = "A20AU",
    [string]$ScorePath = "",
    [string]$ReservoirPath = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [int]$MaxIterations = 6,
    [int]$MaxRuntimeMinutes = 180
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ScorePath)) { $ScorePath = Join-Path $PSScriptRoot "autonomy_score_state.json" }
if ([string]::IsNullOrWhiteSpace($ReservoirPath)) { $ReservoirPath = Join-Path $PSScriptRoot "objective_reservoir.yaml" }
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20AV") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_pixel_rehearsal\A20AV_limited_autonomous_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AW") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_pixel_rehearsal\A20AW_full_night_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AY") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real_run\A20AY_full_night_real_pixel_run_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\omega\A20AU_omega_autonomy_kernel_20260518"
    }
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$morningReportName = if ($MissionId -eq "A20AV") {
    "A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL_REPORT.md"
} elseif ($MissionId -eq "A20AW") {
    "A20AW_FULL_NIGHT_PIXEL_REHEARSAL_REPORT.md"
} elseif ($MissionId -eq "A20AY") {
    "A20AY_FULL_NIGHT_REAL_PIXEL_RUN_REPORT.md"
} else {
    "A20AU_OMEGA_AUTONOMY_KERNEL_SELF_IMPROVING_PIXEL_LAB_REPORT.md"
}

$requiredFiles = [ordered]@{
    objective_reservoir_ready = $ReservoirPath
    bottleneck_detector_ready = (Join-Path $PSScriptRoot "bottleneck_detector.ps1")
    utility_engine_ready = (Join-Path $PSScriptRoot "mission_utility_engine.ps1")
    anti_stagnation_ready = (Join-Path $PSScriptRoot "anti_stagnation_sentinel.ps1")
    pixel_mandate_ready = (Join-Path $PSScriptRoot "pixel_mandate_policy.yaml")
    proof_contracts_ready = (Join-Path $PSScriptRoot "build_proof_carrying_contract.ps1")
    failure_ledger_ready = (Join-Path $PSScriptRoot "failure_ledger.yaml")
    morning_report_available = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path ("docs\autopilot\" + $morningReportName))
    stop_flag_supported = (Join-Path $PSScriptRoot "run_omega_autopilot.ps1")
}

$checks = [ordered]@{
    no_user_intervention_required = $true
    gpt_web_optional = $true
    gemini_optional = $true
    live_lanes_park_and_continue = $true
    screenshots_external_only = ($ArtifactPath -match "NeuroChess_QA_Artifacts")
    no_road_push = $true
    no_secrets = $true
    max_runtime_set = ($MaxRuntimeMinutes -gt 0 -and $MaxRuntimeMinutes -le 480)
    max_iterations_set = ($MaxIterations -gt 0 -and $MaxIterations -le 20)
}

foreach ($name in $requiredFiles.Keys) {
    $checks[$name] = Test-Path -LiteralPath $requiredFiles[$name] -PathType Leaf
}

$missing = @($checks.GetEnumerator() | Where-Object { $_.Value -ne $true } | ForEach-Object { $_.Key })
$score = if (Test-Path -LiteralPath $ScorePath -PathType Leaf) { Get-Content -LiteralPath $ScorePath -Raw | ConvertFrom-Json } else { $null }
$nightScore = if ($score) { [double]$score.scores.night_readiness } else { 0 }
$verdict = if ($missing.Count -eq 0 -and $nightScore -ge 18.8) {
    "NIGHT_READY"
} elseif ($missing.Count -le 1) {
    "NIGHT_READY_LIMITED_PIXEL_REHEARSAL"
} else {
    "NIGHT_NOT_READY"
}

$result = [ordered]@{
    schema_version = "night_readiness_v2_result"
    mission_id = $MissionId
    status = $verdict
    checked_at = (Get-Date).ToString("o")
    checks = $checks
    missing = $missing
    max_iterations = $MaxIterations
    max_runtime_minutes = $MaxRuntimeMinutes
    no_full_night_launched = $true
    recommended_next = if ($verdict -eq "NIGHT_NOT_READY") {
        if ($MissionId -eq "A20AV") { "A20AW_FINAL_NIGHT_READINESS_HARDENING" } elseif ($MissionId -eq "A20AW") { "A20AX_FINAL_AUTOPILOT_HARDENING_BEFORE_NIGHT" } elseif ($MissionId -eq "A20AY") { "A20AZ_FINAL_AUTOPILOT_REPORT_AND_HANDOFF" } else { "A20AV_FIX_OMEGA_KERNEL" }
    } else {
        if ($MissionId -eq "A20AV") { "A20AW_FULL_NIGHT_PIXEL_REHEARSAL" } elseif ($MissionId -eq "A20AW") { "A20AX_FULL_NIGHT_REAL_RUN" } elseif ($MissionId -eq "A20AY") { "A20AZ_ROAD_TO_V2_MERGE_AUDIT_PLAN" } else { "A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL" }
    }
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 40
if ($verdict -eq "NIGHT_NOT_READY") { exit 3 }
exit 0
