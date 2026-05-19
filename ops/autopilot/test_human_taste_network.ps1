$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20at_taste_network_test_" + [guid]::NewGuid().ToString("N"))
$SourceArtifact = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_arena\A20AS_tripled_variants_top2_20260518"

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

    $policy = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\human_taste_network_policy.yaml") -Raw
    Assert-True ($policy -match "pickfu:") "PickFu policy missing"
    Assert-True ($policy -match "useberry:") "Useberry policy missing"
    Assert-True ($policy -match "lyssna:") "Lyssna policy missing"
    Assert-True ($policy -match "maze:") "Maze policy missing"
    Assert-True ($policy -match "local_manual:") "local manual policy missing"
    Assert-True ($policy -match "no_human_claim_without_level_2:\s*true") "no-human-claim rule missing"
    Assert-True ($policy -match "mode:\s*export_only") "provider export-only policy missing"

    $build = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\build_taste_test_packets.ps1") -Arguments @(
        "-ArtifactPath", $SourceArtifact,
        "-Provider", "all",
        "-OutPath", $TempRoot,
        "-SyntheticPanel"
    )
    Assert-True ($build.status -eq "TASTE_TEST_PACKETS_READY") "packet build did not pass"
    Assert-True ($build.paid_submission_performed -eq $false) "paid submission happened"
    Assert-True ($build.crowd_validation_claim_allowed -eq $false) "crowd claim allowed without humans"
    Assert-True ($build.packet_count -ge 20) "too few packets generated"
    foreach ($provider in @("pickfu", "useberry", "lyssna", "maze", "local_manual")) {
        Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "provider_packets\$provider") -PathType Container) "$provider packet dir missing"
    }
    Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "local_vote_sheet.json") -PathType Leaf) "local vote json missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "local_vote_sheet.md") -PathType Leaf) "local vote md missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "synthetic_panel_report.json") -PathType Leaf) "synthetic panel report missing"

    $samplePacketPath = Join-Path $TempRoot "provider_packets\pickfu\sacred_board_chamber_preference.json"
    Assert-True (Test-Path -LiteralPath $samplePacketPath -PathType Leaf) "sample packet missing"
    $samplePacket = Get-Content -LiteralPath $samplePacketPath -Raw | ConvertFrom-Json
    Assert-True ($samplePacket.human_claim_allowed -eq $false) "sample packet permits human claim"
    Assert-True ($samplePacket.paid_submission_performed -eq $false) "sample packet submitted paid study"
    Assert-True ($samplePacket.primary_evidence_policy -eq "isolated_variant_screenshots_only") "packet primary evidence policy wrong"
    Assert-True (($samplePacket.variants[0].screenshot_path -match "NeuroChess_QA_Artifacts") -and ($samplePacket.variants[0].screenshot_path -notmatch "contact_sheets")) "packet does not use isolated external screenshot"

    $csvOut = Join-Path $TempRoot "normalized_csv.json"
    $importCsv = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\import_taste_results.ps1") -Arguments @(
        "-InputPath", (Join-Path $RepoRoot "ops\autopilot\taste_results.example.csv"),
        "-OutPath", $csvOut
    )
    Assert-True ($importCsv.accepted_count -eq 6) "example csv accepted count wrong"
    Assert-True ($importCsv.rejected_count -eq 0) "example csv rejected rows"

    $jsonOut = Join-Path $TempRoot "normalized_json.json"
    $importJson = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\import_taste_results.ps1") -Arguments @(
        "-InputPath", (Join-Path $RepoRoot "ops\autopilot\taste_results.example.json"),
        "-OutPath", $jsonOut
    )
    Assert-True ($importJson.accepted_count -eq 3) "example json accepted count wrong"

    $badCsv = Join-Path $TempRoot "bad_results.csv"
    @(
        "participant_id,provider,study_id,question_id,signature_id,variant_id,response,rating,email",
        "anon_bad,pickfu,study,variant_preference,sacred_board_chamber,,selected,7,person@example.com"
    ) | Set-Content -LiteralPath $badCsv -Encoding UTF8
    $badImport = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\import_taste_results.ps1") -Arguments @(
        "-InputPath", $badCsv,
        "-OutPath", (Join-Path $TempRoot "bad_normalized.json")
    )
    Assert-True ($badImport.accepted_count -eq 0) "bad row accepted"
    Assert-True ($badImport.rejected_count -eq 1) "bad row not rejected"
    $badReasons = ($badImport.rejected_results[0].reasons -join ",")
    Assert-True ($badReasons -match "missing_variant_id") "missing variant not detected"
    Assert-True ($badReasons -match "rating_out_of_range") "bad rating not detected"
    Assert-True ($badReasons -match "pii_field_email") "PII not detected"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\build_taste_test_packets.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "packet builder prompts"
    Assert-True ($source -notmatch "Invoke-RestMethod.*pickfu|Invoke-RestMethod.*useberry|Invoke-RestMethod.*lyssna|Invoke-RestMethod.*maze") "paid platform call detected"

    [ordered]@{
        status = "pass"
        tests = 24
        providers_supported = @("pickfu", "useberry", "lyssna", "maze", "local_manual")
        packets_created = $true
        importer = $true
        no_paid_calls = $true
        no_human_claim_without_data = $true
        synthetic_panel_provisional_only = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
