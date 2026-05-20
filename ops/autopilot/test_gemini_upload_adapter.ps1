$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20be_gemini_upload_adapter_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function New-TinyPng {
    param([string]$Path)
    [byte[]](137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130) |
        Set-Content -LiteralPath $Path -Encoding Byte
}

function Invoke-Upload {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("upload_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\gemini_upload_adapter.ps1") `
        -MissionId A20BE_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "upload adapter exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $isolated = Join-Path $TempRoot "iteration_1_board_readability.png"
    $contact = Join-Path $TempRoot "contact_sheet_true_overnight.png"
    New-TinyPng -Path $isolated
    New-TinyPng -Path $contact

    $find = Invoke-Upload -Arguments @("-Mode", "FindEvidence", "-VisualEvidencePath", $isolated, "-NoPrompt")
    Assert-True ($find.status -eq "VISUAL_EVIDENCE_READY") "isolated screenshot should be accepted"
    Assert-True ($find.contact_sheet_rejected -eq $true) "contact sheet policy flag missing"

    $contactRejected = Invoke-Upload -Arguments @("-Mode", "FindEvidence", "-VisualEvidencePath", $contact, "-NoPrompt")
    Assert-True ($contactRejected.status -eq "VISUAL_EVIDENCE_NOT_FOUND") "contact sheet should be rejected as primary visual evidence"

    $native = Invoke-Upload -Arguments @("-Mode", "RunAdapters", "-VisualEvidencePath", $isolated, "-DryRun", "-MockNativeFileInputWorks", "-NoPrompt")
    Assert-True ($native.status -eq "GEMINI_UPLOAD_CONFIRMED") "native file input fixture should confirm upload"
    Assert-True ($native.successful_adapter -eq "native_file_input") "native adapter not recorded"
    Assert-True ($native.attachment_confirmed -eq $true) "attachment confirmation missing"

    $chooser = Invoke-Upload -Arguments @("-Mode", "RunAdapters", "-VisualEvidencePath", $isolated, "-DryRun", "-MockFileChooserWorks", "-NoPrompt")
    Assert-True ($chooser.status -eq "GEMINI_UPLOAD_CONFIRMED") "file chooser fixture should confirm upload"
    Assert-True ($chooser.successful_adapter -eq "file_chooser") "file chooser adapter not recorded"

    $drag = Invoke-Upload -Arguments @("-Mode", "RunAdapters", "-VisualEvidencePath", $isolated, "-DryRun", "-MockDragDropWorks", "-NoPrompt")
    Assert-True ($drag.status -eq "GEMINI_UPLOAD_CONFIRMED") "drag/drop fixture should confirm upload when mocked"
    Assert-True ($drag.successful_adapter -eq "drag_drop") "drag/drop adapter not recorded"

    $clip = Invoke-Upload -Arguments @("-Mode", "RunAdapters", "-VisualEvidencePath", $isolated, "-DryRun", "-MockClipboardWorks", "-NoPrompt")
    Assert-True ($clip.status -eq "GEMINI_UPLOAD_CONFIRMED") "clipboard fixture should confirm upload when mocked"
    Assert-True ($clip.successful_adapter -eq "clipboard_paste") "clipboard adapter not recorded"

    $unavailable = Invoke-Upload -Arguments @("-Mode", "RunAdapters", "-VisualEvidencePath", $isolated, "-DryRun", "-MockUploadUnavailable", "-NoPrompt")
    Assert-True ($unavailable.status -eq "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED") "upload unavailable should be diagnosed"
    Assert-True ($unavailable.decision_packet_produced -eq $false) "text-only/unavailable lane must not produce visual decision packet"
    Assert-True ($unavailable.lane_status -eq "AVAILABLE_TEXT_ONLY_UPLOAD_UNAVAILABLE") "text-only lane status wrong"

    $packet = Invoke-Upload -Arguments @("-Mode", "SendVisualPacket", "-VisualEvidencePath", $isolated, "-DryRun", "-MockNativeFileInputWorks", "-MockVisualResponseValid", "-NoPrompt")
    Assert-True ($packet.status -eq "GEMINI_VISUAL_PACKET_READY") "valid visual response should produce visual-ready status"
    Assert-True ($packet.decision_packet_produced -eq $true) "valid visual response should write a decision packet"
    Assert-True ($packet.prompt_sent -eq $true) "prompt should be sent after attachment only"
    Assert-True (($packet.adapter_attempts | Where-Object { $_.prompt_sent_before_attachment -eq $true }).Count -eq 0) "prompt was sent before attachment confirmation"

    $wrongPort = Invoke-Upload -Arguments @("-Mode", "DryRun", "-VisualEvidencePath", $isolated, "-CDPPort", "9222", "-NoPrompt")
    Assert-True ($wrongPort.status -eq "GEMINI_SHARED_PROFILE_FORBIDDEN") "Gemini upload must forbid ChatGPT CDP port"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\gemini_upload_adapter.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "upload adapter must not prompt"
    Assert-True ($source -notmatch "GEMINI_API_KEY|OPENAI_API_KEY|AIza") "upload adapter must not require API keys"
    Assert-True ($source -notmatch "click.*captcha|captcha.*click") "upload adapter must not click verification"
    Assert-True ($source -notmatch "SendKeys") "upload adapter must not blindly type"

    [ordered]@{
        status = "pass"
        tests = 24
        gemini_port_9223_only = $true
        adapters_ordered = $true
        no_prompt_before_attachment = $true
        contact_sheet_rejected = $true
        text_only_not_visual_judge = $true
        no_api_call = $true
        no_user_prompt = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
