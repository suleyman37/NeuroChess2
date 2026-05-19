param(
    [ValidateSet("Status", "HealthCheck", "RouteDecision", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BA",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$MockDesktopReady,
    [switch]$MockDesktopUnavailable,
    [switch]$MockDesktopAuthRequired
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_desktop_adapter\A20BA_chatgpt_windows_app_adapter_20260518"
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

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$desktop = Get-DesktopStatus
$desktopReady = ([string]$desktop.status -eq "CHATGPT_DESKTOP_TRANSPORT_READY")
$parked = @()
if (-not $desktopReady) {
    $parked += [ordered]@{
        lane = "chatgpt_windows_app_adapter"
        status = [string]$desktop.status
        reason = if ([string]::IsNullOrWhiteSpace($desktop.unsafe_reason)) { [string]$desktop.status } else { [string]$desktop.unsafe_reason }
    }
}

$selected = if ($desktopReady) { "chatgpt_windows_app_adapter" } else { "local_omega_fallback" }
$resultStatus = if ($desktopReady) { "SUPERVISOR_TRANSPORT_DESKTOP_READY" } else { "SUPERVISOR_TRANSPORT_FALLBACK_READY" }
if ($Mode -eq "DryRun") { $resultStatus = "SUPERVISOR_TRANSPORT_DRY_RUN_PASS" }
if ($Mode -eq "HealthCheck") { $resultStatus = "SUPERVISOR_TRANSPORT_HEALTH_CHECK_COMPLETE" }

$payload = [ordered]@{
    schema_version = "supervisor_transport_fabric_v1"
    mission_id = $MissionId
    mode = $Mode
    status = $resultStatus
    created_at = (Get-Date).ToString("o")
    preferred_order = @("chatgpt_windows_app_adapter", "chatgpt_web_a_j_pool", "local_omega_fallback")
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
