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

Assert-True (Test-Path -LiteralPath (Join-Path $RepoRoot "docs\autopilot\PERCEPTION_GRADE_VISUAL_EVIDENCE_STANDARD.md") -PathType Leaf) "standard doc missing"
Assert-True (Test-Path -LiteralPath (Join-Path $RepoRoot "docs\autopilot\VISUAL_JUDGE_PACKET_PROTOCOL.md") -PathType Leaf) "packet protocol missing"
Assert-True (Test-Path -LiteralPath $ManifestPath -PathType Leaf) "manifest missing"

$app = Get-Content -LiteralPath (Join-Path $RepoRoot "frontend\src\App.tsx") -Raw
Assert-True ($app -match "visualProbe") "isolated visualProbe route missing"
Assert-True ($app -match "import\.meta\.env\.DEV") "DEV-only guard missing"

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$probes = @($manifest.probes)
Assert-True ($probes.Count -eq 10) "expected 10 probes"
$weak = @($probes | Where-Object { [int]$_.evidence_quality_score -lt 75 -or $_.primary_evidence_ready -ne $true })
Assert-True ($weak.Count -eq 0) ("weak evidence: " + (($weak | ForEach-Object { $_.probe_id }) -join ","))
Assert-True ($manifest.overview_contact_sheet.use -eq "OVERVIEW_ONLY") "overview contact sheet not labelled overview-only"

[ordered]@{
    status = "pass"
    probe_count = $probes.Count
    weak_probe_count = $weak.Count
    average_quality_score = [Math]::Round((($probes | Measure-Object -Property evidence_quality_score -Average).Average), 2)
    isolated_routes = $true
    overview_only_contact_sheet = $true
} | ConvertTo-Json -Depth 10
exit 0
