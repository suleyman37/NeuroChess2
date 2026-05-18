param(
    [string]$MissionId = "",
    [string]$CurrentObjective = "",
    [string]$DiscussionLabel = "",
    [string]$Branch = "",
    [string]$Commit = "",
    [string]$PreviousLabel = "",
    [string]$NewLabel = "",
    [string]$RotationReason = "",
    [string]$OutPath = "",
    [int]$MaxWords = 2500
)

$ErrorActionPreference = "Stop"

function Get-WordCount {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return ([regex]::Matches($Text, "\S+")).Count
}

function Limit-Words {
    param([string]$Text, [int]$Limit)
    $words = [regex]::Matches($Text, "\S+") | ForEach-Object { $_.Value }
    if ($words.Count -le $Limit) { return $Text }
    return (($words | Select-Object -First $Limit) -join " ") + "`n`n[Compressed automatically to respect bootstrap word limit.]"
}

if ([string]::IsNullOrWhiteSpace($MissionId)) {
    $MissionId = "UNKNOWN_MISSION"
}
if ([string]::IsNullOrWhiteSpace($CurrentObjective)) {
    $CurrentObjective = "Coordinate NeuroChess web judge sessions safely."
}
if ([string]::IsNullOrWhiteSpace($DiscussionLabel)) {
    $DiscussionLabel = "UNKNOWN"
}
if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (& git -C (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path branch --show-current 2>$null)
}
if ([string]::IsNullOrWhiteSpace($Commit)) {
    $Commit = (& git -C (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path rev-parse --short HEAD 2>$null)
}

$templatePath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path "docs\autopilot\WEB_JUDGE_BOOTSTRAP_CONTEXT_TEMPLATE.md"
$template = Get-Content -LiteralPath $templatePath -Raw

$reportDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path "docs\autopilot"
$recent = Get-ChildItem -LiteralPath $reportDir -Filter "A20*.md" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5
$outcomes = foreach ($file in $recent) {
    $text = Get-Content -LiteralPath $file.FullName -Raw
    $verdict = ([regex]::Match($text, "(?im)Final verdict:\s*`?([^`\r\n]+)`?")).Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($verdict)) {
        $verdict = ([regex]::Match($text, "(?im)^##\s*15\.\s*Final Verdict\s*\r?\n\s*`?([^`\r\n]+)`?")).Groups[1].Value
    }
    if ([string]::IsNullOrWhiteSpace($verdict)) { $verdict = "outcome recorded" }
    "- $($file.BaseName): $verdict"
}
if (-not $outcomes) { $outcomes = @("- No recent outcomes found.") }

$rotation = ""
if (-not [string]::IsNullOrWhiteSpace($PreviousLabel) -or -not [string]::IsNullOrWhiteSpace($NewLabel)) {
    $rotation = @"

## Rotation Handoff

Previous discussion label: $PreviousLabel
New discussion label: $NewLabel
Reason: $RotationReason
"@
}

$body = $template.
    Replace("{{MISSION_ID}}", $MissionId).
    Replace("{{BRANCH}}", $Branch).
    Replace("{{COMMIT}}", $Commit).
    Replace("{{OBJECTIVE}}", $CurrentObjective).
    Replace("{{DISCUSSION_LABEL}}", $DiscussionLabel).
    Replace("{{LAST_OUTCOMES}}", ($outcomes -join "`n"))
$body = $body + $rotation
$limited = Limit-Words -Text $body -Limit $MaxWords

if (-not [string]::IsNullOrWhiteSpace($OutPath)) {
    $dir = Split-Path -Parent $OutPath
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -LiteralPath $OutPath -Value $limited -Encoding UTF8
}

[ordered]@{
    schema_version = "web_judge_bootstrap_context_result_v1"
    mission_id = $MissionId
    discussion_label = $DiscussionLabel
    out_path = $OutPath
    word_count = Get-WordCount -Text $limited
    max_words = $MaxWords
    compressed = ((Get-WordCount -Text $body) -gt $MaxWords)
    private_urls_included = $false
    secrets_included = $false
    status = if ((Get-WordCount -Text $limited) -le $MaxWords) { "BOOTSTRAP_CONTEXT_READY" } else { "BOOTSTRAP_CONTEXT_TOO_LONG" }
} | ConvertTo-Json -Depth 10
