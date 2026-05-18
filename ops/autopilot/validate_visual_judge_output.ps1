param(
    [string]$InputPath = "",
    [ValidateSet("auto", "gemini", "chatgpt", "codex", "hard_gate")]
    [string]$JudgeType = "auto",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function To-StringArray {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [array]) { return @($Value | ForEach-Object { [string]$_ }) }
    return @([string]$Value)
}

function Has-AnyScreenshot {
    param($Value)
    $items = To-StringArray $Value
    return (($items | Where-Object { $_ -match '\.(png|jpg|jpeg|webp|avif)$' }) | Measure-Object).Count -gt 0
}

function Test-NumberRange {
    param($Value, [double]$Min, [double]$Max)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $true }
    try {
        $number = [double]$Value
    } catch {
        return $false
    }
    return ($number -ge $Min -and $number -le $Max)
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("visual_judge_validation_" + [System.Guid]::NewGuid().ToString("N") + ".json")
}

if ([string]::IsNullOrWhiteSpace($InputPath) -or -not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    $result = [ordered]@{
        schema_version = "A20Q_visual_judge_output_validation_v1"
        judge_type = $JudgeType
        input_path = $InputPath
        validation_result = "MISSING_INPUT"
        invalid_reasons = @("judge_file_missing")
        missing_fields = @()
        placeholder_praise_detected = $false
        generic_praise_detected = $false
        public_ready_without_screenshots = $false
        normalized_output_path = $null
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        runtime_user_approval_required = $false
    }
    Write-Json $OutPath $result
    $result | ConvertTo-Json -Depth 20
    exit 0
}

$raw = Get-Content -LiteralPath $InputPath -Raw
try {
    $json = $raw | ConvertFrom-Json
} catch {
    $result = [ordered]@{
        schema_version = "A20Q_visual_judge_output_validation_v1"
        judge_type = $JudgeType
        input_path = $InputPath
        validation_result = "INVALID_OUTPUT"
        invalid_reasons = @("invalid_json")
        missing_fields = @()
        placeholder_praise_detected = $false
        generic_praise_detected = $false
        public_ready_without_screenshots = $false
        normalized_output_path = $null
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        runtime_user_approval_required = $false
    }
    Write-Json $OutPath $result
    $result | ConvertTo-Json -Depth 20
    exit 0
}

if ($JudgeType -eq "auto") {
    if ($json.gemini_visual_verdict -or $json.verdict -or $json.prototype_grade) { $JudgeType = "gemini" }
    elseif ($json.chatgpt_art_direction_verdict -or $json.product_direction_verdict) { $JudgeType = "chatgpt" }
    elseif ($json.codex_feasibility_verdict -or $json.patch_options) { $JudgeType = "codex" }
    elseif ($json.hard_gate_status -or $json.chess_arbiter_verdict) { $JudgeType = "hard_gate" }
    else { $JudgeType = "auto" }
}

$invalid = @()
$missing = @()

foreach ($field in @("mission_id", "evidence_path")) {
    if (-not $json.PSObject.Properties.Name.Contains($field) -or [string]::IsNullOrWhiteSpace([string]$json.$field)) {
        $missing += $field
    }
}

if ($JudgeType -in @("gemini", "chatgpt") -and -not (Has-AnyScreenshot $json.screenshot_set)) {
    $missing += "screenshot_set"
}

if ($JudgeType -eq "gemini") {
    if (-not ($json.gemini_visual_verdict -or $json.verdict)) { $missing += "gemini_visual_verdict" }
    if (-not $json.public_screenshot_level) { $missing += "public_screenshot_level" }
    if (-not $json.PSObject.Properties.Name.Contains("fatal_defects")) { $missing += "fatal_defects" }
}

if ($JudgeType -eq "chatgpt") {
    if (-not ($json.chatgpt_art_direction_verdict -or $json.product_direction_verdict)) { $missing += "chatgpt_art_direction_verdict" }
    if (@(To-StringArray $json.top_defects).Count -eq 0) { $missing += "top_defects" }
}

if ($JudgeType -eq "codex") {
    if (-not $json.codex_feasibility_verdict) { $missing += "codex_feasibility_verdict" }
    if (-not $json.patch_options) { $missing += "patch_options" }
}

$placeholderPraise = $false
if ($raw -match "PASS_VISUAL\|WARNING_VISUAL\|BLOCK_VISUAL" -or
    $raw -match "Precision Cockpit\|Atmospheric Artifact\|Feedback Arena" -or
    $raw -match "KEEP_DIRECTION\|KEEP_WITH_VISUAL_DEBT" -or
    $json.placeholder_level -eq $true) {
    $placeholderPraise = $true
    $invalid += "placeholder_enum_text"
}

$defects = @()
$defects += To-StringArray $json.top_defects
$defects += To-StringArray $json.concrete_weaknesses
$defects += To-StringArray $json.fatal_defects
$defects += To-StringArray $json.blocked_reasons
$strengths = @()
$strengths += To-StringArray $json.top_strengths
$strengths += To-StringArray $json.concrete_strengths

$genericPraise = $false
if (($raw -match "(?i)looks great|strong visuals|nice design|good job|overall good|premium and polished") -and
    $defects.Count -eq 0) {
    $genericPraise = $true
    $invalid += "generic_praise_without_concrete_defects"
}

if (($JudgeType -eq "gemini" -or $JudgeType -eq "chatgpt") -and $strengths.Count -eq 0 -and $defects.Count -eq 0) {
    $genericPraise = $true
    $invalid += "no_concrete_strengths_or_weaknesses"
}

$publicLevel = [string]$json.public_screenshot_level
if ([string]::IsNullOrWhiteSpace($publicLevel) -and $json.creative_director_final_verdict) {
    $publicLevel = [string]$json.creative_director_final_verdict
}

$publicReadyWithoutScreens = $false
if (($publicLevel -match "PUBLIC_TEASER_READY|HERO_SCREENSHOT_READY") -and -not (Has-AnyScreenshot $json.screenshot_set)) {
    $publicReadyWithoutScreens = $true
    $invalid += "public_ready_claim_without_screenshot_reference"
}

if ($json.text_only_overapproval -eq $true) {
    $invalid += "text_only_overapproval"
}

if ($json.self_approval -eq $true -or $json.codex_self_congratulatory -eq $true) {
    $invalid += "codex_self_congratulatory_output"
}

if (-not (Test-NumberRange -Value $json.awwwards_app_craft_score -Min 0 -Max 60)) {
    $invalid += "awwwards_app_craft_score_out_of_range"
}

if (-not (Test-NumberRange -Value $json.visual_competence_score -Min 0 -Max 20)) {
    $invalid += "visual_competence_score_out_of_range"
}

if ($missing.Count -gt 0) {
    $invalid += "missing_required_fields"
}

$validation = if ($invalid.Count -eq 0) { "VALID_OUTPUT" } else { "INVALID_OUTPUT" }

$result = [ordered]@{
    schema_version = "A20Q_visual_judge_output_validation_v1"
    judge_type = $JudgeType
    input_path = $InputPath
    validation_result = $validation
    invalid_reasons = @($invalid | Select-Object -Unique)
    missing_fields = @($missing | Select-Object -Unique)
    placeholder_praise_detected = $placeholderPraise
    generic_praise_detected = $genericPraise
    public_ready_without_screenshots = $publicReadyWithoutScreens
    normalized_output_path = if ($validation -eq "VALID_OUTPUT") { $InputPath } else { $null }
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    runtime_user_approval_required = $false
}

Write-Json $OutPath $result
$result | ConvertTo-Json -Depth 20
