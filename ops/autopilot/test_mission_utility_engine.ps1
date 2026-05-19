$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_utility_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $bottleneck = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\bottleneck_detector.ps1") -Arguments @("-OutPath", (Join-Path $TempRoot "bottleneck.json"))
    Assert-True ($bottleneck.pixel_mandate_active -eq $true) "fixture bottleneck should activate pixels"

    $ranking = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\mission_utility_engine.ps1") -Arguments @(
        "-BottleneckPath", (Join-Path $TempRoot "bottleneck.json"),
        "-OutPath", (Join-Path $TempRoot "ranking.json")
    )
    Assert-True ($ranking.status -eq "MISSION_UTILITY_WINNER_SELECTED") "ranking did not pass"
    Assert-True ($ranking.winner.id -eq "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS") "unexpected winner"
    Assert-True ($ranking.winner.total_utility -gt 0) "winner utility not positive"
    Assert-True ($ranking.no_unsafe_candidate_selected -eq $true) "unsafe selected"
    Assert-True (@($ranking.ranked_candidates).Count -ge 5) "too few candidates"
    Assert-True (($ranking.winner.explanation -contains "pixel_mandate_boost")) "winner missing pixel boost"

    $avoid = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\mission_utility_engine.ps1") -Arguments @(
        "-BottleneckPath", (Join-Path $TempRoot "bottleneck.json"),
        "-AvoidObjectiveIds", "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS",
        "-OutPath", (Join-Path $TempRoot "ranking_avoid.json")
    )
    Assert-True ($avoid.winner.id -ne "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS") "avoid objective ignored"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\mission_utility_engine.ps1") -Raw
    Assert-True ($source -match "Impact\*Confidence") "formula missing"
    Assert-True ($source -notmatch "Read-Host") "utility engine prompts"

    [ordered]@{
        status = "pass"
        tests = 10
        winner = $ranking.winner.id
        avoid_winner = $avoid.winner.id
        pixel_mandate_active = $ranking.pixel_mandate_active
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
