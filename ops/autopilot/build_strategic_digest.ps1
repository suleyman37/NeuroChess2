param(
  [string]$StatePath = "",
  [string]$OutDir = "",
  [string]$Question = "Should we continue, narrow, split, pivot, harden, return to product, quarantine, or stop?"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "strategic_digest\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if ($StatePath) {
  $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
} else {
  $state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "fixtures\strategic_digest_example.json") -Raw | ConvertFrom-Json
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("<STRATEGIC_DIGEST>") | Out-Null
$lines.Add("current_head: $($state.current_head)") | Out-Null
$lines.Add("last_n_missions:") | Out-Null
foreach ($mission in @($state.last_n_missions)) {
  $lines.Add("  - id: $($mission.id)") | Out-Null
  $lines.Add("    result: $($mission.result)") | Out-Null
  $lines.Add("    commit: $($mission.commit)") | Out-Null
  $lines.Add("    risk_tier: $($mission.risk_tier)") | Out-Null
  $lines.Add("    work_type: $($mission.work_type)") | Out-Null
  $lines.Add("    files_changed: $($mission.files_changed)") | Out-Null
  $lines.Add("    diff_lines: $($mission.diff_lines)") | Out-Null
  $lines.Add("    duration: $($mission.duration)") | Out-Null
  $lines.Add("    alarms: $(@($mission.alarms) -join ', ')") | Out-Null
  $lines.Add("    friction: $($mission.friction)") | Out-Null
  $lines.Add("    product_value: $($mission.product_value)") | Out-Null
  $lines.Add("    automation_value: $($mission.automation_value)") | Out-Null
}
$lines.Add("current_roadmap: $($state.current_roadmap)") | Out-Null
$lines.Add("current_product_checkpoint: $($state.current_product_checkpoint)") | Out-Null
$lines.Add("active_risks: $(@($state.active_risks) -join '; ')") | Out-Null
$lines.Add("open_blockers: $(@($state.open_blockers) -join '; ')") | Out-Null
$lines.Add("unexpected_discoveries: $(@($state.unexpected_discoveries) -join '; ')") | Out-Null
$lines.Add("automation_vs_product_ratio: $($state.automation_vs_product_ratio)") | Out-Null
$lines.Add("next_planned_mission: $($state.next_planned_mission)") | Out-Null
$lines.Add("question: $Question") | Out-Null
$lines.Add("</STRATEGIC_DIGEST>") | Out-Null

$path = Join-Path $OutDir "strategic_digest.md"
Set-Content -LiteralPath $path -Value ($lines -join "`n") -Encoding UTF8

$summary = [ordered]@{
  status = "pass"
  digest_path = $path
  includes_full_patch = $false
  includes_long_logs = $false
  includes_screenshots = $false
  live_chatgpt_called = $false
}
$summary | ConvertTo-Json -Depth 8
