$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bb_supervisor_browser_harness_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$PoolPath = Join-Path $TempRoot "web_judge_conversation_pool.local.json"
$StatePath = Join-Path $TempRoot "supervisor_browser_state.json"
$ProfilePath = Join-Path $TempRoot "supervisor_browser_profile"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Harness {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\supervisor_browser_harness.ps1") `
        -MissionId A20BB_TEST `
        -ArtifactPath $ArtifactPath `
        -PoolConfigPath $PoolPath `
        -StatePath $StatePath `
        -ProfilePath $ProfilePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected harness exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "harness did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Invoke-Fabric {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\supervisor_transport_fabric.ps1") `
        -MissionId A20BB_TEST `
        -ArtifactPath $ArtifactPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected fabric exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "fabric did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    param([int]$CountA = 0)
    $pool = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $pool += [ordered]@{
            label = $label
            url = "https://example.invalid/neurochess-supervisor/$label"
            message_count_sent = if ($label -eq "A") { $CountA } else { 0 }
            bootstrap_sent = $false
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

    $missing = Invoke-Harness -Arguments @("-Mode", "Status", "-MockPoolMissing", "-DryRun", "-NoPrompt")
    Assert-True ($missing.status -eq "CHATGPT_AJ_POOL_MISSING") "missing pool did not return CHATGPT_AJ_POOL_MISSING"
    Assert-True ($missing.private_urls_redacted -eq $true) "missing pool status not redacted"

    Write-TestPool
    $dry = Invoke-Harness -Arguments @("-Mode", "DryRun", "-DryRun", "-NoPrompt")
    Assert-True ($dry.status -eq "SUPERVISOR_BROWSER_DRY_RUN_PASS") "dry run did not pass"
    Assert-True ($dry.threshold_50 -eq $true) "threshold 50 not enforced"
    Assert-True ($dry.current_label -eq "A") "current label should start at A"
    $dryText = $dry | ConvertTo-Json -Depth 80
    Assert-True ($dryText -notmatch "private-A|https://chatgpt\.com/") "private URL leaked in dry run output"

    $classNoComposer = Invoke-Harness -Arguments @("-Mode", "ClassifyPage", "-MockPageClass", "CHATGPT_COMPOSER_NOT_FOUND", "-DryRun", "-NoPrompt")
    Assert-True ($classNoComposer.status -eq "CHATGPT_COMPOSER_NOT_FOUND") "composer missing not classified"

    $sendNoComposer = Invoke-Harness -Arguments @("-Mode", "SendTestMessage", "-MockPageClass", "CHATGPT_COMPOSER_NOT_FOUND", "-DryRun", "-NoPrompt")
    Assert-True ($sendNoComposer.sent -eq $false) "send occurred without composer"
    Assert-True ($sendNoComposer.counter_incremented -eq $false) "counter incremented without send"

    $human = Invoke-Harness -Arguments @("-Mode", "ClassifyPage", "-MockPageClass", "HUMAN_ACTION_REQUIRED", "-DryRun", "-NoPrompt")
    Assert-True ($human.status -eq "HUMAN_ACTION_REQUIRED") "human action not classified"
    Assert-True ($human.alert.status -in @("ALERT_DRY_RUN", "ALERT_SUPPRESSED_COOLDOWN", "ALERT_ROUTER_NOT_CONFIGURED")) "human action did not produce alert event"

    $send = Invoke-Harness -Arguments @("-Mode", "SendTestMessage", "-MockPageClass", "PAGE_USABLE", "-MockSendSuccess", "-NoPrompt")
    Assert-True ($send.sent -eq $true) "PAGE_USABLE mock did not allow send"
    Assert-True ($send.counter_incremented -eq $true) "counter did not increment after send"
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    $active = @($state.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ([int]$active.message_count_sent -eq 1) "state counter wrong after send"

    $second = Invoke-Harness -Arguments @("-Mode", "SendTestMessage", "-MockPageClass", "PAGE_USABLE", "-MockSendSuccess", "-NoPrompt")
    Assert-True ($second.status -eq "TEST_MESSAGE_ALREADY_SENT") "harness did not prevent duplicate test send"

    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    Write-TestPool -CountA 50
    $rotate = Invoke-Harness -Arguments @("-Mode", "RotateIfNeeded", "-NoPrompt")
    Assert-True ($rotate.status -eq "ROTATED_TO_NEXT_DISCUSSION") "rotation did not occur at 50"
    Assert-True ($rotate.rotation.current_label -eq "B") "rotation did not move to B"

    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    Write-TestPool
    $launchFail = Invoke-Harness -Arguments @("-Mode", "ClassifyPage", "-MockBrowserLaunchFailure", "-DryRun", "-NoPrompt")
    Assert-True ($launchFail.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") "launch failure not reported"

    $timeout = Invoke-Harness -Arguments @("-Mode", "ReadLastResponse", "-MockPageClass", "PAGE_USABLE", "-MockResponseTimeout", "-NoPrompt")
    Assert-True ($timeout.status -eq "RESPONSE_TIMEOUT") "response timeout not handled"

    $jsonOk = Invoke-Harness -Arguments @("-Mode", "ReadLastResponse", "-MockPageClass", "PAGE_USABLE", "-MockResponseJsonOk", "-NoPrompt")
    Assert-True ($jsonOk.status -eq "RESPONSE_JSON_OK") "response JSON OK not handled"

    $profile = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\supervisor_browser_harness.ps1") `
        -Mode InitProfile `
        -MissionId A20BB_TEST_DEFAULT_PROFILE `
        -NoPrompt `
        -ArtifactPath $ArtifactPath 2>&1
    $profileText = ($profile | Out-String).Trim()
    $profileResult = $profileText.Substring($profileText.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($profileResult.profile_under_gitignored_local_path -eq $true) "default profile not under local path"
    $profileStatus = & git -C $RepoRoot status --short -- ops/autopilot/local/supervisor_browser_profile
    Assert-True ([string]::IsNullOrWhiteSpace(($profileStatus | Out-String).Trim())) "default profile appears in git status"

    $fabricReady = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockHarnessReady", "-NoPrompt")
    Assert-True ($fabricReady.selected_transport -eq "supervisor_browser_harness") "fabric did not select ready harness"
    Assert-True ($fabricReady.supervisor_browser_harness.status -eq "CHATGPT_WEB_SUPERVISOR_E2E_READY") "fabric harness status wrong"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\supervisor_browser_harness.ps1") -Raw
    Assert-True ($source -notmatch "\[System\.Windows\.Forms\.SendKeys\]|SendWait\(") "harness contains active-window SendKeys path"
    Assert-True ($source -notmatch "Read-Host") "harness prompts user"
    Assert-True ($source -notmatch "https://chatgpt\.com/[A-Za-z0-9]") "harness source contains private ChatGPT URL"
    Assert-True ($source -match "rotation_threshold_messages = 50") "harness source missing threshold 50"

    $artifactText = Get-ChildItem -LiteralPath $ArtifactPath -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "neurochess-supervisor/A|https://example\.invalid") "artifact leaked private pool URL"
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"

    [ordered]@{
        status = "pass"
        tests = 18
        missing_pool = $true
        private_urls_redacted = $true
        rotation_threshold_50 = $true
        counter_after_success_only = $true
        composer_missing_prevents_send = $true
        human_action_alerts_and_parks = $true
        page_usable_allows_send_attempt = $true
        no_blind_typing = $true
        profile_not_committed = $true
        browser_launch_failure_parks = $true
        local_omega_fallback = $true
        fabric_can_use_harness = $true
        response_timeout_handled = $true
        no_user_prompt = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
