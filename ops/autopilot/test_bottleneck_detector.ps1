$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_bottleneck_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Detector {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\bottleneck_detector.ps1") @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $scorePath = Join-Path $TempRoot "score_state_fixture.json"
    @'
{
  "schema_version": "autonomy_score_state_v1",
  "updated_by": "A20AT_HUMAN_TASTE_NETWORK_CROWD_VALIDATION_ROUTER",
  "scores": {
    "safety_git": 18.7,
    "operator_zero_friction": 18.0,
    "web_orchestrator": 18.1,
    "external_judge_reliability": 18.5,
    "autonomous_loop": 15.0,
    "visual_production": 18.0,
    "art_direction_concrete": 18.2,
    "evidence_quality": 18.3,
    "night_readiness": 17.5,
    "human_taste_calibration_readiness": 18.0,
    "overall": 18.9
  }
}
'@ | Set-Content -LiteralPath $scorePath -Encoding UTF8
    $result = Invoke-Detector -Arguments @("-ScorePath", $scorePath, "-OutPath", (Join-Path $TempRoot "bottleneck.json"))

    Assert-True ($result.status -eq "BOTTLENECK_DETECTED") "status wrong"
    Assert-True ($result.primary_bottleneck -eq "autonomous_loop") "lowest score not detected"
    Assert-True ($result.pixel_mandate_active -eq $true) "pixel mandate should be active"
    Assert-True ($result.recommended_lane -eq "pixel_production") "wrong recommended lane"
    Assert-True ($result.recommended_objective -eq "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS") "wrong recommended objective"
    Assert-True (($result.must_not_do -contains "do_not_block_on_live_web")) "missing live-web stop"
    Assert-True ($result.signature_status_stagnation -eq $true) "signature stagnation not detected"
    Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "bottleneck.json") -PathType Leaf) "output file missing"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\bottleneck_detector.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "detector prompts"

    [ordered]@{
        status = "pass"
        tests = 9
        primary_bottleneck = $result.primary_bottleneck
        pixel_mandate_active = $result.pixel_mandate_active
        recommended_objective = $result.recommended_objective
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
