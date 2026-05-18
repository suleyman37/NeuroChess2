param(
    [string]$MissionId = "A20V_CHATGPT_VISUAL_UPLOAD_LANE_IMPLEMENTATION",
    [string]$EvidencePath = "",
    [string]$OutputPath = "",
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
    [switch]$AllowChatGPTVisualProbe,
    [ValidateSet("AUTO", "FILE_INPUT")]
    [string]$UploadAdapter = "AUTO",
    [switch]$RequireAttachmentConfirmation,
    [switch]$RequireImageAwareCanary,
    [string]$CanaryCode = "",
    [switch]$HumanVerificationPauseResumeEnabled,
    [int]$TimeoutMinutes = 30,
    [int]$ResumePollSeconds = 15
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

function Invoke-ChatGptFileInputProbe {
    param(
        [string]$PromptFile,
        [string]$Attachment,
        [string]$OutDir,
        [int]$WaitSeconds
    )
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $bundledNode = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    $nodeExe = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { "node" }
    $probeScript = Join-Path $PSScriptRoot "browser\chatgpt_file_input_visual_probe.mjs"
    $probeOutput = & $nodeExe $probeScript `
        --prompt $PromptFile `
        --attachment $Attachment `
        --out $OutDir `
        --maxWaitSeconds ([string]$WaitSeconds) 2>&1
    $exit = $LASTEXITCODE
    $resultPath = Join-Path $OutDir "probe_result.json"
    $result = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    } else {
        $null
    }
    [ordered]@{
        exit_code = $exit
        stdout = ($probeOutput -join "`n")
        result_path = $resultPath
        result = $result
        raw_path = if (Test-Path -LiteralPath (Join-Path $OutDir "raw_response.txt") -PathType Leaf) { Join-Path $OutDir "raw_response.txt" } else { $null }
        partial_path = if (Test-Path -LiteralPath (Join-Path $OutDir "partial_response.txt") -PathType Leaf) { Join-Path $OutDir "partial_response.txt" } else { $null }
        attachment_confirmation_path = if (Test-Path -LiteralPath (Join-Path $OutDir "attachment_confirmation.json") -PathType Leaf) { Join-Path $OutDir "attachment_confirmation.json" } else { $null }
        file_input_selector_audit_path = if (Test-Path -LiteralPath (Join-Path $OutDir "file_input_selector_audit.json") -PathType Leaf) { Join-Path $OutDir "file_input_selector_audit.json" } else { $null }
    }
}

function Invoke-HumanVerificationPauseGate {
    param(
        [string]$ServiceName,
        [string]$MissionIdValue,
        [string]$ReasonValue,
        [string]$ArtifactRoot,
        [int]$TimeoutMinutesValue,
        [switch]$EnableChatGPTResumeProbe
    )
    $gateResultPath = Join-Path $ArtifactRoot "human_verification_pause_gate_result.json"
    $pauseStatePath = Join-Path $PSScriptRoot "runtime\human_verification_pause_state.json"
    $gateArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", (Join-Path $PSScriptRoot "human_verification_pause_resume_gate.ps1"),
        "-Mode", "PauseAndAlert",
        "-ServiceName", $ServiceName,
        "-MissionId", $MissionIdValue,
        "-Reason", $ReasonValue,
        "-BrowserProfile", "redacted",
        "-ArtifactPath", $ArtifactRoot,
        "-PauseStatePath", $pauseStatePath,
        "-TimeoutMinutes", ([string]$TimeoutMinutesValue),
        "-ResultPath", $gateResultPath
    )
    if ($EnableChatGPTResumeProbe) { $gateArgs += "-ChatGPTResumeProbe" }
    $gateOutput = & powershell @gateArgs 2>&1
    $exit = $LASTEXITCODE
    $result = if (Test-Path -LiteralPath $gateResultPath -PathType Leaf) {
        Get-Content -LiteralPath $gateResultPath -Raw | ConvertFrom-Json
    } else {
        $null
    }
    [ordered]@{
        exit_code = $exit
        output_redacted = ($gateOutput -join "`n")
        result_path = $gateResultPath
        pause_state_path = $pauseStatePath
        result = $result
    }
}

