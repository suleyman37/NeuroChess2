$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20u_visual_capture_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Read-Json {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

try {
    $rawGemini = Join-Path $TempRoot "gemini_wrapped_raw.txt"
    @'
The response is below.
{
  "schema": "NC_GEMINI_AUDIT_JSON/1",
  "nonce": "A20U_TEST",
  "mode": "visual_court",
  "verdict": "WARNING_VISUAL",
  "required_action": "record_report",
  "scores": {
    "scope_risk": 1,
    "product_value": 4,
    "safety_risk": 1,
    "automation_drift_risk": 1,
    "confidence": 0.7
  },
  "findings": [
    "The contact sheet keeps the board central.",
    "The phase rail remains early product language."
  ],
  "must_not_do": "Do not override hard gates.",
  "visual_checks": {
    "screenshot_evidence_used": true,
    "board_pollution_detected": false,
    "pre_feedback_hint_detected": false
  },
  "visual_judge_output": {
    "mission_id": "A20U_TEST",
    "evidence_path": "fixture/a20p",
    "screenshot_set": [
      "generation_1_patch/contact_sheet_generation_1_states.png"
    ],
    "gemini_visual_verdict": "WARNING_VISUAL_WITH_CONCRETE_DEBT",
    "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
    "concrete_strengths": [
      "Board remains the center of the screenshot."
    ],
    "concrete_weaknesses": [
      "Feedback trace language is still not signature-grade."
    ],
    "fatal_defects": [],
    "top_strengths": [
      "board_centered"
    ],
    "top_defects": [
      "feedback_trace_language_not_final"
    ],
    "blocked_reasons": [],
    "allowed_next_action": "human_review_or_second_patch",
    "live_gemini_called": true,
    "live_chatgpt_called": false,
    "product_mission_executed": false
  },
  "done": "A20U_TEST"
}
'@ | Set-Content -LiteralPath $rawGemini -Encoding UTF8

    $geminiOut = Join-Path $TempRoot "gemini_visual_observation.json"
    $geminiReport = Join-Path $TempRoot "gemini_normalization_report.json"
    $geminiValidation = Join-Path $TempRoot "gemini_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawGemini `
        -JudgeType gemini `
        -OutPath $geminiOut `
        -ReportPath $geminiReport `
        -ValidationOutPath $geminiValidation | Out-Null
    $geminiValidationJson = Read-Json $geminiValidation
    Assert-True ($geminiValidationJson.validation_result -eq "VALID_OUTPUT") "wrapped Gemini judge output did not validate"

    $rawChatGpt = Join-Path $TempRoot "chatgpt_fenced_raw.txt"
    @'
```json
{
  "mission_id": "A20U_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": [
    "generation_1_patch/contact_sheet_generation_1_states.png"
  ],
  "chatgpt_art_direction_verdict": "PRODUCT_GRADE_WITH_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": [
    "The public frame is cleaner than A20L."
  ],
  "top_defects": [
    "The phase rail is not yet memorable enough."
  ],
  "awwwards_app_craft_score": 45,
  "required_patch": "Use human review or a second focused patch.",
  "allowed_next_action": "human_review_or_second_patch",
  "live_chatgpt_called": true,
  "live_gemini_called": false,
  "product_mission_executed": false
}
```
'@ | Set-Content -LiteralPath $rawChatGpt -Encoding UTF8

    $chatOut = Join-Path $TempRoot "chatgpt_art_direction_review.json"
    $chatReport = Join-Path $TempRoot "chatgpt_normalization_report.json"
    $chatValidation = Join-Path $TempRoot "chatgpt_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawChatGpt `
        -JudgeType chatgpt `
        -OutPath $chatOut `
        -ReportPath $chatReport `
        -ValidationOutPath $chatValidation | Out-Null
    $chatValidationJson = Read-Json $chatValidation
    Assert-True ($chatValidationJson.validation_result -eq "VALID_OUTPUT") "fenced ChatGPT judge output did not validate"

    $rawInvalid = Join-Path $TempRoot "invalid_raw.txt"
    "Looks great overall. I like it." | Set-Content -LiteralPath $rawInvalid -Encoding UTF8
    $invalidReport = Join-Path $TempRoot "invalid_normalization_report.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawInvalid `
        -JudgeType gemini `
        -OutPath (Join-Path $TempRoot "invalid.json") `
        -ReportPath $invalidReport | Out-Null
    $invalidJson = Read-Json $invalidReport
    Assert-True ($invalidJson.normalization_result -eq "NO_VALID_JUDGE_JSON_FOUND") "prose-only output was normalized"

    $rawChatGptProseJson = Join-Path $TempRoot "chatgpt_prose_json_raw.txt"
    @'
Here is the strict JSON:
{
  "mission_id": "A20V_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": [
    "generation_1_patch/contact_sheet_generation_1_states.png"
  ],
  "chatgpt_art_direction_verdict": "PRODUCT_GRADE_WITH_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": [
    "The board remains visually authoritative."
  ],
  "top_defects": [
    "The public-teaser language still needs human review."
  ],
  "awwwards_app_craft_score": 45,
  "visual_competence_score": 17,
  "required_patch": "Human review or second patch.",
  "allowed_next_action": "human_review_or_second_patch",
  "live_chatgpt_called": true,
  "live_gemini_called": false,
  "product_mission_executed": false
}
Thank you.
'@ | Set-Content -LiteralPath $rawChatGptProseJson -Encoding UTF8
    $proseJsonOut = Join-Path $TempRoot "chatgpt_prose_json.json"
    $proseJsonReport = Join-Path $TempRoot "chatgpt_prose_json_report.json"
    $proseJsonValidation = Join-Path $TempRoot "chatgpt_prose_json_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawChatGptProseJson `
        -JudgeType chatgpt `
        -OutPath $proseJsonOut `
        -ReportPath $proseJsonReport `
        -ValidationOutPath $proseJsonValidation | Out-Null
    $proseJsonValidationJson = Read-Json $proseJsonValidation
    Assert-True ($proseJsonValidationJson.validation_result -eq "VALID_OUTPUT") "prose plus JSON block did not validate"

    $rawOutOfRange = Join-Path $TempRoot "chatgpt_out_of_range_raw.txt"
    @'
```json
{
  "mission_id": "A20V_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": [
    "generation_1_patch/contact_sheet_generation_1_states.png"
  ],
  "chatgpt_art_direction_verdict": "PRODUCT_GRADE_WITH_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": ["Specific strength."],
  "top_defects": ["Specific defect."],
  "awwwards_app_craft_score": 75,
  "visual_competence_score": 22,
  "required_patch": "Human review.",
  "allowed_next_action": "human_review_or_second_patch"
}
```
'@ | Set-Content -LiteralPath $rawOutOfRange -Encoding UTF8
    $outOfRangeOut = Join-Path $TempRoot "chatgpt_out_of_range.json"
    $outOfRangeReport = Join-Path $TempRoot "chatgpt_out_of_range_report.json"
    $outOfRangeValidation = Join-Path $TempRoot "chatgpt_out_of_range_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawOutOfRange `
        -JudgeType chatgpt `
        -OutPath $outOfRangeOut `
        -ReportPath $outOfRangeReport `
        -ValidationOutPath $outOfRangeValidation | Out-Null
    $outOfRangeReportJson = Read-Json $outOfRangeReport
    $outOfRangeValidationJson = Read-Json $outOfRangeValidation
    Assert-True ($outOfRangeValidationJson.validation_result -eq "INVALID_OUTPUT") "out-of-range scores were not rejected"
    Assert-True ($outOfRangeReportJson.normalization_result -eq "NORMALIZED_JSON_REJECTED_BY_VALIDATION") "invalid JSON should not be normalized"
    Assert-True (-not (Test-Path -LiteralPath $outOfRangeOut -PathType Leaf)) "invalid normalized output file was written"

    $rawMissingScreens = Join-Path $TempRoot "chatgpt_missing_screens_raw.txt"
    @'
{
  "mission_id": "A20V_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": ["visual_delta_report.md"],
  "chatgpt_art_direction_verdict": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": ["Specific strength."],
  "top_defects": ["Specific defect."],
  "awwwards_app_craft_score": 45,
  "visual_competence_score": 17,
  "required_patch": "Human review.",
  "allowed_next_action": "human_review_or_second_patch"
}
'@ | Set-Content -LiteralPath $rawMissingScreens -Encoding UTF8
    $missingScreensValidation = Join-Path $TempRoot "chatgpt_missing_screens_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawMissingScreens `
        -JudgeType chatgpt `
        -OutPath (Join-Path $TempRoot "chatgpt_missing_screens.json") `
        -ReportPath (Join-Path $TempRoot "chatgpt_missing_screens_report.json") `
        -ValidationOutPath $missingScreensValidation | Out-Null
    $missingScreensValidationJson = Read-Json $missingScreensValidation
    Assert-True ($missingScreensValidationJson.validation_result -eq "INVALID_OUTPUT") "missing screenshot references were not rejected"

    $rawGenericPraise = Join-Path $TempRoot "chatgpt_generic_praise_raw.txt"
    @'
{
  "mission_id": "A20V_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": ["generation_1_patch/contact_sheet_generation_1_states.png"],
  "chatgpt_art_direction_verdict": "PRODUCT_GRADE_WITH_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": ["Looks great overall."],
  "top_defects": [],
  "awwwards_app_craft_score": 45,
  "visual_competence_score": 17,
  "required_patch": "No patch.",
  "allowed_next_action": "accept"
}
'@ | Set-Content -LiteralPath $rawGenericPraise -Encoding UTF8
    $genericPraiseValidation = Join-Path $TempRoot "chatgpt_generic_praise_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawGenericPraise `
        -JudgeType chatgpt `
        -OutPath (Join-Path $TempRoot "chatgpt_generic_praise.json") `
        -ReportPath (Join-Path $TempRoot "chatgpt_generic_praise_report.json") `
        -ValidationOutPath $genericPraiseValidation | Out-Null
    $genericPraiseValidationJson = Read-Json $genericPraiseValidation
    Assert-True ($genericPraiseValidationJson.validation_result -eq "INVALID_OUTPUT") "generic praise was not rejected"

    $rawPlaceholder = Join-Path $TempRoot "chatgpt_placeholder_raw.txt"
    @'
{
  "mission_id": "A20V_TEST",
  "evidence_path": "fixture/a20p",
  "screenshot_set": ["generation_1_patch/contact_sheet_generation_1_states.png"],
  "chatgpt_art_direction_verdict": "KEEP_DIRECTION|KEEP_WITH_VISUAL_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": ["Specific strength."],
  "top_defects": ["Specific defect."],
  "awwwards_app_craft_score": 45,
  "visual_competence_score": 17,
  "required_patch": "Human review.",
  "allowed_next_action": "human_review_or_second_patch"
}
'@ | Set-Content -LiteralPath $rawPlaceholder -Encoding UTF8
    $placeholderValidation = Join-Path $TempRoot "chatgpt_placeholder_validation.json"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_visual_judge_response.ps1") `
        -RawPath $rawPlaceholder `
        -JudgeType chatgpt `
        -OutPath (Join-Path $TempRoot "chatgpt_placeholder.json") `
        -ReportPath (Join-Path $TempRoot "chatgpt_placeholder_report.json") `
        -ValidationOutPath $placeholderValidation | Out-Null
    $placeholderValidationJson = Read-Json $placeholderValidation
    Assert-True ($placeholderValidationJson.placeholder_praise_detected -eq $true) "placeholder enum was not detected"

    $chatProbeOut = Join-Path $TempRoot "chatgpt_probe"
    $chatProbeOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") `
        -EvidencePath "fixture/a20p" `
        -OutputPath $chatProbeOut `
        -AttachmentPath "ops\autopilot\fixtures\judges\a20p_chatgpt_art_direction_review_good.json" `
        -Mode SAFE_LIVE_READONLY_MODE 2>&1
    $chatProbe = $chatProbeOutput | Out-String | ConvertFrom-Json
    Assert-True ($chatProbe.live_chatgpt_called -eq $false) "ChatGPT capture should not call live bridge when disabled"
    Assert-True ($chatProbe.capture_result -eq "UPLOAD_LANE_UNAVAILABLE") "ChatGPT missing lane was not explicit"

    $geminiProbeOut = Join-Path $TempRoot "gemini_probe"
    $geminiProbeOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\capture_gemini_visual_judge.ps1") `
        -EvidencePath "fixture/a20p" `
        -OutputPath $geminiProbeOut `
        -RawFixturePath $rawGemini 2>&1
    $geminiProbe = $geminiProbeOutput | Out-String | ConvertFrom-Json
    Assert-True ($geminiProbe.validation_result -eq "VALID_OUTPUT") "Gemini wrapper did not normalize fixture raw output"
    Assert-True ($geminiProbe.live_gemini_called -eq $false) "Gemini fixture wrapper called live mode"

    [ordered]@{
        status = "pass"
        tests = 10
        gemini_wrapped_json_normalized = $true
        chatgpt_fenced_json_normalized = $true
        chatgpt_prose_json_block_normalized = $true
        out_of_range_scores_rejected = $true
        missing_screenshot_rejected = $true
        generic_praise_rejected = $true
        placeholder_enum_rejected = $true
        prose_only_rejected = $true
        chatgpt_disabled_lane_blocked_without_live_call = $true
        gemini_fixture_wrapper_validates = $true
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
