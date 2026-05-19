$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_failure_ledger_test_" + [guid]::NewGuid().ToString("N"))
$LedgerPath = Join-Path $TempRoot "failure_ledger.yaml"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Ledger {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\failure_ledger_update.ps1") -LedgerPath $LedgerPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $first = Invoke-Ledger -Arguments @("-MissionId", "A20AU_TEST", "-Lane", "chatgpt", "-Reason", "AUTH_REQUIRED", "-LoopContinued")
    Assert-True ($first.status -eq "FAILURE_LEDGER_UPDATED") "first update failed"
    Assert-True ($first.recurrence_count -eq 1) "first recurrence wrong"
    Assert-True ($first.avoid_lane -eq $false) "first should not avoid"

    $second = Invoke-Ledger -Arguments @("-MissionId", "A20AU_TEST", "-Lane", "chatgpt", "-Reason", "AUTH_REQUIRED", "-LoopContinued", "-NtfyAlertSent")
    Assert-True ($second.recurrence_count -eq 2) "second recurrence wrong"
    Assert-True ($second.avoid_lane -eq $true) "second should avoid"
    Assert-True ($second.do_not_repeat_rule -eq "avoid_lane_unless_explicitly_unparked") "do-not-repeat wrong"
    Assert-True (Test-Path -LiteralPath $LedgerPath -PathType Leaf) "ledger missing"
    $ledger = Get-Content -LiteralPath $LedgerPath -Raw
    Assert-True ($ledger -match "loop_continued: true") "loop continuation not recorded"
    Assert-True ($ledger -match "ntfy_alert_sent: true") "ntfy alert not recorded"

    [ordered]@{
        status = "pass"
        tests = 8
        recurrence_count = $second.recurrence_count
        avoid_lane = $second.avoid_lane
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
