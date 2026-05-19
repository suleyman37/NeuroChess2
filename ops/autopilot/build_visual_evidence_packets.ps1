param(
    [string]$ManifestPath = "",
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518\evidence_manifest.json"
}
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path (Split-Path -Parent $ManifestPath) "judge_packets"
}

function Write-Utf8 {
    param([string]$Path, [string]$Text)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8
}

function Assert-NoSecretLikeText {
    param([string]$Text, [string]$Label)
    $patterns = @("ntfy", "sk-", "password", "token=", "chat.openai.com/c/", "gemini.google.com/app/")
    foreach ($pattern in $patterns) {
        if ($Text -match [regex]::Escape($pattern)) {
            throw "SECRET_OR_PRIVATE_URL_PATTERN_IN_$Label"
        }
    }
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "EVIDENCE_MANIFEST_NOT_FOUND"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if (@($manifest.probes).Count -ne 10) { throw "EXPECTED_10_PROBES" }

$geminiDir = Join-Path $OutDir "gemini"
$chatgptDir = Join-Path $OutDir "chatgpt"
$pairwiseDir = Join-Path $OutDir "pairwise"
New-Item -ItemType Directory -Force -Path $geminiDir, $chatgptDir, $pairwiseDir | Out-Null

$geminiPackets = @()
$chatgptPackets = @()
foreach ($probe in $manifest.probes) {
    $id = [string]$probe.probe_id
    $title = ($id -replace "_", " ")
    $geminiText = @"
# Gemini Visual Review Packet: $title

Critique only this one probe. Do not compare against a 10-probe collage.

- Probe id: $id
- Learning-loop stage: $($probe.learning_loop_stage)
- Primary screenshot: $($probe.primary_screenshot_path)
- Main surface crop: $($probe.main_surface_screenshot_path)
- Detail crop: $($probe.detail_screenshot_path)
- Board visible: $($probe.board_visible)
- Evidence quality score: $($probe.evidence_quality_score)

Review questions:
1. Is the visual identity specific and memorable?
2. Is typography readable at this capture size?
3. If a board is visible, is the board strict and readable?
4. Does the atmosphere support chess learning without decorative clutter?
5. What specific visual defects should be patched next?

Return JSON only:
{"verdict":"pass|partial|fail","visual_identity":"...","readability":"...","board_safety":"...","defects":[],"next_patch":"..."}
"@
    $chatgptText = @"
# ChatGPT Product Review Packet: $title

Critique only this one probe. Do not use the overview contact sheet as primary evidence.

- Probe id: $id
- Learning-loop stage: $($probe.learning_loop_stage)
- Primary screenshot: $($probe.primary_screenshot_path)
- Main surface crop: $($probe.main_surface_screenshot_path)
- Detail crop: $($probe.detail_screenshot_path)
- Evidence quality score: $($probe.evidence_quality_score)

Review questions:
1. Does this probe improve the learning loop rather than just decoration?
2. What product utility is visible?
3. Is it anti-generic compared with a dark SaaS card?
4. What UX risks could hurt a beginner?
5. What next micro-mission should patch or compare this probe?

Return JSON only:
{"verdict":"pass|partial|fail","product_utility":"...","learning_loop_contribution":"...","ux_risks":[],"next_mission":"..."}
"@
    Assert-NoSecretLikeText -Text $geminiText -Label "GEMINI_PACKET_$id"
    Assert-NoSecretLikeText -Text $chatgptText -Label "CHATGPT_PACKET_$id"
    $geminiPath = Join-Path $geminiDir "$id.md"
    $chatgptPath = Join-Path $chatgptDir "$id.md"
    Write-Utf8 -Path $geminiPath -Text $geminiText
    Write-Utf8 -Path $chatgptPath -Text $chatgptText
    $geminiPackets += $geminiPath
    $chatgptPackets += $chatgptPath
}

$pairwisePackets = @()
foreach ($sheet in @($manifest.pairwise_sheets)) {
    $pair = @($sheet.pair | ForEach-Object { [string]$_ })
    if ($pair.Count -ne 2 -or [int]$sheet.max_probe_count -gt 2) { throw "PAIRWISE_PACKET_TOO_MANY_PROBES" }
    $name = ($pair -join "_vs_")
    $text = @"
# Pairwise Comparison Packet: $($pair[0]) vs $($pair[1])

Use this only for comparison. Primary critique must use one-probe packets.

- Pairwise image: $($sheet.path)
- Probe A: $($pair[0])
- Probe B: $($pair[1])
- Max probes in image: 2

Return JSON only:
{"preferred_for_signature_five":"probe_a|probe_b|neither|both","reason":"...","risks":[],"next_patch":"..."}
"@
    Assert-NoSecretLikeText -Text $text -Label "PAIRWISE_PACKET_$name"
    $path = Join-Path $pairwiseDir "$name.md"
    Write-Utf8 -Path $path -Text $text
    $pairwisePackets += $path
}

$result = [ordered]@{
    status = "VISUAL_EVIDENCE_PACKETS_READY"
    manifest_path = $ManifestPath
    output_dir = $OutDir
    gemini_packet_count = $geminiPackets.Count
    chatgpt_packet_count = $chatgptPackets.Count
    pairwise_packet_count = $pairwisePackets.Count
    one_probe_per_primary_packet = $true
    overview_contact_sheet_primary_allowed = $false
    no_private_urls = $true
    no_secrets = $true
}
$result | ConvertTo-Json -Depth 20
exit 0
