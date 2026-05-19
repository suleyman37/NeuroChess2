param(
    [ValidateSet("Discover", "Status", "InspectWindow", "DryRunComposer", "SendTestMessage", "ReadLastResponse", "BuildTransportReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BA",
    [string]$MessageFile = "",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 60,
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$MockInstalled,
    [switch]$MockNotInstalled,
    [switch]$MockRunning,
    [switch]$MockWindowDetected,
    [switch]$MockComposerDetected,
    [switch]$MockAuthWall,
    [switch]$MockUnsafe,
    [switch]$MockSendSuccess,
    [string]$MockResponseText = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_desktop_adapter\A20BA_chatgpt_windows_app_adapter_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Redact-Text {
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    $value = [string]$Text
    $value = $value -replace 'https://chatgpt\.com/\S+', '[redacted-chatgpt-url]'
    $value = $value -replace 'https://gemini\.google\.com/\S+', '[redacted-gemini-url]'
    $value = $value -replace '(?i)\b(sk-[A-Za-z0-9_\-]{12,})\b', '[redacted-api-key]'
    $value = $value -replace '(?i)\b([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})\b', '[redacted-email]'
    $value = $value -replace '(?i)(token|cookie|secret|password|api[_-]?key)\s*[:=]\s*\S+', '$1=[redacted]'
    if ($value.Length -gt 96) { $value = $value.Substring(0, 96) + "..." }
    return $value
}

function Test-SensitiveLeak {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return ($Text -match 'https://chatgpt\.com/|https://gemini\.google\.com/|(?i)\bsk-[A-Za-z0-9_\-]{12,}|(?i)(token|cookie|secret|password|api[_-]?key)\s*[:=]\s*\S+')
}

function Redact-WindowTitle {
    param([AllowNull()][string]$ProcessName, [AllowNull()][string]$Title)
    if ([string]::IsNullOrWhiteSpace($Title)) { return "" }
    if ($ProcessName -match '(?i)chatgpt') { return "[redacted-chatgpt-window-title]" }
    if ($Title -match '(?i)chatgpt|openai') { return "[redacted-chatgpt-browser-title]" }
    return "[redacted-window-title]"
}

function Redact-UiaLabel {
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    if ($Text -match '(?i)sign in|log in|login|captcha|verify|verification|2fa|two-factor|consent|human|password|email') {
        return "[auth-or-human-action-label]"
    }
    if ($Text -match '(?i)message|prompt|chat|ask|composer|input|textbox|edit') {
        return "[composer-or-chat-label]"
    }
    if ($Text -match '(?i)send|submit') { return "[send-label]" }
    if ($Text -match '(?i)chatgpt|openai') { return "[chatgpt-label]" }
    return "[redacted-ui-text]"
}

function Get-DefaultOutPath {
    param([string]$ModeName)
    switch ($ModeName) {
        "Discover" { return (Join-Path $ArtifactPath "desktop_discovery_result.json") }
        "Status" { return (Join-Path $ArtifactPath "desktop_status_result.json") }
        "InspectWindow" { return (Join-Path $ArtifactPath "window_inspection_redacted.json") }
        "DryRunComposer" { return (Join-Path $ArtifactPath "composer_dry_run_result.json") }
        "SendTestMessage" { return (Join-Path $ArtifactPath "send_test_result.json") }
        "ReadLastResponse" { return (Join-Path $ArtifactPath "read_response_result.json") }
        default { return (Join-Path $ArtifactPath "transport_integration_result.json") }
    }
}

function Get-UiAutomationAvailability {
    try {
        Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
        Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
        return [ordered]@{
            available = $true
            reason = "UI_AUTOMATION_AVAILABLE"
        }
    } catch {
        return [ordered]@{
            available = $false
            reason = "UI_AUTOMATION_UNAVAILABLE"
            error = (Redact-Text $_.Exception.Message)
        }
    }
}

function Get-ChatGptProcessCandidates {
    $processes = @()
    try {
        $processes = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
            $_.ProcessName -match '(?i)chatgpt|openai' -or $_.MainWindowTitle -match '(?i)chatgpt|openai'
        } | Select-Object -First 10)
    } catch {
        $processes = @()
    }

    return @($processes | ForEach-Object {
        $processIsChatGpt = ($_.ProcessName -match '(?i)chatgpt|openai')
        $titleMentionsChatGpt = ($_.MainWindowTitle -match '(?i)chatgpt|openai')
        [ordered]@{
            process_name = (Redact-Text $_.ProcessName)
            id = [int]$_.Id
            main_window_title = (Redact-WindowTitle -ProcessName $_.ProcessName -Title $_.MainWindowTitle)
            process_is_chatgpt = [bool]$processIsChatGpt
            title_mentions_chatgpt = [bool]$titleMentionsChatGpt
            main_window_handle = [int64]$_.MainWindowHandle
            has_main_window = ([int64]$_.MainWindowHandle -ne 0)
        }
    })
}

function Get-ChatGptInstallSignals {
    $appx = @()
    $startApps = @()
    $commonPaths = @()

    try {
        $appx = @(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '(?i)chatgpt|openai' -or $_.PackageFullName -match '(?i)chatgpt|openai'
        } | Select-Object -First 10)
    } catch {
        $appx = @()
    }

    try {
        $startApps = @(Get-StartApps -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '(?i)chatgpt|openai'
        } | Select-Object -First 10)
    } catch {
        $startApps = @()
    }

    foreach ($candidate in @(
        (Join-Path $env:LOCALAPPDATA "Programs\ChatGPT"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\ChatGPT.exe"),
        (Join-Path $env:ProgramFiles "ChatGPT"),
        (Join-Path ${env:ProgramFiles(x86)} "ChatGPT")
    )) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -ErrorAction SilentlyContinue)) {
            $commonPaths += [ordered]@{
                path_kind = "common_install_path"
                path_hint = (Redact-Text $candidate)
            }
        }
    }

    return [ordered]@{
        appx_packages = @($appx | ForEach-Object {
            [ordered]@{
                name = (Redact-Text $_.Name)
                package_family_name = (Redact-Text $_.PackageFamilyName)
            }
        })
        start_menu_apps = @($startApps | ForEach-Object {
            [ordered]@{
                name = (Redact-Text $_.Name)
                app_id_present = (-not [string]::IsNullOrWhiteSpace($_.AppID))
            }
        })
        common_paths = @($commonPaths)
    }
}

