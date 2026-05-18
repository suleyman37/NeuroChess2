$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20x_minimal_visual_judge_v2_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Read-Json {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Write-TestJson {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function New-ValidV2Judge {
    param([string]$Judge)
    [ordered]@{
        contract_version = "minimal_visual_judge_v2"
        judge = $Judge
        evidence_seen = $true
        evidence_files = @("generation_1_patch/contact_sheet_generation_1_states.png")
        screenshot_references = @(
            "contact_sheet_generation_1_states observe: board is centered and readable",
            "contact_sheet_generation_1_states try: no pre-feedback target trace is visible",
            "contact_sheet_generation_1_states feedback: post-feedback trace is outside board pollution"
        )
        hard_gate_observations = [ordered]@{
            board_readability = "PASS"
            anti_spoiler = "PASS"
            piece_readability = "PASS"
            board_pollution = "PASS"
        }
        public_screenshot_level = "PUBLIC_TEASER_READY_WITH_CAVEATS"
        awwwards_app_craft_level = "PREMIUM_DIRECTION"
        visual_competence_level = "PREMIUM_WITH_SUPERVISION"
        top_strengths = @(
            "The board remains the visual center across the contact sheet.",
            "The phase rail reads as product UI rather than a loose dev panel.",
            "The post-feedback states add drama without polluting the board core."
        )
        top_defects = @(
            "The cockpit language still reads slightly internal beside the board.",
            "The piece identity is serviceable but not signature NeuroChess yet.",
            "The feedback trace language needs more distinctive public-grade restraint."
        )
        fatal_defects = @()
        recommended_action = "HUMAN_REVIEW_REQUIRED"
    }
}

try {
    $validate = Join-Path $RepoRoot "ops\autopilot\validate_visual_judge_output.ps1"
    $normalize = Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1"

    $geminiValid = Join-Path $TempRoot "gemini_valid_v2.json"
    Write-TestJson $geminiValid (New-ValidV2Judge -Judge "gemini_visual_perceiver")
    $geminiValidation = Join-Path $TempRoot "gemini_valid_v2_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $geminiValid -JudgeType gemini -OutPath $geminiValidation | Out-Null
    Assert-True ((Read-Json $geminiValidation).validation_result -eq "VALID_OUTPUT") "Gemini valid enum output failed"

    $oldOutOfRange = Join-Path $TempRoot "gemini_old_out_of_range.json"
    Write-TestJson $oldOutOfRange ([ordered]@{
        mission_id = "A20X_TEST"
        evidence_path = "fixture/a20p"
        screenshot_set = @("generation_1_patch/contact_sheet_generation_1_states.png")
        gemini_visual_verdict = "WARNING_VISUAL_WITH_CONCRETE_DEBT"
        public_screenshot_level = "PUBLIC_TEASER_READY_WITH_CAVEATS"
        fatal_defects = @()
        top_strengths = @("Specific visible board strength.")
        top_defects = @("Specific visible visual defect.")
        awwwards_app_craft_score = 75
        visual_competence_score = 85
    })
    $oldValidation = Join-Path $TempRoot "gemini_old_out_of_range_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $oldOutOfRange -JudgeType gemini -OutPath $oldValidation | Out-Null
    $oldValidationJson = Read-Json $oldValidation
    Assert-True ($oldValidationJson.validation_result -eq "INVALID_OUTPUT") "Old out-of-range numeric output passed"
    Assert-True (@($oldValidationJson.invalid_reasons) -contains "awwwards_app_craft_score_out_of_range") "Old Awwwards score range was not rejected"

    $chatgptValid = Join-Path $TempRoot "chatgpt_valid_v2.json"
    Write-TestJson $chatgptValid (New-ValidV2Judge -Judge "chatgpt_product_art_director")
    $chatgptValidation = Join-Path $TempRoot "chatgpt_valid_v2_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $chatgptValid -JudgeType chatgpt -OutPath $chatgptValidation | Out-Null
    Assert-True ((Read-Json $chatgptValidation).validation_result -eq "VALID_OUTPUT") "ChatGPT valid enum output with image evidence failed"

    $chatgptTextOnly = Join-Path $TempRoot "chatgpt_text_only_v2.json"
    $textOnlyPayload = New-ValidV2Judge -Judge "chatgpt_product_art_director"
    $textOnlyPayload.evidence_seen = $false
    $textOnlyPayload.evidence_files = @()
    Write-TestJson $chatgptTextOnly $textOnlyPayload
    $textOnlyValidation = Join-Path $TempRoot "chatgpt_text_only_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $chatgptTextOnly -JudgeType chatgpt -OutPath $textOnlyValidation | Out-Null
    $textOnlyValidationJson = Read-Json $textOnlyValidation
    Assert-True ($textOnlyValidationJson.validation_result -eq "INVALID_OUTPUT") "Text-only ChatGPT output passed"
    Assert-True (@($textOnlyValidationJson.invalid_reasons) -contains "text_only_visual_review") "Text-only review was not marked"

    $rawFenced = Join-Path $TempRoot "chatgpt_fenced_v2_raw.txt"
    $rawFencedText = @(
        "Here is the answer:",
        '```json',
        ((New-ValidV2Judge -Judge "chatgpt_product_art_director") | ConvertTo-Json -Depth 20),
        '```'
    ) -join "`n"
    $rawFencedText | Set-Content -LiteralPath $rawFenced -Encoding UTF8
    $fencedOut = Join-Path $TempRoot "chatgpt_fenced_v2.json"
    $fencedReport = Join-Path $TempRoot "chatgpt_fenced_report.json"
    $fencedValidation = Join-Path $TempRoot "chatgpt_fenced_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $normalize -RawPath $rawFenced -JudgeType chatgpt -OutPath $fencedOut -ReportPath $fencedReport -ValidationOutPath $fencedValidation | Out-Null
    Assert-True ((Read-Json $fencedValidation).validation_result -eq "VALID_OUTPUT") "Markdown fenced v2 JSON did not normalize"

    $genericPraise = Join-Path $TempRoot "generic_praise_v2.json"
    $genericPayload = New-ValidV2Judge -Judge "gemini_visual_perceiver"
    $genericPayload.top_strengths = @("Looks great.", "Nice design.", "Good job.")
    $genericPayload.top_defects = @()
    Write-TestJson $genericPraise $genericPayload
    $genericValidation = Join-Path $TempRoot "generic_praise_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $genericPraise -JudgeType gemini -OutPath $genericValidation | Out-Null
    Assert-True ((Read-Json $genericValidation).validation_result -eq "INVALID_OUTPUT") "Generic praise passed"

    $missingRefs = Join-Path $TempRoot "missing_refs_v2.json"
    $missingRefsPayload = New-ValidV2Judge -Judge "gemini_visual_perceiver"
    $missingRefsPayload.screenshot_references = @()
    Write-TestJson $missingRefs $missingRefsPayload
    $missingRefsValidation = Join-Path $TempRoot "missing_refs_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $missingRefs -JudgeType gemini -OutPath $missingRefsValidation | Out-Null
    Assert-True ((Read-Json $missingRefsValidation).validation_result -eq "INVALID_OUTPUT") "Missing screenshot references passed"

    $placeholder = Join-Path $TempRoot "placeholder_v2.json"
    $placeholderPayload = New-ValidV2Judge -Judge "gemini_visual_perceiver"
    $placeholderPayload.hard_gate_observations.board_readability = "PASS|MINOR_DEBT|FAIL|NOT_EVALUATED"
    Write-TestJson $placeholder $placeholderPayload
    $placeholderValidation = Join-Path $TempRoot "placeholder_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $placeholder -JudgeType gemini -OutPath $placeholderValidation | Out-Null
    Assert-True ((Read-Json $placeholderValidation).placeholder_praise_detected -eq $true) "Placeholder enum was not detected"

    $placeholderCritique = Join-Path $TempRoot "placeholder_critique_v2.json"
    $placeholderCritiquePayload = New-ValidV2Judge -Judge "gemini_visual_perceiver"
    $placeholderCritiquePayload.top_strengths = @(
        "Replace with a concrete visible strength from the contact sheet.",
        "Replace with a second concrete visible strength from the contact sheet.",
        "Replace with a third concrete visible strength from the contact sheet."
    )
    $placeholderCritiquePayload.top_defects = @(
        "Replace with a concrete visible defect from the contact sheet.",
        "Replace with a second concrete visible defect from the contact sheet.",
        "Replace with a third concrete visible defect from the contact sheet."
    )
    Write-TestJson $placeholderCritique $placeholderCritiquePayload
    $placeholderCritiqueValidation = Join-Path $TempRoot "placeholder_critique_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validate -InputPath $placeholderCritique -JudgeType gemini -OutPath $placeholderCritiqueValidation | Out-Null
    $placeholderCritiqueValidationJson = Read-Json $placeholderCritiqueValidation
    Assert-True ($placeholderCritiqueValidationJson.validation_result -eq "INVALID_OUTPUT") "Placeholder critique text passed"
    Assert-True ($placeholderCritiqueValidationJson.placeholder_praise_detected -eq $true) "Placeholder critique text was not marked"

    [ordered]@{
        status = "pass"
        tests = 9
        gemini_valid_enum_output_passes = $true
        gemini_old_out_of_range_numeric_fails = $true
        chatgpt_valid_enum_with_image_passes = $true
        chatgpt_text_only_fails = $true
        markdown_fenced_json_extracts = $true
        generic_praise_fails = $true
        missing_screenshot_references_fail = $true
        placeholder_enums_fail = $true
        placeholder_critique_fails = $true
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
