$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bd_playwright_visual_control_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Visual {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("visual_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\playwright_visual_control.ps1") `
        -MissionId A20BD_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "visual control exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    Assert-True ($text.IndexOf("{") -ge 0) "visual control did not emit JSON"
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $chatgpt = Invoke-Visual -Arguments @(
        "-Mode", "CaptureState",
        "-Service", "chatgpt",
        "-CDPPort", "9222",
        "-MockClassification", "PAGE_USABLE",
        "-MockComposerVisible",
        "-NoPrompt"
    )
    Assert-True ($chatgpt.classification -eq "PAGE_USABLE") "ChatGPT composer visible should be usable"
    Assert-True ($chatgpt.composer_visible -eq $true) "composer visibility missing"
    Assert-True ($chatgpt.screenshot_before_verdict -eq $true) "screenshot must precede verdict"
    Assert-True ($chatgpt.dom_probe_before_verdict -eq $true) "DOM probe must precede verdict"
    Assert-True ($chatgpt.history_text_ignored -eq $true) "history text must be ignored"
    Assert-True ($chatgpt.playwright_fallback_used -eq $true) "Playwright fallback should be declared"

    $human = Invoke-Visual -Arguments @(
        "-Mode", "ClassifyPage",
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-MockClassification", "HUMAN_ACTION_REQUIRED",
        "-NoPrompt"
    )
    Assert-True ($human.classification -eq "HUMAN_ACTION_REQUIRED") "foreground blocker should require human action"
    Assert-True ($human.foreground_blocker_detected -eq $true) "blocker evidence missing"
    Assert-True ($human.recommended_action -eq "SEND_ALERT") "human action should send alert"

    $wrongAccount = Invoke-Visual -Arguments @(
        "-Mode", "ClassifyPage",
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-MockClassification", "WRONG_ACCOUNT_OR_PLAN",
        "-MockWrongAccount",
        "-NoPrompt"
    )
    Assert-True ($wrongAccount.classification -eq "WRONG_ACCOUNT_OR_PLAN") "wrong account/plan should be classified"
    Assert-True ($wrongAccount.recommended_action -eq "PARK_LANE") "wrong account/plan should park lane"
    Assert-True ($wrongAccount.account_email_redacted -eq $true) "account details must be redacted"

    $model = Invoke-Visual -Arguments @(
        "-Mode", "FindModelSelector",
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-MockComposerVisible",
        "-MockModelSelectorVisible",
        "-NoPrompt"
    )
    Assert-True ($model.classification -eq "MODEL_SELECTOR_AVAILABLE") "model selector should be reported"

    $upload = Invoke-Visual -Arguments @(
        "-Mode", "FindUploadControl",
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-MockComposerVisible",
        "-MockUploadControlVisible",
        "-NoPrompt"
    )
    Assert-True ($upload.classification -eq "UPLOAD_AVAILABLE") "upload control should be reported"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\playwright_visual_control.ps1") -Raw
    Assert-True ($source -notmatch "SendKeys") "visual control must not blindly type"
    Assert-True ($source -notmatch "click.*captcha|captcha.*click") "visual control must not click verification"
    Assert-True ($source -notmatch "OPENAI_API_KEY|GEMINI_API_KEY|AIza") "visual control must not use API keys"
    Assert-True ($source -match "body_text_redacted") "DOM probe must redact body text"

    [ordered]@{
        status = "pass"
        tests = 18
        screenshots_before_verdict = $true
        composer_first_classification = $true
        history_text_ignored = $true
        wrong_account_parks_lane = $true
        playwright_fallback = $true
        no_blind_typing = $true
        no_bypass = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