function Get-WindowInspection {
    param([object[]]$ProcessCandidates)

    $uia = Get-UiAutomationAvailability
    $summary = [ordered]@{
        ui_automation_available = [bool]$uia.available
        ui_automation_status = [string]$uia.reason
        window_detected = $false
        target_confidence = "none"
        composer_detected = $false
        auth_wall_detected = $false
        focused_target_matches_composer = $false
        send_button_detected = $false
        redacted_nodes = @()
        unsafe_reason = ""
    }

    if (-not $uia.available) {
        $summary.unsafe_reason = "UI_AUTOMATION_UNAVAILABLE"
        return $summary
    }

    $window = @($ProcessCandidates | Where-Object {
        $_.has_main_window -eq $true -and ($_.process_is_chatgpt -eq $true -or $_.title_mentions_chatgpt -eq $true)
    } | Select-Object -First 1)
    if ($window.Count -eq 0) {
        $summary.unsafe_reason = "CHATGPT_WINDOW_NOT_FOUND"
        return $summary
    }

    $summary.window_detected = $true
    $summary.target_confidence = "medium"

    try {
        $handle = [IntPtr]([int64]$window[0].main_window_handle)
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
        if ($null -eq $root) {
            $summary.unsafe_reason = "UI_AUTOMATION_ROOT_UNAVAILABLE"
            return $summary
        }

        $focused = $null
        try { $focused = [System.Windows.Automation.AutomationElement]::FocusedElement } catch { $focused = $null }

        $foundComposer = $null
        $foundSend = $false
        $authWall = $false
        $script:nodeBuffer = @()
        function Add-UiaNodeSummary {
            param([object]$Element, [int]$Depth)
            $current = $Element.Current
            $controlType = ""
            try { $controlType = [string]$current.ControlType.ProgrammaticName } catch { $controlType = "" }
            $rawName = [string]$current.Name
            $rawAutomationId = [string]$current.AutomationId
            $rawClassName = [string]$current.ClassName
            $name = Redact-UiaLabel $rawName
            $automationId = Redact-Text $rawAutomationId
            $className = Redact-Text $rawClassName
            $combined = "$rawName $rawAutomationId $rawClassName $controlType"
            if ($combined -match '(?i)sign in|log in|login|captcha|verify|verification|2fa|two-factor|consent|human|password|email') {
                $script:authWall = $true
            }
            if ($controlType -match 'Edit|Document' -and $combined -match '(?i)message|prompt|chat|ask|composer|input|textbox|edit') {
                if ($null -eq $script:foundComposer) { $script:foundComposer = $Element }
            }
            if ($controlType -match 'Button' -and $combined -match '(?i)send|submit') {
                $script:foundSend = $true
            }
            $script:nodeBuffer += [ordered]@{
                depth = $Depth
                control_type = $controlType
                name = $name
                automation_id = $automationId
                class_name = $className
            }
        }

        $script:foundComposer = $null
        $script:foundSend = $false
        $script:authWall = $false
        Add-UiaNodeSummary -Element $root -Depth 0
        $descendants = $root.FindAll(
            [System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.Condition]::TrueCondition
        )
        $limit = [Math]::Min(79, [int]$descendants.Count)
        for ($i = 0; $i -lt $limit; $i++) {
            Add-UiaNodeSummary -Element $descendants.Item($i) -Depth 1
        }

        $summary.redacted_nodes = @($script:nodeBuffer)
        $summary.composer_detected = ($null -ne $script:foundComposer)
        $summary.auth_wall_detected = [bool]$script:authWall
        $summary.send_button_detected = [bool]$script:foundSend
        if ($summary.composer_detected -and -not $summary.auth_wall_detected) {
            $summary.target_confidence = "high"
        }
        if ($null -ne $focused -and $null -ne $script:foundComposer) {
            try {
                $summary.focused_target_matches_composer = [System.Windows.Automation.Automation]::Compare($focused, $script:foundComposer)
            } catch {
                $summary.focused_target_matches_composer = $false
            }
        }
        if ($summary.auth_wall_detected) { $summary.unsafe_reason = "AUTH_OR_HUMAN_ACTION_WALL_DETECTED" }
        elseif (-not $summary.composer_detected) { $summary.unsafe_reason = "COMPOSER_NOT_FOUND" }
    } catch {
        $summary.unsafe_reason = "UI_AUTOMATION_INSPECTION_FAILED"
        $summary.error = (Redact-Text $_.Exception.Message)
    }

    return $summary
}

