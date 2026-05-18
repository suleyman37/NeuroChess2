param(
    [string]$MissionId = "UNKNOWN",
    [string[]]$ChangedFiles = @(),
    [int]$ScreenshotCount = 0,
    [switch]$RoadPushed,
    [switch]$RoadMerged,
    [switch]$SecretCommitted,
    [switch]$RuntimeCommitted,
    [switch]$WebBlocked,
    [string]$ReportPath = "",
    [string]$OutPath = "",
    [string]$ProductValueHint = "medium",
    [string]$AutomationValueHint = "high"
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$forbiddenTouched = @($ChangedFiles | Where-Object {
    $_ -match '^(backend|frontend)/' -or
    $_ -match '^ops/autopilot/(local|runtime)/' -or
    $_ -match '(^|/)package(-lock)?\.json$' -or
    $_ -match 'qa_artifacts|screenshots'
})
$safetyFail = [bool]($RoadPushed -or $RoadMerged -or $SecretCommitted -or $RuntimeCommitted -or $forbiddenTouched.Count -gt 0)
$verdict = if ($safetyFail) { "FAIL" } elseif ($WebBlocked) { "BLOCKED" } elseif ([string]::IsNullOrWhiteSpace($ReportPath)) { "PARTIAL" } else { "PASS" }
$visualValue = if ($ScreenshotCount -gt 0) { "medium" } else { "none" }
$productValue = if ($ChangedFiles.Count -eq 0) { "low" } elseif (($ChangedFiles -join " ") -match 'docs/design') { "medium" } else { $ProductValueHint }
$evidenceQuality = if ($ScreenshotCount -gt 0 -and -not [string]::IsNullOrWhiteSpace($ReportPath)) { "strong" } elseif (-not [string]::IsNullOrWhiteSpace($ReportPath)) { "acceptable" } else { "weak" }
$blockedLanes = @()
if ($WebBlocked) { $blockedLanes += "live_gpt_web" }
$doNotRepeat = @()
if ($WebBlocked) { $doNotRepeat += "do_not_retry_live_web_without_new_evidence" }
if ($safetyFail) { $doNotRepeat += "do_not_promote_or_push" }

$result = [ordered]@{
    schema_version = "mission_doctor_result_v1"
    mission_id = $MissionId
    verdict = $verdict
    product_value = $productValue
    visual_value = $visualValue
    automation_value = $AutomationValueHint
    safety_status = if ($safetyFail) { "FAIL" } else { "PASS" }
    evidence_quality = $evidenceQuality
    next_recommendation = if ($safetyFail) { "FIX_SAFETY_BEFORE_CONTINUING" } elseif ($WebBlocked) { "PARK_LIVE_LANE_AND_CONTINUE_OFFLINE" } else { "SELECT_NEXT_VISUAL_PRODUCTION_OBJECTIVE" }
    blocked_lanes = @($blockedLanes)
    do_not_repeat = @($doNotRepeat)
    score_delta = [ordered]@{
        autonomous_loop = if ($verdict -eq "PASS") { 0.2 } elseif ($verdict -eq "BLOCKED") { 0.05 } else { 0 }
        visual_production = if ($ScreenshotCount -gt 0) { 0.2 } else { 0 }
        safety_git = if ($safetyFail) { -5 } else { 0.05 }
    }
    forbidden_files_touched = @($forbiddenTouched)
    road_pushed = [bool]$RoadPushed
    road_merged = [bool]$RoadMerged
    secret_committed = [bool]$SecretCommitted
    runtime_committed = [bool]$RuntimeCommitted
    web_blocked = [bool]$WebBlocked
    no_user_intervention_required = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
if ($safetyFail) { exit 10 }
exit 0
