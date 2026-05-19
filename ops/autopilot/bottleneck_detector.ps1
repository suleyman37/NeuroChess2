param(
    [string]$ScorePath = "",
    [string]$SignatureStatusPath = "",
    [string]$FailureLedgerPath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ScorePath)) {
    $ScorePath = Join-Path $PSScriptRoot "autonomy_score_state.json"
}
if ([string]::IsNullOrWhiteSpace($SignatureStatusPath)) {
    $SignatureStatusPath = Join-Path $PSScriptRoot "signature_component_status.yaml"
}
if ([string]::IsNullOrWhiteSpace($FailureLedgerPath)) {
    $FailureLedgerPath = Join-Path $PSScriptRoot "failure_ledger.yaml"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing JSON file: $Path"
    }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-ScorePairs {
    param([object]$ScoreState)
    $pairs = @()
    foreach ($prop in $ScoreState.scores.PSObject.Properties) {
        if ($prop.Name -in @("overall", "target_overall")) { continue }
        $pairs += [pscustomobject]@{ name = $prop.Name; value = [double]$prop.Value }
    }
    return @($pairs | Sort-Object value, name)
}

$scoreState = Read-JsonFile -Path $ScorePath
$scorePairs = Get-ScorePairs -ScoreState $scoreState
$lowest = $scorePairs[0]
$scoreMap = @{}
foreach ($pair in $scorePairs) { $scoreMap[$pair.name] = [double]$pair.value }

$signatureText = if (Test-Path -LiteralPath $SignatureStatusPath -PathType Leaf) {
    Get-Content -LiteralPath $SignatureStatusPath -Raw
} else {
    ""
}
$failureText = if (Test-Path -LiteralPath $FailureLedgerPath -PathType Leaf) {
    Get-Content -LiteralPath $FailureLedgerPath -Raw
} else {
    ""
}

$visualScore = if ($scoreMap.ContainsKey("visual_production")) { [double]$scoreMap["visual_production"] } else { 0 }
$nightScore = if ($scoreMap.ContainsKey("night_readiness")) { [double]$scoreMap["night_readiness"] } else { 0 }
$operatorScore = if ($scoreMap.ContainsKey("operator_zero_friction")) { [double]$scoreMap["operator_zero_friction"] } else { 0 }
$overall = [double]$scoreState.scores.overall

$lastMissionWasMeta = [string]$scoreState.updated_by -match "HUMAN_TASTE|CONDUCTOR|NEURORELAY|ROUTER"
$tripledReady = $signatureText -match '(?m)^tripled_signature_count:\s*2\s*$'
$tastePacketsReady = $signatureText -match '(?m)^taste_packet_ready:\s*true\s*$'
$humanDataAbsent = $signatureText -match '(?m)^human_data_status:\s*HUMAN_DATA_ABSENT\s*$'
$signatureStagnation = $tripledReady -and $tastePacketsReady -and $humanDataAbsent
$liveFailureRepeats = @($failureText | Select-String -Pattern "recurrence_count:\s*[2-9]" -AllMatches).Count -gt 0
$noPixelStreak = if ($lastMissionWasMeta) { 1 } else { 0 }
$metaDriftDetected = $lastMissionWasMeta -and $visualScore -lt 18.5
$pixelMandateActive = ($visualScore -lt 18.5 -and $lastMissionWasMeta) -or $signatureStagnation

$secondary = @()
if ($visualScore -lt 18.5) { $secondary += "visual_production_below_18_5" }
if ($nightScore -lt 19) { $secondary += "night_readiness_below_19" }
if ($metaDriftDetected) { $secondary += "meta_drift_after_non_pixel_mission" }
if ($signatureStagnation) { $secondary += "tripled_signatures_need_refinement_or_rehearsal" }
if ($operatorScore -lt 19) { $secondary += "operator_friction_not_19" }

$blocked = @()
if ($liveFailureRepeats -or $failureText -match "live_gpt_web|chatgpt") { $blocked += "live_gpt_web" }
if ($failureText -match "gemini") { $blocked += "gemini" }
if ($blocked.Count -eq 0) { $blocked = @("live_gpt_web_optional", "gemini_optional") }

$recommendedObjective = if ($signatureStagnation) {
    "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS"
} elseif ($pixelMandateActive) {
    "A20AV_OMEGA_SELECTED_PIXEL_MISSION_RUN"
} elseif ($nightScore -lt 19) {
    "A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
} else {
    "A20AV_IMPORT_HUMAN_TASTE_RESULTS_AND_FINALIZE"
}

$result = [ordered]@{
    schema_version = "omega_bottleneck_detection_v1"
    status = "BOTTLENECK_DETECTED"
    primary_bottleneck = [string]$lowest.name
    primary_bottleneck_score = [double]$lowest.value
    secondary_bottlenecks = $secondary
    recommended_lane = if ($pixelMandateActive) { "pixel_production" } else { "autonomy_reliability" }
    recommended_objective = $recommendedObjective
    blocked_lanes = $blocked
    must_not_do = @(
        "do_not_launch_night_mode",
        "do_not_require_user_intervention",
        "do_not_block_on_live_web",
        "do_not_do_docs_only_if_pixel_mandate_active",
        "do_not_inflate_score_without_evidence"
    )
    pixel_mandate_active = [bool]$pixelMandateActive
    meta_drift_detected = [bool]$metaDriftDetected
    no_pixel_streak = $noPixelStreak
    live_web_over_focus = [bool]$liveFailureRepeats
    evidence_weakness = $false
    screenshot_quality_weakness = $false
    signature_status_stagnation = [bool]$signatureStagnation
    night_readiness_blockers = if ($nightScore -lt 19) { @("limited_pixel_rehearsal_not_run", "stop_flag_and_failure_ledger_need_v2_check") } else { @() }
    operator_friction = if ($operatorScore -lt 19) { "operator_zero_friction_below_19" } else { "acceptable" }
    current_overall = $overall
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 40
exit 0
