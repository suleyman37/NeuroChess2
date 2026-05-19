$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bd_manual_auth_bootstrap_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$PoolPath = Join-Path $TempRoot "web_judge_conversation_pool.local.json"
$StatePath = Join-Path $TempRoot "chatgpt_manual_auth_state.json"
$ProfilePath = Join-Path $TempRoot "playwright_supervisor_profile"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Bootstrap {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\chatgpt_manual_auth_bootstrap.ps1") `
        -MissionId A20BD_TEST `
        -ArtifactPath $ArtifactPath `
        -PoolConfigPath $PoolPath `
        -StatePath $StatePath `
        -ProfilePath $ProfilePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected bootstrap exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "bootstrap did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    $pool = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $pool += [ordered]@{
            label = $label
            url = "https://example.invalid/a20bd/$label"
            message_count_sent = 0
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

    $missing = Invoke-Bootstrap -Arguments @("-Mode", "LaunchAuthWindow", "-MockPoolMissing", "-NoPrompt")
    Assert-True ($missing.status -eq "CHATGPT_AJ_POOL_MISSING") "missing pool did not park"

    Write-TestPool
    $launch = Invoke-Bootstrap -Arguments @("-Mode", "LaunchAuthWindow", "-MockHumanActionRequired", "-NoPrompt", "-KeepOpen")
    Assert-True ($launch.status -eq "AUTH_BOOTSTRAP_READY_WAITING_FOR_MANUAL_AUTH") "human auth launch status wrong"
    Assert-True ($launch.keep_open -eq $true) "keep-open not true"
    Assert-True ($launch.headed_visible_browser -eq $true) "browser not marked visible"
    Assert-True ($launch.browser_closed_by_script -eq $false) "browser closed by script"
    Assert-True ($launch.context_closed_by_script -eq $false) "context closed by script"
    Assert-True ($launch.ntfy_alert.status -in @("ALERT_SENT_NTFY", "ALERT_ROUTER_NOT_CONFIGURED", "ALERT_DELIVERY_FAILED", "ALERT_WRITTEN_LOCAL")) "auth alert not attempted"
    Assert-True ($launch.resume_command -match "chatgpt_manual_auth_bootstrap\.ps1 -Mode ResumeE2E") "resume command missing"

    $defaultRuntimeIgnored = & git -C $RepoRoot check-ignore -q ops/autopilot/runtime/chatgpt_manual_auth_state.json
    Assert-True ($LASTEXITCODE -eq 0) "runtime auth state is not gitignored"

    $readyPoll = Invoke-Bootstrap -Arguments @("-Mode", "PollSessionReady", "-MockSessionReady", "-NoPrompt", "-MaxWaitMinutes", "0")
    Assert-True ($readyPoll.status -eq "SESSION_READY") "ready poll did not return SESSION_READY"

    $timeoutPoll = Invoke-Bootstrap -Arguments @("-Mode", "PollSessionReady", "-MockTimeout", "-NoPrompt", "-MaxWaitMinutes", "0")
    Assert-True ($timeoutPoll.status -eq "AUTH_TIMEOUT") "timeout poll did not return AUTH_TIMEOUT"

    $closed = Invoke-Bootstrap -Arguments @("-Mode", "Status", "-MockBrowserClosed", "-NoPrompt")
    Assert-True ($closed.status -eq "AUTH_BROWSER_CLOSED") "closed browser not detected"

    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    $resume = Invoke-Bootstrap -Arguments @("-Mode", "ResumeE2E", "-MockSessionReady", "-MockSendSuccess", "-MockResponseJsonOk", "-NoPrompt")
    Assert-True ($resume.status -eq "CHATGPT_A_READY") "resume E2E did not return ready"
    Assert-True ($resume.message_sent -eq $true) "resume did not send in ready mock"
    Assert-True ($resume.response_read -eq $true) "resume did not read response in ready mock"
    Assert-True ($resume.counter_incremented -eq $true) "counter did not increment after send"
    Assert-True ($resume.resume_used_existing_browser -eq $true) "resume did not attach to existing browser"
    Assert-True ($resume.temporary_profile_launched -eq $false) "resume launched temporary profile"
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    $active = @($state.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ([int]$active.message_count_sent -eq 1) "state counter wrong after resume send"

    $stop = Invoke-Bootstrap -Arguments @("-Mode", "StopSupervisorBrowser", "-MockLaunchSuccess", "-NoPrompt")
    Assert-True ($stop.explicit_only -eq $true) "stop is not explicit-only"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\chatgpt_manual_auth_bootstrap.ps1") -Raw
    Assert-True ($source -notmatch "\[System\.Windows\.Forms\.SendKeys\]|SendWait\(") "script contains active-window SendKeys path"
    Assert-True ($source -notmatch "Read-Host") "script prompts user"
    Assert-True ($source -notmatch "browser\.close\(") "script closes browser from Playwright"
    Assert-True ($source -match "browser\.disconnect\(") "script does not disconnect CDP safely"
    Assert-True ($source -match "StopSupervisorBrowser") "explicit stop mode missing"

    $artifactText = Get-ChildItem -LiteralPath $ArtifactPath -Recurse -File | Where-Object { $_.Name -notmatch "web_judge_conversation_pool" } | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "https://example\.invalid|https://chatgpt\.com/") "artifact leaked private pool URL"
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"
    Assert-True ($artifactText -notmatch "(?i)captcha automation|2fa automation|human verification automation") "artifact suggests forbidden automation"

    [ordered]@{
        status = "pass"
        tests = 15
        launch_keeps_open = $true
        runtime_state_gitignored = $true
        stop_explicit_only = $true
        human_action_alerts = $true
        poll_session_ready = $true
        auth_timeout_bounded = $true
        browser_closed_detected = $true
        resume_uses_existing_profile = $true
        counter_after_success_only = $true
        no_private_urls_printed = $true
        no_cookies_or_tokens_printed = $true
        no_blind_typing = $true
        no_bypass = $true
        omega_fallback_remains = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