function Invoke-HumanVerificationResumeWait {
    param(
        [string]$PauseStatePath,
        [string]$ArtifactRoot,
        [int]$TimeoutMinutesValue,
        [int]$PollSeconds
    )
    $timelinePath = Join-Path $ArtifactRoot "human_resume_timeline.json"
    $deadline = (Get-Date).AddMinutes($TimeoutMinutesValue)
    $events = @()
    $attempt = 0
    if ($PollSeconds -lt 1) { $PollSeconds = 1 }

    while ((Get-Date) -le $deadline) {
        $attempt += 1
        $resumeResultPath = Join-Path $ArtifactRoot ("human_resume_check_{0}.json" -f $attempt)
        $resumeProbeOut = Join-Path $ArtifactRoot ("human_resume_probe_{0}" -f $attempt)
        $resumeOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "human_verification_pause_resume_gate.ps1") `
            -Mode ResumeCheck `
            -PauseStatePath $PauseStatePath `
            -ResultPath $resumeResultPath `
            -ChatGPTResumeProbe `
            -ResumeProbeOutPath $resumeProbeOut 2>&1
        $exit = $LASTEXITCODE
        $result = if (Test-Path -LiteralPath $resumeResultPath -PathType Leaf) {
            Get-Content -LiteralPath $resumeResultPath -Raw | ConvertFrom-Json
        } else {
            $null
        }
        $status = if ($result) { [string]$result.status } else { "UNKNOWN_STATE" }
        $events += [ordered]@{
            attempt = $attempt
            checked_at = (Get-Date).ToString("o")
            status = $status
            exit_code = $exit
            result_path = $resumeResultPath
            probe_out_path = $resumeProbeOut
            output_redacted = ($resumeOutput -join "`n")
        }
        Write-Json -Path $timelinePath -Payload ([ordered]@{
            schema_version = "A20AC_human_resume_timeline_v1"
            status = $status
            timeout_minutes = $TimeoutMinutesValue
            poll_seconds = $PollSeconds
            events = @($events)
        })

        if ($status -in @("RESUME_READY", "SESSION_CLOSED", "TIMEOUT_EXPIRED", "UNKNOWN_STATE")) {
            return [ordered]@{
                status = $status
                exit_code = $exit
                result_path = $resumeResultPath
                timeline_path = $timelinePath
                probe_out_path = $resumeProbeOut
                events = @($events)
            }
        }
        Start-Sleep -Seconds $PollSeconds
    }

    Write-Json -Path $timelinePath -Payload ([ordered]@{
        schema_version = "A20AC_human_resume_timeline_v1"
        status = "TIMEOUT_EXPIRED"
        timeout_minutes = $TimeoutMinutesValue
        poll_seconds = $PollSeconds
        events = @($events)
    })
    [ordered]@{
        status = "TIMEOUT_EXPIRED"
        exit_code = 4
        result_path = $null
        timeline_path = $timelinePath
        probe_out_path = $null
        events = @($events)
    }
}

