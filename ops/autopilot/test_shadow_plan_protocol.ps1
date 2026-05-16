$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\shadow_plan_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$validateScript = Join-Path $PSScriptRoot "validate_shadow_plan.ps1"
$compareScript = Join-Path $PSScriptRoot "compare_shadow_plan_to_contract.ps1"

$validDocs = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_valid_docs_only.json"), "-MaxFiles", "1", "-MaxDiffLines", "300")
$validBackend = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_valid_backend_readonly_branch.json"), "-MaxFiles", "1", "-MaxDiffLines", "600")
$extraWrite = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_invalid_extra_write_path.json"), "-MaxFiles", "1", "-MaxDiffLines", "300")
$forbiddenPath = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_invalid_forbidden_read_path.json"), "-MaxFiles", "1", "-MaxDiffLines", "300")
$mix = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_invalid_frontend_backend_mix.json"), "-MaxFiles", "2", "-MaxDiffLines", "600")
$missingChecks = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", (Join-Path $fixtureRoot "shadow_plan_invalid_missing_checks.json"), "-MaxFiles", "1", "-MaxDiffLines", "300")

$match = Invoke-JsonCommand -Arguments @("-File", $compareScript, "-ShadowPlanPath", (Join-Path $fixtureRoot "shadow_plan_valid_docs_only.json"), "-ContractPath", (Join-Path $fixtureRoot "shadow_plan_contract_match.json"), "-ReportDir", (Join-Path $runDir "compare_match"))
$mismatch = Invoke-JsonCommand -Arguments @("-File", $compareScript, "-ShadowPlanPath", (Join-Path $fixtureRoot "shadow_plan_valid_docs_only.json"), "-ContractPath", (Join-Path $fixtureRoot "shadow_plan_contract_mismatch.json"), "-ReportDir", (Join-Path $runDir "compare_mismatch"))

$destructivePath = Join-Path $runDir "shadow_plan_destructive_command.json"
$destructive = Get-Content -LiteralPath (Join-Path $fixtureRoot "shadow_plan_valid_docs_only.json") -Raw | ConvertFrom-Json
$destructive.planned_commands = @("git add -A")
$destructive | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $destructivePath -Encoding UTF8
$destructiveResult = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", $destructivePath, "-MaxFiles", "1", "-MaxDiffLines", "300")

$broadPath = Join-Path $runDir "shadow_plan_broad_wording.json"
$broad = Get-Content -LiteralPath (Join-Path $fixtureRoot "shadow_plan_valid_docs_only.json") -Raw | ConvertFrom-Json
$broad.goal = "Improve the Shadow Plan protocol as needed."
$broad | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $broadPath -Encoding UTF8
$broadResult = Invoke-JsonCommand -Arguments @("-File", $validateScript, "-InputPath", $broadPath, "-MaxFiles", "1", "-MaxDiffLines", "300")

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($validDocs.exit_code -eq 0 -and $validDocs.json.shadow_plan_result -eq "PASS") "valid docs-only Shadow Plan should pass"
Assert-True ($validBackend.exit_code -eq 0 -and $validBackend.json.shadow_plan_result -eq "PASS") "valid backend-readonly branch Shadow Plan should pass"
Assert-True ($extraWrite.exit_code -ne 0 -and (($extraWrite.json.violations -join "`n") -match "max_files")) "extra write path should fail"
Assert-True ($forbiddenPath.exit_code -ne 0 -and (($forbiddenPath.json.violations -join "`n") -match "forbidden path")) "forbidden read/write path should fail"
Assert-True ($mix.exit_code -ne 0 -and (($mix.json.violations -join "`n") -match "frontend/backend")) "frontend/backend mix should fail"
Assert-True ($missingChecks.exit_code -ne 0 -and (($missingChecks.json.violations -join "`n") -match "planned_checks")) "missing required checks should fail"
Assert-True ($match.exit_code -eq 0 -and $match.json.comparison_result -eq "MATCH") "Shadow Plan matching contract should pass"
Assert-True ($mismatch.exit_code -ne 0 -and $mismatch.json.comparison_result -ne "MATCH") "Shadow Plan mismatch contract should fail"
Assert-True ($destructiveResult.exit_code -ne 0 -and (($destructiveResult.json.violations -join "`n") -match "destructive command")) "destructive command should fail"
Assert-True ($broadResult.exit_code -ne 0 -and (($broadResult.json.violations -join "`n") -match "broad wording")) "broad wording should fail"
Assert-True (-not [bool]$state.shadow_plan_enabled) "Shadow Plan live enforcement must remain disabled"
Assert-True (-not [bool]$state.shadow_plan_required_before_execution) "Shadow Plan required-before-execution must remain disabled"
Assert-True ([bool]$state.shadow_plan_contract_comparison_available) "Shadow Plan comparison should be available"
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched by tests"
Assert-True ($productDirty.Count -eq 0) "frontend/backend/plan/package/App.tsx must not be touched by tests"
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
    valid_docs_only_passes = "PASS"
    valid_backend_readonly_branch_passes = "PASS"
    extra_write_path_fails = "PASS"
    forbidden_path_fails = "PASS"
    frontend_backend_mix_fails = "PASS"
    missing_checks_fails = "PASS"
    contract_match_passes = "PASS"
    contract_mismatch_fails = "PASS"
    destructive_command_fails = "PASS"
    broad_wording_fails = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "shadow_plan_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
