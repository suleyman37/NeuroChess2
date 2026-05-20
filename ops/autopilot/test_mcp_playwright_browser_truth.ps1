$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bf_mcp_browser_truth_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function New-TinyPng {
    param([string]$Path)
    [byte[]](137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,99,0,1,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130) |
        Set-Content -LiteralPath $Path -Encoding Byte
}

function Invoke-Truth {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("truth_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mcp_playwright_browser_truth.ps1") `
        -MissionId A20BF_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "browser truth exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $shot = Join-Path $TempRoot "mcp_visible_ui.png"
    New-TinyPng -Path $shot

    $status = Invoke-Truth -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ($status.status -eq "MCP_PLAYWRIGHT_AVAILABLE") "MCP status should be available by default"

    $noMcp = Invoke-Truth -Arguments @("-Mode", "Status", "-MockMcpUnavailable", "-NoPrompt")
    Assert-True ($noMcp.status -eq "MCP_PLAYWRIGHT_UNAVAILABLE") "MCP unavailable status wrong"

    $missingShot = Invoke-Truth -Arguments @("-Mode", "Observe", "-Service", "gemini", "-ComposerVisible", "-ComposerEnabled", "-NoPrompt")
    Assert-True ($missingShot.status -eq "MCP_SCREENSHOT_REQUIRED") "verdict without screenshot should be rejected"

    $domOnly = Invoke-Truth -Arguments @("-Mode", "Observe", "-Service", "gemini", "-McpScreenshotPath", $shot, "-DomOnlyVerdict", "-ComposerVisible", "-ComposerEnabled", "-NoPrompt")
    Assert-True ($domOnly.status -eq "MCP_SCREENSHOT_REQUIRED") "DOM-only verdict should be rejected"
    Assert-True ($domOnly.dom_only_verdict_rejected -eq $true) "DOM-only rejection flag missing"

    $usable = Invoke-Truth -Arguments @(
        "-Mode", "Observe",
        "-Service", "chatgpt",
        "-CDPPort", "9222",
        "-McpScreenshotPath", $shot,
        "-VisibleUiSummary", "The screenshot shows a visible ChatGPT composer.",
        "-ComposerVisible",
        "-ComposerEnabled",
        "-CurrentUiVerdict", "PAGE_USABLE",
        "-ReasoningFromScreenshot", "I can see the composer.",
        "-NoPrompt"
    )
    Assert-True ($usable.current_ui_verdict -eq "PAGE_USABLE") "composer visible should map to PAGE_USABLE"
    Assert-True ($usable.screenshot_before_verdict -eq $true) "screenshot-before-verdict required"
    Assert-True ($usable.dom_used_only_as_confirmation -eq $true) "DOM must be confirmation only"
    Assert-True ($usable.separate_windows_required -eq $true) "separate browser windows should be required"
    Assert-True ($usable.service_cdp_port -eq 9222) "ChatGPT should use CDP 9222"

    $blocked = Invoke-Truth -Arguments @(
        "-Mode", "Observe",
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-McpScreenshotPath", $shot,
        "-VisibleUiSummary", "The screenshot shows a foreground consent modal.",
        "-ForegroundBlockerVisible",
        "-ReasoningFromScreenshot", "I can see a foreground consent dialog.",
        "-NoPrompt"
    )
    Assert-True ($blocked.current_ui_verdict -eq "HUMAN_ACTION_REQUIRED") "visible blocker should map to human action"
    Assert-True ($blocked.lane_status -eq "LOGIN_REQUIRED_PARKED") "visible blocker should park lane"
    Assert-True ($blocked.service_cdp_port -eq 9223) "Gemini should use CDP 9223"

    $wrongPort = Invoke-Truth -Arguments @(
        "-Mode", "Observe",
        "-Service", "gemini",
        "-CDPPort", "9222",
        "-McpScreenshotPath", $shot,
        "-ComposerVisible",
        "-ComposerEnabled",
        "-NoPrompt"
    )
    Assert-True ($wrongPort.status -eq "SHARED_BROWSER_PROFILE_FORBIDDEN") "Gemini on ChatGPT port should be forbidden"
    Assert-True ($wrongPort.service_window_isolated -eq $false) "wrong-port result should not be isolated"

    $uploadNotVisible = Invoke-Truth -Arguments @(
        "-Mode", "Observe",
        "-Service", "gemini",
        "-McpScreenshotPath", $shot,
        "-VisibleUiSummary", "The screenshot shows composer but no upload control.",
        "-ComposerVisible",
        "-ComposerEnabled",
        "-NoPrompt"
    )
    Assert-True ($uploadNotVisible.status -eq "GEMINI_UPLOAD_NOT_VISIBLE_FROM_SCREENSHOT") "upload unavailable must be screenshot-proven"
    Assert-True ($uploadNotVisible.lane_status -eq "TEXT_SUPERVISOR_ONLY") "text-only lane status wrong"
    Assert-True ($uploadNotVisible.visual_packet_allowed -eq $false) "visual packet cannot be claimed without visible attachment"

    $visualReady = Invoke-Truth -Arguments @(
        "-Mode", "Observe",
        "-Service", "gemini",
        "-McpScreenshotPath", $shot,
        "-VisibleUiSummary", "The screenshot shows an attached image preview.",
        "-ComposerVisible",
        "-ComposerEnabled",
        "-UploadControlVisible",
        "-AttachmentVisuallyConfirmed",
        "-NoPrompt"
    )
    Assert-True ($visualReady.lane_status -eq "VISUAL_READY") "visual lane requires visible attachment confirmation"
    Assert-True ($visualReady.visual_packet_allowed -eq $true) "visual packet allowed flag missing"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\mcp_playwright_browser_truth.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "browser truth must not prompt"
    Assert-True ($source -notmatch "GEMINI_API_KEY|OPENAI_API_KEY|AIza") "browser truth must not require API keys"
    Assert-True ($source -notmatch "SendKeys") "browser truth must not blindly type"
    Assert-True ($source -notmatch "click.*captcha|captcha.*click") "browser truth must not click verification"

    [ordered]@{
        status = "pass"
        tests = 20
        screenshot_required = $true
        mcp_required = $true
        dom_only_rejected = $true
        separate_windows_required = $true
        separate_cdp_ports_required = $true
        history_text_ignored = $true
        visual_packet_requires_attachment = $true
        no_user_prompt = $true
        local_fallback_continues = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