function Get-AdapterDiscovery {
    $processCandidates = @(Get-ChatGptProcessCandidates)
    $installSignals = Get-ChatGptInstallSignals
    $installed = (@($installSignals.appx_packages).Count -gt 0 -or @($installSignals.start_menu_apps).Count -gt 0 -or @($installSignals.common_paths).Count -gt 0)
    $running = (@($processCandidates | Where-Object { $_.process_name -match '(?i)chatgpt|openai' -or $_.main_window_title -match '(?i)chatgpt|openai' }).Count -gt 0)

    if ($MockInstalled) { $installed = $true }
    if ($MockNotInstalled) { $installed = $false }
    if ($MockRunning) { $running = $true }
    if ($MockWindowDetected -and $processCandidates.Count -eq 0) {
        $processCandidates = @([ordered]@{
            process_name = "ChatGPT"
            id = 0
            main_window_title = "[mock-chatgpt-window]"
            process_is_chatgpt = $true
            title_mentions_chatgpt = $true
            main_window_handle = 1234
            has_main_window = $true
        })
    }

    return [ordered]@{
        schema_version = "chatgpt_windows_app_adapter_v1"
        mission_id = $MissionId
        mode = "Discover"
        created_at = (Get-Date).ToString("o")
        installed = [bool]$installed
        running = [bool]$running
        install_signals = $installSignals
        process_candidates = @($processCandidates)
        private_text_logged = $false
        secrets_logged = $false
        no_credentials_entered = $true
        no_bypass_attempted = $true
        no_blind_typing = $true
    }
}

