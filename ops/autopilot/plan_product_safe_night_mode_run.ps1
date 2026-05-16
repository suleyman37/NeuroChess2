param(
  [string]$PolicyPath = "",
  [string]$OutDir = "",
  [int]$MaxMissions = 15
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $PolicyPath) {
  $PolicyPath = Join-Path $PSScriptRoot "product_safe_night_mode_policy.yaml"
}
if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "product_safe_night_mode\plans\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$policyText = Get-Content -LiteralPath $PolicyPath -Raw
$boundedMaxMissions = [Math]::Min([Math]::Max($MaxMissions, 1), 15)

$plan = [ordered]@{
  schema_version = "A13_product_safe_night_mode_plan"
  enabled = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  policy_path = $PolicyPath
  max_missions = $boundedMaxMissions
  max_wall_clock_hours = 8
  auto_drain_at_hours = 7
  mission_timebox_minutes = 10
  strategic_pulse_every_missions = 3
  conversation_rollover_after_missions = 5
  request_more_max_rounds = 2
  prompt_repair_max_attempts = 1
  allowed_scopes = @(
    "docs_only_auto_merge_if_contract_matches",
    "backend_readonly_ephemeral_no_auto_merge",
    "frontend_readonly_ephemeral_no_auto_merge",
    "smoke_test_only_with_evidence"
  )
  stop_conditions = @(
    "ChatGPT bridge fails",
    "Project READY invalid",
    "session rollover fails",
    "watchdog heartbeat fails",
    "mission contract mismatch",
    "forbidden scope touched",
    "red-tier detected",
    "prompt firewall rejects twice",
    "REQUEST_MORE exceeds limit",
    "timebox checkpoint triggered",
    "Strategic Pulse says STOP/QUARANTINE/HARDEN outside scope",
    "push fails",
    "repo not clean before next mission",
    "local project URL missing"
  )
  report_dir = $OutDir
  policy_excerpt_present = ($policyText.Length -gt 0)
}

$plan | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "product_safe_night_mode_plan.json") -Encoding UTF8

$md = @(
  "# Product-Safe Night Mode Run Plan",
  "",
  "Live Night Mode enabled: false",
  "Max missions: $boundedMaxMissions",
  "Max wall-clock hours: 8",
  "Auto-drain at hours: 7",
  "Mission timebox minutes: 10",
  "",
  "Allowed scopes:",
  "- docs-only auto-merge only when contract and checks pass",
  "- backend-readonly on ephemeral branch only",
  "- frontend-readonly on ephemeral branch only",
  "- smoke/test-only with evidence",
  "",
  "This script does not call ChatGPT and does not execute missions."
)
$md | Set-Content -LiteralPath (Join-Path $OutDir "product_safe_night_mode_plan.md") -Encoding UTF8

$plan | ConvertTo-Json -Depth 10
