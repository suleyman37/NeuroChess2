param(
    [string]$ManifestPath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518\evidence_manifest.json"
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path (Split-Path -Parent $ManifestPath) "visual_pixel_budget_report.json"
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

Assert-True (Test-Path -LiteralPath $ManifestPath -PathType Leaf) "manifest missing"
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$probes = @($manifest.probes)
Assert-True ($probes.Count -eq 10) "expected 10 probes"
Assert-True ($manifest.overview_contact_sheet.primary_evidence_allowed -eq $false) "overview contact sheet is primary evidence"

$failures = @()
foreach ($sheet in @($manifest.pairwise_sheets)) {
    if ([int]$sheet.max_probe_count -gt 2 -or @($sheet.pair).Count -gt 2) {
        $failures += "pairwise_sheet_too_large:$($sheet.path)"
    }
}

foreach ($probe in $probes) {
    if (-not (Test-Path -LiteralPath ([string]$probe.primary_screenshot_path) -PathType Leaf)) { $failures += "$($probe.probe_id):primary_missing" }
    if (-not (Test-Path -LiteralPath ([string]$probe.main_surface_screenshot_path) -PathType Leaf)) { $failures += "$($probe.probe_id):main_surface_missing" }
    if ([int]$probe.viewport_width -lt 1200) { $failures += "$($probe.probe_id):primary_width_lt_1200" }
    if ([int]$probe.viewport_height -lt 800) { $failures += "$($probe.probe_id):primary_height_lt_800" }
    if ([int]$probe.main_surface_bbox.width -lt 700) { $failures += "$($probe.probe_id):main_surface_width_lt_700" }
    if ([int]$probe.main_surface_bbox.height -lt 450) { $failures += "$($probe.probe_id):main_surface_height_lt_450" }
    if ([double]$probe.main_surface_area_ratio -lt 0.35) { $failures += "$($probe.probe_id):main_surface_area_ratio_lt_0_35" }
    if ($probe.board_visible -eq $true -and [int]$probe.board_bbox.width -lt 360) { $failures += "$($probe.probe_id):board_width_lt_360" }
}

$result = [ordered]@{
    status = if ($failures.Count -eq 0) { "VISUAL_PIXEL_BUDGET_PASS" } else { "VISUAL_PIXEL_BUDGET_FAIL" }
    manifest_path = $ManifestPath
    checked_at = (Get-Date).ToString("o")
    probe_count = $probes.Count
    failures = $failures
    overview_contact_sheet_primary_allowed = $false
    pairwise_max_two = ($failures | Where-Object { $_ -like "pairwise*" }).Count -eq 0
}
$dir = Split-Path -Parent $OutPath
if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$result | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutPath -Encoding UTF8
Assert-True ($failures.Count -eq 0) ($failures -join "; ")
$result | ConvertTo-Json -Depth 30
exit 0
