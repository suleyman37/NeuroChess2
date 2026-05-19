$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ScriptPath = Join-Path $RepoRoot "ops\autopilot\full_night_score_guard.ps1"

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

$pass = Invoke-Guard -Arguments @("-PreviousOverall", "19.5", "-NewOverall", "19.5", "-ScreenshotCount", "6", "-MissionDoctorPassCount", "6", "-TestsPassed", "-RequestedLabel", "FULL_NIGHT_REHEARSAL_CONFIRMED")
Assert-True ($pass.status -eq "SCORE_GUARD_PASS") "valid confirmation should pass"

$noProof = Invoke-Guard -Arguments @("-PreviousOverall", "19.35", "-NewOverall", "19.5", "-ScreenshotCount", "0", "-MissionDoctorPassCount", "0", "-TestsPassed") -AcceptExitCodes @(5)
Assert-True (@($noProof.violations) -contains "overall_increase_without_proof") "overall increase without proof not blocked"

$noScreenshot = Invoke-Guard -Arguments @("-PreviousVisual", "18.8", "-NewVisual", "19.0", "-ScreenshotCount", "0", "-MissionDoctorPassCount", "5", "-TestsPassed") -AcceptExitCodes @(5)
Assert-True (@($noScreenshot.violations) -contains "visual_increase_without_screenshot") "visual increase without screenshot not blocked"

$noTests = Invoke-Guard -Arguments @("-PreviousNightReadiness", "19.2", "-NewNightReadiness", "19.5", "-ScreenshotCount", "6", "-MissionDoctorPassCount", "6") -AcceptExitCodes @(5)
Assert-True (@($noTests.violations) -contains "night_readiness_increase_without_tests") "night readiness increase without tests not blocked"

$tooHigh = Invoke-Guard -Arguments @("-PreviousOverall", "19.5", "-NewOverall", "19.6", "-ScreenshotCount", "8", "-MissionDoctorPassCount", "8", "-TestsPassed", "-RequestedLabel", "FULL_NIGHT_CONFIRMED_19_5") -AcceptExitCodes @(5)
Assert-True (@($tooHigh.violations) -contains "overall_above_19_5_not_allowed") "score above 19.5 not blocked"

$humanClaim = Invoke-Guard -Arguments @("-RequestedLabel", "HUMAN_CROWD_CONFIRMED", "-ScreenshotCount", "6", "-MissionDoctorPassCount", "6", "-TestsPassed") -AcceptExitCodes @(5)
Assert-True (@($humanClaim.violations) -contains "human_validation_claim_without_human_data") "human claim without human data not blocked"

$source = Get-Content -LiteralPath $ScriptPath -Raw
Assert-True ($source -notmatch "20/20 claim allowed") "score guard appears to allow 20/20"

[ordered]@{
    status = "pass"
    tests = 8
    score_guard = "ready"
} | ConvertTo-Json -Depth 8
