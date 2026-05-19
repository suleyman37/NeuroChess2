$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_stagnation_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $scorePath = Join-Path $TempRoot "score_state_fixture.json"
    @'
{
  "schema_version": "autonomy_score_state_v1",
  "updated_by": "A20AT_HUMAN_TASTE_NETWORK_CROWD_VALIDATION_ROUTER",
  "scores": {
    "visual_production": 18.0,
    "overall": 18.9
  }
}
'@ | Set-Content -LiteralPath $scorePath -Encoding UTF8
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\anti_stagnation_sentinel.ps1") -ScorePath $scorePath -OutPath (Join-Path $TempRoot "anti.json") 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "sentinel failed: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $result = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($result.status -eq "ANTI_STAGNATION_CHECK_COMPLETE") "status wrong"
    Assert-True ($result.no_pixel_progress_risk -eq $true) "no-pixel risk missing"
    Assert-True (($result.actions -contains "FORCE_PIXEL_MISSION")) "force pixel action missing"
    Assert-True (($result.forbid_repeating_objectives -contains "pure_docs_only")) "docs-only not forbidden"
    Assert-True ($result.limited_rehearsal_allowed -eq $true) "limited rehearsal should be allowed"
    Assert-True ($result.loop_continues -eq $true) "loop should continue"

    [ordered]@{
        status = "pass"
        tests = 6
        actions = $result.actions
        recommended_next = $result.recommended_next
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
