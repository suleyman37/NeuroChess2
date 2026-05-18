param(
    [string]$MissionId = "A20V_CHATGPT_VISUAL_UPLOAD_LANE_IMPLEMENTATION",
    [Parameter(Mandatory = $true)][string]$EvidencePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$PromptPath = "",
    [string]$ContactSheetPath = "",
    [string[]]$AttachmentPath = @(),
    [ValidateSet("DRY_RUN", "OFFLINE_FIXTURE_MODE", "SAFE_LIVE_READONLY_MODE")]
    [string]$Mode = "DRY_RUN",
    [switch]$Live,
    [string]$RawFixturePath = "",
    [string]$Nonce = "",
    [int]$MaxWaitSeconds = 900,
    [string]$AllowOneJsonCorrection = "true",
    [switch]$AllowChatGPTVisualProbe
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-FirstExistingFile {
    param([string[]]$Paths)
    foreach ($candidate in $Paths) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return ""
}

function Get-SanitizedLocalConfigState {
    param([string]$Root)
    $localProjectPath = Join-Path $Root "local\chatgpt_project.local.json"
    $localSessionPath = Join-Path $Root "local\chatgpt_sessions.local.json"
    $projectConfigured = $false
    $sessionConfigured = $false
    if (Test-Path -LiteralPath $localProjectPath -PathType Leaf) {
        $localProject = Get-Content -LiteralPath $localProjectPath -Raw | ConvertFrom-Json
        $projectConfigured = -not [string]::IsNullOrWhiteSpace([string]$localProject.chatgpt_project.project_url)
    }
    if (Test-Path -LiteralPath $localSessionPath -PathType Leaf) {
        $localSession = Get-Content -LiteralPath $localSessionPath -Raw | ConvertFrom-Json
        $sessionConfigured = -not [string]::IsNullOrWhiteSpace([string]$localSession.active_session_url)
    }
    [ordered]@{
        local_project_url_configured = $projectConfigured
        local_active_session_configured = $sessionConfigured
        local_config_paths_redacted = $true
    }
}

function Get-ProfileLockState {
    param($BridgeConfig)
    $profile = if ($BridgeConfig.chrome_profile_path) {
        [string]$BridgeConfig.chrome_profile_path
    } else {
        Join-Path ([string]$env:USERPROFILE) "Documents\Dev\ChatGPTSupervisorChromeProfile"
    }
    $lockFiles = @("SingletonLock", "SingletonCookie", "SingletonSocket") |
        ForEach-Object { Join-Path $profile $_ } |
        Where-Object { Test-Path -LiteralPath $_ }
    [ordered]@{
        profile_configured = -not [string]::IsNullOrWhiteSpace($profile)
        profile_path_redacted = $true
        locked = ($lockFiles.Count -gt 0)
        lock_file_count = $lockFiles.Count
    }
}

function Invoke-Normalization {
    param(
        [string]$RawPath,
        [string]$NormalizedPath,
        [string]$ReportPath,
        [string]$ValidationPath
    )
    $normalizerOutput = & (Join-Path $PSScriptRoot "normalize_visual_judge_response.ps1") `
        -RawPath $RawPath `
        -JudgeType "chatgpt" `
        -OutPath $NormalizedPath `
        -ReportPath $ReportPath `
        -ValidationOutPath $ValidationPath 2>&1
    $normalization = if (Test-Path -LiteralPath $ReportPath -PathType Leaf) {
        Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
    } else {
        $null
    }
    $validation = if (Test-Path -LiteralPath $ValidationPath -PathType Leaf) {
        Get-Content -LiteralPath $ValidationPath -Raw | ConvertFrom-Json
    } else {
        $null
    }
    [ordered]@{
        normalizer_output = ($normalizerOutput -join "`n")
        normalization = $normalization
        validation = $validation
    }
}

function Get-CaptureResultFromValidation {
    param($Validation, $NormalizationResult)
    if ($Validation -and $Validation.validation_result -eq "VALID_OUTPUT") { return "CHATGPT_CAPTURED_VALID_JSON" }
    if ($Validation -and ($Validation.placeholder_praise_detected -eq $true -or $Validation.generic_praise_detected -eq $true)) {
        return "CHATGPT_CAPTURED_INVALID_JSON"
    }
    if ($NormalizationResult -eq "NO_VALID_JUDGE_JSON_FOUND") { return "CHATGPT_CAPTURED_INVALID_JSON" }
    if ($Validation -and $Validation.validation_result -eq "INVALID_OUTPUT") { return "CHATGPT_CAPTURED_INVALID_JSON" }
    return "NO_RESPONSE_CAPTURED"
}

