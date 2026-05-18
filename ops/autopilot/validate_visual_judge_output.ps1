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

function Test-HasProperty {
    param($Object, [string]$Name)
    return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Test-InEnum {
    param([string]$Value, [string[]]$Allowed)
    return (-not [string]::IsNullOrWhiteSpace($Value) -and $Allowed -contains $Value)
}

function Test-ConcreteList {
    param($Value, [int]$MinCount)
    $items = @(To-StringArray $Value | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($items.Count -lt $MinCount) { return $false }
    $generic = @(
        "looks great",
        "strong visuals",
        "nice design",
        "good job",
        "overall good",
        "premium and polished",
        "very good",
        "well designed"
    )
    $placeholders = @(
        "replace with",
        "placeholder",
        "todo",
        "example strength",
        "example defect",
        "concrete visible strength",
        "concrete visible defect"
    )
    foreach ($item in $items) {
        $lower = $item.ToLowerInvariant()
        if ($item.Length -lt 12) { return $false }
        foreach ($placeholder in $placeholders) {
            if ($lower -match [regex]::Escape($placeholder)) {
                return $false
            }
        }
        foreach ($phrase in $generic) {
            if ($lower -eq $phrase -or $lower -match ("^" + [regex]::Escape($phrase) + "\.?$")) {
                return $false
            }
        }
    }
    return $true
}

function Test-ContainsPlaceholderText {
    param($Value)
    $items = @(To-StringArray $Value | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $placeholders = @(
        "replace with",
        "placeholder",
        "todo",
        "example strength",
        "example defect",
        "concrete visible strength",
        "concrete visible defect"
    )
    foreach ($item in $items) {
        $lower = $item.ToLowerInvariant()
        foreach ($placeholder in $placeholders) {
            if ($lower -match [regex]::Escape($placeholder)) {
                return $true
            }
        }
    }
    return $false
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
    if ([string]$json.contract_version -eq "minimal_visual_judge_v2" -and [string]$json.judge -match "^gemini_") { $JudgeType = "gemini" }
    elseif ([string]$json.contract_version -eq "minimal_visual_judge_v2" -and [string]$json.judge -match "^chatgpt_") { $JudgeType = "chatgpt" }
    elseif ($json.gemini_visual_verdict -or $json.verdict -or $json.prototype_grade) { $JudgeType = "gemini" }
    elseif ($json.chatgpt_art_direction_verdict -or $json.product_direction_verdict) { $JudgeType = "chatgpt" }
    elseif ($json.codex_feasibility_verdict -or $json.patch_options) { $JudgeType = "codex" }
    elseif ($json.hard_gate_status -or $json.chess_arbiter_verdict) { $JudgeType = "hard_gate" }
    else { $JudgeType = "auto" }
}

$invalid = @()
$missing = @()

if ([string]$json.contract_version -eq "minimal_visual_judge_v2") {
    $hardGateEnum = @("PASS", "MINOR_DEBT", "FAIL", "NOT_EVALUATED")
    $publicLevelEnum = @(
        "INTERNAL_ONLY",
        "INTERNAL_NORTH_STAR_CANDIDATE",
        "PUBLIC_TEASER_READY_WITH_CAVEATS",
        "PUBLIC_TEASER_READY",
        "HERO_SCREENSHOT_READY"
    )
    $craftEnum = @(
        "WEAK_PROTOTYPE",
        "DECENT_APP_UI",
        "PREMIUM_DIRECTION",
        "AWWWARDS_INSPIRED_APP_CRAFT",
        "SIGNATURE_NEUROCHESS_SCREEN"
    )
    $competenceEnum = @(
        "UNSAFE",
        "FILTERS_FAILURES",
        "SAFE_PROTOTYPE",
        "PREMIUM_WITH_SUPERVISION",
        "LIMITED_AUTONOMOUS_VISUAL_LANE_READY",
        "STRONG_AUTONOMOUS_WITH_HUMAN_REVIEW"
    )
    $actionEnum = @(
        "ACCEPT_WITH_CAVEATS",
        "PATCH_AGAIN",
        "PIECE_IDENTITY_WORK",
        "FEEDBACK_LANGUAGE_WORK",
        "HUMAN_REVIEW_REQUIRED",
        "REJECT",
        "INSUFFICIENT_EVIDENCE"
    )

    foreach ($field in @(
        "contract_version",
        "judge",
        "evidence_seen",
        "evidence_files",
        "screenshot_references",
        "hard_gate_observations",
        "public_screenshot_level",
        "awwwards_app_craft_level",
        "visual_competence_level",
        "top_strengths",
        "top_defects",
        "fatal_defects",
        "recommended_action"
    )) {
        if (-not (Test-HasProperty $json $field)) { $missing += $field }
    }

    $judgeValue = [string]$json.judge
    if ($JudgeType -eq "gemini" -and $judgeValue -ne "gemini_visual_perceiver") {
        $invalid += "judge_type_mismatch"
    }
    if ($JudgeType -eq "chatgpt" -and $judgeValue -ne "chatgpt_product_art_director") {
        $invalid += "judge_type_mismatch"
    }
    if ($judgeValue -notin @("gemini_visual_perceiver", "chatgpt_product_art_director")) {
        $invalid += "invalid_judge_enum"
    }

    if ($json.evidence_seen -ne $true) {
        $invalid += "evidence_not_seen"
        if ($JudgeType -eq "chatgpt") { $invalid += "text_only_visual_review" }
    }

    $evidenceFiles = To-StringArray $json.evidence_files
    $screenshotRefs = To-StringArray $json.screenshot_references
    if (-not (Has-AnyScreenshot $evidenceFiles)) { $missing += "evidence_files_with_image" }
    if ($screenshotRefs.Count -eq 0) { $missing += "screenshot_references" }

    if (-not (Test-HasProperty $json "hard_gate_observations")) {
        $missing += "hard_gate_observations"
    } else {
        foreach ($gateField in @("board_readability", "anti_spoiler", "piece_readability", "board_pollution")) {
            $gateValue = [string]$json.hard_gate_observations.$gateField
            if (-not (Test-InEnum -Value $gateValue -Allowed $hardGateEnum)) {
                $invalid += "invalid_hard_gate_observation_$gateField"
            }
        }
    }

    if (-not (Test-InEnum -Value ([string]$json.public_screenshot_level) -Allowed $publicLevelEnum)) {
        $invalid += "invalid_public_screenshot_level"
    }
    if (-not (Test-InEnum -Value ([string]$json.awwwards_app_craft_level) -Allowed $craftEnum)) {
        $invalid += "invalid_awwwards_app_craft_level"
    }
    if (-not (Test-InEnum -Value ([string]$json.visual_competence_level) -Allowed $competenceEnum)) {
        $invalid += "invalid_visual_competence_level"
    }
    if (-not (Test-InEnum -Value ([string]$json.recommended_action) -Allowed $actionEnum)) {
        $invalid += "invalid_recommended_action"
    }

    $placeholderPraise = $false
    if ($raw -match "\bPASS\|MINOR_DEBT\|FAIL\|NOT_EVALUATED\b" -or
        $raw -match "gemini_visual_perceiver\|chatgpt_product_art_director" -or
        $raw -match "INTERNAL_ONLY\|INTERNAL_NORTH_STAR_CANDIDATE" -or
        $raw -match "WEAK_PROTOTYPE\|DECENT_APP_UI" -or
        $raw -match "ACCEPT_WITH_CAVEATS\|PATCH_AGAIN" -or
        $json.placeholder_level -eq $true) {
        $placeholderPraise = $true
        $invalid += "placeholder_enum_text"
    }

    $strengths = To-StringArray $json.top_strengths
    $defects = To-StringArray $json.top_defects
    $genericPraise = $false
    if (Test-ContainsPlaceholderText $strengths -or Test-ContainsPlaceholderText $defects) {
        $placeholderPraise = $true
        $invalid += "placeholder_critique_text"
    }
    if (-not (Test-ConcreteList -Value $strengths -MinCount 3)) {
        $genericPraise = $true
        $invalid += "insufficient_concrete_strengths"
    }
    if (-not (Test-ConcreteList -Value $defects -MinCount 3)) {
        $genericPraise = $true
        $invalid += "insufficient_concrete_defects"
    }

    $publicReadyWithoutScreens = $false
    if (([string]$json.public_screenshot_level -match "PUBLIC_TEASER_READY|HERO_SCREENSHOT_READY") -and $screenshotRefs.Count -eq 0) {
        $publicReadyWithoutScreens = $true
        $invalid += "public_ready_claim_without_screenshot_reference"
    }

    if ($json.text_only_overapproval -eq $true) {
        $invalid += "text_only_overapproval"
    }

    if ($missing.Count -gt 0) {
        $invalid += "missing_required_fields"
    }

    $validation = if ($invalid.Count -eq 0) { "VALID_OUTPUT" } else { "INVALID_OUTPUT" }
    $result = [ordered]@{
        schema_version = "A20X_visual_judge_output_validation_v2"
        contract_version = "minimal_visual_judge_v2"
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
    exit 0
}

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
