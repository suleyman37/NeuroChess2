$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ScriptPath = Join-Path $RepoRoot "ops\autopilot\final_full_night_go_no_go.ps1"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ax_go_no_go_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Gate {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $ready = Invoke-Gate -Arguments @(
        "-MissionId", "A20AX_TEST",
        "-ProposedFullNightBranch", "auto/a20ay-full-night-real-pixel-run-20260518-235959",
        "-OutPath", (Join-Path $TempRoot "ready.json")
    )
    Assert-True ($ready.status -eq "READY_FOR_FULL_NIGHT") "go/no-go should be ready from A20AW candidate"
    Assert-True ($ready.allowed_next_mission -eq "A20AY_FULL_NIGHT_REAL_PIXEL_RUN") "wrong next mission when ready"
    Assert-True ($ready.ready_for_full_night -eq $true) "ready flag false"

    $badBranch = Invoke-Gate -Arguments @(
        "-MissionId", "A20AX_TEST",
        "-ProposedFullNightBranch", "road-to-V2",
        "-OutPath", (Join-Path $TempRoot "bad_branch.json")
    )
    Assert-True ($badBranch.status -eq "READY_FOR_LIMITED_SECOND_REHEARSAL") "bad branch should downgrade readiness"
    Assert-True (@($badBranch.violations) -contains "branch_quarantine_invalid") "bad branch violation missing"

    $missingReport = Invoke-Gate -Arguments @(
        "-MissionId", "A20AX_TEST",
        "-A20AWReportPath", (Join-Path $TempRoot "missing_a20aw.md"),
        "-OutPath", (Join-Path $TempRoot "missing_report.json")
    ) -AcceptExitCodes @(9)
    Assert-True ($missingReport.status -eq "NO_GO") "missing A20AW evidence should be NO_GO"
    Assert-True (@($missingReport.violations) -contains "a20aw_not_full_night_candidate") "missing report violation absent"

    $source = Get-Content -LiteralPath $ScriptPath -Raw
    Assert-True ($source -notmatch "Read-Host") "go/no-go prompts"
    Assert-True ($source -match "A20AY_FULL_NIGHT_REAL_PIXEL_RUN") "go/no-go does not name allowed next mission"

    [ordered]@{
        status = "pass"
        tests = 8
        go_no_go = "ready"
    } | ConvertTo-Json -Depth 8
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
