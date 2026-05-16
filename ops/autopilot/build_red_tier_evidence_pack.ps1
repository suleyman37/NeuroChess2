param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [Parameter(Mandatory = $true)][string]$ClassificationJson,
  [string]$BranchName = "",
  [string]$BaseHead = "",
  [string]$OutDir = "",
  [string]$CodexReport = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\red_tier_evidence" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if (-not $BaseHead) {
  $BaseHead = (git rev-parse --short HEAD).Trim()
}
if (-not $BranchName) {
  $BranchName = "quarantine/red-unassigned-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

$missionRaw = Get-Content -LiteralPath $MissionJson -Raw
$classificationRaw = Get-Content -LiteralPath $ClassificationJson -Raw
$classification = $classificationRaw | ConvertFrom-Json

Set-Content -LiteralPath (Join-Path $OutDir "mission_brief.md") -Value $missionRaw -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "classification.json") -Value $classificationRaw -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "branch_name.txt") -Value $BranchName -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "base_head.txt") -Value $BaseHead -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "changed_files.txt") -Value "BLOCKING: not collected yet." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "diff.patch") -Value "BLOCKING: no diff captured yet." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "checks_summary.md") -Value "BLOCKING: checks not run yet." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "precheck.txt") -Value "BLOCKING: precheck not captured yet." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "db_snapshot_before_required.txt") -Value "BLOCKING: DB snapshot before is required. Do not fabricate." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "db_snapshot_after_required.txt") -Value "BLOCKING: DB snapshot after is required. Do not fabricate." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "db_mutation_report_required.txt") -Value "BLOCKING: DB mutation report is required. Do not fabricate." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "route_inventory_required.md") -Value "BLOCKING: route inventory required if backend routes are touched." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "side_effect_inventory_required.md") -Value "BLOCKING: side-effect risk inventory required." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "rollback_plan_required.md") -Value "BLOCKING: rollback plan required before execution." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "supervisor_response.md") -Value "Not supplied." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "go_no_go.md") -Value "NO-GO: required evidence placeholders are still blocking." -Encoding UTF8

if ($CodexReport -and (Test-Path -LiteralPath $CodexReport)) {
  Copy-Item -LiteralPath $CodexReport -Destination (Join-Path $OutDir "codex_report.md") -Force
} else {
  Set-Content -LiteralPath (Join-Path $OutDir "codex_report.md") -Value "No Codex report supplied." -Encoding UTF8
}

$mission = $missionRaw | ConvertFrom-Json
@($mission.allowed_paths) | Set-Content -LiteralPath (Join-Path $OutDir "allowed_paths.txt") -Encoding UTF8
@($mission.forbidden_paths) | Set-Content -LiteralPath (Join-Path $OutDir "forbidden_paths.txt") -Encoding UTF8

$blockingItems = @(
  "db_snapshot_before_required.txt",
  "db_snapshot_after_required.txt",
  "db_mutation_report_required.txt",
  "rollback_plan_required.md",
  "side_effect_inventory_required.md"
)

$manifest = [ordered]@{
  schema_version = "A6_red_tier_evidence_pack"
  status = "BLOCKED"
  reason = "required evidence placeholders are blocking"
  risk_tier = $classification.risk_tier
  red_flags = @($classification.red_flags)
  branch_name = $BranchName
  base_head = $BaseHead
  evidence_dir = $OutDir
  blocking_items = $blockingItems
  product_execution = $false
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "manifest.json") -Encoding UTF8
$manifest | ConvertTo-Json -Depth 10
