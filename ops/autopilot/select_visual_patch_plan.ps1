param(
    [string]$SummaryPath,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SummaryPath) -or -not (Test-Path -LiteralPath $SummaryPath)) {
    throw "SummaryPath is required."
}

$summary = Get-Content -LiteralPath $SummaryPath -Raw | ConvertFrom-Json
$defects = @()
if ($summary.top_defects) { $defects = @($summary.top_defects | ForEach-Object { [string]$_ }) }
$blocked = @()
if ($summary.blocked_reasons) { $blocked = @($summary.blocked_reasons | ForEach-Object { [string]$_ }) }
$screens = @()
if ($summary.screenshot_set) { $screens = @($summary.screenshot_set | ForEach-Object { [string]$_ }) }
$missing = @()
if ($summary.missing_inputs) { $missing = @($summary.missing_inputs | ForEach-Object { [string]$_ }) }

$action = "patch"
$final = "PRODUCT_GRADE_WITH_DEBT"
$allowedNext = "generate_next_visual_mission_prompt"
$requiredPatch = "Apply a constrained visual patch that deletes generic noise before adding ambition."
$publicLevel = [string]$summary.public_screenshot_level

if ($summary.hard_gate_override -eq $true) {
    $action = "rework"
    $final = "ART_DIRECTION_REWORK_REQUIRED"
    $requiredPatch = "Repair hard gate failure before any visual praise can count."
} elseif ($missing.Count -gt 0 -or $screens.Count -eq 0) {
    $action = "insufficient_evidence"
    $final = "INSUFFICIENT_VISUAL_EVIDENCE"
    $publicLevel = "INTERNAL_PROTOTYPE_ONLY"
    $requiredPatch = "Collect screenshot evidence and missing judge inputs before public-readiness claims."
} elseif (($summary.generic_praise_insufficient -eq $true) -or ($defects -contains "safe_but_too_light") -or ($defects -contains "governance_only")) {
    $action = "patch"
    $final = "PRODUCT_GRADE_WITH_DEBT"
    $requiredPatch = "Run a screenshot-to-patch pass focused on visible product ambition."
} elseif (($summary.anti_generic_verdict -match "BLOCK") -or ($blocked -contains "generic_glow_overuse")) {
    $action = "rework"
    $final = "ART_DIRECTION_REWORK_REQUIRED"
    $requiredPatch = "Remove generic glow and rebuild state-specific visual language."
} elseif ($publicLevel -eq "PUBLIC_TEASER_READY" -and [int]$summary.awwwards_app_craft_score -ge 46) {
    $action = "accept"
    $final = "PUBLIC_TEASER_READY"
    $requiredPatch = "No immediate patch required; preserve hard-gate evidence."
} elseif ($defects -contains "abandon_direction") {
    $action = "abandon"
    $final = "ABANDON_DIRECTION"
    $requiredPatch = "Stop this visual direction and start a new one under the Sacred Board Contract."
}

$score = [int]$summary.visual_competence_score
if ($score -ge 18 -and -not ($summary.has_screenshot_to_patch_evidence -eq $true)) {
    $score = 17
    $defects += "visual_competence_capped_without_screenshot_to_patch_evidence"
}

$verdict = [ordered]@{
    mission_id = $summary.mission_id
    evidence_path = $summary.evidence_path
    screenshot_set = $screens
    hard_gate_status = $summary.hard_gate_status
    chess_arbiter_verdict = $summary.chess_arbiter_verdict
    gemini_visual_verdict = $summary.gemini_visual_verdict
    chatgpt_art_direction_verdict = $summary.chatgpt_art_direction_verdict
    anti_generic_verdict = $summary.anti_generic_verdict
    codex_feasibility_verdict = $summary.codex_feasibility_verdict
    creative_director_final_verdict = $final
    selected_action = $action
    public_screenshot_level = $publicLevel
    awwwards_app_craft_score = [int]$summary.awwwards_app_craft_score
    visual_competence_score = $score
    top_defects = @($defects | Select-Object -Unique)
    top_strengths = $summary.top_strengths
    required_patch = $requiredPatch
    allowed_next_action = $allowedNext
    blocked_reasons = @($blocked | Select-Object -Unique)
    next_mission_prompt_path = $null
    hard_gate_override = $summary.hard_gate_override
    missing_inputs = $missing
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    runtime_user_approval_required = $false
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) "creative_director_verdict.json"
}

$verdict | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutPath -Encoding UTF8

[ordered]@{
    creative_director_verdict_path = $OutPath
    selected_action = $action
    creative_director_final_verdict = $final
    visual_competence_score = $score
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
} | ConvertTo-Json -Depth 6
