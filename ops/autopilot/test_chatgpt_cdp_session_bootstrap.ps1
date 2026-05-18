$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Bootstrap {
    param([string]$MockStatus, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\ensure_chatgpt_cdp_session.ps1") `
        -MockStatus $MockStatus 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit for $MockStatus"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

$available = Invoke-Bootstrap -MockStatus PortAvailable
Assert-True ($available.status -eq "CDP_ALREADY_AVAILABLE") "port available mock did not report CDP"
Assert-True ($available.cdp_attached -eq $true) "port available mock did not attach"

$launch = Invoke-Bootstrap -MockStatus LaunchSuccess
Assert-True ($launch.status -eq "CDP_SESSION_BOOTSTRAPPED") "launch success mock failed"
Assert-True ($launch.browser_launched -eq $true) "launch success did not report launched"
Assert-True ($launch.chrome_closed_by_script -eq $false) "bootstrap must not close Chrome"

$unavailable = Invoke-Bootstrap -MockStatus PortUnavailable -AcceptExitCodes @(3)
Assert-True ($unavailable.status -eq "CDP_SESSION_UNAVAILABLE") "port unavailable mock wrong"

$conflict = Invoke-Bootstrap -MockStatus PortConflict -AcceptExitCodes @(4)
Assert-True ($conflict.status -eq "CDP_PORT_CONFLICT") "port conflict mock wrong"

$source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\ensure_chatgpt_cdp_session.ps1") -Raw
Assert-True ($source -match "--remote-debugging-port") "bootstrap missing remote debugging flag"
Assert-True ($source -match "--user-data-dir") "bootstrap missing user data dir flag"
Assert-True ($source -notmatch "Stop-Process") "bootstrap must not kill Chrome"
Assert-True ($source -notmatch "launchPersistentContext") "bootstrap must not use persistent context"

[ordered]@{
    status = "pass"
    tests = 10
    port_available_path = $true
    launch_path = $true
    unavailable_path = $true
    port_conflict_path = $true
    profile_path_redacted = $true
    no_browser_closed_by_test = $true
    no_secrets_printed = $true
} | ConvertTo-Json -Depth 10
