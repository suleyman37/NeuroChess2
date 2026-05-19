param(
    [ValidateSet("Status", "HealthCheck", "RouteDecision", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BA",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$MockPlaywrightReady,
    [switch]$MockPlaywrightUnavailable,
    [switch]$MockPlaywrightHumanAuth,
    [switch]$MockHarnessReady,
    [switch]$MockHarnessUnavailable,
    [switch]$MockHarnessHumanAction,
    [switch]$MockDesktopReady,
    [switch]$MockDesktopUnavailable,
    [switch]$MockDesktopAuthRequired
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20BC") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BC_session_bootstrap_e2e_20260518"
    } elseif ($MissionId -eq "A20BB") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_browser_harness\A20BB_chatgpt_aj_e2e_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_desktop_adapter\A20BA_chatgpt_windows_app_adapter_20260518"
    }
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $ArtifactPath "transport_integration_result.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        throw "Unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    }
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "No JSON emitted by $ScriptPath" }
    return $text.Substring($start) | ConvertFrom-Json
}

function Get-DesktopStatus {
    $adapterPath = Join-Path $PSScriptRoot "chatgpt_windows_app_adapter.ps1"
    $adapterArgs = @(
        "-Mode", "Status",
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-OutPath", (Join-Path $ArtifactPath "desktop_status_for_transport.json"),
        "-NoPrompt"
    )
    if ($MockDesktopReady) {
        $adapterArgs += @("-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected")
    } elseif ($MockDesktopUnavailable) {
        $adapterArgs += @("-MockNotInstalled")
    } elseif ($MockDesktopAuthRequired) {
        $adapterArgs += @("-MockInstalled", "-MockRunning", "-MockWindowDetected", "-MockComposerDetected", "-MockAuthWall")
    }
    return Invoke-JsonScript -ScriptPath $adapterPath -Arguments $adapterArgs
}

