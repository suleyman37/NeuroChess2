$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20an_autonomous_loop_test_" + [guid]::NewGuid().ToString("N"))
$StatePath = Join-Path $RepoRoot "ops\autopilot\runtime\autonomous_improvement_loop_test_state.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Loop {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_autonomous_improvement_loop.ps1") `
        -MissionId A20AN_TEST `
        -ArtifactPath $TempRoot `
        -StatePath $StatePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "loop did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue

    $dry = Invoke-Loop -Arguments @("-Mode", "DryRun", "-NoLiveWeb")
    Assert-True ($dry.status -eq "AUTONOMOUS_LOOP_DRY_RUN_PASS") "dry run did not pass"
    Assert-True ($dry.completed_iterations -eq 5) "dry run should simulate 5 iterations"
    Assert-True ($dry.no_user_intervention -eq $true) "dry run requires user"
    Assert-True ($dry.live_gpt_web_optional -eq $true) "live GPT should be optional"
    Assert-True ((@($dry.next_planned_objectives | Select-Object -Unique).Count) -gt 1) "dry run should preview distinct next objectives"

    $rehearsal = Invoke-Loop -Arguments @("-Mode", "Rehearsal", "-MaxIterations", "2", "-NoLiveWeb")
    Assert-True ($rehearsal.status -eq "AUTONOMOUS_LOOP_REHEARSAL_PASS") "rehearsal did not pass"
    Assert-True ($rehearsal.completed_iterations -eq 2) "rehearsal iteration count wrong"
    Assert-True ($rehearsal.blocked_lanes_park_and_continue -eq $true) "blocked lanes should park and continue"
    Assert-True ($rehearsal.loop_bounded -eq $true) "loop not bounded"

    $status = Invoke-Loop -Arguments @("-Mode", "Status")
    Assert-True ($status.completed_iterations -eq 2) "status did not read runtime state"

    $stop = Invoke-Loop -Arguments @("-Mode", "Stop")
    Assert-True ($stop.stop_requested -eq $true) "stop flag not written"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_autonomous_improvement_loop.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "conductor contains prompt"
    Assert-True ($source -notmatch "while\\s*\\(\\s*\\$true\\s*\\)") "conductor contains infinite loop"
    Assert-True ($source -match "MaxIterations") "conductor missing iteration bound"
    Assert-True ($source -match "MaxRuntimeMinutes") "conductor missing runtime bound"

    [ordered]@{
        status = "pass"
        tests = 14
        dry_run_pass = $true
        rehearsal_pass = $true
        no_user_intervention = $true
        live_gpt_optional = $true
        blocked_lanes_park_and_continue = $true
        loop_bounded = $true
    } | ConvertTo-Json -Depth 10
} finally {
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
