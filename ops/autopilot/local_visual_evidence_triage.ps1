param(
    [string]$ManifestPath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518\evidence_manifest.json"
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path (Split-Path -Parent $ManifestPath) "local_triage_result.json"
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw "EVIDENCE_MANIFEST_NOT_FOUND" }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$probes = @($manifest.probes)
$weak = @($probes | Where-Object { $_.primary_evidence_ready -ne $true -or [int]$_.evidence_quality_score -lt 75 })
$readyCount = $probes.Count - $weak.Count
$verdict = if ($readyCount -eq 10) {
    "EVIDENCE_READY_FOR_SELECTION"
} elseif ($readyCount -ge 7) {
    "EVIDENCE_PARTIAL_NEEDS_RECAPTURE"
} else {
    "EVIDENCE_WEAK_DO_NOT_SELECT"
}
$result = [ordered]@{
    status = $verdict
    manifest_path = $ManifestPath
    probe_count = $probes.Count
    ready_count = $readyCount
    weak_probes = @($weak | ForEach-Object {
        [ordered]@{
            probe_id = [string]$_.probe_id
            evidence_quality_score = [int]$_.evidence_quality_score
            failure_reasons = @($_.failure_reasons | ForEach-Object { [string]$_ })
        }
    })
    signature_five_selection_can_proceed = ($verdict -eq "EVIDENCE_READY_FOR_SELECTION")
    recommendation = if ($verdict -eq "EVIDENCE_READY_FOR_SELECTION") {
        "Proceed to A20AR_SIGNATURE_FIVE_SELECTION_FROM_HIGH_QUALITY_EVIDENCE."
    } else {
        "Recapture weak probe evidence before final Signature Five selection."
    }
    overview_contact_sheet_primary_allowed = $false
}
$dir = Split-Path -Parent $OutPath
if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$result | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutPath -Encoding UTF8
$result | ConvertTo-Json -Depth 30
exit 0
