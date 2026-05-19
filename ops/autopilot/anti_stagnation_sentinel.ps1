param(
    [string]$ScorePath = "",
    [string]$SignatureStatusPath = "",
    [string]$FailureLedgerPath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ScorePath)) { $ScorePath = Join-Path $PSScriptRoot "autonomy_score_state.json" }
if ([string]::IsNullOrWhiteSpace($SignatureStatusPath)) { $SignatureStatusPath = Join-Path $PSScriptRoot "signature_component_status.yaml" }
if ([string]::IsNullOrWhiteSpace($FailureLedgerPath)) { $FailureLedgerPath = Join-Path $PSScriptRoot "failure_ledger.yaml" }

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$score = Get-Content -LiteralPath $ScorePath -Raw | ConvertFrom-Json
$signatureText = if (Test-Path -LiteralPath $SignatureStatusPath -PathType Leaf) { Get-Content -LiteralPath $SignatureStatusPath -Raw } else { "" }
$failureText = if (Test-Path -LiteralPath $FailureLedgerPath -PathType Leaf) { Get-Content -LiteralPath $FailureLedgerPath -Raw } else { "" }

$visual = [double]$score.scores.visual_production
$overall = [double]$score.scores.overall
$lastMissionMeta = [string]$score.updated_by -match "HUMAN_TASTE|CONDUCTOR|NEURORELAY|ROUTER"
$scoreInflationRisk = $overall -ge 19 -and $visual -lt 18.5
$tripledNoHuman = $signatureText -match '(?m)^tripled_signature_count:\s*2\s*$' -and $signatureText -match '(?m)^human_data_status:\s*HUMAN_DATA_ABSENT\s*$'
$repeatedLive = $failureText -match "recurrence_count:\s*[2-9]" -and $failureText -match "chatgpt|gemini|live"

$actions = @()
$forbidden = @()
if ($visual -lt 18.5 -and $lastMissionMeta) {
    $actions += "FORCE_PIXEL_MISSION"
    $forbidden += "pure_docs_only"
}
if ($repeatedLive) {
    $actions += "PARK_BLOCKED_LIVE_LANE"
    $forbidden += "repeat_live_web_retry"
}
if ($tripledNoHuman) {
    $actions += "PRIORITIZE_PROVISIONAL_VARIANT_REFINEMENT_OR_LIMITED_PIXEL_REHEARSAL"
}
if ($scoreInflationRisk) {
    $actions += "LOWER_SCORE_CONFIDENCE"
    $forbidden += "score_inflation_without_evidence"
}
if ($actions.Count -eq 0) { $actions += "CONTINUE_NORMAL_UTILITY_SELECTION" }

$result = [ordered]@{
    schema_version = "omega_anti_stagnation_result_v1"
    status = "ANTI_STAGNATION_CHECK_COMPLETE"
    meta_mission_risk = [bool]$lastMissionMeta
    no_pixel_progress_risk = [bool]($visual -lt 18.5 -and $lastMissionMeta)
    repeated_live_web_loop = [bool]$repeatedLive
    repeated_email_alert_fix_loop = $false
    no_frontend_dev_route_progress = [bool]($visual -lt 18.5)
    no_screenshot_progress = [bool]($visual -lt 18.5)
    score_inflation_without_evidence = [bool]$scoreInflationRisk
    same_failure_repeated = [bool]$repeatedLive
    actions = $actions
    forbid_repeating_objectives = $forbidden
    recommended_next = if ($actions -contains "FORCE_PIXEL_MISSION") { "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS" } else { "UTILITY_ENGINE_WINNER" }
    limited_rehearsal_allowed = [bool]($signatureText -match '(?m)^taste_packet_ready:\s*true\s*$')
    loop_continues = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
exit 0
