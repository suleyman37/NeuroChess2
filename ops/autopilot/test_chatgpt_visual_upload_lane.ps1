$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20v_chatgpt_upload_lane_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

try {
    $fixtureAttachment = Join-Path $TempRoot "contact_sheet_fixture.png"
    [System.IO.File]::WriteAllBytes($fixtureAttachment, [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))

    $captureOut = Join-Path $TempRoot "capture"
    $captureOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") `
        -MissionId A20V_TEST_UPLOAD_LANE `
        -EvidencePath "fixture/a20p" `
        -OutputPath $captureOut `
        -ContactSheetPath $fixtureAttachment `
        -Mode SAFE_LIVE_READONLY_MODE `
        -MaxWaitSeconds 5 `
        -AllowOneJsonCorrection false 2>&1
    $capture = $captureOutput | Out-String | ConvertFrom-Json

    Assert-True ($capture.capture_result -eq "UPLOAD_LANE_UNAVAILABLE") "disabled bridge did not stop as upload unavailable"
    Assert-True ($capture.live_chatgpt_called -eq $false) "disabled bridge attempted live ChatGPT"
    Assert-True ($capture.approved_upload_lane_available -eq $false) "disabled bridge reported approved upload lane"
    Assert-True ($capture.attachment_count -eq 1) "contact sheet parameter was not counted"
    Assert-True ($capture.stop_reason -eq "chatgpt_web_bridge.enabled=false") "unexpected stop reason"

    [ordered]@{
        status = "pass"
        tests = 5
        disabled_bridge_returns_upload_lane_unavailable = $true
        live_chatgpt_called = $false
        product_mission_executed = $false
        browser_required = $false
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
