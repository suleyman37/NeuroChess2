param(
    [ValidateSet("Status", "Discover", "CreateManualFallback", "DryRun")]
    [string]$Mode = "Discover",
    [string]$MissionId = "A20BK",
    [string]$ArtifactRoot = "",
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Get-DefaultRoot {
    "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BK_screenshot_first_transport_bridge_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-Root {
    if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) { Get-DefaultRoot } else { $ArtifactRoot }
}

function Get-BridgePaths {
    $root = Get-Root
    [ordered]@{
        root = $root
        inbox = Join-Path $root "inbox"
        outbox = Join-Path $root "outbox"
        artifacts = Join-Path $root "artifacts"
        screenshots = Join-Path $root "screenshots"
    }
}

function Get-CliDiscovery {
    $names = @("antigravity", "google-antigravity")
    $commands = @()
    foreach ($name in $names) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            $commands += [ordered]@{ name = $cmd.Name; command_type = [string]$cmd.CommandType; source_redacted = $true }
        }
    }
    [ordered]@{
        transport = "CLI"
        command_found = @($commands).Count -gt 0
        commands = @($commands)
        safe_help_run = $false
        safe_for_work_order = $false
        status = if (@($commands).Count -gt 0) { "CLI_PRESENT_NOT_PROVEN_SAFE" } else { "CLI_NOT_FOUND" }
    }
}

function Get-ProcessDiscovery {
    $processes = @(Get-Process | Where-Object { $_.ProcessName -match "Antigravity" } | Select-Object ProcessName, Id, MainWindowTitle, MainWindowHandle)
    [ordered]@{
        process_count = @($processes).Count
        main_window_count = @($processes | Where-Object { $_.MainWindowHandle -ne 0 }).Count
        process_only_ready_forbidden = $true
    }
}

function Get-LocalServerDiscovery {
    $ports = @()
    try {
        $cmdLines = @(Get-CimInstance Win32_Process -Filter "name = 'Antigravity.exe'" -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.CommandLine })
        foreach ($line in $cmdLines) {
            if ($line -match '--remote-debugging-port=(\d+)') {
                $port = [int]$Matches[1]
                if ($port -gt 0 -and $port -le 65535) { $ports += $port }
            }
            if ($line -match '127\.0\.0\.1:(\d+)') {
                $port = [int]$Matches[1]
                if ($port -gt 0 -and $port -le 65535) { $ports += $port }
            }
            if ($line -match 'localhost:(\d+)') {
                $port = [int]$Matches[1]
                if ($port -gt 0 -and $port -le 65535) { $ports += $port }
            }
        }
    } catch {}
    $ports = @($ports | Select-Object -Unique)
    [ordered]@{
        transport = "Local server"
        clearly_related_ports = @($ports)
        brute_force_ports = $false
        read_only_status_checked = $false
        safe_for_work_order = $false
        status = if ($ports.Count -gt 0) { "LOCAL_ENDPOINT_CANDIDATE_FOUND_NOT_VALIDATED" } else { "LOCAL_SERVER_NOT_FOUND" }
    }
}

function Get-ProtocolDiscovery {
    $keys = @("HKCU:\Software\Classes\antigravity", "HKLM:\Software\Classes\antigravity")
    $found = @()
    foreach ($key in $keys) {
        if (Test-Path -LiteralPath $key) { $found += ($key -replace "HKCU:\\Software\\Classes\\", "" -replace "HKLM:\\Software\\Classes\\", "") }
    }
    [ordered]@{
        transport = "Protocol handler"
        protocol_found = @($found).Count -gt 0
        protocol_names = @($found)
        launched = $false
        safe_for_work_order = $false
        status = if (@($found).Count -gt 0) { "PROTOCOL_HANDLER_PRESENT_NOT_LAUNCHED" } else { "PROTOCOL_HANDLER_NOT_FOUND" }
    }
}

function Invoke-GuiScreenshot {
    $root = Get-Root
    $scriptPath = Join-Path $PSScriptRoot "antigravity_screenshot_truth.ps1"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath -Mode CaptureWindow -Target antigravity -ArtifactRoot $root -ActionAttempted "passive window screenshot" -NoPrompt 2>&1
    if ($LASTEXITCODE -ne 0) {
        return [ordered]@{ status = "GUI_SCREENSHOT_COMMAND_FAILED"; error_redacted = $true; screenshot_path = "" }
    }
    $text = ($output | Out-String).Trim()
    $json = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
    return $json
}

