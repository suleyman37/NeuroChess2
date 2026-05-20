param(
    [ValidateSet("Status", "CaptureWindow", "ValidateObservation", "DryRun")]
    [string]$Mode = "Status",
    [ValidateSet("antigravity", "chatgpt", "gemini", "browser", "desktop")]
    [string]$Target = "antigravity",
    [string]$ActionAttempted = "",
    [string]$ScreenshotPath = "",
    [string]$ArtifactRoot = "",
    [string]$VisibleUiSummary = "",
    [string[]]$VisibleControls = @(),
    [string[]]$MissingControls = @(),
    [string]$SafeNextAction = "",
    [ValidateSet("READY", "BLOCKED", "UNSAFE", "UNCLASSIFIED", "FALLBACK_REQUIRED")]
    [string]$Verdict = "UNCLASSIFIED",
    [string]$WorkspacePath = "",
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultArtifactRoot {
    "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BK_screenshot_first_transport_bridge_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-PathInside {
    param([string]$Child, [string]$Parent)
    if ([string]::IsNullOrWhiteSpace($Child) -or [string]::IsNullOrWhiteSpace($Parent)) { return $false }
    try {
        $childFull = if (Test-Path -LiteralPath $Child) { (Resolve-Path -LiteralPath $Child).Path } else { [System.IO.Path]::GetFullPath($Child) }
        $parentFull = if (Test-Path -LiteralPath $Parent) { (Resolve-Path -LiteralPath $Parent).Path } else { [System.IO.Path]::GetFullPath($Parent) }
        return $childFull.StartsWith($parentFull.TrimEnd("\") + "\", [System.StringComparison]::OrdinalIgnoreCase) -or
            $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

function New-Observation {
    param(
        [string]$Status,
        [string]$Reason,
        [string]$Screenshot = $ScreenshotPath,
        [string]$VerdictValue = $Verdict
    )
    [ordered]@{
        schema_version = "antigravity_screenshot_truth_observation_v1"
        status = $Status
        target = $Target
        action_attempted = $ActionAttempted
        screenshot_path = $Screenshot
        visible_ui_summary = $VisibleUiSummary
        visible_controls = @($VisibleControls)
        missing_controls = @($MissingControls)
        safe_next_action = $SafeNextAction
        verdict = $VerdictValue
        reason = $Reason
        reasoning_from_pixels = @(
            "A current screenshot is required before any GUI verdict.",
            "Process, DOM, or window metadata may confirm context but cannot replace pixels.",
            "No blind typing or unidentified window action is allowed."
        )
        dom_or_process_used_only_as_confirmation = $true
        no_blind_typing = $true
        official_repo_workspace_forbidden = $true
        screenshots_external_only = $true
    }
}

function Test-ScreenshotExternal {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    if (Test-PathInside -Child $Path -Parent (Get-RepoRoot)) { return $false }
    return $true
}

function Invoke-ValidateObservation {
    if ([string]::IsNullOrWhiteSpace($ScreenshotPath)) {
        return New-Observation -Status "MCP_SCREENSHOT_REQUIRED" -Reason "No screenshot path was provided; no GUI/browser verdict is allowed." -VerdictValue "UNCLASSIFIED"
    }
    if (-not (Test-Path -LiteralPath $ScreenshotPath -PathType Leaf)) {
        return New-Observation -Status "SCREENSHOT_FILE_MISSING" -Reason "Screenshot path does not exist; no verdict is allowed." -VerdictValue "UNCLASSIFIED"
    }
    if (-not (Test-ScreenshotExternal -Path $ScreenshotPath)) {
        return New-Observation -Status "SCREENSHOT_NOT_EXTERNAL_REJECTED" -Reason "Screenshot is missing or inside the repo; screenshots must remain external." -VerdictValue "UNCLASSIFIED"
    }
    if ($ActionAttempted -match '(?i)\btype\b|\btyping\b|sendkeys|paste') {
        return New-Observation -Status "BLIND_TYPING_FORBIDDEN" -Reason "Typing-like action is not allowed by this bridge." -VerdictValue "UNSAFE"
    }
    if ($Target -eq "desktop" -and $Verdict -eq "READY") {
        return New-Observation -Status "UNKNOWN_WINDOW_UNSAFE" -Reason "Generic desktop target cannot be marked ready." -VerdictValue "UNSAFE"
    }
    if (-not [string]::IsNullOrWhiteSpace($WorkspacePath) -and (Test-PathInside -Child $WorkspacePath -Parent (Get-RepoRoot))) {
        return New-Observation -Status "GUI_TRANSPORT_UNSAFE_OFFICIAL_REPO_WORKSPACE" -Reason "Workspace points inside the official repo." -VerdictValue "UNSAFE"
    }
    if ($Verdict -eq "READY") {
        if ([string]::IsNullOrWhiteSpace($WorkspacePath) -or $WorkspacePath -notmatch "NeuroChess_Agent_Worktrees") {
            return New-Observation -Status "SANDBOX_WORKTREE_REQUIRED" -Reason "Ready GUI verdict requires visible or configured external sandbox/worktree evidence." -VerdictValue "UNSAFE"
        }
        if ([string]::IsNullOrWhiteSpace($VisibleUiSummary)) {
            return New-Observation -Status "VISIBLE_UI_SUMMARY_REQUIRED" -Reason "Ready GUI verdict requires a current visible UI summary." -VerdictValue "UNCLASSIFIED"
        }
    }
    return New-Observation -Status "SCREENSHOT_OBSERVATION_VALID" -Reason "Screenshot-backed observation accepted."
}

function Invoke-CaptureWindow {
    $root = if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) { Get-DefaultArtifactRoot } else { $ArtifactRoot }
    $screenDir = Join-Path $root "screenshots"
    New-Item -ItemType Directory -Force -Path $screenDir | Out-Null

    $proc = Get-Process | Where-Object { $_.ProcessName -match "Antigravity" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $proc) {
        return New-Observation -Status "WINDOW_NOT_FOUND_SCREENSHOT_UNAVAILABLE" -Reason "No Antigravity window handle was available." -Screenshot "" -VerdictValue "UNCLASSIFIED"
    }

    Add-Type -AssemblyName System.Drawing
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
public class Win32WindowRect {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@
    $rect = New-Object RECT
    $ok = [Win32WindowRect]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
    if (-not $ok) {
        return New-Observation -Status "WINDOW_RECT_UNAVAILABLE" -Reason "Could not read Antigravity window rectangle." -Screenshot "" -VerdictValue "UNCLASSIFIED"
    }
    $width = [Math]::Max(1, $rect.Right - $rect.Left)
    $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
    if ($width -le 1 -or $height -le 1) {
        return New-Observation -Status "WINDOW_RECT_INVALID" -Reason "Antigravity window rectangle is not capturable." -Screenshot "" -VerdictValue "UNCLASSIFIED"
    }

    $path = Join-Path $screenDir ("antigravity_window_{0:yyyyMMdd_HHmmss}.png" -f (Get-Date))
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }

    $script:ScreenshotPath = $path
    $script:VisibleUiSummary = "Antigravity window screenshot captured. This script does not type or mark the GUI ready without sandbox/worktree proof."
    $script:VisibleControls = @("window_title_antigravity")
    $script:MissingControls = @("sandbox_path_proof", "proposal_pack_outbox_proof")
    $script:SafeNextAction = "Use manual/file bridge or inspect screenshot; do not type blindly."
    return New-Observation -Status "SCREENSHOT_CAPTURED_VERDICT_UNCLASSIFIED" -Reason "Screenshot captured; GUI transport still requires sandbox/outbox proof." -Screenshot $path -VerdictValue "UNCLASSIFIED"
}

if ($Mode -eq "Status") {
    $result = [ordered]@{
        schema_version = "antigravity_screenshot_truth_status_v1"
        status = "ANTIGRAVITY_SCREENSHOT_TRUTH_READY"
        screenshot_required_before_gui_verdict = $true
        process_only_ready_forbidden = $true
        blind_typing_forbidden = $true
        official_repo_workspace_forbidden = $true
    }
} elseif ($Mode -eq "CaptureWindow") {
    $result = Invoke-CaptureWindow
} elseif ($Mode -eq "DryRun") {
    $result = [ordered]@{
        schema_version = "antigravity_screenshot_truth_dry_run_v1"
        status = "ANTIGRAVITY_SCREENSHOT_TRUTH_DRY_RUN_PASS"
        no_screenshot_status = (Invoke-ValidateObservation).status
        process_only_ready_forbidden = $true
        blind_typing_forbidden = $true
    }
} else {
    $result = Invoke-ValidateObservation
}

$result | ConvertTo-Json -Depth 60