function Get-AdapterStatus {
    $discovery = Get-AdapterDiscovery
    $inspection = Get-WindowInspection -ProcessCandidates @($discovery.process_candidates)

    if ($MockWindowDetected) { $inspection.window_detected = $true; $inspection.target_confidence = "high" }
    if ($MockComposerDetected) { $inspection.composer_detected = $true; $inspection.focused_target_matches_composer = $true }
    if ($MockAuthWall) { $inspection.auth_wall_detected = $true; $inspection.unsafe_reason = "AUTH_OR_HUMAN_ACTION_WALL_DETECTED" }
    if ($MockUnsafe) { $inspection.unsafe_reason = "MOCK_UNSAFE_TARGET"; $inspection.target_confidence = "low" }

    $safeToSend = (
        [bool]$discovery.installed -and
        [bool]$discovery.running -and
        [bool]$inspection.window_detected -and
        [bool]$inspection.composer_detected -and
        -not [bool]$inspection.auth_wall_detected -and
        [string]$inspection.target_confidence -eq "high" -and
        -not $MockUnsafe
    )

    $status = "CHATGPT_DESKTOP_INSTALLED_NOT_AUTOMATABLE"
    if ($MockUnsafe) { $status = "CHATGPT_DESKTOP_ADAPTER_UNSAFE" }
    elseif (-not [bool]$discovery.installed) { $status = "CHATGPT_DESKTOP_NOT_INSTALLED" }
    elseif ([bool]$inspection.auth_wall_detected) { $status = "CHATGPT_DESKTOP_AUTH_REQUIRED" }
    elseif (-not [bool]$discovery.running -or -not [bool]$inspection.window_detected) { $status = "CHATGPT_DESKTOP_INSTALLED_NOT_AUTOMATABLE" }
    elseif (-not [bool]$inspection.composer_detected) { $status = "CHATGPT_DESKTOP_COMPOSER_NOT_FOUND" }
    elseif ($safeToSend) { $status = "CHATGPT_DESKTOP_TRANSPORT_READY" }
    else { $status = "CHATGPT_DESKTOP_ADAPTER_UNSAFE" }

    return [ordered]@{
        schema_version = "chatgpt_windows_app_adapter_v1"
        mission_id = $MissionId
        mode = "Status"
        created_at = (Get-Date).ToString("o")
        status = $status
        installed = [bool]$discovery.installed
        running = [bool]$discovery.running
        window_detected = [bool]$inspection.window_detected
        composer_detected = [bool]$inspection.composer_detected
        auth_wall_detected = [bool]$inspection.auth_wall_detected
        safe_to_send = [bool]$safeToSend
        target_confidence = [string]$inspection.target_confidence
        focused_target_matches_composer = [bool]$inspection.focused_target_matches_composer
        ui_automation_available = [bool]$inspection.ui_automation_available
        ui_automation_status = [string]$inspection.ui_automation_status
        unsafe_reason = [string]$inspection.unsafe_reason
        inspection_error = if ($inspection.Contains("error")) { [string]$inspection.error } else { "" }
        aj_url_support = "unknown"
        no_credentials_entered = $true
        no_bypass_attempted = $true
        no_blind_typing = $true
        zero_cost_policy_respected = $true
        local_omega_fallback_available = $true
    }
}

function New-Manifest {
    param([object]$Status)
    [ordered]@{
        mission_id = $MissionId
        status = [string]$Status.status
        artifact_path = $ArtifactPath
        created_at = (Get-Date).ToString("o")
        desktop_adapter_optional = $true
        local_omega_fallback_available = $true
        private_urls_committed = $false
        secrets_committed = $false
        screenshots_committed = $false
        no_credentials_entered = $true
        no_bypass_attempted = $true
        no_blind_typing = $true
    }
}

function Invoke-DryRunComposer {
    $status = Get-AdapterStatus
    [ordered]@{
        schema_version = "chatgpt_windows_app_adapter_v1"
        mission_id = $MissionId
        mode = "DryRunComposer"
        created_at = (Get-Date).ToString("o")
        status = if ($status.safe_to_send) { "COMPOSER_DRY_RUN_PASS" } else { "COMPOSER_DRY_RUN_NOT_SAFE" }
        composer_detected = [bool]$status.composer_detected
        safe_to_send = [bool]$status.safe_to_send
        auth_wall_detected = [bool]$status.auth_wall_detected
        target_confidence = [string]$status.target_confidence
        no_text_sent = $true
        no_blind_typing = $true
        blocker = if ($status.safe_to_send) { "" } else { [string]$status.status }
    }
}

