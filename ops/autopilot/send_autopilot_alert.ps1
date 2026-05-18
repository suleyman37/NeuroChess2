param(
    [ValidateSet("auto", "ntfy", "gmail", "local")]
    [string]$Channel = "auto",
    [string]$Title = "[NeuroChess] Action required",
    [string]$Message = "",
    [string]$MissionId = "UNKNOWN_MISSION",
    [string]$ServiceName = "ChatGPT",
    [string]$Reason = "Human action required",
    [string]$ArtifactPath = "",
    [ValidateSet("default", "high", "urgent")]
    [string]$Priority = "high",
    [switch]$DryRun,
    [switch]$NoPrompt,
    [int]$TimeoutSeconds = 10,
    [string]$ConfigPath = "",
    [string]$ResultPath = "",
    [switch]$MockNtfySuccess,
    [switch]$MockNtfyFailure,
    [switch]$MockGmailSuccess
)

$ErrorActionPreference = "Stop"

function Get-DefaultConfigPath {
    Join-Path $PSScriptRoot "local\alert_router.local.json"
}

function Get-DefaultRuntimeAlertPath {
    Join-Path $PSScriptRoot "runtime\autopilot_alert_event.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Emit {
    param([object]$Payload, [int]$ExitCode = 0)
    Write-JsonFile -Path $ResultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 40
    exit $ExitCode
}

function Redact-Topic {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    if ($Value.Length -le 8) { return "[redacted]" }
    $headLength = [Math]::Min(14, $Value.Length - 4)
    $head = $Value.Substring(0, $headLength)
    $tail = $Value.Substring($Value.Length - 4)
    return "$head...-$tail"
}

function Read-Config {
    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { return $null }
    Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
}

function Convert-Priority {
    param([string]$Value)
    switch ($Value) {
        "urgent" { return "urgent" }
        "high" { return "high" }
        default { return "default" }
    }
}

function Get-SafeMessage {
    $timestamp = (Get-Date).ToString("o")
    $body = if ([string]::IsNullOrWhiteSpace($Message)) {
@"
Action required for NeuroChess automation.

Service: $ServiceName
Mission id: $MissionId
Reason: $Reason
Detected at: $timestamp

Go to the Chrome window left open by Codex.
Do not close Chrome.
Complete the verification manually.
After finishing, leave the page open and wait for Codex to resume.

Artifact path:
$ArtifactPath
"@
    } else {
        $Message
    }
    $body -replace "https://chatgpt\.com/[^\s]+", "[redacted-chatgpt-url]"
}

function Invoke-SetupIfAllowed {
    if ($NoPrompt) { return $null }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "setup_alert_router.ps1") `
        -Action InitNtfy `
        -ConfigPath $ConfigPath 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { return $null }
    $text.Substring($start) | ConvertFrom-Json
}

function Send-Ntfy {
    param($Config, [string]$Body)
    if ($MockNtfySuccess) {
        return [ordered]@{ status = "ALERT_SENT_NTFY"; mock = $true }
    }
    if ($MockNtfyFailure) {
        return [ordered]@{ status = "ALERT_DELIVERY_FAILED"; mock = $true; error_redacted = "mock ntfy failure" }
    }
    if ($DryRun) {
        return [ordered]@{ status = "ALERT_DRY_RUN"; channel = "ntfy"; network_called = $false }
    }
    $server = ([string]$Config.ntfy.server).TrimEnd("/")
    $topic = [string]$Config.ntfy.topic
    $uri = "$server/$topic"
    $headers = @{
        Title = $Title
        Priority = Convert-Priority -Value $Priority
        Tags = "warning,chess,computer"
    }
    try {
        $response = Invoke-WebRequest -Method Post -Uri $uri -Headers $headers -Body $Body -TimeoutSec $TimeoutSeconds -UseBasicParsing
        return [ordered]@{ status = "ALERT_SENT_NTFY"; http_status = [int]$response.StatusCode; network_called = $true }
    } catch {
        $messageText = $_.Exception.Message
        if (-not [string]::IsNullOrWhiteSpace($topic)) {
            $messageText = $messageText.Replace($topic, "[redacted-topic]")
        }
        return [ordered]@{ status = "ALERT_DELIVERY_FAILED"; error_redacted = $messageText; network_called = $true }
    }
}

