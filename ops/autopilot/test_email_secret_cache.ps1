$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20af_email_secret_cache_test_" + [guid]::NewGuid().ToString("N"))
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

function Invoke-JsonCommand {
    param([scriptblock]$Command)
    $output = & $Command 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON: $text"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    Clear-EmailEnv
    $secretPath = Join-Path $TempRoot "email_alert.secret.dpapi.json"
    $fakeSecret = "A20AF_FAKE_REDACTION_SENTINEL_VALUE"

    $set = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\manage_email_alert_secret.ps1") `
            -Action Set `
            -SecretPath $secretPath `
            -SecretTextForTest $fakeSecret
    }
    Assert-True ($set.status -eq "EMAIL_SECRET_CACHE_STORED") "secret was not stored"
    Assert-True (Test-Path -LiteralPath $secretPath -PathType Leaf) "secret cache file missing"
    $secretFileText = Get-Content -LiteralPath $secretPath -Raw
    Assert-True ($secretFileText -notmatch [regex]::Escape($fakeSecret)) "plaintext secret appeared in cache file"

    $test = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\manage_email_alert_secret.ps1") `
            -Action Test `
            -SecretPath $secretPath
    }
    Assert-True ($test.status -eq "EMAIL_SECRET_CACHE_VALID") "stored secret did not validate"

    $setupMissingPath = Join-Path $TempRoot "setup_missing.json"
    $missing = Invoke-JsonCommand {
        & (Join-Path $RepoRoot "ops\autopilot\setup_email_alert_env.ps1") `
            -UseStoredSecret `
            -SecretPath (Join-Path $TempRoot "missing.secret.dpapi.json") `
            -NoPrompt `
            -ResultPath $setupMissingPath
    }
    Assert-True ($missing.status -eq "EMAIL_ALERT_NOT_CONFIGURED") "NoPrompt missing cache should not prompt or hang"

    Clear-EmailEnv
    $setupResultPath = Join-Path $TempRoot "setup_result.json"
    $setup = Invoke-JsonCommand {
        & (Join-Path $RepoRoot "ops\autopilot\setup_email_alert_env.ps1") `
            -UseStoredSecret `
            -SecretPath $secretPath `
            -NoPrompt `
            -ResultPath $setupResultPath
    }
    Assert-True ($setup.status -eq "EMAIL_ALERT_STORED_SECRET_READY") "setup did not load stored secret"
    Assert-True ($setup.secret_cache_used -eq $true) "setup did not report cache use"
    Assert-True ([Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "Process") -eq $fakeSecret) "setup did not set process password env"
    Assert-True ((Get-Content -LiteralPath $setupResultPath -Raw) -notmatch [regex]::Escape($fakeSecret)) "setup result leaked secret"

    $mockEmailPath = Join-Path $TempRoot "mock_email.json"
    $mock = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_human_verification_email_alert.ps1") `
            -ServiceName ChatGPT `
            -MissionId A20AF_TEST_EMAIL_SECRET_CACHE `
            -Reason "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" `
            -ArtifactPath $TempRoot `
            -PauseStatePath (Join-Path $TempRoot "pause_state.json") `
            -ResultPath $mockEmailPath `
            -MockSmtpSuccess `
            -NoPasswordPrompt
    }
    Assert-True ($mock.status -eq "EMAIL_ALERT_SENT") "send script did not use process secret env"
    Assert-True ((Get-Content -LiteralPath $mockEmailPath -Raw) -notmatch [regex]::Escape($fakeSecret)) "send result leaked secret"

    $gitLocalStatus = & git -C $RepoRoot status --short -- ops/autopilot/local
    Assert-True (-not (($gitLocalStatus | Out-String) -match "email_alert\.secret\.dpapi\.json")) "real local secret file appears in git status"

    [ordered]@{
        status = "pass"
        tests = 8
        fake_secret_stored = $true
        stored_file_omits_plaintext = $true
        no_prompt_never_hangs = $true
        setup_loads_cache = $true
        send_script_can_use_stored_secret_env = $true
        no_real_local_secret_staged = $true
        secrets_redacted = $true
    } | ConvertTo-Json -Depth 10
} finally {
    foreach ($name in $EnvNames) {
        [Environment]::SetEnvironmentVariable($name, $SavedEnv[$name], "Process")
    }
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
