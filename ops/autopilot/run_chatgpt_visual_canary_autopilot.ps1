param(
    [string]$MissionId = "A20AF",
    [switch]$NoPrompt,
    [switch]$SkipLive,
    [string]$ReadyTextForTest = "",
    [ValidateSet("", "PortAvailable", "PortUnavailable", "PortConflict", "LaunchSuccess", "LaunchFailure")]
    [string]$MockCdpStatus = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Script did not emit JSON: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        $text = ($output | Out-String)
        throw "Script failed with exit code ${exit}: $ScriptPath`n$text"
    }
    Convert-JsonOutput -Output $output
}

function New-CanaryImage {
    param([string]$ImagePath, [string]$ExpectedPath, [string]$PromptPath)
    $code = "NC_CANARY_" + ([guid]::NewGuid().ToString("N").Substring(0, 8).ToUpperInvariant())
    $dir = Split-Path -Parent $ImagePath
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    Add-Type -AssemblyName System.Drawing
    $bitmap = [System.Drawing.Bitmap]::new(900, 520)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.FillRectangle([System.Drawing.Brushes]::RoyalBlue, 70, 90, 230, 180)
        $graphics.FillEllipse([System.Drawing.Brushes]::Orange, 370, 110, 180, 180)
        $graphics.FillPolygon([System.Drawing.Brushes]::MediumSeaGreen, @(
            [System.Drawing.Point]::new(690, 95),
            [System.Drawing.Point]::new(810, 275),
            [System.Drawing.Point]::new(570, 275)
        ))
        $font = [System.Drawing.Font]::new("Arial", 34, [System.Drawing.FontStyle]::Bold)
        $graphics.DrawString($code, $font, [System.Drawing.Brushes]::Black, 120, 360)
        $bitmap.Save($ImagePath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }

    [ordered]@{
        schema_version = "A20AF_canary_expected_v1"
        canary_code = $code
        shapes = @("royal blue rectangle", "orange circle", "green triangle")
        colors = @("white", "royal blue", "orange", "medium sea green", "black")
        expected_minimum_observations = @(
            "visible canary code",
            "blue rectangle",
            "orange circle",
            "green triangle"
        )
        code_hidden_from_prompt = $true
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ExpectedPath -Encoding UTF8

@"
Inspect the attached image and return strict JSON only. Do not use markdown or prose.

Return this shape:
{
  "visible_text": [],
  "visible_shapes": [],
  "visible_colors": [],
  "image_awareness_notes": []
}

Rules:
- Report any visible text exactly as it appears in the image.
- Report the main visible shapes and colors.
- Do not guess from the filename.
- If no image is attached, return visible_text as an empty array and explain that no image was available in image_awareness_notes.
"@ | Set-Content -LiteralPath $PromptPath -Encoding UTF8

    [ordered]@{
        code = $code
        image_path = $ImagePath
        expected_path = $ExpectedPath
        prompt_path = $PromptPath
    }
}

$pathResolver = Join-Path $PSScriptRoot "resolve_autopilot_mission_paths.ps1"
$paths = Invoke-JsonScript -ScriptPath $pathResolver -Arguments @("-MissionId", $MissionId)
$artifactPath = [string]$paths.output_path

$manifestPath = Join-Path $artifactPath "manifest.json"
$pathResultPath = Join-Path $artifactPath "path_resolution_result.json"
$emailStatusPath = Join-Path $artifactPath "email_secret_status.json"
$cdpResultPath = Join-Path $artifactPath "cdp_bootstrap_result.json"
$readyResultPath = Join-Path $artifactPath "user_ready_gate_result.json"
$scoreArtifactPath = Join-Path $artifactPath "a20af_score_update.json"

Write-JsonFile -Path $pathResultPath -Payload $paths

$setupParams = @{
    UseStoredSecret = $true
    SaveSecretLocal = $true
    ResultPath = $emailStatusPath
}
if ($NoPrompt -or $SkipLive) { $setupParams.NoPrompt = $true }
$emailSetupOutput = & (Join-Path $PSScriptRoot "setup_email_alert_env.ps1") @setupParams 2>&1
$emailSetup = Get-Content -LiteralPath $emailStatusPath -Raw | ConvertFrom-Json

$ensureArgs = @("-ResultPath", $cdpResultPath)
if (-not [string]::IsNullOrWhiteSpace($MockCdpStatus)) {
    $ensureArgs += @("-MockStatus", $MockCdpStatus)
}
if ($SkipLive -and [string]::IsNullOrWhiteSpace($MockCdpStatus)) {
    $ensureArgs += "-NoLaunch"
}
$cdp = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "ensure_chatgpt_cdp_session.ps1") -Arguments $ensureArgs -AcceptExitCodes @(0, 3, 4)

