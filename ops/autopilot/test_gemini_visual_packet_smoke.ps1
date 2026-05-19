$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_gemini_visual_packet_smoke_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Smoke {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("visual_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\gemini_visual_packet_smoke.ps1") `
        -MissionId A20BC_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "visual smoke exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $isolated = Join-Path $TempRoot "iteration_1_sacred_board_chamber.png"
    $contact = Join-Path $TempRoot "contact_sheet_full_night.png"
    [byte[]](137,80,78,71,13,10,26,10) | Set-Content -LiteralPath $isolated -Encoding Byte
    [byte[]](137,80,78,71,13,10,26,10) | Set-Content -LiteralPath $contact -Encoding Byte

    $find = Invoke-Smoke -Arguments @("-Mode", "FindEvidence", "-VisualEvidencePath", $isolated, "-NoPrompt")
    Assert-True ($find.status -eq "VISUAL_EVIDENCE_READY") "isolated screenshot not accepted"
    Assert-True ($find.isolated_screenshot_selected -eq $true) "isolated screenshot flag missing"

    $contactRejected = Invoke-Smoke -Arguments @("-Mode", "FindEvidence", "-VisualEvidencePath", $contact, "-NoPrompt")
    Assert-True ($contactRejected.status -eq "VISUAL_EVIDENCE_NOT_FOUND") "contact sheet should be rejected"

    $pass = Invoke-Smoke -Arguments @(
        "-Mode", "DryRun",
        "-VisualEvidencePath", $isolated,
        "-MockVisualPass",
        "-NoPrompt"
    )
    Assert-True ($pass.status -eq "GEMINI_VISUAL_PACKET_SMOKE_PASS") "mock visual packet should pass"
    Assert-True ($pass.decision_packet_produced -eq $true) "visual packet should produce decision packet"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\gemini_visual_packet_smoke.ps1") -Raw
    Assert-True ($source -match "contact") "contact sheet rejection missing"
    Assert-True ($source -notmatch "Read-Host") "visual smoke must not prompt"
    Assert-True ($source -notmatch "GEMINI_API_KEY|OPENAI_API_KEY|AIza") "visual smoke must not require API"

    [ordered]@{
        status = "pass"
        tests = 9
        isolated_screenshot_required = $true
        contact_sheet_rejected = $true
        no_api_call = $true
        no_user_prompt = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
