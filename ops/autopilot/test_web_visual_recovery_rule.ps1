$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "web_visual_recovery_rule.ps1"
$artifactRoot = Join-Path $env:TEMP ("neurochess_a20bg_web_visual_recovery_test_{0}" -f [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Rule {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "web_visual_recovery_rule.ps1 failed: $($output | Out-String)"
    }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function New-TestPng {
    param([string]$Path)
    $dir = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=")
    [System.IO.File]::WriteAllBytes($Path, $bytes)
}

try {
    $status = Invoke-Rule -Arguments @("-Mode", "Status", "-MissionId", "A20BG", "-ArtifactPath", $artifactRoot, "-NoPrompt")
    Assert-True ($status.status -eq "WEB_VISUAL_RECOVERY_RULE_AVAILABLE") "Status should expose the recovery rule."
    Assert-True ($status.chatgpt_cdp_port -eq 9222 -and $status.gemini_cdp_port -eq 9223) "ChatGPT and Gemini must use separate CDP ports."
    Assert-True ([bool]$status.separate_windows_required) "Separate windows/profiles must be required."

    $missingShot = Invoke-Rule -Arguments @(
        "-Mode", "RecordRecovery",
        "-MissionId", "A20BG",
        "-ArtifactPath", $artifactRoot,
        "-Service", "chatgpt",
        "-CDPPort", "9222",
        "-ActionAttempted", "send",
        "-FailureOrAmbiguity", "ambiguous",
        "-NoPrompt"
    )
    Assert-True ($missingShot.status -eq "MCP_SCREENSHOT_REQUIRED") "Recovery verdict without screenshot must be rejected."

    $wrongPortShot = Join-Path $artifactRoot "screenshots\wrong_port.png"
    New-TestPng -Path $wrongPortShot
    $wrongPort = Invoke-Rule -Arguments @(
        "-Mode", "RecordRecovery",
        "-MissionId", "A20BG",
        "-ArtifactPath", $artifactRoot,
        "-Service", "gemini",
        "-CDPPort", "9222",
        "-ScreenshotBefore", $wrongPortShot,
        "-NoPrompt"
    )
    Assert-True ($wrongPort.status -eq "SHARED_BROWSER_PROFILE_FORBIDDEN") "Gemini on ChatGPT port must be rejected."

    $goodShot = Join-Path $artifactRoot "screenshots\gemini\current_ui.png"
    New-TestPng -Path $goodShot
    $recorded = Invoke-Rule -Arguments @(
        "-Mode", "RecordRecovery",
        "-MissionId", "A20BG",
        "-ArtifactPath", $artifactRoot,
        "-Service", "gemini",
        "-CDPPort", "9223",
        "-ActionAttempted", "upload",
        "-FailureOrAmbiguity", "upload ambiguous",
        "-ScreenshotBefore", $goodShot,
        "-VisibleUiAnalysis", "I can see the Gemini composer. The likely next action is to inspect the visible import button.",
        "-RevisedAction", "retry upload once",
        "-Result", "success",
        "-NoPrompt"
    )
    Assert-True ($recorded.status -eq "WEB_VISUAL_RECOVERY_EVENT_RECORDED") "Valid screenshot-backed recovery event should be recorded."
    Assert-True ([bool]$recorded.event.screenshot_external) "Screenshots must be external artifacts."
    Assert-True ([bool]$recorded.event.no_blind_retry) "Recovery must forbid blind retry."

    $dry = Invoke-Rule -Arguments @("-Mode", "DryRun", "-MissionId", "A20BG", "-ArtifactPath", $artifactRoot, "-NoPrompt")
    Assert-True ($dry.web_visual_recovery_rule_ready) "Dry run should mark recovery rule ready."
    Assert-True ($dry.screenshots_before_revised_action) "Dry run must preserve screenshot-before-revised-action rule."
    Assert-True ($dry.chatgpt.attempts -eq 4) "Dry run should target four ChatGPT attempts."
    Assert-True ($dry.chatgpt.successful_decision_packets -ge 2) "Dry run should prove at least two ChatGPT packets."
    Assert-True ($dry.gemini.visual_packet_ready) "Dry run should prove Gemini visual packet path."
    Assert-True ($dry.pixel_work.visible_pixel_deltas -ge 2) "Dry run must produce at least two visible pixel deltas."
    Assert-True ($dry.safety.local_fallback_available) "Local OMEGA fallback must remain available."

    $events = Get-Content -LiteralPath (Join-Path $artifactRoot "web_visual_recovery_events.json") -Raw | ConvertFrom-Json
    Assert-True (@($events.events).Count -ge 3) "Recovery events should be persisted."
    Assert-True (-not (($events | ConvertTo-Json -Depth 20) -match 'https://chatgpt|https://gemini|ntfy|cookie|token')) "Recovery events must not print private URLs or secrets."

    Write-Host "PASS test_web_visual_recovery_rule"
} finally {
    if (Test-Path -LiteralPath $artifactRoot) {
        Remove-Item -LiteralPath $artifactRoot -Recurse -Force
    }
}
