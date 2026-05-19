$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20at_taste_confidence_test_" + [guid]::NewGuid().ToString("N"))

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
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "script did not emit JSON: $ScriptPath"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $noData = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\compute_taste_confidence.ps1") -Arguments @(
        "-OutPath", (Join-Path $TempRoot "no_data.json")
    )
    Assert-True ($noData.status -eq "NO_DATA") "no-data status wrong"
    Assert-True ($noData.overall_claim_status -eq "HUMAN_DATA_ABSENT") "no-data claim status wrong"
    Assert-True ($noData.crowd_validation_claim_allowed -eq $false) "crowd claim allowed with no data"

    $normalizedSmall = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\import_taste_results.ps1") -Arguments @(
        "-InputPath", (Join-Path $RepoRoot "ops\autopilot\taste_results.example.csv"),
        "-OutPath", (Join-Path $TempRoot "normalized_small.json")
    )
    Assert-True ($normalizedSmall.accepted_count -eq 6) "small import failed"
    $smallConfidence = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\compute_taste_confidence.ps1") -Arguments @(
        "-ResultsPath", (Join-Path $TempRoot "normalized_small.json"),
        "-OutPath", (Join-Path $TempRoot "small_confidence.json")
    )
    Assert-True ($smallConfidence.validation_level -eq "LEVEL_1_OWNER") "local manual should be owner/local level"
    Assert-True ($smallConfidence.crowd_validation_claim_allowed -eq $false) "small local data allowed crowd claim"
    Assert-True (($smallConfidence.confidence_label -in @("INSUFFICIENT_SAMPLE", "PROVISIONAL"))) "small confidence label wrong"

    $crowdRows = @()
    for ($i = 1; $i -le 32; $i++) {
        $participantId = "crowd_{0:D3}" -f $i
        $crowdRows += [ordered]@{ participant_id = $participantId; provider = "pickfu"; study_id = "study_majority"; question_id = "variant_preference"; signature_id = "sacred_board_chamber"; variant_id = "B"; response = "selected"; rating = 5 }
        $crowdRows += [ordered]@{ participant_id = $participantId; provider = "pickfu"; study_id = "study_majority"; question_id = "weirdness_rejection"; signature_id = "sacred_board_chamber"; variant_id = "B"; response = "No"; rating = 5 }
        $crowdRows += [ordered]@{ participant_id = $participantId; provider = "pickfu"; study_id = "study_majority"; question_id = "board_readability"; signature_id = "sacred_board_chamber"; variant_id = "B"; response = "Yes"; rating = 5 }
    }
    $crowdPath = Join-Path $TempRoot "crowd_results.json"
    [ordered]@{ normalized_results = $crowdRows } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $crowdPath -Encoding UTF8
    $majority = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\compute_taste_confidence.ps1") -Arguments @(
        "-ResultsPath", $crowdPath,
        "-OutPath", (Join-Path $TempRoot "majority_confidence.json")
    )
    Assert-True ($majority.validation_level -eq "LEVEL_2_CROWD") "crowd level not detected"
    Assert-True ($majority.confidence_label -eq "MAJORITY_SUPPORTED") "majority label wrong"
    Assert-True ($majority.crowd_validation_claim_allowed -eq $true) "crowd majority should be claimable"
    Assert-True ($majority.no_95_percent_claim -eq $true) "95 percent claim rule missing"

    $badRows = @()
    for ($i = 1; $i -le 30; $i++) {
        $participantId = "bad_{0:D3}" -f $i
        $response = if ($i -le 8) { "Yes" } else { "No" }
        $badRows += [ordered]@{ participant_id = $participantId; provider = "useberry"; study_id = "study_bad"; question_id = "weirdness_rejection"; signature_id = "decision_feedback_language"; variant_id = "C"; response = $response; rating = 3 }
        $badRows += [ordered]@{ participant_id = $participantId; provider = "useberry"; study_id = "study_bad"; question_id = "board_readability"; signature_id = "decision_feedback_language"; variant_id = "C"; response = "Yes"; rating = 4 }
    }
    $badPath = Join-Path $TempRoot "bad_crowd_results.json"
    [ordered]@{ normalized_results = $badRows } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $badPath -Encoding UTF8
    $failed = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\compute_taste_confidence.ps1") -Arguments @(
        "-ResultsPath", $badPath,
        "-OutPath", (Join-Path $TempRoot "failed_confidence.json")
    )
    Assert-True ($failed.confidence_label -eq "HUMAN_VALIDATION_FAILED") "weirdness failure not detected"
    Assert-True ($failed.crowd_validation_claim_allowed -eq $false) "failed validation allowed claim"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\compute_taste_confidence.ps1") -Raw
    Assert-True ($source -match "wilson_lower_bound") "Wilson confidence method missing"
    Assert-True ($source -notmatch "universal appeal.*95 percent") "forbidden fake 95 claim found"

    [ordered]@{
        status = "pass"
        tests = 18
        no_data = $true
        insufficient_or_provisional_local = $true
        majority_supported = $true
        weirdness_failure = $true
        no_fake_95_claim = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
