$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\night_mode_dry_runs" ("A14_test_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$dryRun = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run_product_safe_night_mode_dryrun.ps1") -OutDir $runDir) | ConvertFrom-Json

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($dryRun.verdict -eq "PASS_DRY_RUN") "dry-run should pass"
Assert-True ([int]$dryRun.steps_processed -eq 5) "dry-run should process five steps"

$step1 = @($dryRun.decisions | Where-Object { [int]$_.step -eq 1 })[0]
$step2 = @($dryRun.decisions | Where-Object { [int]$_.step -eq 2 })[0]
$step3 = @($dryRun.decisions | Where-Object { [int]$_.step -eq 3 })[0]
$step4 = @($dryRun.decisions | Where-Object { [int]$_.step -eq 4 })[0]
$step5 = @($dryRun.decisions | Where-Object { [int]$_.step -eq 5 })[0]

Assert-True ([bool]$step1.allowed) "docs-only step should be allowed"
Assert-True ([bool]$step1.auto_merge_to_road_allowed) "docs-only step should allow road auto-merge"
Assert-True ([bool]$step2.allowed) "backend-readonly step should be allowed"
Assert-True ([bool]$step2.requires_ephemeral_branch) "backend-readonly should require ephemeral branch"
Assert-True (-not [bool]$step2.auto_merge_to_road_allowed) "backend-readonly must not auto-merge"
Assert-True (($step2.required_evidence -join "`n") -match "anti_mutation") "backend-readonly should require anti-mutation evidence"
Assert-True ([bool]$step3.allowed) "frontend-readonly step should be allowed"
Assert-True ([bool]$step3.requires_ephemeral_branch) "frontend-readonly should require ephemeral branch"
Assert-True (($step3.required_evidence -join "`n") -match "screenshots|contact") "frontend-readonly should require screenshot/contact evidence"
Assert-True (($step3.required_evidence -join "`n") -match "visual") "frontend-readonly should require visual review brief"
Assert-True (-not [bool]$step4.allowed) "red-tier step should be rejected"
Assert-True (($step4.violations -join "`n") -match "red-tier|learning-state") "red-tier rejection reason missing"
Assert-True (-not [bool]$step5.allowed) "direct road product-code step should be rejected"
Assert-True (($step5.violations -join "`n") -match "road-to-V2|auto-merge|directly") "direct road rejection reason missing"
Assert-True (Test-Path -LiteralPath (Join-Path $dryRun.report_dir "product_safe_night_mode_5_step_dryrun_summary.json")) "dry-run summary missing"
Assert-True (Test-Path -LiteralPath (Join-Path $dryRun.report_dir "product_safe_night_mode_5_step_dryrun_report.md")) "dry-run markdown report missing"
Assert-True (Test-Path -LiteralPath (Join-Path $dryRun.morning_report_dir "product_safe_night_mode_report.json")) "morning report json missing"
Assert-True (-not [bool]$dryRun.live_chatgpt_called) "dry-run must not call live ChatGPT"
Assert-True (-not [bool]$dryRun.product_mission_executed) "dry-run must not execute product mission"
Assert-True (-not [bool]$dryRun.product_code_touched) "dry-run must not touch product code"
Assert-True ($endBranch -eq $startBranch) "dry-run should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "dry-run should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  dry_run_report_dir = [string]$dryRun.report_dir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    five_steps_processed = "PASS"
    docs_only_allowed = "PASS"
    backend_readonly_ephemeral_and_evidence = "PASS"
    frontend_readonly_screenshots_visual_brief = "PASS"
    red_tier_rejected = "PASS"
    direct_road_product_code_rejected = "PASS"
    report_builder_produced_final_report = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "product_safe_night_mode_dryrun_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
