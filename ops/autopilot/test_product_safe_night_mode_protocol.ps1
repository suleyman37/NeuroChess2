$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-ScopeFixture {
  param([string]$FixturePath, [string]$OutDir)
  $json = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_product_safe_night_mode_scope.ps1") -MissionJson $FixturePath -ReportDir $OutDir
  return $json | ConvertFrom-Json
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\product_safe_night_mode_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$docs = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_docs_only.json") -OutDir (Join-Path $runDir "docs")
$backend = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_backend_readonly.json") -OutDir (Join-Path $runDir "backend")
$frontend = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_frontend_readonly.json") -OutDir (Join-Path $runDir "frontend")
$red = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_reject_red_tier.json") -OutDir (Join-Path $runDir "red")
$practice = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_reject_practice.json") -OutDir (Join-Path $runDir "practice")
$directRoad = Invoke-ScopeFixture -FixturePath (Join-Path $fixtureRoot "product_safe_night_mode_reject_direct_road_merge.json") -OutDir (Join-Path $runDir "direct_road")

$report = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_product_safe_night_mode_report.ps1") `
  -RunMetadataJson (Join-Path $fixtureRoot "product_safe_night_mode_report_example.json") `
  -OutDir (Join-Path $runDir "morning_report")) | ConvertFrom-Json

$plan = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "plan_product_safe_night_mode_run.ps1") `
  -OutDir (Join-Path $runDir "plan")) | ConvertFrom-Json

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ([bool]$docs.allowed) "docs-only mission should be allowed"
Assert-True ([bool]$docs.auto_merge_to_road_allowed) "docs-only mission should allow road auto-merge"
Assert-True ([bool]$backend.allowed) "backend-readonly fixture should be allowed"
Assert-True ([bool]$backend.requires_ephemeral_branch) "backend-readonly should require ephemeral branch"
Assert-True (-not [bool]$backend.auto_merge_to_road_allowed) "backend-readonly must not auto-merge to road"
Assert-True ([bool]$frontend.allowed) "frontend-readonly fixture should be allowed"
Assert-True ([bool]$frontend.requires_ephemeral_branch) "frontend-readonly should require ephemeral branch"
Assert-True (($frontend.required_evidence -join "`n") -match "screenshots|contact") "frontend-readonly should require screenshots/contact sheet"
Assert-True (-not [bool]$red.allowed) "red-tier mission should be rejected"
Assert-True (-not [bool]$practice.allowed) "Practice mission should be rejected"
Assert-True (-not [bool]$directRoad.allowed) "direct road merge for product code should be rejected"
Assert-True (Test-Path -LiteralPath (Join-Path $report.report_dir "product_safe_night_mode_report.json")) "report json missing"
Assert-True (Test-Path -LiteralPath (Join-Path $report.report_dir "product_safe_night_mode_report.md")) "report md missing"
Assert-True ($report.morning_recommendation -eq "READY_TO_REVIEW") "report recommendation mismatch"
Assert-True ($plan.max_missions -eq 15) "planner max missions mismatch"
Assert-True ($plan.max_wall_clock_hours -eq 8) "planner hours mismatch"
Assert-True (-not [bool]$plan.enabled) "planner must not enable live Night Mode"
Assert-True (-not [bool]$state.product_safe_night_mode_enabled) "state must not enable live Night Mode"
Assert-True (-not [bool]$state.night_mode_auto_merge_product_code) "state must disable product code auto-merge"
Assert-True ([bool]$state.night_mode_auto_merge_docs) "state must allow docs auto-merge"
Assert-True (-not [bool]$state.night_mode_red_tier_allowed) "state must forbid red-tier"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    docs_only_allowed = "PASS"
    backend_readonly_ephemeral_only = "PASS"
    frontend_readonly_screenshots_ephemeral = "PASS"
    red_tier_rejected = "PASS"
    practice_rejected = "PASS"
    direct_road_merge_rejected = "PASS"
    report_builder_fields = "PASS"
    planner_bounded = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "product_safe_night_mode_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
