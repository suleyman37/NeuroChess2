param(
    [ValidateSet("DetectOnly", "PauseAndAlert", "ResumeCheck", "TestSimulation")]
    [string]$Mode = "DetectOnly",
    [string]$ServiceName = "ChatGPT",
    [string]$MissionId = "UNKNOWN_MISSION",
    [string]$Reason = "Human verification required",
    [string]$BrowserProfile = "redacted",
    [string]$PageUrl = "",
    [string]$ArtifactPath = "",
    [string]$PauseStatePath = "",
    [int]$TimeoutMinutes = 30,
    [string]$VerificationMarkerPath = "",
    [string]$ResultPath = "",
    [string]$EmailLocalConfigPath = "",
    [switch]$ChatGPTResumeProbe,
    [string]$ResumeProbeOutPath = "",
    [switch]$EmailDryRun,
    [switch]$MockEmailSuccess,
    [switch]$SessionClosed,
    [switch]$AlertRouterEnabled,
    [string]$AlertRouterConfigPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonIfExists {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
    }
    return $null
}

if ([string]::IsNullOrWhiteSpace($PauseStatePath)) {
    $PauseStatePath = Join-Path $PSScriptRoot "runtime\human_verification_pause_state.json"
}
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Split-Path -Parent $PauseStatePath
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path $ArtifactPath "human_verification_pause_gate_result.json"
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

if ($Mode -eq "TestSimulation") {
    $Mode = "PauseAndAlert"
    $EmailDryRun = $true
    if ([string]::IsNullOrWhiteSpace($Reason)) {
        $Reason = "Test simulation marker: STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
    }
}

$detected = $Reason -match "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED|human verification|captcha|2FA|consent|I am human|verification"

if ($Mode -eq "DetectOnly") {
    $result = [ordered]@{
        schema_version = "A20AA_human_verification_pause_gate_result_v1"
        mode = "DetectOnly"
        status = if ($detected) { "HUMAN_VERIFICATION_DETECTED" } else { "NO_HUMAN_VERIFICATION_DETECTED" }
        service = $ServiceName
        mission_id = $MissionId
        reason = $Reason
        browser_should_remain_open = $true
        automation_paused = $detected
        bypass_attempted = $false
        clicked_verification = $false
    }
    Write-Json -Path $ResultPath -Payload $result
    $result | ConvertTo-Json -Depth 20
    if ($detected) { exit 5 } else { exit 0 }
}