function Update-SummaryFromFileInputBridge {
    param(
        $Summary,
        $Bridge,
        [string]$RawPathValue,
        [string]$RawDirValue,
        [string]$AttemptLabel
    )
    $probe = $Bridge.result
    $Summary.chatgpt_bridge_exit_code = $Bridge.exit_code
    $Summary.chatgpt_bridge_stdout = $Bridge.stdout
    $Summary.file_input_probe_result_path = $Bridge.result_path
    $Summary.attachment_confirmation_path = $Bridge.attachment_confirmation_path
    $Summary.file_input_selector_audit_path = $Bridge.file_input_selector_audit_path
    if ($probe) {
        $Summary.live_chatgpt_called = [bool]$probe.live_chatgpt_called
        $Summary.cdp_attach_used = [bool]$probe.cdp_attached
        $Summary.persistent_context_avoided = [bool]$probe.cdp_attached
        $Summary.highest_capability = [string]$probe.highest_capability
        $Summary.human_verification_encountered = ([string]$probe.status -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -or [string]$probe.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED")
        $Summary.file_input_adapter_result = if ([bool]$probe.file_input_found) { "FOUND" } else { "NOT_FOUND" }
        $Summary.image_attachment_confirmed = [bool]$probe.attachment_confirmed
        $Summary.upload_control_status = if ([bool]$probe.file_input_found) { "FILE_INPUT_FOUND" } else { "FILE_INPUT_NOT_FOUND" }
        $Summary.capture_result = [string]$probe.status
        $Summary.stop_reason = [string]$probe.stop_reason
    } else {
        $Summary.capture_result = "NO_RESPONSE_CAPTURED"
        $Summary.stop_reason = "file input probe did not produce probe_result.json"
    }
    if ($Bridge.raw_path) {
        Copy-Item -LiteralPath $Bridge.raw_path -Destination $RawPathValue -Force
        Copy-Item -LiteralPath $Bridge.raw_path -Destination (Join-Path $RawDirValue ("chatgpt_raw_response_{0}.txt" -f $AttemptLabel)) -Force
        $Summary.raw_output_path = $RawPathValue
    } elseif ($Bridge.partial_path) {
        Copy-Item -LiteralPath $Bridge.partial_path -Destination (Join-Path $RawDirValue ("chatgpt_partial_response_{0}.txt" -f $AttemptLabel)) -Force
    }
}

function Get-FirstJsonObjectFromText {
    param([string]$Text)
    $candidate = [string]$Text
    $fence = [regex]::Match($candidate, '```(?:json)?\s*(\{[\s\S]*?\})\s*```', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($fence.Success) { $candidate = $fence.Groups[1].Value }
    $start = $candidate.IndexOf("{")
    $end = $candidate.LastIndexOf("}")
    if ($start -lt 0 -or $end -le $start) { return $null }
    try {
        return ($candidate.Substring($start, $end - $start + 1) | ConvertFrom-Json)
    } catch {
        return $null
    }
}

$missingParameters = @()
if ([string]::IsNullOrWhiteSpace($EvidencePath)) { $missingParameters += "EvidencePath" }
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $missingParameters += "OutputPath" }
if ($missingParameters.Count -gt 0) {
    $fallbackOutputPath = if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
        $OutputPath
    } else {
        Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_chatgpt_capture_missing_params_" + [guid]::NewGuid().ToString("N"))
    }
    New-Item -ItemType Directory -Force -Path $fallbackOutputPath | Out-Null
    $paramReportPath = Join-Path $fallbackOutputPath "chatgpt_capture_report.json"
    $paramSummary = [ordered]@{
        schema_version = "A20AF_chatgpt_capture_parameter_guard_v1"
        mission_id = $MissionId
        capture_result = "PARAMETER_REQUIRED"
        stop_reason = "Required non-interactive parameters missing: " + ($missingParameters -join ", ")
        missing_parameters = @($missingParameters)
        evidence_path = $EvidencePath
        output_path = $OutputPath
        interactive_prompt_used = $false
        operator_prompt_leak_detected = $false
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        bypass_attempted = $false
    }
    Write-Json -Path $paramReportPath -Payload $paramSummary
    $paramSummary | ConvertTo-Json -Depth 20
    exit 12
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
$normalizedPath = if ($RequireImageAwareCanary) {
    Join-Path $normalizedDir "canary_response.json"
} else {
    Join-Path $normalizedDir "chatgpt_art_direction_review.json"
}
$validationPath = if ($RequireImageAwareCanary) {
    Join-Path $validatedDir "canary_validation.json"
} else {
    Join-Path $validatedDir "chatgpt_validation.json"
}
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
    upload_adapter = $UploadAdapter
    require_attachment_confirmation = [bool]$RequireAttachmentConfirmation
    require_image_aware_canary = [bool]$RequireImageAwareCanary
    human_verification_pause_resume_enabled = [bool]$HumanVerificationPauseResumeEnabled
    timeout_minutes = $TimeoutMinutes
    resume_poll_seconds = $ResumePollSeconds
    cdp_attach_used = $false
    persistent_context_avoided = $false
    highest_capability = "C0_REPO_AND_CONFIG_FOUND"
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
    human_verification_gate_status = "NOT_TRIGGERED"
    human_verification_pause_state_path = $null
    human_verification_email_alert_status = "NOT_TRIGGERED"
    human_resume_status = "NOT_TRIGGERED"
    human_resume_timeline_path = $null
    human_resume_retry_attempted = $false
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
    } elseif ($profileState.locked -eq $true -and $bridgeConfig.profile_lock_preflight -eq $true -and $UploadAdapter -ne "FILE_INPUT") {
        $summary.capture_result = "SAFE_SESSION_UNAVAILABLE"
        $summary.stop_reason = "chatgpt chrome profile appears locked"
    } elseif ($UploadAdapter -eq "FILE_INPUT") {
        $summary.upload_control_status = "PROBED_BY_CDP_FILE_INPUT"
        $liveOut = Join-Path $OutputPath "live_file_input_attempt_1"
        $bridge = Invoke-ChatGptFileInputProbe -PromptFile $requestPath -Attachment $resolvedAttachments[0] -OutDir $liveOut -WaitSeconds $MaxWaitSeconds
        Update-SummaryFromFileInputBridge -Summary $summary -Bridge $bridge -RawPathValue $rawPath -RawDirValue $rawDir -AttemptLabel "attempt_1"

        if (($summary.capture_result -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -or $summary.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") -and $HumanVerificationPauseResumeEnabled) {
            $summary.human_verification_encountered = $true
            $pause = Invoke-HumanVerificationPauseGate `
                -ServiceName "ChatGPT" `
                -MissionIdValue $MissionId `
                -ReasonValue "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
                -ArtifactRoot $OutputPath `
                -TimeoutMinutesValue $TimeoutMinutes `
                -EnableChatGPTResumeProbe
            $summary.human_verification_gate_status = if ($pause.result) { [string]$pause.result.status } else { "PAUSE_GATE_FAILED" }
            $summary.human_verification_pause_state_path = $pause.pause_state_path
            $summary.human_verification_pause_gate_result_path = $pause.result_path
            $summary.human_verification_pause_gate_exit_code = $pause.exit_code
            if ($pause.result) {
                $summary.human_verification_email_alert_status = [string]$pause.result.email_alert_status
            } else {
                $summary.human_verification_email_alert_status = "EMAIL_ALERT_SEND_FAILED"
            }

            if ($summary.human_verification_email_alert_status -ne "EMAIL_ALERT_SENT") {
                $summary.capture_result = "HUMAN_VERIFICATION_EMAIL_FAILED"
                $summary.stop_reason = "HUMAN_VERIFICATION_EMAIL_FAILED"
            } else {
                $resume = Invoke-HumanVerificationResumeWait `
                    -PauseStatePath $pause.pause_state_path `
                    -ArtifactRoot $OutputPath `
                    -TimeoutMinutesValue $TimeoutMinutes `
                    -PollSeconds $ResumePollSeconds
                $summary.human_resume_status = [string]$resume.status
                $summary.human_resume_timeline_path = $resume.timeline_path
                $summary.human_resume_result_path = $resume.result_path
                if ($resume.status -eq "RESUME_READY") {
                    $summary.human_resume_retry_attempted = $true
                    $liveOut = Join-Path $OutputPath "live_file_input_attempt_2_after_human_resume"
                    $bridge = Invoke-ChatGptFileInputProbe -PromptFile $requestPath -Attachment $resolvedAttachments[0] -OutDir $liveOut -WaitSeconds $MaxWaitSeconds
                    Update-SummaryFromFileInputBridge -Summary $summary -Bridge $bridge -RawPathValue $rawPath -RawDirValue $rawDir -AttemptLabel "attempt_2_after_human_resume"
                    if ($summary.capture_result -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -or $summary.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") {
                        $summary.capture_result = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED_UNRESUMED"
                        $summary.stop_reason = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED_UNRESUMED"
                    }
                } elseif ($resume.status -eq "TIMEOUT_EXPIRED") {
                    $summary.capture_result = "HUMAN_VERIFICATION_EMAIL_SENT_TIMEOUT_EXPIRED"
                    $summary.stop_reason = "HUMAN_VERIFICATION_EMAIL_SENT_TIMEOUT_EXPIRED"
                } elseif ($resume.status -eq "SESSION_CLOSED") {
                    $summary.capture_result = "HUMAN_VERIFICATION_EMAIL_SENT_SESSION_CLOSED"
                    $summary.stop_reason = "HUMAN_VERIFICATION_EMAIL_SENT_SESSION_CLOSED"
                } else {
                    $summary.capture_result = "HUMAN_VERIFICATION_EMAIL_SENT_UNKNOWN_STATE"
                    $summary.stop_reason = "HUMAN_VERIFICATION_EMAIL_SENT_UNKNOWN_STATE"
                }
            }
        }

        if ($RequireAttachmentConfirmation -and -not [bool]$summary.image_attachment_confirmed -and $summary.capture_result -notin @(
            "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED",
            "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED_UNRESUMED",
            "HUMAN_VERIFICATION_EMAIL_FAILED",
            "HUMAN_VERIFICATION_EMAIL_SENT_TIMEOUT_EXPIRED",
            "HUMAN_VERIFICATION_EMAIL_SENT_SESSION_CLOSED",
            "HUMAN_VERIFICATION_EMAIL_SENT_UNKNOWN_STATE"
        )) {
            $summary.capture_result = if ($summary.capture_result -eq "CHATGPT_FILE_INPUT_NOT_FOUND") { "CHATGPT_FILE_INPUT_NOT_FOUND" } else { "CHATGPT_ATTACHMENT_NOT_CONFIRMED" }
            $summary.stop_reason = $summary.capture_result
        }
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

if ((Test-Path -LiteralPath $rawPath -PathType Leaf) -and $RequireImageAwareCanary) {
    $rawText = Get-Content -LiteralPath $rawPath -Raw
    $canaryMentioned = (-not [string]::IsNullOrWhiteSpace($CanaryCode) -and $rawText -match [regex]::Escape($CanaryCode))
    $canaryJson = Get-FirstJsonObjectFromText -Text $rawText
    if ($canaryJson) {
        $canaryJson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $normalizedPath -Encoding UTF8
        $summary.normalized_output_path = $normalizedPath
        $summary.normalization_result = "CANARY_JSON_EXTRACTED"
    } else {
        $summary.normalization_result = "CANARY_JSON_INVALID"
    }
    $summary.canary_code_mentioned = [bool]$canaryMentioned
    $summary.canary_json_valid = [bool]$canaryJson
    if ($canaryMentioned -and $canaryJson) {
        $summary.capture_result = "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED"
        $summary.validation_result = "PASS_CANARY_JSON"
        $summary.highest_capability = "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED"
    } elseif ($canaryMentioned) {
        $summary.capture_result = "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED"
        $summary.validation_result = "PASS_IMAGE_AWARENESS_JSON_INVALID"
        $summary.highest_capability = "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED"
    } else {
        $summary.capture_result = "CHATGPT_TEXT_ONLY_INVALID_FOR_VISUAL_JUDGE"
        $summary.validation_result = "INVALID_CANARY_RESPONSE"
        if ([bool]$summary.image_attachment_confirmed) {
            $summary.highest_capability = "C8_CHATGPT_IMAGE_PROMPT_SENT"
        }
    }
} elseif (Test-Path -LiteralPath $rawPath -PathType Leaf) {
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

if (($summary.capture_result -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -or $summary.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") -and -not $HumanVerificationPauseResumeEnabled) {
    $summary.human_verification_encountered = $true
    $pause = Invoke-HumanVerificationPauseGate -ServiceName "ChatGPT" -MissionIdValue $MissionId -ReasonValue "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -ArtifactRoot $OutputPath -TimeoutMinutesValue 30
    $summary.human_verification_gate_status = if ($pause.result) { [string]$pause.result.status } else { "PAUSE_GATE_FAILED" }
    $summary.human_verification_pause_state_path = $pause.pause_state_path
    $summary.human_verification_pause_gate_result_path = $pause.result_path
    $summary.human_verification_pause_gate_exit_code = $pause.exit_code
    if ($pause.result) {
        $summary.human_verification_email_alert_status = [string]$pause.result.email_alert_status
    } else {
        $summary.human_verification_email_alert_status = "EMAIL_ALERT_SEND_FAILED"
    }
    if ($summary.human_verification_email_alert_status -eq "EMAIL_ALERT_SENT") {
        $summary.capture_result = "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_SENT"
        $summary.stop_reason = "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_SENT"
    } else {
        $summary.capture_result = "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_FAILED"
        $summary.stop_reason = "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_FAILED"
    }
}

Write-Json $reportPath $summary
$summary | ConvertTo-Json -Depth 40

switch ($summary.capture_result) {
    "CHATGPT_CAPTURED_VALID_JSON" { exit 0 }
    "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED" { exit 0 }
    "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED" { exit 2 }
    "UPLOAD_LANE_UNAVAILABLE" { exit 3 }
    "SAFE_SESSION_UNAVAILABLE" { exit 4 }
    "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" { exit 5 }
    "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED_UNRESUMED" { exit 5 }
    "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_SENT" { exit 5 }
    "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_FAILED" { exit 6 }
    "HUMAN_VERIFICATION_EMAIL_FAILED" { exit 6 }
    "HUMAN_VERIFICATION_EMAIL_SENT_TIMEOUT_EXPIRED" { exit 5 }
    "HUMAN_VERIFICATION_EMAIL_SENT_SESSION_CLOSED" { exit 5 }
    "HUMAN_VERIFICATION_EMAIL_SENT_UNKNOWN_STATE" { exit 5 }
    default { exit 2 }
}
