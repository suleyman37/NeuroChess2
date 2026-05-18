param(
    [ValidateSet("InitNtfy", "Status", "Test", "Clear")]
    [string]$Action = "Status",
    [string]$Topic = "",
    [string]$ConfigPath = "",
    [string]$ResultPath = "",
    [string]$Server = "https://ntfy.sh",
    [string]$Priority = "high",
    [switch]$NoPrompt,
    [switch]$ShowFullTopic,
    [switch]$DryRun,
    [int]$TimeoutSeconds = 10
)

$ErrorActionPreference = "Stop"

function Get-DefaultConfigPath {
    Join-Path $PSScriptRoot "local\alert_router.local.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Emit {
    param([object]$Payload, [int]$ExitCode = 0)
    Write-JsonFile -Path $ResultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 30
    exit $ExitCode
}

function Redact-Topic {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    if ($ShowFullTopic) { return $Value }
    if ($Value.Length -le 8) { return "[redacted]" }
    $headLength = [Math]::Min(14, $Value.Length - 4)
    $head = $Value.Substring(0, $headLength)
    $tail = $Value.Substring($Value.Length - 4)
    return "$head...-$tail"
}

function Test-GuessableTopic {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    if ($Value.Length -lt 32) { return $true }
    if ($Value -match "^(neurochess|test|alert|iphone|suley|codex)[-_]?\d*$") { return $true }
    if ($Value -match "1234|password|secret|topic") { return $true }
    return $false
}

function Read-Config {
    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { return $null }
    Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
}

function New-Config {
    param([string]$TopicValue)
    [ordered]@{
        schema_version = "autopilot_alert_router_v1"
        primary_channel = "ntfy"
        ntfy = [ordered]@{
            enabled = $true
            server = $Server.TrimEnd("/")
            topic = $TopicValue
            priority = $Priority
        }
        gmail = [ordered]@{
            enabled = $false
            fallback_only = $true
        }
    }
}

function New-StatusPayload {
    param($Config, [string]$Status)
    $topicValue = if ($Config -and $Config.ntfy) { [string]$Config.ntfy.topic } else { "" }
    [ordered]@{
        schema_version = "autopilot_alert_router_setup_result_v1"
        status = $Status
        action = $Action
        config_path = $ConfigPath
        config_path_redacted = $true
        config_exists = Test-Path -LiteralPath $ConfigPath -PathType Leaf
        primary_channel = if ($Config) { [string]$Config.primary_channel } else { "ntfy" }
        ntfy_enabled = if ($Config -and $Config.ntfy) { [bool]$Config.ntfy.enabled } else { $false }
        ntfy_server = if ($Config -and $Config.ntfy) { [string]$Config.ntfy.server } else { $Server }
        ntfy_topic_redacted = Redact-Topic -Value $topicValue
        ntfy_topic_length = if ($topicValue) { $topicValue.Length } else { 0 }
        ntfy_topic_printed_full = [bool]$ShowFullTopic
        topic_looks_guessable = Test-GuessableTopic -Value $topicValue
        gmail_fallback_enabled = if ($Config -and $Config.gmail) { [bool]$Config.gmail.enabled } else { $false }
        secrets_redacted = $true
        private_topic_printed = [bool]$ShowFullTopic
    }
}

function Send-NtfyTest {
    param($Config)
    if ($DryRun) {
        return [ordered]@{
            status = "ALERT_DRY_RUN"
            network_called = $false
        }
    }
    $serverValue = ([string]$Config.ntfy.server).TrimEnd("/")
    $topicValue = [string]$Config.ntfy.topic
    $uri = "$serverValue/$topicValue"
    $headers = @{
        Title = "[NeuroChess] iPhone alert router test"
        Priority = [string]$Config.ntfy.priority
        Tags = "warning,chess,computer"
    }
    try {
        $response = Invoke-WebRequest -Method Post -Uri $uri -Headers $headers -Body "NeuroChess ntfy iPhone alert router test." -TimeoutSec $TimeoutSeconds -UseBasicParsing
        return [ordered]@{
            status = "ALERT_SENT_NTFY"
            http_status = [int]$response.StatusCode
            network_called = $true
        }
    } catch {
        $message = $_.Exception.Message
        if (-not [string]::IsNullOrWhiteSpace($topicValue)) {
            $message = $message.Replace($topicValue, "[redacted-topic]")
        }
        return [ordered]@{
            status = "ALERT_DELIVERY_FAILED"
            error_redacted = $message
            network_called = $true
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Get-DefaultConfigPath
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_alert_router_" + [guid]::NewGuid().ToString("N") + ".json")
}

switch ($Action) {
    "Status" {
        $config = Read-Config
        if (-not $config) {
            Emit -Payload (New-StatusPayload -Config $null -Status "ALERT_ROUTER_NOT_CONFIGURED") -ExitCode 10
        }
        Emit -Payload (New-StatusPayload -Config $config -Status "ALERT_ROUTER_READY") -ExitCode 0
    }
    "Clear" {
        if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
            Remove-Item -LiteralPath $ConfigPath -Force
        }
        Emit -Payload (New-StatusPayload -Config $null -Status "ALERT_ROUTER_CLEARED") -ExitCode 0
    }
    "InitNtfy" {
        $topicValue = $Topic
        $prompted = $false
        if ([string]::IsNullOrWhiteSpace($topicValue) -and -not $NoPrompt) {
            $topicValue = Read-Host "Enter ntfy topic for NeuroChess iPhone alerts"
            $prompted = $true
        }
        if ([string]::IsNullOrWhiteSpace($topicValue)) {
            $payload = New-StatusPayload -Config $null -Status "ALERT_ROUTER_TOPIC_REQUIRED"
            $payload.prompted = $prompted
            Emit -Payload $payload -ExitCode 10
        }
        $topicValue = $topicValue.Trim()
        if ($topicValue.Length -lt 24) {
            $payload = New-StatusPayload -Config $null -Status "ALERT_ROUTER_TOPIC_TOO_SHORT"
            $payload.ntfy_topic_length = $topicValue.Length
            $payload.prompted = $prompted
            Emit -Payload $payload -ExitCode 11
        }
        $config = New-Config -TopicValue $topicValue
        $dir = Split-Path -Parent $ConfigPath
        if (-not [string]::IsNullOrWhiteSpace($dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        $config | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
        $payload = New-StatusPayload -Config $config -Status "ALERT_ROUTER_NTFY_CONFIGURED"
        $payload.prompted = $prompted
        Emit -Payload $payload -ExitCode 0
    }
    "Test" {
        $config = Read-Config
        if (-not $config) {
            Emit -Payload (New-StatusPayload -Config $null -Status "ALERT_ROUTER_NOT_CONFIGURED") -ExitCode 10
        }
        $send = Send-NtfyTest -Config $config
        $payload = New-StatusPayload -Config $config -Status ([string]$send.status)
        $payload.ntfy_test = $send
        $exit = if ([string]$send.status -eq "ALERT_SENT_NTFY" -or [string]$send.status -eq "ALERT_DRY_RUN") { 0 } else { 12 }
        Emit -Payload $payload -ExitCode $exit
    }
}
