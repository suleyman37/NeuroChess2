$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-ValidateFixture {
  param([string]$FixturePath, [string]$OutDir)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate_mission_contract.ps1") -ContractPath $FixturePath -ReportDir $OutDir 2>$null
  $code = $LASTEXITCODE
  $json = if ($output) { ($output -join "`n") | ConvertFrom-Json } else { $null }
  return [ordered]@{ exit_code = $code; result = $json }
}

function Invoke-CompareFixture {
  param([string]$ContractPath, [string]$ActualPath, [string]$OutDir)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "compare_mission_contract_to_result.ps1") -ContractPath $ContractPath -ActualPath $ActualPath -ReportDir $OutDir 2>$null
  $code = $LASTEXITCODE
  $json = if ($output) { ($output -join "`n") | ConvertFrom-Json } else { $null }
  return [ordered]@{ exit_code = $code; result = $json }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mission_contract_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$contractPath = Join-Path $fixtureRoot "mission_contract_valid_docs_only.json"

$valid = Invoke-ValidateFixture -FixturePath $contractPath -OutDir (Join-Path $runDir "validate_valid")
$missing = Invoke-ValidateFixture -FixturePath (Join-Path $fixtureRoot "mission_contract_missing_required_field.json") -OutDir (Join-Path $runDir "validate_missing")
$matches = Invoke-CompareFixture -ContractPath $contractPath -ActualPath (Join-Path $fixtureRoot "mission_contract_actual_matches.json") -OutDir (Join-Path $runDir "compare_matches")
$extra = Invoke-CompareFixture -ContractPath $contractPath -ActualPath (Join-Path $fixtureRoot "mission_contract_extra_file_violation.json") -OutDir (Join-Path $runDir "compare_extra")
$large = Invoke-CompareFixture -ContractPath $contractPath -ActualPath (Join-Path $fixtureRoot "mission_contract_diff_too_large.json") -OutDir (Join-Path $runDir "compare_large")
$forbidden = Invoke-CompareFixture -ContractPath $contractPath -ActualPath (Join-Path $fixtureRoot "mission_contract_forbidden_path_violation.json") -OutDir (Join-Path $runDir "compare_forbidden")
$checksArray = Invoke-CompareFixture -ContractPath (Join-Path $fixtureRoot "mission_contract_required_checks_array.json") -ActualPath (Join-Path $fixtureRoot "mission_contract_required_checks_actual_matches.json") -OutDir (Join-Path $runDir "compare_checks_array")
$checksComma = Invoke-CompareFixture -ContractPath (Join-Path $fixtureRoot "mission_contract_required_checks_comma_string.json") -ActualPath (Join-Path $fixtureRoot "mission_contract_required_checks_actual_matches.json") -OutDir (Join-Path $runDir "compare_checks_comma")
$checksNewline = Invoke-CompareFixture -ContractPath (Join-Path $fixtureRoot "mission_contract_required_checks_newline_semicolon_string.json") -ActualPath (Join-Path $fixtureRoot "mission_contract_required_checks_actual_matches.json") -OutDir (Join-Path $runDir "compare_checks_newline")
$checksMissing = Invoke-CompareFixture -ContractPath (Join-Path $fixtureRoot "mission_contract_required_checks_array.json") -ActualPath (Join-Path $fixtureRoot "mission_contract_required_checks_missing_check.json") -OutDir (Join-Path $runDir "compare_checks_missing")