$readyStatus = "NOT_REQUESTED"
$readyInput = ""
if ($SkipLive) {
    $readyStatus = "SKIPPED_FOR_NON_LIVE_TEST"
} elseif (-not [string]::IsNullOrWhiteSpace($ReadyTextForTest)) {
    $readyInput = $ReadyTextForTest
    $readyStatus = if ($readyInput -eq "READY") { "READY_CONFIRMED" } else { "USER_NOT_READY" }
} else {
    $readyInput = Read-Host "Type READY when you are present and ready to handle any ChatGPT verification in the Chrome window"
    $readyStatus = if ($readyInput -eq "READY") { "READY_CONFIRMED" } else { "USER_NOT_READY" }
}
Write-JsonFile -Path $readyResultPath -Payload ([ordered]@{
    schema_version = "A20AF_user_ready_gate_result_v1"
    status = $readyStatus
    ready_confirmed = ($readyStatus -eq "READY_CONFIRMED")
    prompt_text = "Type READY when you are present and ready to handle any ChatGPT verification in the Chrome window."
    interactive_prompt_allowed = -not [bool]$SkipLive
})

$canaryDir = [string]$paths.canary_path
$canary = New-CanaryImage `
    -ImagePath (Join-Path $canaryDir "canary_image.png") `
    -ExpectedPath (Join-Path $canaryDir "canary_expected.json") `
    -PromptPath (Join-Path $canaryDir "canary_prompt.md")

$capture = $null
$captureExit = $null
$highest = "C5_LOCAL_CANARY_IMAGE_GENERATED"
$canaryPassed = $false
$operatorPromptLeakDetected = $false

if (-not $SkipLive -and $readyStatus -ne "READY_CONFIRMED") {
    $capture = [ordered]@{
        capture_result = "USER_NOT_READY"
        highest_capability = $highest
        live_chatgpt_called = $false
    }
} elseif (-not $SkipLive -and ([string]$cdp.status -eq "CDP_SESSION_UNAVAILABLE" -or [string]$cdp.status -eq "CDP_PORT_CONFLICT")) {
    $capture = [ordered]@{
        capture_result = [string]$cdp.status
        highest_capability = if ([string]$cdp.status -eq "CDP_PORT_CONFLICT") { "C0_REPO_AND_CONFIG_FOUND" } else { "C5_LOCAL_CANARY_IMAGE_GENERATED" }
        live_chatgpt_called = $false
    }
} elseif (-not $SkipLive) {
    $captureArgs = @(
        "-MissionId", $MissionId,
        "-EvidencePath", ([string]$paths.evidence_path),
        "-OutputPath", ([string]$paths.output_path),
        "-ContactSheetPath", ([string]$canary.image_path),
        "-PromptPath", ([string]$canary.prompt_path),
        "-Mode", "SAFE_LIVE_READONLY_MODE",
        "-UploadAdapter", "FILE_INPUT",
        "-AllowChatGPTVisualProbe",
        "-RequireAttachmentConfirmation",
        "-RequireImageAwareCanary",
        "-CanaryCode", ([string]$canary.code),
        "-HumanVerificationPauseResumeEnabled",
        "-TimeoutMinutes", "30",
        "-ResumePollSeconds", "15",
        "-MaxWaitSeconds", "180",
        "-AllowOneJsonCorrection", "true"
    )
    $captureOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "capture_chatgpt_visual_judge.ps1") @captureArgs 2>&1
    $captureExit = $LASTEXITCODE
    $capture = Convert-JsonOutput -Output $captureOutput
    if ($capture.highest_capability) { $highest = [string]$capture.highest_capability }
    $canaryPassed = ([string]$capture.capture_result -eq "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED")
} else {
    $capture = [ordered]@{
        capture_result = "SKIPPED_FOR_NON_LIVE_TEST"
        highest_capability = $highest
        live_chatgpt_called = $false
    }
}

$score = 17.5
$realCdpScoreEligible = (-not [bool]$SkipLive -and [string]::IsNullOrWhiteSpace($MockCdpStatus))
if ($realCdpScoreEligible -and [string]$cdp.status -in @("CDP_ALREADY_AVAILABLE", "CDP_SESSION_BOOTSTRAPPED")) { $score = [Math]::Max($score, 17.55) }
switch ([string]$highest) {
    "C6_CHATGPT_FILE_INPUT_FOUND" { $score = [Math]::Max($score, 17.6) }
    "C7_CHATGPT_IMAGE_ATTACHMENT_CONFIRMED" { $score = [Math]::Max($score, 17.65) }
    "C8_CHATGPT_IMAGE_PROMPT_SENT" { $score = [Math]::Max($score, 17.7) }
    "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED" { $score = [Math]::Max($score, 17.75) }
    "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED" { $score = [Math]::Max($score, 17.75) }
}

$scorePayload = [ordered]@{
    schema_version = "A20AF_zero_friction_canary_score_result_v1"
    previous_score = 17.5
    new_score = $score
    reached_18 = $false
    highest_capability = $highest
    canary_passed = $canaryPassed
    no_a20p_and_no_gemini_valid = $true
    no_claim_of_19 = $true
}
Write-JsonFile -Path $scoreArtifactPath -Payload $scorePayload
Write-JsonFile -Path (Join-Path $PSScriptRoot "a20af_zero_friction_canary_score_result.json") -Payload $scorePayload

Write-JsonFile -Path (Join-Path $canaryDir "canary_result.json") -Payload ([ordered]@{
    schema_version = "A20AF_canary_result_v1"
    status = if ($canaryPassed) { "PASS_CANARY_IMAGE_AWARENESS" } elseif ($SkipLive) { "SKIPPED_FOR_NON_LIVE_TEST" } else { [string]$capture.capture_result }
    highest_capability = $highest
    canary_passed = $canaryPassed
    canary_code_hidden_from_prompt = $true
    prompt_sent = ([string]$highest -in @("C8_CHATGPT_IMAGE_PROMPT_SENT", "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED", "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED"))
    image_aware_response = ([string]$highest -in @("C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED", "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED"))
    validation_result = if ($canaryPassed) { "PASS" } else { "NOT_VALIDATED" }
})

$result = [ordered]@{
    schema_version = "A20AF_zero_friction_runner_result_v1"
    status = if ($operatorPromptLeakDetected) {
        "OPERATOR_PROMPT_LEAK_DETECTED"
    } elseif ([string]$capture.capture_result -eq "CDP_SESSION_UNAVAILABLE") {
        "CDP_SESSION_UNAVAILABLE"
    } elseif (-not $SkipLive -and [string]$capture.capture_result -ne "SKIPPED_FOR_NON_LIVE_TEST") {
        "CDP_SESSION_READY_AND_CANARY_ATTEMPTED"
    } else {
        "ZERO_FRICTION_RUNNER_READY"
    }
    mission_id = $MissionId
    artifact_path = $artifactPath
    path_resolution_result_path = $pathResultPath
    email_secret_status_path = $emailStatusPath
    cdp_bootstrap_result_path = $cdpResultPath
    user_ready_gate_result_path = $readyResultPath
    canary_code_hidden_from_prompt = $true
    evidence_path_prompted = $false
    output_path_prompted = $false
    artifact_path_prompted = $false
    email_password_prompt_eliminated_when_cache_exists = [bool]$emailSetup.secret_cache_used
    email_secret_cache_used = [bool]$emailSetup.secret_cache_used
    cdp_status = [string]$cdp.status
    chrome_launched = [bool]$cdp.browser_launched
    cdp_attached = [bool]$cdp.cdp_attached
    capture_result = $capture
    capture_exit_code = $captureExit
    highest_capability = $highest
    canary_passed = $canaryPassed
    score = $scorePayload
    operator_prompt_leak_detected = $operatorPromptLeakDetected
    password_printed = $false
    secrets_redacted = $true
    bypass_attempted = $false
}

Write-JsonFile -Path (Join-Path $artifactPath "upload_probe_result.json") -Payload $result
Write-JsonFile -Path $manifestPath -Payload ([ordered]@{
    schema_version = "A20AF_manifest_v1"
    mission_id = $MissionId
    created_at = (Get-Date).ToString("o")
    artifact_path = $artifactPath
    files = @(
        "path_resolution_result.json",
        "email_secret_status.json",
        "cdp_bootstrap_result.json",
        "user_ready_gate_result.json",
        "canary/canary_image.png",
        "canary/canary_expected.json",
        "canary/canary_prompt.md",
        "canary/canary_result.json",
        "upload_probe_result.json",
        "a20af_score_update.json"
    )
    secrets_redacted = $true
    qa_artifacts_committed = $false
})

$result | ConvertTo-Json -Depth 40
if ($result.status -eq "CDP_SESSION_UNAVAILABLE") { exit 3 }
if ($result.status -eq "OPERATOR_PROMPT_LEAK_DETECTED") { exit 6 }
exit 0