if ($Mode -eq "PauseAndAlert") {
    $detectedAt = Get-Date
    $timeoutAt = $detectedAt.AddMinutes($TimeoutMinutes)
    $resumeCommand = "powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode ResumeCheck -PauseStatePath `"$PauseStatePath`""
    if (-not [string]::IsNullOrWhiteSpace($VerificationMarkerPath)) {
        $resumeCommand += " -VerificationMarkerPath `"$VerificationMarkerPath`""
    }
    if ($ChatGPTResumeProbe) {
        $resumeCommand += " -ChatGPTResumeProbe"
    }

    $state = [ordered]@{
        schema_version = "A20AA_human_verification_pause_state_v1"
        status = "WAITING_FOR_HUMAN_VERIFICATION"
        service = $ServiceName
        mission_id = $MissionId
        reason = $Reason
        detected_at = $detectedAt.ToString("o")
        timeout_at = $timeoutAt.ToString("o")
        timeout_minutes = $TimeoutMinutes
        browser_should_remain_open = $true
        automation_paused = $true
        user_action_required = "Complete verification manually in the open Chrome window, then run ResumeCheck. Do not close Chrome."
        email_alert_status = "NOT_ATTEMPTED"
        resume_check_command = $resumeCommand
        chatgpt_resume_probe_enabled = [bool]$ChatGPTResumeProbe
        artifact_path = $ArtifactPath
        page_url_redacted = -not [string]::IsNullOrWhiteSpace($PageUrl)
        browser_profile_redacted = $true
        bypass_attempted = $false
        clicked_verification = $false
    }
    Write-Json -Path $PauseStatePath -Payload $state

    $emailStatus = "NOT_ATTEMPTED"
    $emailExit = 0
    $emailOutput = @()
    $alertStatus = "NOT_ATTEMPTED"
    $alertExit = 0
    $alertOutput = @()

    if (-not $EmailDryRun -and -not $MockEmailSuccess -and ($AlertRouterEnabled -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot "send_autopilot_alert.ps1") -PathType Leaf))) {
        $alertResultPath = Join-Path $ArtifactPath "human_verification_autopilot_alert_result.json"
        $alertArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-File", (Join-Path $PSScriptRoot "send_autopilot_alert.ps1"),
            "-Channel", "auto",
            "-Title", "[NeuroChess] Action required - complete ChatGPT verification",
            "-MissionId", $MissionId,
            "-ServiceName", $ServiceName,
            "-Reason", $Reason,
            "-ArtifactPath", $ArtifactPath,
            "-Priority", "high",
            "-ResultPath", $alertResultPath,
            "-NoPrompt"
        )
        if (-not [string]::IsNullOrWhiteSpace($AlertRouterConfigPath)) {
            $alertArgs += @("-ConfigPath", $AlertRouterConfigPath)
        }
        $alertOutput = & powershell @alertArgs 2>&1
        $alertExit = $LASTEXITCODE
        $alertResult = Read-JsonIfExists -Path $alertResultPath
        $alertStatus = if ($alertResult) { [string]$alertResult.status } else { "ALERT_DELIVERY_FAILED" }
        $emailStatus = $alertStatus
        $state.alert_status = $alertStatus
        $state.alert_result_path = $alertResultPath
    } else {
        $emailResultPath = Join-Path $ArtifactPath "human_verification_email_alert_result.json"
        $emailArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-File", (Join-Path $PSScriptRoot "send_human_verification_email_alert.ps1"),
            "-ServiceName", $ServiceName,
            "-MissionId", $MissionId,
            "-Reason", $Reason,
            "-BrowserProfile", $BrowserProfile,
            "-ArtifactPath", $ArtifactPath,
            "-PauseStatePath", $PauseStatePath,
            "-ResultPath", $emailResultPath
        )
        if (-not [string]::IsNullOrWhiteSpace($PageUrl)) {
            $emailArgs += @("-PageUrl", $PageUrl)
        }
        if (-not [string]::IsNullOrWhiteSpace($EmailLocalConfigPath)) {
            $emailArgs += @("-LocalConfigPath", $EmailLocalConfigPath)
        }
        if ($EmailDryRun) { $emailArgs += "-DryRun" }
        if ($MockEmailSuccess) { $emailArgs += "-MockSmtpSuccess" }

        $emailOutput = & powershell @emailArgs 2>&1
        $emailExit = $LASTEXITCODE
        $emailResult = Read-JsonIfExists -Path $emailResultPath
        $emailStatus = if ($emailResult) { [string]$emailResult.status } else { "EMAIL_ALERT_SEND_FAILED" }
        $alertStatus = $emailStatus
        $state.email_alert_result_path = $emailResultPath
    }

    $state.email_alert_status = $emailStatus
    Write-Json -Path $PauseStatePath -Payload $state

    $result = [ordered]@{
        schema_version = "A20AA_human_verification_pause_gate_result_v1"
        mode = "PauseAndAlert"
        status = "WAITING_FOR_HUMAN_VERIFICATION"
        service = $ServiceName
        mission_id = $MissionId
        reason = $Reason
        pause_state_path = $PauseStatePath
        alert_status = $alertStatus
        alert_exit_code = $alertExit
        alert_output_redacted = ($alertOutput -join "`n")
        email_alert_status = $emailStatus
        email_exit_code = $emailExit
        email_output_redacted = ($emailOutput -join "`n")
        browser_should_remain_open = $true
        automation_paused = $true
        resume_check_command = $resumeCommand
        timeout_minutes = $TimeoutMinutes
        chatgpt_resume_probe_enabled = [bool]$ChatGPTResumeProbe
        artifact_path = $ArtifactPath
        bypass_attempted = $false
        clicked_verification = $false
    }
    Write-Json -Path $ResultPath -Payload $result
    $result | ConvertTo-Json -Depth 30
    if ($alertStatus -in @("ALERT_SENT_NTFY", "ALERT_SENT_GMAIL_FALLBACK", "ALERT_DRY_RUN") -or $emailStatus -eq "EMAIL_ALERT_SENT" -or $emailStatus -eq "EMAIL_ALERT_DRY_RUN") { exit 0 }
    if ($emailStatus -eq "EMAIL_ALERT_NOT_CONFIGURED") { exit 10 }
    exit 11
}

