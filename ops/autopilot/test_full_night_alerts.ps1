$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ax_alerts_" + [guid]::NewGuid().ToString("N"))
$RuntimeDir = Join-Path $TempRoot "runtime"
$ConfigPath = Join-Path $TempRoot "alert_router.local.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Json {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\full_night_alerts.ps1") @Arguments 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "alert command failed: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
    $local = Invoke-Json -Arguments @("-Event", "Started", "-MissionId", "A20AX_TEST", "-Reason", "no_config", "-RuntimeDir", $RuntimeDir, "-ConfigPath", (Join-Path $TempRoot "missing.json"), "-DryRun")
    Assert-True ($local.status -eq "ALERT_WRITTEN_LOCAL") "missing ntfy config should write local alert"
    Assert-True ((Test-Path -LiteralPath $local.local_runtime_alert_path -PathType Leaf)) "local runtime alert missing"

    [ordered]@{
        schema_version = "autopilot_alert_router_v1"
        primary_channel = "ntfy"
        ntfy = [ordered]@{ enabled = $true; server = "https://ntfy.sh"; topic = "a20ax-redaction-test-topic-12345678901234567890"; priority = "high" }
        gmail = [ordered]@{ enabled = $false; fallback_only = $true }
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

    $dry = Invoke-Json -Arguments @("-Event", "Completed", "-MissionId", "A20AX_TEST", "-Reason", "dry_configured", "-RuntimeDir", $RuntimeDir, "-ConfigPath", $ConfigPath, "-DryRun")
    Assert-True ($dry.status -eq "ALERT_DRY_RUN") "configured dry-run should return ALERT_DRY_RUN"
    Assert-True (($dry | ConvertTo-Json -Depth 30) -notmatch "a20ax-redaction-test-topic-12345678901234567890") "alert printed ntfy topic"

    $repeat = Invoke-Json -Arguments @("-Event", "Completed", "-MissionId", "A20AX_TEST", "-Reason", "dry_configured", "-RuntimeDir", $RuntimeDir, "-ConfigPath", $ConfigPath, "-DryRun")
    Assert-True ($repeat.status -eq "ALERT_SUPPRESSED_COOLDOWN") "repeat alert should be suppressed"

    $mock = Invoke-Json -Arguments @("-Event", "MorningReportReady", "-MissionId", "A20AX_TEST", "-Reason", "mock_success", "-RuntimeDir", $RuntimeDir, "-ConfigPath", $ConfigPath, "-MockNtfySuccess")
    Assert-True ($mock.status -eq "ALERT_SENT_NTFY") "mock ntfy success did not pass"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\full_night_alerts.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "full night alerts prompt"
    Assert-True ($source -notmatch "(?i)credential") "full night alerts mention credential prompts"

    [ordered]@{ status = "pass"; tests = 7; alerts = "ready" } | ConvertTo-Json -Depth 6
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
