param(
    [ValidateSet("FindEvidence", "Smoke", "DryRun")]
    [string]$Mode = "Smoke",
    [string]$MissionId = "A20BC",
    [string]$VisualEvidencePath = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$MockVisualPass,
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 90
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BC_gemini_3_5_flash_extended_lane_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

function Test-IsContactSheet {
    param([string]$Path)
    $full = [string]$Path
    $name = [System.IO.Path]::GetFileName($Path)
    return ($name -match '(?i)contact[_ -]?sheet|collage|10[_ -]?up|thumbnail|sprite|montage') -or
        ($full -match '(?i)contact[_ -]?sheets?|collages?|pairwise|10[_ -]?up')
}

function Test-IsImageFile {
    param([string]$Path)
    return ([System.IO.Path]::GetExtension($Path)) -match '^\.(png|jpg|jpeg)$'
}

function Find-IsolatedScreenshot {
    if (-not [string]::IsNullOrWhiteSpace($VisualEvidencePath) -and (Test-Path -LiteralPath $VisualEvidencePath -PathType Leaf)) {
        if (-not (Test-IsImageFile -Path $VisualEvidencePath)) { return $null }
        if (Test-IsContactSheet -Path $VisualEvidencePath) { return $null }
        return (Resolve-Path -LiteralPath $VisualEvidencePath).Path
    }
    $roots = @(
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_arena"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_pixel_rehearsal"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real_run"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\true_overnight_composer_first")
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
        $candidate = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { (Test-IsImageFile -Path $_.FullName) -and -not (Test-IsContactSheet -Path $_.FullName) } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }
    return $null
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath "visual_packet_smoke_result.json" }

$selected = Find-IsolatedScreenshot
$base = [ordered]@{
    schema_version = "gemini_visual_packet_smoke_result_v1"
    mission_id = $MissionId
    mode = $Mode
    selected_visual_evidence_path = if ($selected) { $selected } else { "" }
    isolated_screenshot_selected = -not [string]::IsNullOrWhiteSpace($selected)
    contact_sheet_rejected = $true
    status = "NOT_RUN"
    adapter_status = ""
    visual_packet_result = "NOT_RUN"
    decision_packet_produced = $false
    no_api_call = $true
    no_paid_service = $true
    private_urls_redacted = $true
    secrets_redacted = $true
}

if ($Mode -eq "FindEvidence") {
    $base.status = if ($selected) { "VISUAL_EVIDENCE_READY" } else { "VISUAL_EVIDENCE_NOT_FOUND" }
    Write-JsonFile -Path $OutPath -Payload $base
    $base | ConvertTo-Json -Depth 60
    exit 0
}

if (-not $selected) {
    $base.status = "VISUAL_EVIDENCE_NOT_FOUND"
    Write-JsonFile -Path $OutPath -Payload $base
    $base | ConvertTo-Json -Depth 60
    exit 0
}

$args = @(
    "-Mode", "SendVisualPacket",
    "-MissionId", $MissionId,
    "-VisualEvidencePath", $selected,
    "-ArtifactPath", $ArtifactPath,
    "-MaxWaitSeconds", ([string]$MaxWaitSeconds),
    "-NoPrompt"
)
if ($DryRun -or $Mode -eq "DryRun") { $args += @("-DryRun", "-MockClassification", "PAGE_USABLE", "-MockComposerVisible", "-MockUploadAvailable") }
if ($MockVisualPass) { $args += "-MockVisualPacketPass" }
$output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "gemini_web_lane_adapter.ps1") @args 2>&1
$adapter = Convert-JsonOutput -Output $output
$base.adapter_status = [string]$adapter.status
$base.visual_packet_result = [string]$adapter.visual_packet_result
$base.decision_packet_produced = [bool]$adapter.decision_packet_produced
$base.status = if ($base.visual_packet_result -eq "GEMINI_VISUAL_PACKET_SMOKE_PASS") { "GEMINI_VISUAL_PACKET_SMOKE_PASS" } elseif ($base.visual_packet_result -eq "GEMINI_UPLOAD_UNAVAILABLE") { "GEMINI_UPLOAD_UNAVAILABLE" } else { "GEMINI_VISUAL_PACKET_SMOKE_PARTIAL" }
Write-JsonFile -Path $OutPath -Payload $base
$base | ConvertTo-Json -Depth 60