function Invoke-SendTestMessage {
    $status = Get-AdapterStatus
    $message = 'NeuroChess transport test. Reply with JSON: {"transport":"chatgpt_windows_app","status":"ok"}'
    if (-not [string]::IsNullOrWhiteSpace($MessageFile) -and (Test-Path -LiteralPath $MessageFile -PathType Leaf)) {
        $candidate = Get-Content -LiteralPath $MessageFile -Raw
        if (-not (Test-SensitiveLeak $candidate)) { $message = $candidate.Trim() }
    }

    if (-not [bool]$status.safe_to_send) {
        return [ordered]@{
            schema_version = "chatgpt_windows_app_adapter_v1"
            mission_id = $MissionId
            mode = "SendTestMessage"
            created_at = (Get-Date).ToString("o")
            status = [string]$status.status
            sent = $false
            reason = "SAFE_TO_SEND_FALSE"
            no_blind_typing = $true
            no_credentials_entered = $true
            no_bypass_attempted = $true
        }
    }

    if ($DryRun) {
        return [ordered]@{
            schema_version = "chatgpt_windows_app_adapter_v1"
            mission_id = $MissionId
            mode = "SendTestMessage"
            created_at = (Get-Date).ToString("o")
            status = "CHATGPT_DESKTOP_SEND_DRY_RUN_ONLY"
            sent = $false
            message_preview = "NeuroChess transport test JSON request"
            no_blind_typing = $true
        }
    }

    if ($MockSendSuccess) {
        return [ordered]@{
            schema_version = "chatgpt_windows_app_adapter_v1"
            mission_id = $MissionId
            mode = "SendTestMessage"
            created_at = (Get-Date).ToString("o")
            status = "CHATGPT_DESKTOP_TEST_MESSAGE_SENT"
            sent = $true
            message_preview = "NeuroChess transport test JSON request"
            no_blind_typing = $true
        }
    }

    return [ordered]@{
        schema_version = "chatgpt_windows_app_adapter_v1"
        mission_id = $MissionId
        mode = "SendTestMessage"
        created_at = (Get-Date).ToString("o")
        status = "CHATGPT_DESKTOP_SAFE_SEND_FAILED"
        sent = $false
        reason = "REAL_SEND_REQUIRES_PATTERN_SUPPORT_AND_EXACT_FOCUS; active-window keystrokes are forbidden"
        no_blind_typing = $true
        no_credentials_entered = $true
        no_bypass_attempted = $true
    }
}

function Invoke-ReadLastResponse {
    $status = Get-AdapterStatus
    if (-not [string]::IsNullOrWhiteSpace($MockResponseText)) {
        $clean = Redact-Text $MockResponseText
        return [ordered]@{
            schema_version = "chatgpt_windows_app_adapter_v1"
            mission_id = $MissionId
            mode = "ReadLastResponse"
            created_at = (Get-Date).ToString("o")
            status = "CHATGPT_DESKTOP_RESPONSE_READ_MOCK"
            response_read = $true
            response_preview = $clean
            expected_transport_json_detected = ($clean -match '"transport"\s*:\s*"chatgpt_windows_app"')
            private_text_logged = $false
        }
    }

    [ordered]@{
        schema_version = "chatgpt_windows_app_adapter_v1"
        mission_id = $MissionId
        mode = "ReadLastResponse"
        created_at = (Get-Date).ToString("o")
        status = "RESPONSE_READ_UNAVAILABLE"
        response_read = $false
        reason = if ($status.status -eq "CHATGPT_DESKTOP_TRANSPORT_READY") { "READ_PATH_NOT_IMPLEMENTED_WITHOUT_PRIVACY_RISK" } else { [string]$status.status }
        private_text_logged = $false
        secrets_logged = $false
    }
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$payload = $null
switch ($Mode) {
    "Discover" { $payload = Get-AdapterDiscovery }
    "Status" { $payload = Get-AdapterStatus }
    "InspectWindow" {
        $discovery = Get-AdapterDiscovery
        $payload = Get-WindowInspection -ProcessCandidates @($discovery.process_candidates)
        $payload.mission_id = $MissionId
        $payload.mode = "InspectWindow"
        $payload.created_at = (Get-Date).ToString("o")
    }
    "DryRunComposer" { $payload = Invoke-DryRunComposer }
    "SendTestMessage" { $payload = Invoke-SendTestMessage }
    "ReadLastResponse" { $payload = Invoke-ReadLastResponse }
    "BuildTransportReport" {
        $status = Get-AdapterStatus
        $payload = [ordered]@{
            schema_version = "chatgpt_windows_app_adapter_v1"
            mission_id = $MissionId
            mode = "BuildTransportReport"
            created_at = (Get-Date).ToString("o")
            status = [string]$status.status
            desktop_status = $status
            transport_priority = @("chatgpt_windows_app_adapter", "chatgpt_web_a_j_pool", "local_omega_fallback")
            selected_transport = if ($status.status -eq "CHATGPT_DESKTOP_TRANSPORT_READY") { "chatgpt_windows_app_adapter" } else { "local_omega_fallback" }
            parked_desktop_lane = ($status.status -ne "CHATGPT_DESKTOP_TRANSPORT_READY")
            local_omega_fallback_available = $true
        }
        Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload (New-Manifest -Status $status)
    }
}

if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Get-DefaultOutPath -ModeName $Mode }
Write-JsonFile -Path $OutPath -Payload $payload

if ($Mode -ne "BuildTransportReport") {
    $statusForManifest = if ($payload.Contains("status")) { $payload } else { Get-AdapterStatus }
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload (New-Manifest -Status $statusForManifest)
}

$payload | ConvertTo-Json -Depth 80
