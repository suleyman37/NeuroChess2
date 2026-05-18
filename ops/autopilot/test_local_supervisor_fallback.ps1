$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20an_local_fallback_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command)
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $diagPath = Join-Path $TempRoot "diagnosis.json"
    [ordered]@{ verdict = "BLOCKED"; blocked_lanes = @("live_gpt_web"); do_not_repeat = @("live_web") } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $diagPath -Encoding UTF8
    $result = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\local_supervisor_fallback.ps1") `
            -MissionId A20AN_TEST `
            -DiagnosisPath $diagPath `
            -OutPath (Join-Path $TempRoot "fallback.json") `
            -NoLiveWeb
    }
    Assert-True ($result.status -eq "LOCAL_FALLBACK_NEXT_OBJECTIVE_SELECTED") "fallback did not select objective"
    Assert-True ($result.selected_family -in @("VISUAL_PRODUCTION_MODE", "SIGNATURE_COMPONENTS")) "fallback should prefer visual production"
    Assert-True ($result.live_lane_parked -eq $true) "live lane not parked"
    Assert-True ($result.no_user_intervention -eq $true) "fallback should not require user"
    $second = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\local_supervisor_fallback.ps1") `
            -MissionId A20AN_TEST `
            -DiagnosisPath $diagPath `
            -AvoidObjectiveIds $result.selected_objective_id `
            -NoLiveWeb
    }
    Assert-True ($second.selected_objective_id -ne $result.selected_objective_id) "fallback should avoid already selected objective when alternatives exist"
    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\local_supervisor_fallback.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "fallback contains prompt"

    [ordered]@{
        status = "pass"
        tests = 6
        visual_preferred = $true
        live_lane_parked = $true
        no_user_intervention = $true
        avoids_repetition = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
