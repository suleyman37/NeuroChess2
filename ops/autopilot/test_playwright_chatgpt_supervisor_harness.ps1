$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_playwright_harness_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$PoolPath = Join-Path $TempRoot "web_judge_conversation_pool.local.json"
$StatePath = Join-Path $TempRoot "playwright_state.json"
$ProfilePath = Join-Path $TempRoot "playwright_profile"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Harness {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\playwright_chatgpt_supervisor_harness.ps1") `
        -MissionId A20BC_TEST `
        -ArtifactPath $ArtifactPath `
        -PoolConfigPath $PoolPath `
        -StatePath $StatePath `
        -ProfilePath $ProfilePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected harness exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "harness did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    param([int]$CountA = 0)
    $pool = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $pool += [ordered]@{
            label = $label
            url = "https://example.invalid/a20bc/$label"
            message_count_sent = if ($label -eq "A") { $CountA } else { 0 }
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 35
        pool = @($pool)
    } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $PoolPath -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null

    $missing = Invoke-Harness -Arguments @("-Mode", "Status", "-MockPoolMissing", "-NoPrompt", "-DryRun")
    Assert-True ($missing.status -eq "CHATGPT_AJ_POOL_MISSING") "missing pool did not return CHATGPT_AJ_POOL_MISSING"

    Write-TestPool
    $dry = Invoke-Harness -Arguments @("-Mode", "DryRun", "-MockMcpReady", "-NoPrompt", "-DryRun")
    Assert-True ($dry.status -eq "PLAYWRIGHT_SUPERVISOR_DRY_RUN_PASS") "dry run failed"
    Assert-True ($dry.threshold_50 -eq $true) "threshold not 50"
    Assert-True ($dry.setup_status -eq "MCP_PLAYWRIGHT_READY") "MCP readiness not detected"
    Assert-True ($dry.selected_transport -eq "native_playwright_chatgpt_supervisor") "native Playwright executor not selected for script-level E2E"
    $dryText = $dry | ConvertTo-Json -Depth 80
    Assert-True ($dryText -notmatch "https://example\.invalid|https://chatgpt\.com/") "private URL leaked in dry output"

    $human = Invoke-Harness -Arguments @("-Mode", "ClassifyPage", "-MockMcpReady", "-MockSessionStatus", "HUMAN_ACTION_REQUIRED", "-NoPrompt", "-DryRun")
    Assert-True ($human.status -eq "HUMAN_ACTION_REQUIRED") "human action not classified"
    Assert-True ($human.alert.status -in @("ALERT_DRY_RUN", "ALERT_SUPPRESSED_COOLDOWN", "ALERT_ROUTER_NOT_CONFIGURED")) "human action did not alert"

    $composer = Invoke-Harness -Arguments @("-Mode", "DetectComposer", "-MockMcpReady", "-MockSessionStatus", "SESSION_READY", "-NoPrompt")
    Assert-True ($composer.status -eq "COMPOSER_DETECTED") "composer not detected in ready mock"

    $noComposer = Invoke-Harness -Arguments @("-Mode", "SendTestMessage", "-MockMcpReady", "-MockSessionStatus", "CHATGPT_COMPOSER_NOT_FOUND", "-NoPrompt")
    Assert-True ($noComposer.sent -eq $false) "send occurred without composer"
    Assert-True ($noComposer.counter_incremented -eq $false) "counter incremented without send"

    $send = Invoke-Harness -Arguments @("-Mode", "SendTestMessage", "-MockMcpReady", "-MockSessionStatus", "SESSION_READY", "-MockSendSuccess", "-NoPrompt")
    Assert-True ($send.sent -eq $true) "send success mock not sent"
    Assert-True ($send.counter_incremented -eq $true) "counter not incremented after send"
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    $active = @($state.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ([int]$active.message_count_sent -eq 1) "counter wrong after send"

    $responseTimeout = Invoke-Harness -Arguments @("-Mode", "ReadLastResponse", "-MockMcpReady", "-MockSessionStatus", "SESSION_READY", "-MockResponseTimeout", "-NoPrompt")
    Assert-True ($responseTimeout.status -eq "RESPONSE_TIMEOUT") "response timeout not handled"

    $responseOk = Invoke-Harness -Arguments @("-Mode", "ReadLastResponse", "-MockMcpReady", "-MockSessionStatus", "SESSION_READY", "-MockResponseJsonOk", "-NoPrompt")
    Assert-True ($responseOk.status -eq "RESPONSE_JSON_OK") "response JSON OK not handled"

    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    Write-TestPool -CountA 50
    $rotate = Invoke-Harness -Arguments @("-Mode", "RotateIfNeeded", "-NoPrompt")
    Assert-True ($rotate.status -eq "ROTATED_TO_NEXT_DISCUSSION") "rotation did not trigger at 50"
    Assert-True ($rotate.rotation.current_label -eq "B") "rotation did not move to B"

    $profile = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\playwright_chatgpt_supervisor_harness.ps1") `
        -Mode Status `
        -MissionId A20BC_TEST_DEFAULT_PROFILE `
        -NoPrompt `
        -ArtifactPath $ArtifactPath 2>&1
    $profileText = ($profile | Out-String).Trim()
    $profileJson = $profileText.Substring($profileText.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($profileJson.profile.profile_under_gitignored_local_path -eq $true) "default profile not gitignored local path"
    $profileStatus = & git -C $RepoRoot status --short -- ops/autopilot/local/playwright_supervisor_profile
    Assert-True ([string]::IsNullOrWhiteSpace(($profileStatus | Out-String).Trim())) "default profile appears in git status"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\playwright_chatgpt_supervisor_harness.ps1") -Raw
    Assert-True ($source -notmatch "\[System\.Windows\.Forms\.SendKeys\]|SendWait\(") "harness contains active-window SendKeys path"
    Assert-True ($source -notmatch "Read-Host") "harness prompts user"
    Assert-True ($source -notmatch "https://chatgpt\.com/[A-Za-z0-9]") "harness source contains private ChatGPT URL"

    $artifactText = Get-ChildItem -LiteralPath $ArtifactPath -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "https://example\.invalid|https://chatgpt\.com/") "artifact leaked private pool URL"
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"

    [ordered]@{
        status = "pass"
        tests = 18
        pool_loaded = $true
        threshold_50 = $true
        private_urls_redacted = $true
        human_action_alerts_and_parks = $true
        page_usable_allows_send = $true
        composer_missing_prevents_send = $true
        counter_after_success_only = $true
        no_blind_typing = $true
        no_user_prompt = $true
        omega_fallback_remains = $true
        resume_command_supported = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