$built = (& (Join-Path $PSScriptRoot "build_mission_contract.ps1") `
  -MissionId "A11A_BUILDER_SMOKE" `
  -RiskTier "green" `
  -WorkType "docs-only" `
  -Goal "Create one mission contract builder smoke document." `
  -ExpectedChangedFiles @("docs/autopilot/A11A_BUILDER_SMOKE.md") `
  -AllowedPaths @("docs/autopilot/**") `
  -ForbiddenPaths @("frontend/**", "backend/**", "docs/rebuild/**", "plan/**", "package.json", "package-lock.json", "App.tsx", ".serena/**", "qa_artifacts/**", ".venv/**") `
  -MaxFiles 1 `
  -MaxDiffLines 80 `
  -ExpectedDiffLinesMin 10 `
  -ExpectedDiffLinesMax 70 `
  -ExpectedReadPaths @("docs/autopilot/**") `
  -ExpectedWritePaths @("docs/autopilot/A11A_BUILDER_SMOKE.md") `
  -RequiredChecks @("git diff --check") `
  -ExpectedArtifacts @("mission_report.md") `
  -StopConditions @("any forbidden path touched", "git diff --check fails") `
  -OutDir (Join-Path $runDir "builder_smoke")) | ConvertFrom-Json

$builtValidation = Invoke-ValidateFixture -FixturePath $built.contract_json -OutDir (Join-Path $runDir "validate_built")
$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($valid.exit_code -eq 0) "valid docs-only contract should pass validation"
Assert-True ($valid.result.validation_result -eq "PASS") "valid contract result mismatch"
Assert-True ($missing.exit_code -eq 1) "missing required field should fail"
Assert-True ($missing.result.validation_result -eq "FAIL") "missing field validation mismatch"
Assert-True ($matches.exit_code -eq 0) "matching actual result should pass"
Assert-True ($matches.result.contract_result -eq "PASS") "matching comparison result mismatch"
Assert-True ($extra.exit_code -eq 1) "extra file violation should fail"
Assert-True ($extra.result.contract_result -eq "FAIL") "extra file comparison result mismatch"
Assert-True ($large.exit_code -eq 2) "diff too large should stop for supervisor"
Assert-True ($large.result.contract_result -eq "STOP_FOR_SUPERVISOR") "large diff comparison result mismatch"
Assert-True ($forbidden.exit_code -eq 3) "forbidden backend path should require quarantine"
Assert-True ($forbidden.result.contract_result -eq "QUARANTINE_REQUIRED") "forbidden path comparison result mismatch"
Assert-True ($checksArray.exit_code -eq 0) "required_checks array should pass"
Assert-True ($checksArray.result.contract_result -eq "PASS") "required_checks array result mismatch"
Assert-True ($checksComma.exit_code -eq 0) "required_checks comma string should pass"
Assert-True ($checksComma.result.contract_result -eq "PASS") "required_checks comma result mismatch"
Assert-True ($checksNewline.exit_code -eq 0) "required_checks newline/semicolon string should pass"
Assert-True ($checksNewline.result.contract_result -eq "PASS") "required_checks newline result mismatch"
Assert-True ($checksMissing.exit_code -eq 1) "missing required check should still fail"
Assert-True ($checksMissing.result.contract_result -eq "FAIL") "missing required check result mismatch"
Assert-True (($checksMissing.result.violations -join "`n") -match "tools/plan_guard.py") "missing plan guard check should be reported"
Assert-True ($built.status -eq "built") "builder smoke should create a contract"
Assert-True (Test-Path -LiteralPath $built.contract_json) "builder smoke contract json missing"
Assert-True (Test-Path -LiteralPath $built.contract_markdown) "builder smoke contract markdown missing"
Assert-True ($builtValidation.exit_code -eq 0) "built contract should validate"
Assert-True (-not [bool]$state.mission_contract_enabled) "mission_contract_enabled must remain false"
Assert-True ([bool]$state.mission_contract_required_for_night_mode) "mission_contract_required_for_night_mode must be true"
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
    valid_docs_only_contract_passes = $true
    missing_required_field_fails = $true
    actual_result_matching_contract_passes = $true
    extra_file_violation_fails = $true
    diff_too_large_fails = $true
    forbidden_path_violation_fails = $true
    required_checks_array_passes = $true
    required_checks_comma_string_passes = $true
    required_checks_newline_semicolon_string_passes = $true
    missing_required_check_still_fails = $true
    build_mission_contract_creates_files = $true
    no_live_chatgpt_call = $true
    no_product_mission_executed = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "mission_contract_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
