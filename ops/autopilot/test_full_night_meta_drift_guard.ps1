$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ScriptPath = Join-Path $RepoRoot "ops\autopilot\full_night_meta_drift_guard.ps1"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ax_meta_drift_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Guard {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $pixel = Invoke-Guard -Arguments @("-ObjectiveId", "A20AY_BUILD_NORTH_STAR_REVIEW_MICRO_FLOW", "-VisualProductionBottleneck")
    Assert-True ($pixel.status -eq "META_DRIFT_GUARD_PASS") "pixel objective should pass"

    $frontendPixel = Invoke-Guard -Arguments @("-ObjectiveId", "A20AY_REFACTOR_TEXT", "-ChangedFiles", "frontend/src/dev/full-night/FullNight.tsx", "-VisualProductionBottleneck")
    Assert-True ($frontendPixel.status -eq "META_DRIFT_GUARD_PASS") "frontend dev visual file should count as pixel evidence"

    $reject = Invoke-Guard -Arguments @("-ObjectiveId", "A20AY_WRITE_MORE_DOCS", "-ChangedFiles", "docs/autopilot/report.md", "-VisualProductionBottleneck") -AcceptExitCodes @(4)
    Assert-True ($reject.status -eq "OBJECTIVE_REJECTED_NON_PIXEL") "non-pixel objective should be rejected under visual bottleneck"

    $iterationsPath = Join-Path $TempRoot "iterations.json"
    [ordered]@{
        iterations = @(
            [ordered]@{ objective = "A20AY_DOCS_ONLY"; changed_files = @("docs/autopilot/a.md") },
            [ordered]@{ objective = "A20AY_SCORE_ONLY"; changed_files = @("ops/autopilot/autonomy_score_state.json") }
        )
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $iterationsPath -Encoding UTF8
    $stop = Invoke-Guard -Arguments @("-IterationPath", $iterationsPath) -AcceptExitCodes @(3)
    Assert-True ($stop.status -eq "META_DRIFT_STOP") "two consecutive non-pixel iterations should stop"

    $source = Get-Content -LiteralPath $ScriptPath -Raw
    Assert-True ($source -notmatch "Read-Host") "meta drift guard prompts"

    [ordered]@{
        status = "pass"
        tests = 6
        meta_drift_guard = "ready"
    } | ConvertTo-Json -Depth 8
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
