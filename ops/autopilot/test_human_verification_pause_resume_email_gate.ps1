$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20aa_human_verification_gate_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

$EnvNames = @(
    "NC_ALERT_EMAIL_TO",
    "NC_ALERT_EMAIL_FROM",
    "NC_ALERT_SMTP_HOST",
    "NC_ALERT_SMTP_PORT",
    "NC_ALERT_SMTP_USER",
    "NC_ALERT_SMTP_PASSWORD",
    "NC_ALERT_SMTP_USE_SSL"
)
$SavedEnv = @{}
foreach ($name in $EnvNames) {
    $SavedEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Clear-EmailEnv {
    foreach ($name in $EnvNames) {
        [Environment]::SetEnvironmentVariable($name, $null, "Process")
    }
}

function Set-MockEmailEnv {
    [Environment]::SetEnvironmentVariable("NC_ALERT_EMAIL_TO", "receiver@example.test", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_EMAIL_FROM", "sender@example.test", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_HOST", "smtp.example.test", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_PORT", "587", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_USER", "sender@example.test", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "SUPER_SECRET_A20AA_TEST", "Process")
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_USE_SSL", "true", "Process")
}

function Invoke-JsonCommand {
    param([scriptblock]$Command)
    $oldErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & $Command 2>&1
    $ErrorActionPreference = $oldErrorPreference
    $text = ($output | Out-String)
    $jsonStart = $text.IndexOf("{")
    Assert-True ($jsonStart -ge 0) "command did not emit JSON: $text"
    return $text.Substring($jsonStart) | ConvertFrom-Json
}

try {
    Clear-EmailEnv
    $missingResultPath = Join-Path $TempRoot "missing_email_result.json"
    $missing = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_human_verification_email_alert.ps1") `
            -ServiceName ChatGPT `
            -MissionId A20AA_TEST_MISSING_EMAIL `
            -Reason "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
            -ArtifactPath $TempRoot `
            -PauseStatePath (Join-Path $TempRoot "pause_state.json") `
            -LocalConfigPath (Join-Path $TempRoot "missing.local.json") `
            -ResultPath $missingResultPath
    }
    Assert-True ($missing.status -eq "EMAIL_ALERT_NOT_CONFIGURED") "missing SMTP config was not detected"
    Assert-True (($missing.missing_config_keys | Measure-Object).Count -ge 7) "missing config keys were incomplete"

    $dryRunResultPath = Join-Path $TempRoot "dry_run_email_result.json"
    $dryRun = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_human_verification_email_alert.ps1") `
            -ServiceName ChatGPT `
            -MissionId A20AA_TEST_DRY_RUN `
            -Reason "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
            -ArtifactPath $TempRoot `
            -PauseStatePath (Join-Path $TempRoot "pause_state.json") `
            -LocalConfigPath (Join-Path $TempRoot "missing.local.json") `
            -ResultPath $dryRunResultPath `
            -DryRun
    }
    Assert-True ($dryRun.status -eq "EMAIL_ALERT_DRY_RUN") "dry-run email did not report dry-run"
    Assert-True (Test-Path -LiteralPath $dryRun.dry_run_payload_path -PathType Leaf) "dry-run payload was not written"

    Set-MockEmailEnv
    $mockResultPath = Join-Path $TempRoot "mock_email_result.json"
    $mock = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_human_verification_email_alert.ps1") `
            -ServiceName ChatGPT `
            -MissionId A20AA_TEST_MOCK_EMAIL `
            -Reason "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
            -ArtifactPath $TempRoot `
            -PauseStatePath (Join-Path $TempRoot "pause_state.json") `
            -LocalConfigPath (Join-Path $TempRoot "missing.local.json") `
            -ResultPath $mockResultPath `
            -MockSmtpSuccess
    }
    Assert-True ($mock.status -eq "EMAIL_ALERT_SENT") "mock SMTP success did not report sent"
    $mockText = Get-Content -LiteralPath $mockResultPath -Raw
    Assert-True ($mockText -notmatch "SUPER_SECRET_A20AA_TEST") "SMTP password appeared in mock result"
    Assert-True ($mock.smtp_password_printed -eq $false) "mock result reported password printed"

    $pauseStatePath = Join-Path $TempRoot "human_verification_pause_state.json"
    $pauseResultPath = Join-Path $TempRoot "pause_gate_result.json"
    $pause = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\human_verification_pause_resume_gate.ps1") `
            -Mode PauseAndAlert `
            -ServiceName ChatGPT `
            -MissionId A20AA_TEST_PAUSE `
            -Reason "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
            -ArtifactPath $TempRoot `
            -PauseStatePath $pauseStatePath `
            -ResultPath $pauseResultPath `
            -MockEmailSuccess
    }
    Assert-True ($pause.status -eq "WAITING_FOR_HUMAN_VERIFICATION") "pause gate did not enter waiting state"
    Assert-True ($pause.email_alert_status -eq "EMAIL_ALERT_SENT") "pause gate did not send mock email"
    Assert-True (Test-Path -LiteralPath $pauseStatePath -PathType Leaf) "pause state file was not created"
    $state = Get-Content -LiteralPath $pauseStatePath -Raw | ConvertFrom-Json
    Assert-True ($state.status -eq "WAITING_FOR_HUMAN_VERIFICATION") "pause state status was wrong"
    Assert-True ($state.browser_should_remain_open -eq $true) "browser keep-open flag missing"
    Assert-True ($state.automation_paused -eq $true) "automation paused flag missing"
    Assert-True ($state.clicked_verification -eq $false) "pause state suggested clicking verification"

    $markerPath = Join-Path $TempRoot "verification.marker"
    "still waiting" | Set-Content -LiteralPath $markerPath -Encoding ASCII
    $waiting = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\human_verification_pause_resume_gate.ps1") `
            -Mode ResumeCheck `
            -PauseStatePath $pauseStatePath `
            -VerificationMarkerPath $markerPath `
            -ResultPath (Join-Path $TempRoot "resume_waiting.json")
    }
    Assert-True ($waiting.status -eq "STILL_WAITING_FOR_HUMAN") "resume check did not remain waiting while marker existed"

    $state.timeout_at = (Get-Date).AddMinutes(-1).ToString("o")
    $state | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $pauseStatePath -Encoding UTF8
    Remove-Item -LiteralPath $markerPath -Force
    $timeout = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\human_verification_pause_resume_gate.ps1") `
            -Mode ResumeCheck `
            -PauseStatePath $pauseStatePath `
            -ResultPath (Join-Path $TempRoot "resume_timeout.json")
    }
    Assert-True ($timeout.status -eq "TIMEOUT_EXPIRED") "resume check did not return timeout"

    $captureSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") -Raw
    Assert-True ($captureSource -match "Invoke-HumanVerificationPauseGate") "ChatGPT capture script missing pause gate integration"
    Assert-True ($captureSource -match "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_SENT") "capture script missing email-sent wait status"
    Assert-True ($captureSource -match "WAITING_FOR_HUMAN_VERIFICATION_EMAIL_FAILED") "capture script missing email-failed wait status"

    $gateSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\human_verification_pause_resume_gate.ps1") -Raw
    $emailSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\send_human_verification_email_alert.ps1") -Raw
    Assert-True ($gateSource -notmatch 'Click\(') "pause gate contains click automation"
    Assert-True ($emailSource -match 'smtp_password_printed\s*=\s*\$false') "email script does not explicitly record password redaction"
    Assert-True (($gateSource + $emailSource) -notmatch "SUPER_SECRET_A20AA_TEST") "test secret appeared in source"

    $localStatus = & git -C $RepoRoot status --short -- ops/autopilot/local
    Assert-True (-not (($localStatus | Out-String) -match "email_alert\\.local\\.json")) "real email local config appears in git status"

    [ordered]@{
        status = "pass"
        tests = 14
        pause_state_created = $true
        email_dry_run_payload_created = $true
        missing_smtp_returns_not_configured = $true
        mock_smtp_success = $true
        secrets_redacted = $true
        pause_mode_never_clicks_verification = $true
        browser_should_remain_open = $true
        resume_waiting_marker = $true
        timeout_returns_expired = $true
        capture_integration_present = $true
        no_real_local_config_staged = $true
        no_credentials_in_logs = $true
        no_bypass_action = $true
        live_email_sent = $false
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
    } | ConvertTo-Json -Depth 10
} finally {
    foreach ($name in $EnvNames) {
        [Environment]::SetEnvironmentVariable($name, $SavedEnv[$name], "Process")
    }
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
