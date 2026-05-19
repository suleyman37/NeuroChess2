$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_omega_loop_test_" + [guid]::NewGuid().ToString("N"))
$StatePath = Join-Path $TempRoot "omega_state.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Omega {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_omega_autopilot.ps1") `
        -ArtifactPath $TempRoot `
        -StatePath $StatePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $dry = Invoke-Omega -Arguments @("-Mode", "DryRun", "-MissionId", "A20AU_TEST")
    Assert-True ($dry.status -eq "OMEGA_DRY_RUN_PASS") "dry run did not pass"
    Assert-True ($dry.completed_iterations -eq 1) "dry run iteration count wrong"
    Assert-True ($dry.no_user_intervention -eq $true) "dry run requires user"
    Assert-True ($dry.pixel_objective_included -eq $true) "dry run did not include pixel objective"
    Assert-True ($dry.contract_word_count_avg -lt 900) "contract too large"

    $rehearsal = Invoke-Omega -Arguments @("-Mode", "Rehearsal", "-MissionId", "A20AU_TEST", "-MaxIterations", "3")
    Assert-True ($rehearsal.status -eq "OMEGA_REHEARSAL_PASS") "rehearsal did not pass"
    Assert-True ($rehearsal.completed_iterations -eq 3) "rehearsal iteration count wrong"
    Assert-True (@($rehearsal.selected_objectives | Select-Object -Unique).Count -gt 1) "rehearsal did not progress objectives"
    Assert-True ($rehearsal.loop_bounded -eq $true) "loop not bounded"
    Assert-True ($rehearsal.no_live_web -eq $true) "live web should default off"

    $night = Invoke-Omega -Arguments @("-Mode", "NightCheck", "-MissionId", "A20AU_TEST") -AcceptExitCodes @(0,3)
    Assert-True ($night.status -in @("NIGHT_READY", "NIGHT_READY_LIMITED_PIXEL_REHEARSAL", "NIGHT_NOT_READY")) "night check bad status"

    $stop = Invoke-Omega -Arguments @("-Mode", "Stop", "-MissionId", "A20AU_TEST")
    Assert-True ($stop.stop_requested -eq $true) "stop flag not written"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_omega_autopilot.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "OMEGA prompts"
    Assert-True ($source -notmatch "while\\s*\\(\\s*\\$true\\s*\\)") "OMEGA infinite loop"

    [ordered]@{
        status = "pass"
        tests = 15
        dry_run_pass = $true
        rehearsal_pass = $true
        night_check_status = $night.status
        no_user_intervention = $true
        loop_bounded = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
