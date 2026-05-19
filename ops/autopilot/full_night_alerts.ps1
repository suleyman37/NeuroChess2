param(
    [ValidateSet("Started", "IterationFailure", "KillSwitchDetected", "SafetyStop", "Completed", "MorningReportReady")]
    [string]$Event = "Started",
    [string]$MissionId = "A20AX",
    [string]$Reason = "",
    [string]$ArtifactPath = "",
    [string]$RuntimeDir = "",
    [string]$ConfigPath = "",
    [string]$OutPath = "",
    [switch]$DryRun,
    [switch]$MockNtfySuccess,
    [switch]$MockNtfyFailure
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RuntimeDir)) { $RuntimeDir = Join-Path $PSScriptRoot "runtime" }
if ([string]::IsNullOrWhiteSpace($ConfigPath)) { $ConfigPath = Join-Path $PSScriptRoot "local\alert_router.local.json" }
if ([string]::IsNullOrWhiteSpace($Reason)) { $Reason = $Event }
$StatePath = Join-Path $RuntimeDir "full_night_alert_state.json"
$LocalAlertPath = Join-Path $RuntimeDir "full_night_alert_event.json"
$CooldownMinutes = 30

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tempPath = Join-Path $dir (".{0}.{1}.tmp" -f ([System.IO.Path]::GetFileName($Path)), ([guid]::NewGuid().ToString("N")))
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $tempPath -Encoding UTF8
    Move-Item -LiteralPath $tempPath -Destination $Path -Force
}

function Read-JsonOrNull {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $raw = Get-Content -LiteralPath $Path -Raw
    try {
        return $raw | ConvertFrom-Json
    } catch {
        $schemaIndex = $raw.LastIndexOf('"schema_version"')
        if ($schemaIndex -lt 0) { return $null }
        $start = $raw.LastIndexOf("{", $schemaIndex)
        if ($start -lt 0) { return $null }
        try {
            return $raw.Substring($start) | ConvertFrom-Json
        } catch {
            return $null
        }
    }
}

function Get-SafeTitle {
    switch ($Event) {
        "Started" { "NeuroChess full night started" }
        "IterationFailure" { "NeuroChess full night iteration failure" }
        "KillSwitchDetected" { "NeuroChess full night kill switch" }
        "SafetyStop" { "NeuroChess full night safety stop" }
        "Completed" { "NeuroChess full night completed" }
        "MorningReportReady" { "NeuroChess morning report ready" }
    }
}

$state = Read-JsonOrNull -Path $StatePath
$key = "$Event|$Reason"
$now = Get-Date
if ($state -and $state.last_alerts) {
    $lastProp = $state.last_alerts.PSObject.Properties[$key]
    $lastValue = if ($lastProp) { [string]$lastProp.Value } else { "" }
    if (-not [string]::IsNullOrWhiteSpace($lastValue)) {
        $last = [datetime]::Parse($lastValue)
        if (($now - $last).TotalMinutes -lt $CooldownMinutes) {
            $payload = [ordered]@{
                schema_version = "full_night_alert_result_v1"
                mission_id = $MissionId
                event = $Event
                reason = $Reason
                status = "ALERT_SUPPRESSED_COOLDOWN"
                cooldown_minutes = $CooldownMinutes
                no_secrets = $true
                private_urls_redacted = $true
                ntfy_topic_printed = $false
            }
            Write-JsonFile -Path $OutPath -Payload $payload
            $payload | ConvertTo-Json -Depth 30
            exit 0
        }
    }
}

$message = @"
Event: $Event
Mission id: $MissionId
Reason: $Reason
Codex continues only if local safety gates allow it.
No action is required unless you want to stop the run with the kill switch.
"@
$message = $message -replace "https://chatgpt\.com/[^\s]+", "[redacted-chatgpt-url]"
$title = Get-SafeTitle

$sendStatus = "ALERT_WRITTEN_LOCAL"
$sendPayload = $null
if ((Test-Path -LiteralPath $ConfigPath -PathType Leaf) -or $MockNtfySuccess -or $MockNtfyFailure) {
    $resultPath = if ([string]::IsNullOrWhiteSpace($OutPath)) { Join-Path ([System.IO.Path]::GetTempPath()) ("full_night_alert_" + [guid]::NewGuid().ToString("N") + ".json") } else { $OutPath }
    $args = @(
        "-Channel", "auto",
        "-Title", $title,
        "-Message", $message,
        "-MissionId", $MissionId,
        "-ServiceName", "FullNight",
        "-Reason", $Reason,
        "-ConfigPath", $ConfigPath,
        "-ResultPath", $resultPath,
        "-NoPrompt"
    )
    if (-not [string]::IsNullOrWhiteSpace($ArtifactPath)) {
        $args += @("-ArtifactPath", $ArtifactPath)
    }
    if ($DryRun) { $args += "-DryRun" }
    if ($MockNtfySuccess) { $args += "-MockNtfySuccess" }
    if ($MockNtfyFailure) { $args += "-MockNtfyFailure" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_autopilot_alert.ps1") @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -ge 0) {
        $sendPayload = $text.Substring($start) | ConvertFrom-Json
        $sendStatus = [string]$sendPayload.status
    } elseif ($LASTEXITCODE -ne 0) {
        $sendStatus = "ALERT_DELIVERY_FAILED"
    }
}

if ($sendStatus -eq "ALERT_DELIVERY_FAILED" -or $sendStatus -eq "ALERT_WRITTEN_LOCAL") {
    Write-JsonFile -Path $LocalAlertPath -Payload ([ordered]@{
        schema_version = "full_night_local_alert_event_v1"
        mission_id = $MissionId
        event = $Event
        reason = $Reason
        title = $title
        message = $message
        created_at = $now.ToString("o")
        no_secrets = $true
        private_urls_redacted = $true
    })
}

$lastAlerts = [ordered]@{}
if ($state -and $state.last_alerts) {
    foreach ($prop in $state.last_alerts.PSObject.Properties) { $lastAlerts[$prop.Name] = [string]$prop.Value }
}
$lastAlerts[$key] = $now.ToString("o")
Write-JsonFile -Path $StatePath -Payload ([ordered]@{ schema_version = "full_night_alert_state_v1"; last_alerts = $lastAlerts })

$payload = [ordered]@{
    schema_version = "full_night_alert_result_v1"
    mission_id = $MissionId
    event = $Event
    reason = $Reason
    status = $sendStatus
    alert_router_payload = $sendPayload
    local_runtime_alert_path = if (Test-Path -LiteralPath $LocalAlertPath -PathType Leaf) { $LocalAlertPath } else { $null }
    ntfy_optional = $true
    gmail_required = $false
    no_secrets = $true
    private_urls_redacted = $true
    ntfy_topic_printed = $false
    cooldown_minutes = $CooldownMinutes
}

Write-JsonFile -Path $OutPath -Payload $payload
$payload | ConvertTo-Json -Depth 30
exit 0
