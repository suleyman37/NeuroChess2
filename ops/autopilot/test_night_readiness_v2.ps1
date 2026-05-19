$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_night_v2_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\night_readiness_v2.ps1") `
        -ArtifactPath $TempRoot `
        -OutPath (Join-Path $TempRoot "night.json") `
        -MaxIterations 6 `
        -MaxRuntimeMinutes 180 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "night readiness failed: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $result = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($result.status -in @("NIGHT_READY", "NIGHT_READY_LIMITED_PIXEL_REHEARSAL")) "unexpected readiness status"
    Assert-True ($result.checks.no_user_intervention_required -eq $true) "user intervention required"
    Assert-True ($result.checks.gpt_web_optional -eq $true) "GPT not optional"
    Assert-True ($result.checks.gemini_optional -eq $true) "Gemini not optional"
    Assert-True ($result.checks.bottleneck_detector_ready -eq $true) "bottleneck detector missing"
    Assert-True ($result.checks.utility_engine_ready -eq $true) "utility engine missing"
    Assert-True ($result.checks.proof_contracts_ready -eq $true) "proof contracts missing"
    Assert-True ($result.no_full_night_launched -eq $true) "full night launched"

    [ordered]@{
        status = "pass"
        tests = 8
        readiness = $result.status
        recommended_next = $result.recommended_next
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
