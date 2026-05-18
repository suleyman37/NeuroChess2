$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20an_mission_doctor_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command, [int[]]$AcceptExitCodes = @(0))
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $pass = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mission_doctor.ps1") `
            -MissionId A20AN_TEST `
            -ChangedFiles docs/autopilot/example.md `
            -ReportPath docs/autopilot/example.md `
            -OutPath (Join-Path $TempRoot "pass.json")
    }
    Assert-True ($pass.verdict -eq "PASS") "pass case failed"
    Assert-True ($pass.visual_value -ne "high") "no screenshots must not be high visual value"

    $blocked = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mission_doctor.ps1") `
            -MissionId A20AN_TEST `
            -ReportPath docs/autopilot/example.md `
            -WebBlocked `
            -OutPath (Join-Path $TempRoot "blocked.json")
    }
    Assert-True ($blocked.verdict -eq "BLOCKED") "web blocked should classify as blocked"
    Assert-True (($blocked.blocked_lanes -contains "live_gpt_web")) "blocked lane missing"
    Assert-True ($blocked.next_recommendation -eq "PARK_LIVE_LANE_AND_CONTINUE_OFFLINE") "blocked lane should route offline"

    $fail = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mission_doctor.ps1") `
            -MissionId A20AN_TEST `
            -ChangedFiles backend/unsafe.py `
            -SecretCommitted `
            -OutPath (Join-Path $TempRoot "fail.json")
    } -AcceptExitCodes @(10)
    Assert-True ($fail.verdict -eq "FAIL") "safety fail not detected"
    Assert-True ($fail.safety_status -eq "FAIL") "safety status not fail"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\mission_doctor.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "mission doctor contains prompt"

    [ordered]@{
        status = "pass"
        tests = 8
        pass_verdict = $true
        web_blocked_parks_lane = $true
        safety_fail_detected = $true
        visual_high_requires_screenshots = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
