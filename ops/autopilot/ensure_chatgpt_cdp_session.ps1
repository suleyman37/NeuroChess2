param(
    [string]$Endpoint = "http://127.0.0.1:9222",
    [string]$ProfilePath = "",
    [string]$ChatGptUrl = "",
    [string]$ResultPath = "",
    [int]$WaitSeconds = 20,
    [switch]$NoLaunch,
    [ValidateSet("", "PortAvailable", "PortUnavailable", "PortConflict", "LaunchSuccess", "LaunchFailure")]
    [string]$MockStatus = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if (-not [string]::IsNullOrWhiteSpace($Path)) {
        $dir = Split-Path -Parent $Path
        if (-not [string]::IsNullOrWhiteSpace($dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
    }
}

function Emit {
    param([object]$Payload, [int]$ExitCode)
    Write-JsonFile -Path $ResultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 20
    exit $ExitCode
}

function Get-CdpVersion {
    param([string]$BaseEndpoint)
    $uri = $BaseEndpoint.TrimEnd("/") + "/json/version"
    try {
        Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 3
    } catch {
        $null
    }
}

function Test-PortOpen {
    param([string]$BaseEndpoint)
    try {
        $uri = [Uri]$BaseEndpoint
        $client = [Net.Sockets.TcpClient]::new()
        $async = $client.BeginConnect($uri.Host, $uri.Port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(1000, $false)
        if ($ok) { $client.EndConnect($async) }
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

function Find-BrowserExe {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
    )
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return $candidate
        }
    }
    return ""
}

if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $configPath = Join-Path $PSScriptRoot "config.json"
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $ProfilePath = [string]$config.chatgpt_web_bridge.chrome_profile_path
        if ([string]::IsNullOrWhiteSpace($ChatGptUrl)) {
            $ChatGptUrl = [string]$config.chatgpt_web_bridge.chatgpt_url
        }
    }
}
if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $ProfilePath = Join-Path $env:USERPROFILE "Documents\Dev\ChatGPTSupervisorChromeProfile"
}
if ([string]::IsNullOrWhiteSpace($ChatGptUrl)) {
    $sessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"
    if (Test-Path -LiteralPath $sessionPath -PathType Leaf) {
        try {
            $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
            $ChatGptUrl = [string]$session.active_session_url
        } catch {
            $ChatGptUrl = ""
        }
    }
}
if ([string]::IsNullOrWhiteSpace($ChatGptUrl)) {
    $ChatGptUrl = "https://chatgpt.com/"
}

$base = [ordered]@{
    schema_version = "neurochess_chatgpt_cdp_session_bootstrap_v1"
    endpoint = $Endpoint
    endpoint_redacted = $false
    preferred_port = 9222
    profile_path_redacted = $true
    profile_configured = -not [string]::IsNullOrWhiteSpace($ProfilePath)
    chatgpt_url_configured = -not [string]::IsNullOrWhiteSpace($ChatGptUrl)
    browser_launched = $false
    cdp_attached = $false
    chrome_closed_by_script = $false
    credentials_entered = $false
    bypass_attempted = $false
    mock_status = $MockStatus
}

if (-not [string]::IsNullOrWhiteSpace($MockStatus)) {
    switch ($MockStatus) {
        "PortAvailable" {
            $base.status = "CDP_ALREADY_AVAILABLE"
            $base.cdp_attached = $true
            Emit -Payload $base -ExitCode 0
        }
        "PortUnavailable" {
            $base.status = "CDP_SESSION_UNAVAILABLE"
            Emit -Payload $base -ExitCode 3
        }
        "PortConflict" {
            $base.status = "CDP_PORT_CONFLICT"
            Emit -Payload $base -ExitCode 4
        }
        "LaunchSuccess" {
            $base.status = "CDP_SESSION_BOOTSTRAPPED"
            $base.browser_launched = $true
            $base.cdp_attached = $true
            Emit -Payload $base -ExitCode 0
        }
        "LaunchFailure" {
            $base.status = "CDP_SESSION_UNAVAILABLE"
            Emit -Payload $base -ExitCode 3
        }
    }
}

$version = Get-CdpVersion -BaseEndpoint $Endpoint
if ($version) {
    $base.status = "CDP_ALREADY_AVAILABLE"
    $base.cdp_attached = $true
    $base.browser = if ($version.Browser) { "available" } else { "unknown" }
    Emit -Payload $base -ExitCode 0
}

if (Test-PortOpen -BaseEndpoint $Endpoint) {
    $base.status = "CDP_PORT_CONFLICT"
    Emit -Payload $base -ExitCode 4
}

if ($NoLaunch) {
    $base.status = "CDP_SESSION_UNAVAILABLE"
    $base.no_launch = $true
    Emit -Payload $base -ExitCode 3
}

$browserExe = Find-BrowserExe
if ([string]::IsNullOrWhiteSpace($browserExe)) {
    $base.status = "CDP_SESSION_UNAVAILABLE"
    $base.browser_executable_found = $false
    Emit -Payload $base -ExitCode 3
}

New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
$endpointUri = [Uri]$Endpoint
$args = @(
    "--remote-debugging-port=$($endpointUri.Port)",
    "--user-data-dir=$ProfilePath",
    "--no-first-run",
    "--new-window",
    $ChatGptUrl
)

try {
    Start-Process -FilePath $browserExe -ArgumentList $args | Out-Null
    $base.browser_launched = $true
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $version = Get-CdpVersion -BaseEndpoint $Endpoint
        if ($version) {
            $base.status = "CDP_SESSION_BOOTSTRAPPED"
            $base.cdp_attached = $true
            Emit -Payload $base -ExitCode 0
        }
    }
    $base.status = "CDP_SESSION_UNAVAILABLE"
    $base.error_redacted = "CDP endpoint did not become reachable before timeout."
    Emit -Payload $base -ExitCode 3
} catch {
    $base.status = "CDP_SESSION_UNAVAILABLE"
    $base.error_redacted = $_.Exception.Message
    Emit -Payload $base -ExitCode 3
}