function Invoke-ChatGptBridge {
    param(
        [string]$ConfigPath,
        [string]$RequestPath,
        [string]$NonceValue,
        [string[]]$Attachments,
        [string]$OutDir,
        [int]$WaitSeconds
    )
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $bundledNode = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    $nodeExe = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { "node" }
    $bridgeArgs = @(
        (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs"),
        "--live",
        "--config", $ConfigPath,
        "--request", $RequestPath,
        "--nonce", $NonceValue,
        "--response-root", "NC_VISUAL_JUDGE_RESPONSE",
        "--out", $OutDir,
        "--max-wait-seconds", ([string]$WaitSeconds)
    )
    foreach ($attachment in $Attachments) {
        $bridgeArgs += @("--attachment", $attachment)
    }
    & $nodeExe @bridgeArgs
    $exit = $LASTEXITCODE
    $candidateRaw = @(
        (Join-Path $OutDir "extracted_response.txt"),
        (Join-Path $OutDir "raw_response.txt"),
        (Join-Path $OutDir "partial_response.txt")
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    $bridgeError = Join-Path $OutDir "bridge_error.md"
    $reason = if (Test-Path -LiteralPath $bridgeError -PathType Leaf) {
        (Get-Content -LiteralPath $bridgeError -Raw).Trim()
    } else {
        ""
    }
    [ordered]@{
        exit_code = $exit
        raw_path = $candidateRaw
        bridge_error = $reason
    }
}

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
$parentOut = Split-Path -Parent $OutputPath
$rawDir = Join-Path $parentOut "raw_outputs"
$normalizedDir = Join-Path $parentOut "normalized_outputs"
$validatedDir = Join-Path $parentOut "validated_outputs"
New-Item -ItemType Directory -Force -Path $rawDir, $normalizedDir, $validatedDir | Out-Null

if ($Live) { $Mode = "SAFE_LIVE_READONLY_MODE" }
if ($Mode -eq "SAFE_LIVE_READONLY_MODE" -and -not [string]::IsNullOrWhiteSpace($RawFixturePath)) {
    $RawFixturePath = ""
}
if (-not $Nonce) {
    $Nonce = "A20V_CHATGPT_" + ([guid]::NewGuid().ToString("N").Substring(0, 12).ToUpperInvariant())
}
$allowCorrection = ([string]$AllowOneJsonCorrection).ToLowerInvariant() -in @("true", "1", "yes")

$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$bridgeConfig = $config.chatgpt_web_bridge
$probeEnabled = ([bool]$bridgeConfig.enabled -or [bool]$AllowChatGPTVisualProbe)
$localState = Get-SanitizedLocalConfigState -Root $PSScriptRoot
$profileState = Get-ProfileLockState -BridgeConfig $bridgeConfig

$resolvedAttachments = @()
$candidateAttachments = @()
if ($ContactSheetPath) { $candidateAttachments += $ContactSheetPath }
$candidateAttachments += $AttachmentPath
foreach ($attachment in @($candidateAttachments | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $attachment -PathType Leaf)) {
        throw "AttachmentPath not found: $attachment"
    }
    $resolvedAttachments += (Resolve-Path -LiteralPath $attachment).Path
}

$prompt = if ($PromptPath -and (Test-Path -LiteralPath $PromptPath -PathType Leaf)) {
    Get-Content -LiteralPath $PromptPath -Raw
} else {
    ""
}
$requestPath = Join-Path $OutputPath "chatgpt_visual_judge_request.md"
@"
You are the ChatGPT Product and Art Director reviewer for NeuroChess.

Mission: $MissionId
Nonce: $Nonce
Evidence path: $EvidencePath

Use only the attached A20P contact sheet and the visual packet context. Do not
infer visual evidence from text-only file names. If no image/contact sheet is
actually attached and visible to you, set evidence_seen to false.

Return exactly one XML response block with strict JSON inside, no markdown:

<NC_VISUAL_JUDGE_RESPONSE nonce="$Nonce">
{
  "contract_version": "minimal_visual_judge_v2",
  "judge": "chatgpt_product_art_director",
  "evidence_seen": true,
  "evidence_files": [
    "generation_1_patch/contact_sheet_generation_1_states.png"
  ],
  "screenshot_references": [
    "contact_sheet_generation_1_states: observe board and phase rail",
    "contact_sheet_generation_1_states: try-before-feedback board state",
    "contact_sheet_generation_1_states: feedback success and miss states"
  ],
  "hard_gate_observations": {
    "board_readability": "PASS",
    "anti_spoiler": "PASS",
    "piece_readability": "PASS",
    "board_pollution": "PASS"
  },
  "public_screenshot_level": "PUBLIC_TEASER_READY_WITH_CAVEATS",
  "awwwards_app_craft_level": "PREMIUM_DIRECTION",
  "visual_competence_level": "PREMIUM_WITH_SUPERVISION",
  "top_strengths": [
    "Replace with a concrete visible strength from the contact sheet.",
    "Replace with a second concrete visible strength from the contact sheet.",
    "Replace with a third concrete visible strength from the contact sheet."
  ],
  "top_defects": [
    "Replace with a concrete visible defect from the contact sheet.",
    "Replace with a second concrete visible defect from the contact sheet.",
    "Replace with a third concrete visible defect from the contact sheet."
  ],
  "fatal_defects": [],
  "recommended_action": "HUMAN_REVIEW_REQUIRED"
}
<NC_DONE nonce="$Nonce">DONE</NC_DONE>
</NC_VISUAL_JUDGE_RESPONSE>

$prompt

Rules:
- Include at least three concrete screenshot-grounded strengths and defects.
- Do not approve without visible screenshot evidence.
- Hard gates have veto.
- No generic praise.
- No numeric scores, percentages, or 0-100 ratings.
"@ | Set-Content -LiteralPath $requestPath -Encoding UTF8

$reportPath = Join-Path $OutputPath "chatgpt_capture_report.json"
$rawPath = Join-Path $rawDir "chatgpt_raw_response.txt"
$normalizedPath = Join-Path $normalizedDir "chatgpt_art_direction_review.json"
$validationPath = Join-Path $validatedDir "chatgpt_validation.json"
$normalizationReportPath = Join-Path $OutputPath "chatgpt_normalization_report.json"

$summary = [ordered]@{
    schema_version = "A20X_chatgpt_visual_upload_probe_report_v1"
    mission_id = $MissionId
    evidence_path = $EvidencePath
    output_path = $OutputPath
    request_path = $requestPath
    nonce = $Nonce
    mode = $Mode
    max_wait_seconds = $MaxWaitSeconds
    allow_one_json_correction = $allowCorrection
    raw_fixture_mode = -not [string]::IsNullOrWhiteSpace($RawFixturePath)
    attachment_count = $resolvedAttachments.Count
    attachment_paths_redacted = $true
    chatgpt_web_bridge_enabled = [bool]$bridgeConfig.enabled
    mission_scoped_visual_probe_override = [bool]$AllowChatGPTVisualProbe
    chatgpt_bridge_script_exists = Test-Path -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs") -PathType Leaf
    local_project_url_configured = $localState.local_project_url_configured
    local_active_session_configured = $localState.local_active_session_configured
    profile_path_redacted = $true
    profile_locked = [bool]$profileState.locked
    approved_upload_lane_available = ($probeEnabled -and $resolvedAttachments.Count -gt 0)
    upload_control_status = "NOT_PROBED"
    file_input_adapter_result = "NOT_ATTEMPTED"
    clipboard_image_paste_adapter_result = "NOT_ATTEMPTED"
    drag_drop_adapter_result = "NOT_ATTEMPTED"
    image_attachment_confirmed = $false
    capture_result = "NOT_RUN"
    stop_reason = ""
    raw_output_path = $null
    normalized_output_path = $null
    validation_path = $null
    normalization_result = "NOT_RUN"
    validation_result = "NOT_RUN"
    validation_invalid_reasons = @()
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
} elseif ($Mode -eq "SAFE_LIVE_READONLY_MODE") {
    if (-not $probeEnabled) {
        $summary.capture_result = "UPLOAD_LANE_UNAVAILABLE"
        $summary.stop_reason = "chatgpt_web_bridge.enabled=false"
    } elseif ($resolvedAttachments.Count -eq 0) {
        $summary.capture_result = "UPLOAD_LANE_UNAVAILABLE"
        $summary.stop_reason = "no contact sheet or screenshot attachment supplied"
    } elseif ($profileState.locked -eq $true -and $bridgeConfig.profile_lock_preflight -eq $true) {
        $summary.capture_result = "SAFE_SESSION_UNAVAILABLE"
        $summary.stop_reason = "chatgpt chrome profile appears locked"
    } else {
        $summary.upload_control_status = "PROBED_BY_CHATGPT_BRIDGE"
        $liveOut = Join-Path $OutputPath "live_attempt_1"
        $bridge = Invoke-ChatGptBridge -ConfigPath $configPath -RequestPath $requestPath -NonceValue $Nonce -Attachments $resolvedAttachments -OutDir $liveOut -WaitSeconds $MaxWaitSeconds
        $summary.live_chatgpt_called = $true
        $summary.chatgpt_bridge_exit_code = $bridge.exit_code
        if ($bridge.raw_path) {
            Copy-Item -LiteralPath $bridge.raw_path -Destination $rawPath -Force
            Copy-Item -LiteralPath $bridge.raw_path -Destination (Join-Path $rawDir "chatgpt_raw_response_attempt_1.txt") -Force
            $summary.raw_output_path = $rawPath
        }
        if ($bridge.bridge_error) {
            $summary.stop_reason = $bridge.bridge_error
            if ($bridge.bridge_error -match "LOGIN|HUMAN|CAPTCHA|2FA|CONSENT") {
                $summary.human_verification_encountered = $true
                $summary.capture_result = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
            } elseif ($bridge.bridge_error -match "UPLOAD|ATTACHMENT|file chooser") {
                $summary.capture_result = "CHATGPT_FILE_INPUT_ADAPTER_FAILED"
                $summary.file_input_adapter_result = "FAILED"
                $summary.clipboard_image_paste_adapter_result = "NOT_IMPLEMENTED"
                $summary.drag_drop_adapter_result = "NOT_IMPLEMENTED"
            } elseif ($bridge.bridge_error -match "Timed out|DONE|timeout") {
                $summary.capture_result = "CHATGPT_RESPONSE_TIMEOUT"
            } else {
                $summary.capture_result = "NO_RESPONSE_CAPTURED"
            }
        } elseif ($bridge.exit_code -eq 0 -and $bridge.raw_path) {
            $summary.capture_result = "RAW_RESPONSE_CAPTURED"
            $summary.file_input_adapter_result = "ATTACHMENT_CONFIRMED_BY_BRIDGE"
            $summary.image_attachment_confirmed = $true
        } else {
            $summary.capture_result = "NO_RESPONSE_CAPTURED"
        }

        $uploadResultPath = Join-Path $liveOut "upload_result.json"
        if (Test-Path -LiteralPath $uploadResultPath -PathType Leaf) {
            $uploadResult = Get-Content -LiteralPath $uploadResultPath -Raw | ConvertFrom-Json
            $summary.upload_result_path = $uploadResultPath
            $summary.upload_result_ok = [bool]$uploadResult.ok
            if ($uploadResult.ok -eq $true) {
                $summary.file_input_adapter_result = [string]$uploadResult.strategy
                $summary.image_attachment_confirmed = $true
            } elseif ($summary.file_input_adapter_result -eq "NOT_ATTEMPTED") {
                $summary.file_input_adapter_result = "FAILED"
            }
        }
    }
} else {
    $summary.capture_result = "LIVE_NOT_REQUESTED"
}

if (Test-Path -LiteralPath $rawPath -PathType Leaf) {
    $normalization = Invoke-Normalization -RawPath $rawPath -NormalizedPath $normalizedPath -ReportPath $normalizationReportPath -ValidationPath $validationPath
    $summary.normalizer_output = $normalization.normalizer_output
    if ($normalization.normalization) {
        $summary.normalization_result = $normalization.normalization.normalization_result
    }
    if ($normalization.validation) {
        $summary.validation_result = $normalization.validation.validation_result
        $summary.validation_path = $validationPath
        $summary.validation_invalid_reasons = @($normalization.validation.invalid_reasons)
    }
    if (Test-Path -LiteralPath $normalizedPath -PathType Leaf) {
        $summary.normalized_output_path = $normalizedPath
    }
    if ($summary.capture_result -in @("RAW_RESPONSE_CAPTURED", "RAW_FIXTURE_CAPTURED", "CHATGPT_CAPTURED_INVALID_JSON", "NO_RESPONSE_CAPTURED")) {
        $summary.capture_result = Get-CaptureResultFromValidation -Validation $normalization.validation -NormalizationResult $summary.normalization_result
    }

    if ($summary.capture_result -ne "CHATGPT_CAPTURED_VALID_JSON" -and $allowCorrection -and $Mode -eq "SAFE_LIVE_READONLY_MODE" -and $summary.live_chatgpt_called -eq $true -and -not $summary.human_verification_encountered) {
        $repairRequestPath = Join-Path $OutputPath "chatgpt_visual_judge_json_correction_request.md"
        $validationText = if (Test-Path -LiteralPath $validationPath -PathType Leaf) { Get-Content -LiteralPath $validationPath -Raw } else { "No validation report." }
        $rawText = Get-Content -LiteralPath $rawPath -Raw
@"
Return the corrected minimal_visual_judge_v2 JSON for the same NeuroChess
visual judge request, wrapped exactly in the required XML response block.

Nonce: $Nonce

Your previous response failed validation:
$validationText

Previous raw response:
$rawText

Do not add prose. Do not change the evidence basis. Use the attached A20P
contact sheet only. Do not use numeric scores, percentages, or 0-100 ratings.

Required wrapper:
<NC_VISUAL_JUDGE_RESPONSE nonce="$Nonce">
{ "contract_version": "minimal_visual_judge_v2" }
<NC_DONE nonce="$Nonce">DONE</NC_DONE>
</NC_VISUAL_JUDGE_RESPONSE>
"@ | Set-Content -LiteralPath $repairRequestPath -Encoding UTF8

        $repairOut = Join-Path $OutputPath "live_attempt_2_json_correction"
        $repair = Invoke-ChatGptBridge -ConfigPath $configPath -RequestPath $repairRequestPath -NonceValue $Nonce -Attachments $resolvedAttachments -OutDir $repairOut -WaitSeconds $MaxWaitSeconds
        $summary.json_correction_attempted = $true
        $summary.json_correction_exit_code = $repair.exit_code
        if ($repair.raw_path) {
            Copy-Item -LiteralPath $repair.raw_path -Destination (Join-Path $rawDir "chatgpt_raw_response_attempt_2.txt") -Force
            Copy-Item -LiteralPath $repair.raw_path -Destination $rawPath -Force
            $summary.raw_output_path = $rawPath
            $normalization = Invoke-Normalization -RawPath $rawPath -NormalizedPath $normalizedPath -ReportPath $normalizationReportPath -ValidationPath $validationPath
            $summary.normalizer_output_after_correction = $normalization.normalizer_output
            if ($normalization.normalization) { $summary.normalization_result = $normalization.normalization.normalization_result }
            if ($normalization.validation) {
                $summary.validation_result = $normalization.validation.validation_result
                $summary.validation_invalid_reasons = @($normalization.validation.invalid_reasons)
            }
            if (Test-Path -LiteralPath $normalizedPath -PathType Leaf) {
                $summary.normalized_output_path = $normalizedPath
            }
            $summary.capture_result = Get-CaptureResultFromValidation -Validation $normalization.validation -NormalizationResult $summary.normalization_result
        }
        if ($repair.bridge_error -match "LOGIN|HUMAN|CAPTCHA|2FA|CONSENT") {
            $summary.human_verification_encountered = $true
            $summary.capture_result = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
            $summary.stop_reason = $repair.bridge_error
        }
    }
}

Write-Json $reportPath $summary
$summary | ConvertTo-Json -Depth 40

switch ($summary.capture_result) {
    "CHATGPT_CAPTURED_VALID_JSON" { exit 0 }
    "UPLOAD_LANE_UNAVAILABLE" { exit 3 }
    "SAFE_SESSION_UNAVAILABLE" { exit 4 }
    "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" { exit 5 }
    default { exit 2 }
}