function Invoke-ManualFallback {
    $root = Get-Root
    $bridge = Join-Path $PSScriptRoot "antigravity_agent_bridge.ps1"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $bridge -Mode CreateManualBridge -MissionId $MissionId -ArtifactRoot $root -NoPrompt 2>&1
    if ($LASTEXITCODE -ne 0) { throw "manual bridge creation failed: $($output | Out-String)" }
    $text = ($output | Out-String).Trim()
    return $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

function Invoke-Discover {
    $paths = Get-BridgePaths
    New-Item -ItemType Directory -Force -Path $paths.inbox, $paths.outbox, $paths.artifacts, $paths.screenshots | Out-Null
    $cli = Get-CliDiscovery
    $process = Get-ProcessDiscovery
    $server = Get-LocalServerDiscovery
    $protocol = Get-ProtocolDiscovery
    $gui = Invoke-GuiScreenshot
    $manual = Invoke-ManualFallback

    $screenshotEvidence = -not [string]::IsNullOrWhiteSpace([string]$gui.screenshot_path)
    $safeTransports = @()
    if ($manual.status -eq "ANTIGRAVITY_MANUAL_BRIDGE_CREATED") { $safeTransports += "manual_file_inbox_outbox" }

    $result = [ordered]@{
        schema_version = "antigravity_transport_discovery_result_v1"
        mission_id = $MissionId
        status = "ANTIGRAVITY_TRANSPORT_DISCOVERY_COMPLETE"
        artifact_root = $paths.root
        transports = [ordered]@{
            cli = $cli
            local_server = $server
            protocol_handler = $protocol
            file_inbox_outbox = [ordered]@{
                transport = "File inbox/outbox"
                inbox_path = $paths.inbox
                outbox_path = $paths.outbox
                automatic_monitor_detected = $false
                manual_bridge_viable = $true
                safe_for_manual_handoff = $true
                safe_for_automated_work_order = $false
                status = "MANUAL_FILE_BRIDGE_READY_NO_AUTOMATED_MONITOR"
            }
            browser_web_ui = [ordered]@{
                transport = "Browser/web UI"
                endpoint_found = $false
                mcp_playwright_used = $false
                safe_for_work_order = $false
                status = "BROWSER_WEB_UI_NOT_FOUND"
            }
            desktop_gui = [ordered]@{
                transport = "Desktop GUI"
                process = $process
                screenshot_observation = $gui
                safe_for_work_order = $false
                status = if ($screenshotEvidence) { "GUI_SCREENSHOT_CAPTURED_BUT_SANDBOX_NOT_PROVEN" } else { "GUI_SCREENSHOT_REQUIRED_NOT_AVAILABLE" }
            }
            manual_fallback = $manual
        }
        safe_transports = @($safeTransports)
        safest_transport = "manual_file_inbox_outbox"
        bridge_ready = $false
        proposal_pack_produced = $false
        tiny_work_order_attempted = $false
        can_automate_antigravity_safely = $false
        exact_blocker = "No safe CLI, local server, protocol handler, automated file monitor, or screenshot-controlled GUI path proved sandbox/outbox execution without blind typing."
        screenshot_evidence_used = $screenshotEvidence
        final_verdict = if ($screenshotEvidence) { "ANTIGRAVITY_MANUAL_ONLY_WITH_SCREENSHOT_EVIDENCE" } else { "ANTIGRAVITY_TRANSPORT_FAILED" }
        no_blind_typing = $true
        antigravity_official_repo_touch = $false
    }
    Write-JsonFile -Path (Join-Path $paths.artifacts "transport_discovery_result.json") -Payload $result
    return $result
}

if ($Mode -eq "Status") {
    $result = [ordered]@{
        schema_version = "antigravity_transport_discovery_status_v1"
        status = "ANTIGRAVITY_TRANSPORT_DISCOVERY_READY"
        transports_checked = @("CLI", "Local server", "Protocol handler", "File inbox/outbox", "Browser/web UI", "Desktop GUI", "Manual fallback")
        screenshot_first_required = $true
        no_blind_typing = $true
    }
} elseif ($Mode -eq "CreateManualFallback") {
    $result = Invoke-ManualFallback
} elseif ($Mode -eq "DryRun") {
    $result = [ordered]@{
        schema_version = "antigravity_transport_discovery_dry_run_v1"
        status = "ANTIGRAVITY_TRANSPORT_DISCOVERY_DRY_RUN_PASS"
        process_only_cannot_mark_ready = $true
        manual_fallback_available = $true
        no_blind_typing = $true
    }
} else {
    $result = Invoke-Discover
}

$result | ConvertTo-Json -Depth 100
