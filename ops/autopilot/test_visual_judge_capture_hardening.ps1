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

    $chatProbeOut = Join-Path $TempRoot "chatgpt_probe"
    $chatProbeOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") `
        -EvidencePath "fixture/a20p" `
        -OutputPath $chatProbeOut `
        -AttachmentPath "ops\autopilot\fixtures\judges\a20p_chatgpt_art_direction_review_good.json" `
        -Live 2>&1
    $chatProbe = $chatProbeOutput | Out-String | ConvertFrom-Json
    Assert-True ($chatProbe.live_chatgpt_called -eq $false) "ChatGPT capture should not call live bridge when disabled"
    Assert-True ($chatProbe.capture_result -eq "CHATGPT_VISUAL_CAPTURE_LANE_MISSING") "ChatGPT missing lane was not explicit"

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
        tests = 5
        gemini_wrapped_json_normalized = $true
        chatgpt_fenced_json_normalized = $true
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
