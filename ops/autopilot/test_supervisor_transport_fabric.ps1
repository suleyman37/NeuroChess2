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

    $fallback = Invoke-Fabric -Arguments @("-Mode", "HealthCheck", "-MockDesktopUnavailable", "-NoPrompt")
    Assert-True ($fallback.status -eq "SUPERVISOR_TRANSPORT_HEALTH_CHECK_COMPLETE") "health check status wrong"
    Assert-True ($fallback.selected_transport -eq "local_omega_fallback") "fallback not selected"
    Assert-True ($fallback.local_omega_fallback_available -eq $true) "local fallback unavailable"
    Assert-True ($fallback.api_adapters_enabled -eq $false) "API adapters should stay disabled"
    Assert-True (@($fallback.parked_lanes | Where-Object { $_.lane -eq "chatgpt_windows_app_adapter" }).Count -eq 1) "desktop lane not parked"

    $ready = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockDesktopReady", "-NoPrompt")
    Assert-True ($ready.selected_transport -eq "chatgpt_windows_app_adapter") "ready desktop not routed"
    Assert-True ($ready.desktop_adapter.safe_to_send -eq $true) "desktop ready mock not safe"

    $auth = Invoke-Fabric -Arguments @("-Mode", "RouteDecision", "-MockDesktopAuthRequired", "-NoPrompt")
    Assert-True ($auth.selected_transport -eq "local_omega_fallback") "auth blocked desktop should fall back"
    Assert-True ($auth.desktop_adapter.status -eq "CHATGPT_DESKTOP_AUTH_REQUIRED") "auth status missing"

    $policy = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\supervisor_transport_policy.yaml") -Raw
    Assert-True ($policy -match "chatgpt_windows_app_adapter") "policy missing desktop adapter"
    Assert-True ($policy -match "local_omega_fallback") "policy missing fallback"
    Assert-True ($policy -match "openai_api_enabled:\s*false") "zero-cost OpenAI API policy missing"
    Assert-True ($policy -match "no_blind_typing:\s*true") "blind typing guard missing"

    [ordered]@{
        status = "pass"
        tests = 12
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
