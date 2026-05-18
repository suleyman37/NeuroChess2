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

    $captureSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") -Raw
    $probeSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\browser\chatgpt_file_input_visual_probe.mjs") -Raw
    Assert-True ($captureSource -match "UploadAdapter") "capture script missing upload adapter parameter"
    Assert-True ($captureSource -match "RequireAttachmentConfirmation") "capture script missing attachment confirmation gate"
    Assert-True ($captureSource -match "RequireImageAwareCanary") "capture script missing canary gate"
    Assert-True ($captureSource -match "HumanVerificationPauseResumeEnabled") "capture script missing human resume flag"
    Assert-True ($captureSource -match "C10_CHATGPT_VALID_CANARY_JSON_CAPTURED") "capture script missing C10 canary success status"
    Assert-True ($captureSource -match "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" -and $captureSource -match "HUMAN_VERIFICATION_EMAIL_SENT_TIMEOUT_EXPIRED") "attachment gate must preserve human-verification safety stops"
    Assert-True ($probeSource -match "connectOverCDP") "file input probe must reuse existing CDP browser"
    Assert-True ($probeSource -notmatch "launchPersistentContext") "file input probe must avoid persistent context launch"
    Assert-True ($probeSource -match 'input\[type="file"\]') "file input probe must query file inputs"
    Assert-True ($probeSource -match "setInputFiles") "file input probe must use Playwright file input assignment"
    Assert-True ($probeSource -match "resumeCheckOnly") "file input probe must support read-only resume checks"

    [ordered]@{
        status = "pass"
        tests = 16
        disabled_bridge_returns_upload_lane_unavailable = $true
        live_chatgpt_called = $false
        product_mission_executed = $false
        browser_required = $false
        cdp_file_input_probe_present = $true
        persistent_context_avoided = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
