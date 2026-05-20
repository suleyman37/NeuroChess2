$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "antigravity_transport_discovery.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_antigravity_transport_{0}" -f [guid]::NewGuid().ToString("N"))

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Discovery {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "discovery failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

    $status = Invoke-Discovery -Arguments @("-Mode", "Status", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($status.status -eq "ANTIGRAVITY_TRANSPORT_DISCOVERY_READY") "discovery status missing"
    Assert-True ([bool]$status.screenshot_first_required) "screenshot-first rule missing"

    $dry = Invoke-Discovery -Arguments @("-Mode", "DryRun", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($dry.status -eq "ANTIGRAVITY_TRANSPORT_DISCOVERY_DRY_RUN_PASS") "dry run should pass"
    Assert-True ([bool]$dry.process_only_cannot_mark_ready) "process-only ready must be forbidden"
    Assert-True ([bool]$dry.manual_fallback_available) "manual fallback missing"

    $manual = Invoke-Discovery -Arguments @("-Mode", "CreateManualFallback", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($manual.status -eq "ANTIGRAVITY_MANUAL_BRIDGE_CREATED") "manual fallback should be created"
    Assert-True (Test-Path -LiteralPath (Join-Path $tempRoot "inbox\work_order.md")) "manual fallback inbox missing"

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch '\[System\.Windows\.Forms\.SendKeys\]|WScript\.Shell.*SendKeys') "discovery must not use SendKeys APIs"
    Assert-True ($source -notmatch "git commit") "discovery must not commit"
    Assert-True ($source -notmatch "git push") "discovery must not push"
    Assert-True ($source -notmatch "Invoke-WebRequest.*1\\.\\.65535") "discovery must not brute-force random ports"

    [ordered]@{
        status = "pass"
        tests = 9
        process_discovery_alone_cannot_mark_ready = $true
        no_blind_typing = $true
        fallback_manual_bridge_created = $true
        no_commit_or_push = $true
        no_random_port_bruteforce = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
