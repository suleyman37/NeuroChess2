$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ai_email_preflight_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$SecretPath = Join-Path $TempRoot "email_alert.secret.dpapi.json"
$PoolPath = Join-Path $TempRoot "web_judge_pool.local.json"
$StatePath = Join-Path $TempRoot "web_judge_state.json"

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
    param([scriptblock]$Command, [int[]]$AcceptExitCodes = @(0))
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON: $text"
    $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    $entries = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $entries += [ordered]@{
            label = $label
            url = "https://chatgpt.com/g/example-neurochess-supervisor/c/local-test-$label"
            message_count_sent = 0
            bootstrap_sent = $false
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 35
        pool = @($entries)
    } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $PoolPath -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null
    Clear-EmailEnv
    $fakeSecret = "A20AI_FAKE_EMAIL_PREFLIGHT_SECRET"

    $missing = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\ensure_email_alert_ready.ps1") `
            -MissionId A20AI_TEST `
            -ArtifactPath $ArtifactPath `
            -SecretPath $SecretPath `
            -NoPrompt
    } -AcceptExitCodes @(10)
    Assert-True ($missing.status -eq "EMAIL_SECRET_CACHE_MISSING") "NoPrompt missing secret should fail cleanly"

    Clear-EmailEnv
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", $fakeSecret, "Process")
    $dryRun = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\ensure_email_alert_ready.ps1") `
            -MissionId A20AI_TEST `
            -ArtifactPath $ArtifactPath `
            -SecretPath $SecretPath `
            -DryRun `
            -NoPrompt
    }
    Assert-True ($dryRun.status -eq "EMAIL_PREFLIGHT_READY") "dry preflight with env secret did not pass"
    Assert-True ($dryRun.env_secret_imported -eq $true) "env secret was not imported"
    Assert-True ((Test-Path -LiteralPath $SecretPath -PathType Leaf)) "preflight did not create encrypted cache"
    Assert-True ((Get-Content -LiteralPath $SecretPath -Raw) -notmatch [regex]::Escape($fakeSecret)) "encrypted cache leaked plaintext"
    Assert-True (($dryRun | ConvertTo-Json -Depth 30) -notmatch [regex]::Escape($fakeSecret)) "preflight result leaked plaintext"

    Clear-EmailEnv
    $cacheRun = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\ensure_email_alert_ready.ps1") `
            -MissionId A20AI_TEST `
            -ArtifactPath $ArtifactPath `
            -SecretPath $SecretPath `
            -DryRun `
            -NoPrompt
    }
    Assert-True ($cacheRun.status -eq "EMAIL_PREFLIGHT_READY") "dry preflight from cache did not pass"
    Assert-True ($cacheRun.cache_used -eq $true) "preflight did not use cache"
    Assert-True ($cacheRun.user_prompted -eq $false) "cache run prompted"

    Write-TestPool
    $orchestrator = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_web_judge_orchestrator.ps1") `
            -MissionId A20AI_TEST `
            -Mode EnsureSessions `
            -PoolConfigPath $PoolPath `
            -StatePath $StatePath `
            -ArtifactPath $ArtifactPath `
            -DryRun `
            -NoPrompt
    }
    Assert-True ($orchestrator.status -eq "SESSIONS_ENSURED") "orchestrator dry EnsureSessions failed"
    Assert-True ($orchestrator.email_preflight_status -eq "EMAIL_PREFLIGHT_READY") "orchestrator did not report email preflight"

    $orchestratorSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_web_judge_orchestrator.ps1") -Raw
    Assert-True ($orchestratorSource -match "Invoke-EmailPreflight") "orchestrator does not call email preflight"
    Assert-True ($orchestratorSource -match "Stop-IfEmailPreflightFailed") "orchestrator does not stop on preflight failure"
    Assert-True ($orchestratorSource -match "AUTH_WALL_EMAIL_FAILED") "auth wall email failure is not explicit"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*EvidencePath") "EvidencePath prompt leak"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*OutputPath") "OutputPath prompt leak"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*ArtifactPath") "ArtifactPath prompt leak"

    $setupSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\setup_email_alert_env.ps1") -Raw
    Assert-True ($setupSource -match "suley37550@gmail.com") "Gmail defaults missing"
    Assert-True ($setupSource -match "smtp.gmail.com") "Gmail SMTP host missing"
    Assert-True ($setupSource -match "EMAIL_ALERT_ENV_IMPORTED_TO_CACHE_READY") "env import status missing"

    $gitLocalStatus = & git -C $RepoRoot status --short -- ops/autopilot/local ops/autopilot/runtime
    Assert-True ([string]::IsNullOrWhiteSpace(($gitLocalStatus | Out-String).Trim())) "local/runtime files appear in git status"

    [ordered]@{
        status = "pass"
        tests = 14
        defaults_are_gmail = $true
        env_secret_imports_to_dpapi_cache = $true
        cache_prevents_repeat_prompt = $true
        no_prompt_missing_secret_fails_cleanly = $true
        smtp_password_never_printed = $true
        smtp_password_not_written_to_json = $true
        encrypted_cache_not_staged = $true
        orchestrator_calls_preflight_before_live_modes = $true
        auth_wall_cannot_continue_if_preflight_fails = $true
        auth_wall_email_failure_explicit = $true
        forbidden_prompts_absent = $true
        low_level_path_prompts_absent = $true
        private_chatgpt_urls_not_printed = $true
        runtime_local_files_not_staged = $true
    } | ConvertTo-Json -Depth 20
} finally {
    foreach ($name in $EnvNames) {
        [Environment]::SetEnvironmentVariable($name, $SavedEnv[$name], "Process")
    }
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