function Send-GmailFallback {
    param([string]$Body)
    if ($MockGmailSuccess) {
        return [ordered]@{ status = "EMAIL_ALERT_SENT"; mock = $true }
    }
    if ($DryRun) {
        return [ordered]@{ status = "EMAIL_ALERT_DRY_RUN"; mock = $false }
    }
    $resultPath = Join-Path (Split-Path -Parent $ResultPath) "gmail_fallback_alert_result.json"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_human_verification_email_alert.ps1") `
        -ServiceName $ServiceName `
        -MissionId $MissionId `
        -Reason $Reason `
        -ArtifactPath $ArtifactPath `
        -PauseStatePath (Join-Path $PSScriptRoot "runtime\autopilot_alert_pause_state.json") `
        -ResultPath $resultPath `
        -NoPasswordPrompt `
        -SubjectOverride $Title `
        -BodyOverride $Body 2>&1
    if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        return (Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json)
    }
    return [ordered]@{ status = "EMAIL_ALERT_SEND_FAILED"; error_redacted = ($output -join "`n") }
}

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Get-DefaultConfigPath
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_autopilot_alert_" + [guid]::NewGuid().ToString("N") + ".json")
}

$config = Read-Config
if (-not $config -and -not $NoPrompt) {
    Invoke-SetupIfAllowed | Out-Null
    $config = Read-Config
}

$base = [ordered]@{
    schema_version = "autopilot_alert_router_send_result_v1"
    mission_id = $MissionId
    service = $ServiceName
    reason = $Reason
    title = $Title
    channel_requested = $Channel
    config_path_redacted = $true
    config_exists = ($null -ne $config)
    primary_channel = if ($config) { [string]$config.primary_channel } else { "ntfy" }
    ntfy_topic_redacted = if ($config -and $config.ntfy) { Redact-Topic -Value ([string]$config.ntfy.topic) } else { "" }
    ntfy_topic_printed_full = $false
    gmail_fallback_enabled = if ($config -and $config.gmail) { [bool]$config.gmail.enabled } else { $false }
    artifact_path = $ArtifactPath
    dry_run = [bool]$DryRun
    timeout_seconds = $TimeoutSeconds
    secrets_redacted = $true
    private_urls_redacted = $true
    smtp_password_printed = $false
    bypass_attempted = $false
}

if (-not $config -and $Channel -ne "local") {
    $base.status = "ALERT_ROUTER_NOT_CONFIGURED"
    Emit -Payload $base -ExitCode 10
}

$body = Get-SafeMessage
$selected = if ($Channel -eq "auto") { if ($config) { [string]$config.primary_channel } else { "local" } } else { $Channel }
$base.channel_selected = $selected

if ($selected -eq "ntfy") {
    $ntfy = Send-Ntfy -Config $config -Body $body
    $base.ntfy_status = [string]$ntfy.status
    $base.ntfy_result = $ntfy
    if ([string]$ntfy.status -eq "ALERT_SENT_NTFY") {
        $base.status = "ALERT_SENT_NTFY"
        Emit -Payload $base -ExitCode 0
    }
    if ([string]$ntfy.status -eq "ALERT_DRY_RUN") {
        $base.status = "ALERT_DRY_RUN"
        $base.alert_body_preview = $body
        Emit -Payload $base -ExitCode 0
    }
    if ($config.gmail -and [bool]$config.gmail.enabled) {
        $gmail = Send-GmailFallback -Body $body
        $base.gmail_status = [string]$gmail.status
        $base.gmail_result = $gmail
        if ([string]$gmail.status -in @("EMAIL_ALERT_SENT", "EMAIL_ALERT_DRY_RUN")) {
            $base.status = "ALERT_SENT_GMAIL_FALLBACK"
            Emit -Payload $base -ExitCode 0
        }
    }
}

if ($selected -eq "gmail") {
    $gmail = Send-GmailFallback -Body $body
    $base.gmail_status = [string]$gmail.status
    $base.gmail_result = $gmail
    if ([string]$gmail.status -in @("EMAIL_ALERT_SENT", "EMAIL_ALERT_DRY_RUN")) {
        $base.status = "ALERT_SENT_GMAIL_FALLBACK"
        Emit -Payload $base -ExitCode 0
    }
}

$runtimePath = Get-DefaultRuntimeAlertPath
$localEvent = [ordered]@{
    schema_version = "autopilot_alert_runtime_event_v1"
    status = "ALERT_DELIVERY_FAILED"
    mission_id = $MissionId
    service = $ServiceName
    reason = $Reason
    title = $Title
    message = $body
    created_at = (Get-Date).ToString("o")
    secrets_redacted = $true
    private_urls_redacted = $true
}
Write-JsonFile -Path $runtimePath -Payload $localEvent
$base.status = if ($selected -eq "local") { "ALERT_WRITTEN_LOCAL" } else { "ALERT_DELIVERY_FAILED" }
$base.local_runtime_alert_path = $runtimePath
$base.alert_body_preview = if ($DryRun) { $body } else { $null }
$exitCode = if ($selected -eq "local") { 0 } else { 12 }
Emit -Payload $base -ExitCode $exitCode
