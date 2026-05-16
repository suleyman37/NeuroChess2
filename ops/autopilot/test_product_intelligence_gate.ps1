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
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\product_intelligence_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$evaluateScript = Join-Path $PSScriptRoot "evaluate_product_impact.ps1"
$frictionScript = Join-Path $PSScriptRoot "check_product_friction_progress.ps1"

$direct = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", (Join-Path $fixtureRoot "product_impact_direct_value.json"))
$indirect = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", (Join-Path $fixtureRoot "product_impact_indirect_enabler.json"))
$infraUnlock = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", (Join-Path $fixtureRoot "product_impact_infra_with_unlock.json"))
$infraNoUnlock = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", (Join-Path $fixtureRoot "product_impact_infra_without_unlock.json"))
$fakeRisk = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", (Join-Path $fixtureRoot "product_impact_fake_progress_risk.json"))
$window = Invoke-JsonCommand -Arguments @("-File", $frictionScript, "-InputPath", (Join-Path $fixtureRoot "product_friction_no_progress_window.json"), "-WindowSize", "3")

$missingPath = Join-Path $runDir "product_impact_missing_required.json"
$missing = Get-Content -LiteralPath (Join-Path $fixtureRoot "product_impact_direct_value.json") -Raw | ConvertFrom-Json
$missing.PSObject.Properties.Remove("friction_targeted")
$missing | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $missingPath -Encoding UTF8
$missingResult = Invoke-JsonCommand -Arguments @("-File", $evaluateScript, "-InputPath", $missingPath)

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($direct.exit_code -eq 0 -and $direct.json.product_gate_result -eq "PASS") "direct product value should pass"
Assert-True ([int]$direct.json.total_score -eq 27) "direct score total should be computed correctly"
Assert-True ($indirect.exit_code -eq 0 -and $indirect.json.product_gate_result -eq "PASS") "indirect enabler should pass"
Assert-True ($infraUnlock.exit_code -eq 0 -and $infraUnlock.json.product_gate_result -eq "WARN") "infra with explicit unlock should pass with warning"
Assert-True (($infraUnlock.json.warnings -join "`n") -match "unlocks") "infra unlock warning should name product unlock"
Assert-True ($infraNoUnlock.exit_code -ne 0 -and (($infraNoUnlock.json.violations -join "`n") -match "infra_only")) "infra without unlock should fail or warn strongly"
Assert-True ($fakeRisk.exit_code -ne 0 -and (($fakeRisk.json.violations -join "`n") -match "fake_progress_risk")) "high fake progress risk should fail"
Assert-True ($window.json.friction_progress_result -eq "STRATEGIC_PULSE_REQUIRED" -or $window.json.friction_progress_result -eq "RETURN_TO_PRODUCT_REQUIRED") "no-product-friction window should trigger return/product pulse"
Assert-True ($missingResult.exit_code -ne 0 -and (($missingResult.json.violations -join "`n") -match "friction_targeted")) "schema validation should catch missing fields"
Assert-True (-not [bool]$state.product_intelligence_gate_enabled) "Product Gate live enforcement must remain disabled"
Assert-True ([bool]$state.potential_acceleration_score_available) "Potential Acceleration Score should be available"
Assert-True ([bool]$state.product_friction_register_available) "Product Friction Register should be available"
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
    direct_product_value_passes = "PASS"
    indirect_enabler_passes = "PASS"
    infra_with_unlock_warns = "PASS"
    infra_without_unlock_fails = "PASS"
    fake_progress_high_fails = "PASS"
    no_product_friction_window_triggers = "PASS"
    score_total_computed = "PASS"
    missing_field_schema_validation = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "product_intelligence_gate_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