if ($Mode -eq "ResumeCheck") {
    $state = Read-JsonIfExists -Path $PauseStatePath
    if (-not $state) {
        $result = [ordered]@{
            schema_version = "A20AA_human_verification_pause_gate_result_v1"
            mode = "ResumeCheck"
            status = "UNKNOWN_STATE"
            pause_state_path = $PauseStatePath
            bypass_attempted = $false
            clicked_verification = $false
        }
        Write-Json -Path $ResultPath -Payload $result
        $result | ConvertTo-Json -Depth 20
        exit 5
    }

    $timeoutAt = [datetime]::Parse([string]$state.timeout_at, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
    if ($SessionClosed) {
        $status = "SESSION_CLOSED"
        $exitCode = 3
    } elseif ((Get-Date) -gt $timeoutAt) {
        $status = "TIMEOUT_EXPIRED"
        $exitCode = 4
    } elseif (-not [string]::IsNullOrWhiteSpace($VerificationMarkerPath) -and (Test-Path -LiteralPath $VerificationMarkerPath -PathType Leaf)) {
        $status = "STILL_WAITING_FOR_HUMAN"
        $exitCode = 2
    } elseif ($ChatGPTResumeProbe) {
        if ([string]::IsNullOrWhiteSpace($ResumeProbeOutPath)) {
            $ResumeProbeOutPath = Join-Path $ArtifactPath "resume_probe"
        }
        New-Item -ItemType Directory -Force -Path $ResumeProbeOutPath | Out-Null
        $nodeExe = "node"
        $bundledNode = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
        if (Test-Path -LiteralPath $bundledNode -PathType Leaf) { $nodeExe = $bundledNode }
        $probeScript = Join-Path $PSScriptRoot "browser\chatgpt_file_input_visual_probe.mjs"
        $probeOutput = & $nodeExe $probeScript --resumeCheckOnly --out $ResumeProbeOutPath 2>&1
        $probeResultPath = Join-Path $ResumeProbeOutPath "probe_result.json"
        $probeResult = Read-JsonIfExists -Path $probeResultPath
        $probeStatus = if ($probeResult) { [string]$probeResult.status } else { "UNKNOWN_STATE" }
        if ($probeStatus -eq "RESUME_READY") {
            $status = "RESUME_READY"
            $exitCode = 0
        } elseif ($probeStatus -eq "STILL_WAITING_FOR_HUMAN" -or $probeStatus -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") {
            $status = "STILL_WAITING_FOR_HUMAN"
            $exitCode = 2
        } elseif ($probeStatus -eq "SESSION_CLOSED" -or $probeStatus -eq "CHATGPT_SAFE_SESSION_UNAVAILABLE") {
            $status = "SESSION_CLOSED"
            $exitCode = 3
        } else {
            $status = "UNKNOWN_STATE"
            $exitCode = 5
        }
    } else {
        $status = "RESUME_READY"
        $exitCode = 0
    }

    $result = [ordered]@{
        schema_version = "A20AA_human_verification_pause_gate_result_v1"
        mode = "ResumeCheck"
        status = $status
        service = $state.service
        mission_id = $state.mission_id
        pause_state_path = $PauseStatePath
        browser_should_remain_open = $true
        automation_paused = ($status -ne "RESUME_READY")
        timeout_at = $state.timeout_at
        artifact_path = $state.artifact_path
        chatgpt_resume_probe_enabled = [bool]$ChatGPTResumeProbe
        resume_probe_out_path = if ($ChatGPTResumeProbe) { $ResumeProbeOutPath } else { $null }
        resume_probe_status = if ($ChatGPTResumeProbe -and $probeResult) { [string]$probeResult.status } else { $null }
        resume_probe_output_redacted = if ($ChatGPTResumeProbe) { ($probeOutput -join "`n") } else { "" }
        bypass_attempted = $false
        clicked_verification = $false
    }
    Write-Json -Path $ResultPath -Payload $result
    $result | ConvertTo-Json -Depth 20
    exit $exitCode
}