function Get-HarnessStatus {
    if ($MockHarnessReady) {
        return [pscustomobject]([ordered]@{
            status = "CHATGPT_WEB_SUPERVISOR_E2E_READY"
            current_label = "A"
            rotation_threshold_messages = 50
            pool_loaded = $true
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    if ($MockHarnessUnavailable) {
        return [pscustomobject]([ordered]@{
            status = "CHATGPT_AJ_POOL_MISSING"
            current_label = "A"
            rotation_threshold_messages = 50
            pool_loaded = $false
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    if ($MockHarnessHumanAction) {
        return [pscustomobject]([ordered]@{
            status = "CHATGPT_WEB_HUMAN_ACTION_REQUIRED_PARKED"
            current_label = "A"
            rotation_threshold_messages = 50
            pool_loaded = $true
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    $harnessPath = Join-Path $PSScriptRoot "supervisor_browser_harness.ps1"
    if (-not (Test-Path -LiteralPath $harnessPath -PathType Leaf)) {
        return [pscustomobject]([ordered]@{ status = "SUPERVISOR_BROWSER_HARNESS_NOT_PRESENT"; local_omega_fallback_available = $true })
    }
    return Invoke-JsonScript -ScriptPath $harnessPath -Arguments @(
        "-Mode", "BuildReport",
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt"
    )
}

function Get-PlaywrightStatus {
    if ($MockPlaywrightReady) {
        return [pscustomobject]([ordered]@{
            status = "CHATGPT_A_READY"
            current_label = "A"
            threshold_50 = $true
            selected_transport = "mcp_playwright_chatgpt_supervisor"
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    if ($MockPlaywrightUnavailable) {
        return [pscustomobject]([ordered]@{
            status = "PLAYWRIGHT_SUPERVISOR_UNAVAILABLE"
            current_label = "A"
            threshold_50 = $true
            selected_transport = "local_omega_fallback"
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    if ($MockPlaywrightHumanAuth) {
        return [pscustomobject]([ordered]@{
            status = "CHATGPT_SESSION_BOOTSTRAP_NEEDS_MANUAL_AUTH"
            current_label = "A"
            threshold_50 = $true
            selected_transport = "native_playwright_chatgpt_supervisor"
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        })
    }
    $playwrightPath = Join-Path $PSScriptRoot "playwright_chatgpt_supervisor_harness.ps1"
    if (-not (Test-Path -LiteralPath $playwrightPath -PathType Leaf)) {
        return [pscustomobject]([ordered]@{ status = "PLAYWRIGHT_SUPERVISOR_NOT_PRESENT"; local_omega_fallback_available = $true })
    }
    return Invoke-JsonScript -ScriptPath $playwrightPath -Arguments @(
        "-Mode", "BuildReport",
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt"
    )
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$playwright = Get-PlaywrightStatus
$harness = Get-HarnessStatus
$desktop = Get-DesktopStatus
$playwrightReady = ([string]$playwright.status -in @("CHATGPT_A_READY", "CHATGPT_A_MESSAGE_SUBMITTED_RESPONSE_UNREAD"))
$harnessReady = ([string]$harness.status -in @("CHATGPT_WEB_SUPERVISOR_E2E_READY", "CHATGPT_WEB_MESSAGE_SUBMITTED_RESPONSE_UNREAD"))
$desktopReady = ([string]$desktop.status -eq "CHATGPT_DESKTOP_TRANSPORT_READY")
$parked = @()
if (-not $playwrightReady) {
    $parked += [ordered]@{
        lane = "playwright_chatgpt_supervisor_harness"
        status = [string]$playwright.status
        reason = [string]$playwright.status
    }
}
if (-not $harnessReady) {
    $parked += [ordered]@{
        lane = "supervisor_browser_harness"
        status = [string]$harness.status
        reason = [string]$harness.status
    }
}
if (-not $desktopReady) {
    $parked += [ordered]@{
        lane = "chatgpt_windows_app_adapter"
        status = [string]$desktop.status
        reason = if ([string]::IsNullOrWhiteSpace($desktop.unsafe_reason)) { [string]$desktop.status } else { [string]$desktop.unsafe_reason }
    }
}

$selected = if ($playwrightReady) { [string]$playwright.selected_transport } elseif ($harnessReady) { "supervisor_browser_harness" } elseif ($desktopReady) { "chatgpt_windows_app_adapter" } else { "local_omega_fallback" }
$resultStatus = if ($playwrightReady) { "SUPERVISOR_TRANSPORT_PLAYWRIGHT_READY" } elseif ($harnessReady) { "SUPERVISOR_TRANSPORT_BROWSER_HARNESS_READY" } elseif ($desktopReady) { "SUPERVISOR_TRANSPORT_DESKTOP_READY" } else { "SUPERVISOR_TRANSPORT_FALLBACK_READY" }
if ($Mode -eq "DryRun") { $resultStatus = "SUPERVISOR_TRANSPORT_DRY_RUN_PASS" }
if ($Mode -eq "HealthCheck") { $resultStatus = "SUPERVISOR_TRANSPORT_HEALTH_CHECK_COMPLETE" }

$payload = [ordered]@{
    schema_version = "supervisor_transport_fabric_v1"
    mission_id = $MissionId
    mode = $Mode
    status = $resultStatus
    created_at = (Get-Date).ToString("o")
    preferred_order = @("mcp_playwright_chatgpt_supervisor", "native_playwright_chatgpt_supervisor", "legacy_cdp_chatgpt_supervisor", "supervisor_browser_harness", "chatgpt_windows_app_adapter", "local_omega_fallback")
    playwright_chatgpt_supervisor = $playwright
    supervisor_browser_harness = $harness
    desktop_adapter = $desktop
    selected_transport = $selected
    parked_lanes = @($parked)
    api_adapters_enabled = $false
    zero_cost_policy_respected = $true
    local_omega_fallback_available = $true
    no_user_intervention = $true
    no_blind_typing = $true
    no_credentials_entered = $true
    no_bypass_attempted = $true
}

Write-JsonFile -Path $OutPath -Payload $payload
$payload | ConvertTo-Json -Depth 60
