$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ba_supervisor_transport_fabric_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
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

    $fallback = Invoke-Fabric -Arguments @("-Mode", "HealthCheck", "-MockPlaywrightUnavailable", "-MockHarnessUnavailable", "-MockDesktopUnavailable", "-NoPrompt")
    Assert-True ($fallback.status -eq "SUPERVISOR_TRANSPORT_HEALTH_CHECK_COMPLETE") "health check status wrong"
    Assert-True ($fallback.selected_transport -eq "local_omega_fallback") "fallback not selected"
    Assert-True ($fallback.local_omega_fallback_available -eq $true) "local fallback unavailable"
    Assert-True ($fallback.api_adapters_enabled -eq $false) "API adapters should stay disabled"
    Assert-True (@($fallback.parked_lanes | Where-Object { $_.lane -eq "playwright_chatgpt_supervisor_harness" }).Count -eq 1) "playwright lane not parked"
    Assert-True (@($fallback.parked_lanes | Where-Object { $_.lane -eq "supervisor_browser_harness" }).Count -eq 1) "harness lane not parked"
    Assert-True (@($fallback.parked_lanes | Where-Object { $_.lane -eq "chatgpt_windows_app_adapter" }).Count -eq 1) "desktop lane not parked"

    $playwrightReady = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockPlaywrightReady", "-MockHarnessReady", "-MockDesktopReady", "-NoPrompt")
    Assert-True ($playwrightReady.selected_transport -eq "mcp_playwright_chatgpt_supervisor") "ready Playwright supervisor not routed first"
    Assert-True ($playwrightReady.playwright_chatgpt_supervisor.status -eq "CHATGPT_A_READY") "playwright ready mock wrong"

    $browserReady = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockPlaywrightUnavailable", "-MockHarnessReady", "-MockDesktopReady", "-NoPrompt")
    Assert-True ($browserReady.selected_transport -eq "supervisor_browser_harness") "ready browser harness not routed first"
    Assert-True ($browserReady.supervisor_browser_harness.status -eq "CHATGPT_WEB_SUPERVISOR_E2E_READY") "browser harness ready mock wrong"

    $desktopReady = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockPlaywrightUnavailable", "-MockHarnessUnavailable", "-MockDesktopReady", "-NoPrompt")
    Assert-True ($desktopReady.selected_transport -eq "chatgpt_windows_app_adapter") "ready desktop not routed after harness parked"
    Assert-True ($desktopReady.desktop_adapter.safe_to_send -eq $true) "desktop ready mock not safe"

    $auth = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockPlaywrightHumanAuth", "-MockHarnessUnavailable", "-MockDesktopAuthRequired", "-NoPrompt")
    Assert-True ($auth.selected_transport -eq "local_omega_fallback") "auth blocked desktop should fall back"
    Assert-True ($auth.desktop_adapter.status -eq "CHATGPT_DESKTOP_AUTH_REQUIRED") "auth status missing"

    $policy = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\supervisor_transport_policy.yaml") -Raw
    Assert-True ($policy -match "mcp_playwright_chatgpt_supervisor") "policy missing MCP Playwright supervisor"
    Assert-True ($policy -match "supervisor_browser_harness") "policy missing browser harness"
    Assert-True ($policy -match "chatgpt_windows_app_adapter") "policy missing desktop adapter"
    Assert-True ($policy -match "local_omega_fallback") "policy missing fallback"
    Assert-True ($policy -match "openai_api_enabled:\s*false") "zero-cost OpenAI API policy missing"
    Assert-True ($policy -match "no_blind_typing:\s*true") "blind typing guard missing"

    [ordered]@{
        status = "pass"
        tests = 18
        playwright_ready_routes_first = $true
        browser_harness_ready_routes_first = $true
        desktop_ready_routes = $true
        desktop_blocked_parks = $true
        local_fallback_works = $true
        zero_cost_policy = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
