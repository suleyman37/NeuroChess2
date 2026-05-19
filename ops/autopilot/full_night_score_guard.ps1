param(
    [double]$PreviousOverall = 19.5,
    [double]$NewOverall = 19.5,
    [double]$PreviousVisual = 19.0,
    [double]$NewVisual = 19.0,
    [double]$PreviousNightReadiness = 19.5,
    [double]$NewNightReadiness = 19.5,
    [int]$ScreenshotCount = 0,
    [int]$MissionDoctorPassCount = 0,
    [switch]$TestsPassed,
    [string]$HumanValidationLevel = "HUMAN_DATA_ABSENT",
    [int]$ExternalDecisionPackets = 0,
    [string]$RequestedLabel = "FULL_NIGHT_REHEARSAL_CONFIRMED",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$violations = @()
if ($NewOverall -gt 19.5) { $violations += "overall_above_19_5_not_allowed" }
if ($RequestedLabel -match '20|20/20') { $violations += "twenty_out_of_twenty_claim_forbidden" }
if ($NewOverall -gt $PreviousOverall -and ($ScreenshotCount -le 0 -or $MissionDoctorPassCount -le 0)) { $violations += "overall_increase_without_proof" }
if ($NewVisual -gt $PreviousVisual -and $ScreenshotCount -le 0) { $violations += "visual_increase_without_screenshot" }
if ($NewNightReadiness -gt $PreviousNightReadiness -and -not $TestsPassed) { $violations += "night_readiness_increase_without_tests" }
if ($HumanValidationLevel -notin @("OWNER_TASTE_SELECTED", "CROWD_RESULTS_IMPORTED", "MAJORITY_PREFERENCE_SUPPORTED") -and $RequestedLabel -match "HUMAN|CROWD|OWNER") { $violations += "human_validation_claim_without_human_data" }
if ($ExternalDecisionPackets -eq 0 -and $RequestedLabel -match "EXTERNAL_JUDGE_CONFIRMED|GPT|GEMINI") { $violations += "external_judge_claim_without_packets" }

$allowedLabels = @("FULL_NIGHT_CONFIRMED_19_5", "FULL_NIGHT_REHEARSAL_CONFIRMED", "FULL_NIGHT_PARTIAL", "FULL_NIGHT_NO_GO")
if ($allowedLabels -notcontains $RequestedLabel) { $violations += "unsupported_post_real_night_label" }

$status = if ($violations.Count -eq 0) { "SCORE_GUARD_PASS" } else { "SCORE_GUARD_BLOCK" }
$result = [ordered]@{
    schema_version = "full_night_score_guard_v1"
    status = $status
    violations = $violations
    requested_label = $RequestedLabel
    allowed_post_real_night_labels = $allowedLabels
    no_20_out_of_20_claim = $true
    visual_requires_screenshot = $true
    night_readiness_requires_tests = $true
    human_validation_requires_human_data = $true
    external_judge_requires_packets = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 20
if ($violations.Count -gt 0) { exit 5 }
exit 0
