param(
    [string]$MissionId = "A20U_VISUAL_JUDGE_CAPTURE_HARDENING",
    [Parameter(Mandatory = $true)][string]$EvidencePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$PromptPath = "",
    [string[]]$ImagePath = @(),
    [switch]$Live,
    [string]$RawFixturePath = "",
    [string]$Nonce = "",
    [int]$TimeoutSeconds = 360,
    [int]$StabilitySeconds = 12,
    [string]$ProfilePath = "C:\Users\suley\Documents\Dev\GeminiAuditorChromeProfile"
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-OptionalText {
    param([string]$Path)
    if ($Path -and (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return Get-Content -LiteralPath $Path -Raw
    }
    return ""
}

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
$rawDir = Join-Path (Split-Path -Parent $OutputPath) "raw_outputs"
$normalizedDir = Join-Path (Split-Path -Parent $OutputPath) "normalized_outputs"
$validatedDir = Join-Path (Split-Path -Parent $OutputPath) "validated_outputs"
New-Item -ItemType Directory -Force -Path $rawDir, $normalizedDir, $validatedDir | Out-Null

if ($Live -and -not [string]::IsNullOrWhiteSpace($RawFixturePath)) {
    $RawFixturePath = ""
}

if (-not $Nonce) {
    $Nonce = "A20U_GEMINI_" + ([guid]::NewGuid().ToString("N").Substring(0, 12).ToUpperInvariant())
}

$resolvedImages = @()
foreach ($image in $ImagePath) {
    if (-not (Test-Path -LiteralPath $image -PathType Leaf)) {
        throw "ImagePath not found: $image"
    }
    $resolvedImages += (Resolve-Path -LiteralPath $image).Path
}

$basePrompt = Read-OptionalText -Path $PromptPath
$requestPath = Join-Path $OutputPath "gemini_visual_judge_request.md"
$request = @"
You are the Gemini Visual Perceiver for NeuroChess.

Mission: $MissionId
Nonce: $Nonce
Evidence path: $EvidencePath

Inspect only the attached A20P visual evidence. Do not infer from source code.
Do not provide implementation instructions. Do not mention MICRO_PROMPT or
codex_prompt. Do not give generic praise.

$basePrompt

Return strict JSON only. The outer transport object must use this exact shape:

{
  "schema": "NC_GEMINI_AUDIT_JSON/1",
  "nonce": "$Nonce",
  "mode": "visual_court",
  "verdict": "PASS_VISUAL or WARNING_VISUAL or BLOCK_VISUAL",
  "required_action": "none or block_visual or record_report",
  "scores": {
    "scope_risk": 0,
    "product_value": 0,
    "safety_risk": 0,
    "automation_drift_risk": 0,
    "confidence": 0.0
  },
  "findings": [
    "One concrete screenshot-grounded observation."
  ],
  "must_not_do": "Do not override hard gates or produce Codex prompts.",
  "visual_checks": {
    "visual_code_seen": "",
    "fake_practice_claim_detected": false,
    "fake_xp_rank_transfer_claim_detected": false,
    "board_pollution_detected": false,
    "pre_feedback_hint_detected": false,
    "screenshot_evidence_used": true
  },
  "visual_judge_output": {
    "mission_id": "$MissionId",
    "evidence_path": "$EvidencePath",
    "screenshot_set": [
      "generation_1_patch/contact_sheet_generation_1_states.png",
      "generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png"
    ],
    "gemini_visual_verdict": "WARNING_VISUAL_WITH_CONCRETE_DEBT",
    "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
    "concrete_strengths": [],
    "concrete_weaknesses": [],
    "fatal_defects": [],
    "top_defects": [],
    "top_strengths": [],
    "blocked_reasons": [],
    "awwwards_app_craft_score": 0,
    "visual_competence_score": 17,
    "allowed_next_action": "human_review_or_second_patch",
    "live_gemini_called": true,
    "live_chatgpt_called": false,
    "product_mission_executed": false
  },
  "done": "$Nonce"
}

Rules:
- Replace placeholder values with concrete screenshot-grounded judgment.
- Include at least one concrete strength and one concrete weakness.
- Include fatal_defects even when it is an empty array.
- Keep board fidelity and anti-spoiler concerns explicit.
- Set done exactly to "$Nonce".
"@
$request | Set-Content -LiteralPath $requestPath -Encoding UTF8

$reportPath = Join-Path $OutputPath "gemini_capture_report.json"
$rawPath = Join-Path $rawDir "gemini_raw_response.txt"
$normalizedPath = Join-Path $normalizedDir "gemini_visual_observation.json"
$validationPath = Join-Path $validatedDir "gemini_validation.json"
$normalizationReportPath = Join-Path $OutputPath "gemini_normalization_report.json"

$summary = [ordered]@{
    schema_version = "A20U_gemini_capture_report_v1"
    mission_id = $MissionId
    evidence_path = $EvidencePath
    output_path = $OutputPath
    request_path = $requestPath
    nonce = $Nonce
    live_attempted = [bool]$Live
    raw_fixture_mode = -not [string]::IsNullOrWhiteSpace($RawFixturePath)
    image_count = $resolvedImages.Count
    raw_output_path = $null
    normalized_output_path = $null
    validation_path = $null
    capture_result = "NOT_RUN"
    normalization_result = "NOT_RUN"
    validation_result = "NOT_RUN"
    live_gemini_called = $false
    live_chatgpt_called = $false
    product_mission_executed = $false
    human_verification_encountered = $false
    bypass_attempted = $false
}

if ($RawFixturePath) {
    if (-not (Test-Path -LiteralPath $RawFixturePath -PathType Leaf)) {
        throw "RawFixturePath not found: $RawFixturePath"
    }
    Copy-Item -LiteralPath $RawFixturePath -Destination $rawPath -Force
    $summary.capture_result = "RAW_FIXTURE_CAPTURED"
    $summary.raw_output_path = $rawPath
} elseif ($Live) {
    $liveOut = Join-Path $OutputPath "live_attempt"
    New-Item -ItemType Directory -Force -Path $liveOut | Out-Null
    $output = & (Join-Path $PSScriptRoot "ask_gemini_web.ps1") `
        -Live `
        -RequestPath $requestPath `
        -OutDir $liveOut `
        -Nonce $Nonce `
        -TimeoutSeconds $TimeoutSeconds `
        -StabilitySeconds $StabilitySeconds `
        -ProfilePath $ProfilePath `
        -ImagePath $resolvedImages 2>&1
    $exit = $LASTEXITCODE
    $output | Set-Content -LiteralPath (Join-Path $OutputPath "gemini_live_stdout.txt") -Encoding UTF8
    $summary.live_gemini_called = $true
    $summary.ask_gemini_exit_code = $exit

    $candidateRaw = @(
        (Join-Path $liveOut "extracted_response.txt"),
        (Join-Path $liveOut "raw_response.txt"),
        (Join-Path $liveOut "partial_response.txt")
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1

    if ($candidateRaw) {
        Copy-Item -LiteralPath $candidateRaw -Destination $rawPath -Force
        $summary.raw_output_path = $rawPath
    }

    $bridgeError = Join-Path $liveOut "bridge_error.md"
    if (Test-Path -LiteralPath $bridgeError) {
        $reason = (Get-Content -LiteralPath $bridgeError -Raw).Trim()
        $summary.stop_reason = $reason
        if ($reason -match "LOGIN|HUMAN|CAPTCHA|2FA|CONSENT") {
            $summary.human_verification_encountered = $true
            $summary.capture_result = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
        } else {
            $summary.capture_result = $reason
        }
    } elseif ($exit -eq 0) {
        $summary.capture_result = "RAW_RESPONSE_CAPTURED"
    } else {
        $summary.capture_result = "GEMINI_CAPTURE_FAILED"
    }
} else {
    $summary.capture_result = "LIVE_NOT_REQUESTED"
}

if (Test-Path -LiteralPath $rawPath -PathType Leaf) {
    $normalizerOutput = & (Join-Path $PSScriptRoot "normalize_visual_judge_response.ps1") `
        -RawPath $rawPath `
        -JudgeType "gemini" `
        -OutPath $normalizedPath `
        -ReportPath $normalizationReportPath `
        -ValidationOutPath $validationPath 2>&1
    $summary.normalizer_output = ($normalizerOutput -join "`n")
    if (Test-Path -LiteralPath $normalizationReportPath) {
        $normalization = Get-Content -LiteralPath $normalizationReportPath -Raw | ConvertFrom-Json
        $summary.normalization_result = $normalization.normalization_result
    }
    if (Test-Path -LiteralPath $validationPath) {
        $validation = Get-Content -LiteralPath $validationPath -Raw | ConvertFrom-Json
        $summary.validation_result = $validation.validation_result
        $summary.validation_path = $validationPath
    }
    if (Test-Path -LiteralPath $normalizedPath) {
        $summary.normalized_output_path = $normalizedPath
    }
}

Write-Json $reportPath $summary
$summary | ConvertTo-Json -Depth 40

if ($summary.validation_result -eq "VALID_OUTPUT") { exit 0 }
exit 2
