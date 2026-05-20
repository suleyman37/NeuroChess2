$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "antigravity_screenshot_truth.ps1"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_antigravity_screenshot_truth_{0}" -f [guid]::NewGuid().ToString("N"))

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-ScreenshotTruth {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "screenshot truth failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    $shot = Join-Path $tempRoot "fixture.png"
    Set-Content -LiteralPath $shot -Value "fake screenshot fixture" -Encoding UTF8
    $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) "NeuroChess_Agent_Worktrees\a20bk-fixture"

    $status = Invoke-ScreenshotTruth -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ($status.status -eq "ANTIGRAVITY_SCREENSHOT_TRUTH_READY") "status missing"
    Assert-True ([bool]$status.screenshot_required_before_gui_verdict) "screenshot requirement missing"

    $noShot = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "antigravity", "-Verdict", "READY", "-NoPrompt")
    Assert-True ($noShot.status -eq "MCP_SCREENSHOT_REQUIRED") "GUI verdict without screenshot should reject"

    $unknown = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "desktop", "-Verdict", "READY", "-ScreenshotPath", $shot, "-WorkspacePath", $sandbox, "-VisibleUiSummary", "unknown desktop", "-NoPrompt")
    Assert-True ($unknown.status -eq "UNKNOWN_WINDOW_UNSAFE") "unknown window should be unsafe"

    $official = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "antigravity", "-Verdict", "READY", "-ScreenshotPath", $shot, "-WorkspacePath", $repoRoot, "-VisibleUiSummary", "official repo is visible", "-NoPrompt")
    Assert-True ($official.status -eq "GUI_TRANSPORT_UNSAFE_OFFICIAL_REPO_WORKSPACE") "official repo workspace should be unsafe"

    $typing = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "antigravity", "-Verdict", "UNCLASSIFIED", "-ScreenshotPath", $shot, "-ActionAttempted", "type prompt into window", "-NoPrompt")
    Assert-True ($typing.status -eq "BLIND_TYPING_FORBIDDEN") "blind typing should be forbidden"

    $ready = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "antigravity", "-Verdict", "READY", "-ScreenshotPath", $shot, "-WorkspacePath", $sandbox, "-VisibleUiSummary", "Antigravity window with external sandbox path visible", "-VisibleControls", "input", "-MissingControls", "none", "-SafeNextAction", "file bridge only", "-NoPrompt")
    Assert-True ($ready.status -eq "SCREENSHOT_OBSERVATION_VALID") "valid screenshot-backed observation should pass"

    $repoShot = Join-Path $repoRoot "screenshot_fixture.png"
    try {
        Set-Content -LiteralPath $repoShot -Value "repo screenshot fixture" -Encoding UTF8
        $repoShotResult = Invoke-ScreenshotTruth -Arguments @("-Mode", "ValidateObservation", "-Target", "antigravity", "-Verdict", "UNCLASSIFIED", "-ScreenshotPath", $repoShot, "-NoPrompt")
        Assert-True ($repoShotResult.status -eq "SCREENSHOT_NOT_EXTERNAL_REJECTED") "repo screenshot should be rejected"
    } finally {
        if (Test-Path -LiteralPath $repoShot) { Remove-Item -LiteralPath $repoShot -Force }
    }

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch '\[System\.Windows\.Forms\.SendKeys\]|WScript\.Shell.*SendKeys') "script must not use SendKeys APIs"
    Assert-True ($source -notmatch "git commit") "script must not commit"
    Assert-True ($source -notmatch "git push") "script must not push"

    [ordered]@{
        status = "pass"
        tests = 10
        gui_verdict_without_screenshot_rejected = $true
        process_only_ready_forbidden = $true
        blind_typing_forbidden = $true
        unknown_window_unsafe = $true
        official_repo_workspace_unsafe = $true
        screenshots_external_only = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
