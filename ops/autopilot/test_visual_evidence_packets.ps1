param(
    [string]$ManifestPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518\evidence_manifest.json"
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

Assert-True (Test-Path -LiteralPath $ManifestPath -PathType Leaf) "manifest missing"
$outDir = Join-Path (Split-Path -Parent $ManifestPath) "judge_packets"
$output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\build_visual_evidence_packets.ps1") `
    -ManifestPath $ManifestPath `
    -OutDir $outDir 2>&1
$exit = $LASTEXITCODE
Assert-True ($exit -eq 0) "packet builder failed: $($output | Out-String)"
$text = ($output | Out-String).Trim()
$start = $text.IndexOf("{")
Assert-True ($start -ge 0) "builder emitted no JSON"
$result = $text.Substring($start) | ConvertFrom-Json
Assert-True ([int]$result.gemini_packet_count -eq 10) "gemini packet count"
Assert-True ([int]$result.chatgpt_packet_count -eq 10) "chatgpt packet count"
Assert-True ([int]$result.pairwise_packet_count -eq 5) "pairwise packet count"

$geminiPackets = @(Get-ChildItem -LiteralPath (Join-Path $outDir "gemini") -Filter "*.md")
$chatgptPackets = @(Get-ChildItem -LiteralPath (Join-Path $outDir "chatgpt") -Filter "*.md")
foreach ($packet in @($geminiPackets + $chatgptPackets)) {
    $content = Get-Content -LiteralPath $packet.FullName -Raw
    Assert-True ($content -match "Critique only this one probe") "$($packet.Name) missing one-probe instruction"
    Assert-True ($content -notmatch "10-probe collage as primary") "$($packet.Name) implies collage primary evidence"
    Assert-True ($content -notmatch "chat\.openai\.com/c/|gemini\.google\.com/app/|sk-|password|token=") "$($packet.Name) contains private pattern"
}

[ordered]@{
    status = "pass"
    gemini_packet_count = $geminiPackets.Count
    chatgpt_packet_count = $chatgptPackets.Count
    pairwise_packet_count = [int]$result.pairwise_packet_count
    one_probe_per_primary_packet = $true
    no_private_urls = $true
} | ConvertTo-Json -Depth 10
exit 0
