$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ba_chatgpt_windows_app_adapter_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Adapter {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\chatgpt_windows_app_adapter.ps1") `
        -MissionId A20BA_TEST `
        -ArtifactPath $TempRoot `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected adapter exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "adapter did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Invoke-Fabric {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\supervisor_transport_fabric.ps1") `
        -MissionId A20BA_TEST `
        -ArtifactPath $TempRoot `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected fabric exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "fabric did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $missing = Invoke-Adapter -Arguments @("-Mode", "Status", "-MockNotInstalled", "-NoPrompt")
    Assert-True ($missing.status -eq "CHATGPT_DESKTOP_NOT_INSTALLED") "missing app should report not installed"
    Assert-True ($missing.local_omega_fallback_available -eq $true) "fallback unavailable for missing app"

    $uncertain = Invoke-Adapter -Arguments @("-Mode", "SendTestMessage", "-MockInstalled", "-MockRunning", "-NoPrompt")
    Assert-True ($uncertain.sent -eq $false) "adapter sent with uncertain target"
    Assert-True ($uncertain.reason -eq "SAFE_TO_SEND_FALSE") "uncertain target reason wrong"

    $noComposer = Invoke-Adapter -Arguments @("-Mode", "SendTestMessage", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-NoPrompt")
    Assert-True ($noComposer.sent -eq $false) "adapter sent without composer"
    Assert-True ($noComposer.status -eq "CHATGPT_DESKTOP_COMPOSER_NOT_FOUND") "composer absence not reported"

    $auth = Invoke-Adapter -Arguments @("-Mode", "SendTestMessage", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-MockAuthWall", "-NoPrompt")
    Assert-True ($auth.sent -eq $false) "adapter sent through auth wall"
    Assert-True ($auth.status -eq "CHATGPT_DESKTOP_AUTH_REQUIRED") "auth wall not reported"

    $readyDry = Invoke-Adapter -Arguments @("-Mode", "SendTestMessage", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-DryRun", "-NoPrompt")
    Assert-True ($readyDry.sent -eq $false) "dry run should not send"
    Assert-True ($readyDry.no_blind_typing -eq $true) "dry run blind typing flag false"

    $mockSent = Invoke-Adapter -Arguments @("-Mode", "SendTestMessage", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-MockSendSuccess", "-NoPrompt")
    Assert-True ($mockSent.sent -eq $true) "mock safe send did not report sent"

    $response = Invoke-Adapter -Arguments @("-Mode", "ReadLastResponse", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-MockResponseText", '{"transport":"chatgpt_windows_app","status":"ok"}', "-NoPrompt")
    Assert-True ($response.response_read -eq $true) "mock response not read"
    Assert-True ($response.response_preview -match "chatgpt_windows_app") "expected transport response preview missing"

    $report = Invoke-Adapter -Arguments @("-Mode", "BuildTransportReport", "-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-NoPrompt")
    Assert-True ($report.selected_transport -eq "chatgpt_windows_app_adapter") "ready desktop not selected"

    $fabricFallback = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockDesktopUnavailable", "-NoPrompt")
    Assert-True ($fabricFallback.selected_transport -eq "local_omega_fallback") "fabric did not fall back locally"
    Assert-True (@($fabricFallback.parked_lanes).Count -ge 1) "fabric did not park unavailable desktop lane"

    $fabricReady = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockDesktopReady", "-NoPrompt")
    Assert-True ($fabricReady.selected_transport -eq "chatgpt_windows_app_adapter") "fabric did not select ready desktop lane"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\chatgpt_windows_app_adapter.ps1") -Raw
    Assert-True ($source -notmatch "\[System\.Windows\.Forms\.SendKeys\]|SendWait\(") "adapter contains active-window SendKeys path"
    Assert-True ($source -notmatch "Read-Host") "adapter prompts user"
    Assert-True ($source -notmatch "https://chatgpt\.com/[A-Za-z0-9]") "adapter contains private ChatGPT URL"
    Assert-True ($source -match "Redact-Text") "adapter missing redaction"

    $artifactText = Get-ChildItem -LiteralPath $TempRoot -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "https://chatgpt\.com/") "artifact leaked private ChatGPT URL"
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"

    [ordered]@{
        status = "pass"
        tests = 18
        missing_app_nonfatal = $true
        refuses_uncertain_window = $true
        refuses_missing_composer = $true
        refuses_auth_wall = $true
        redacted_status = $true
        no_secret_logs = $true
        transport_fabric_parks_desktop = $true
        local_omega_fallback_works = $true
        no_blind_typing = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
