param(
    [string]$MissionId = "A20U_VISUAL_JUDGE_CAPTURE_HARDENING",
    [Parameter(Mandatory = $true)][string]$EvidencePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$PromptPath = "",
    [string[]]$AttachmentPath = @(),
    [switch]$Live,
    [string]$RawFixturePath = "",
    [string]$Nonce = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
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
    $Nonce = "A20U_CHATGPT_" + ([guid]::NewGuid().ToString("N").Substring(0, 12).ToUpperInvariant())
}

$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$localProjectPath = Join-Path $PSScriptRoot "local\chatgpt_project.local.json"
$localSessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"
$localProjectConfigured = $false
$localSessionConfigured = $false
if (Test-Path -LiteralPath $localProjectPath) {
    $localProject = Get-Content -LiteralPath $localProjectPath -Raw | ConvertFrom-Json
    $localProjectConfigured = -not [string]::IsNullOrWhiteSpace([string]$localProject.chatgpt_project.project_url)
}
if (Test-Path -LiteralPath $localSessionPath) {
    $localSession = Get-Content -LiteralPath $localSessionPath -Raw | ConvertFrom-Json
    $localSessionConfigured = -not [string]::IsNullOrWhiteSpace([string]$localSession.active_session_url)
}

$resolvedAttachments = @()
foreach ($attachment in $AttachmentPath) {
    if (-not (Test-Path -LiteralPath $attachment -PathType Leaf)) {
        throw "AttachmentPath not found: $attachment"
    }
    $resolvedAttachments += (Resolve-Path -LiteralPath $attachment).Path
}

$requestPath = Join-Path $OutputPath "chatgpt_visual_judge_request.md"
$prompt = if ($PromptPath -and (Test-Path -LiteralPath $PromptPath -PathType Leaf)) { Get-Content -LiteralPath $PromptPath -Raw } else { "" }
@"
You are the ChatGPT Product and Art Director reviewer for NeuroChess.

Mission: $MissionId
Nonce: $Nonce
Evidence path: $EvidencePath

Use only the attached A20P contact sheet/screenshots and the visual packet
context. Do not infer visual evidence from text-only file names. Return strict
JSON only, no markdown.

$prompt

Required JSON:
{
  "mission_id": "$MissionId",
  "evidence_path": "$EvidencePath",
  "screenshot_set": [
    "generation_1_patch/contact_sheet_generation_1_states.png",
    "generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png"
  ],
  "chatgpt_art_direction_verdict": "PRODUCT_GRADE_WITH_DEBT",
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "top_strengths": [],
  "top_defects": [],
  "awwwards_app_craft_score": 0,
  "required_patch": "One concrete next visual action or human review.",
  "allowed_next_action": "human_review_or_second_patch",
  "live_chatgpt_called": true,
  "live_gemini_called": false,
  "product_mission_executed": false,
  "done": "$Nonce"
}

Rules:
- Include concrete screenshot-grounded strengths and defects.
- Do not approve without visible screenshot evidence.
- Hard gates have veto.
- No generic praise.
"@ | Set-Content -LiteralPath $requestPath -Encoding UTF8

$reportPath = Join-Path $OutputPath "chatgpt_capture_report.json"
$rawPath = Join-Path $rawDir "chatgpt_raw_response.txt"
$normalizedPath = Join-Path $normalizedDir "chatgpt_art_direction_review.json"
$validationPath = Join-Path $validatedDir "chatgpt_validation.json"
$normalizationReportPath = Join-Path $OutputPath "chatgpt_normalization_report.json"

$summary = [ordered]@{
    schema_version = "A20U_chatgpt_capture_report_v1"
    mission_id = $MissionId
    evidence_path = $EvidencePath
    output_path = $OutputPath
    request_path = $requestPath
    nonce = $Nonce
    live_attempted = [bool]$Live
    raw_fixture_mode = -not [string]::IsNullOrWhiteSpace($RawFixturePath)
    attachment_count = $resolvedAttachments.Count
    chatgpt_web_bridge_enabled = [bool]$config.chatgpt_web_bridge.enabled
    local_project_url_configured = $localProjectConfigured
    local_active_session_configured = $localSessionConfigured
    approved_attachment_lane_available = ([bool]$config.chatgpt_web_bridge.enabled -and $resolvedAttachments.Count -gt 0)
    capture_result = "NOT_RUN"
    raw_output_path = $null
    normalized_output_path = $null
    validation_path = $null
    normalization_result = "NOT_RUN"
    validation_result = "NOT_RUN"
    live_chatgpt_called = $false
    live_gemini_called = $false
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
    if (-not [bool]$config.chatgpt_web_bridge.enabled) {
        $summary.capture_result = "CHATGPT_VISUAL_CAPTURE_LANE_MISSING"
        $summary.stop_reason = "chatgpt_web_bridge.enabled=false"
    } elseif ($resolvedAttachments.Count -eq 0) {
        $summary.capture_result = "CHATGPT_VISUAL_CAPTURE_LANE_MISSING"
        $summary.stop_reason = "no screenshot/contact-sheet attachment supplied"
    } else {
        $liveOut = Join-Path $OutputPath "live_attempt"
        New-Item -ItemType Directory -Force -Path $liveOut | Out-Null
        $bundledNode = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
        $nodeExe = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { "node" }
        $bridgeArgs = @(
            (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs"),
            "--live",
            "--config", $configPath,
            "--request", $requestPath,
            "--nonce", $Nonce,
            "--response-root", "NC_VISUAL_JUDGE_RESPONSE",
            "--out", $liveOut
        )
        foreach ($attachment in $resolvedAttachments) {
            $bridgeArgs += @("--attachment", $attachment)
        }
        & $nodeExe @bridgeArgs
        $exit = $LASTEXITCODE
        $summary.live_chatgpt_called = $true
        $summary.chatgpt_bridge_exit_code = $exit
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
            $summary.capture_result = "CHATGPT_CAPTURE_FAILED"
        }
    }
} else {
    $summary.capture_result = "LIVE_NOT_REQUESTED"
}

if (Test-Path -LiteralPath $rawPath -PathType Leaf) {
    $normalizerOutput = & (Join-Path $PSScriptRoot "normalize_visual_judge_response.ps1") `
        -RawPath $rawPath `
        -JudgeType "chatgpt" `
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
if ($summary.capture_result -eq "CHATGPT_VISUAL_CAPTURE_LANE_MISSING") { exit 3 }
exit 2
