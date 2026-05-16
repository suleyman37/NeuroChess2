$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-EarlyExitFixture {
  param(
    [string]$Fixture,
    [string]$MissionId,
    [string]$WorkType,
    [int]$MaxDiffLines = 100
  )
  $out = & (Join-Path $PSScriptRoot "check_early_exit.ps1") `
    -MissionId $MissionId `
    -RiskTier "green" `
    -WorkType $WorkType `
    -AllowedPaths @("docs/autopilot/**") `
    -ForbiddenPaths @("frontend/**", "backend/**", "docs/rebuild/**", "plan/**", ".serena/**", ".venv/**", "qa_artifacts/**", "package.json", "package-lock.json", "App.tsx") `
    -MaxFiles 2 `
    -MaxDiffLines $MaxDiffLines `
    -FixturePath $Fixture `
    -ReportDir (Join-Path $script:runDir ([IO.Path]::GetFileNameWithoutExtension($Fixture))) 2>$null
  $code = $LASTEXITCODE
  $json = if ($out) { ($out -join "`n") | ConvertFrom-Json } else { $null }
  return [ordered]@{ exit_code = $code; result = $json }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$script:runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\early_exit_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $script:runDir | Out-Null

$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$clean = Invoke-EarlyExitFixture -Fixture (Join-Path $fixtureRoot "early_exit_clean_green_docs.json") -MissionId "A8_CLEAN_GREEN_DOCS" -WorkType "docs-only"
$codeTouched = Invoke-EarlyExitFixture -Fixture (Join-Path $fixtureRoot "early_exit_docs_only_code_touched.json") -MissionId "A8_DOCS_CODE_TOUCHED" -WorkType "docs-only"
$forbidden = Invoke-EarlyExitFixture -Fixture (Join-Path $fixtureRoot "early_exit_forbidden_path.json") -MissionId "A8_FORBIDDEN_PATH" -WorkType "docs-only"
$large = Invoke-EarlyExitFixture -Fixture (Join-Path $fixtureRoot "early_exit_diff_too_large.json") -MissionId "A8_DIFF_TOO_LARGE" -WorkType "docs-only" -MaxDiffLines 100

$shadow = (& (Join-Path $PSScriptRoot "run_shadow_lint.ps1") -ReportDir (Join-Path $script:runDir "shadow_lint") -AutomationOnly) | ConvertFrom-Json
$context = (& (Join-Path $PSScriptRoot "update_mission_runtime_context.ps1") `
  -CurrentTask "A8_TEST" `
  -RiskTier "green" `
  -WorkType "automation-safety" `
  -NextExpectedStep "A8B_STRATEGIC_PULSE_REVIEW_PROTOCOL" `
  -ActiveConstraints @("no product code") `
  -DoNotTouch @("frontend/**", "backend/**", "docs/rebuild/**") `
  -ReportDir (Join-Path $script:runDir "runtime_context") `
  -DryRun) | ConvertFrom-Json

$runtimePath = Join-Path $repoRoot "ops\autopilot\runtime\current_mission_context.json"
git -C $repoRoot check-ignore -q "ops/autopilot/runtime/current_mission_context.json"
$gitIgnored = ($LASTEXITCODE -eq 0)
$runtimeGenerated = Test-Path -LiteralPath $runtimePath
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($clean.exit_code -eq 0) "clean green docs fixture should continue"
Assert-True ($clean.result.decision -eq "CONTINUE") "clean fixture decision mismatch"
Assert-True ($codeTouched.exit_code -eq 1) "docs-only code touched fixture should stop mechanically"
Assert-True ($codeTouched.result.decision -eq "STOP_MECHANICAL") "code touched decision mismatch"
Assert-True ($forbidden.exit_code -eq 1) "forbidden path fixture should stop mechanically"
Assert-True ($forbidden.result.decision -eq "STOP_MECHANICAL") "forbidden path decision mismatch"
Assert-True ($large.exit_code -eq 2) "large diff fixture should stop for supervisor"
Assert-True ($large.result.decision -eq "STOP_FOR_SUPERVISOR") "large diff decision mismatch"
Assert-True ($shadow.status -eq "pass") "shadow lint should pass on current A8 changes"
Assert-True (-not [bool]$shadow.live_product_tests_executed) "shadow lint must not execute product tests"
Assert-True ([bool]$context.dry_run) "runtime context dry-run should report dry_run true"
Assert-True (-not [bool]$context.wrote_context) "runtime context dry-run must not write generated context"
Assert-True ($gitIgnored -or -not $runtimeGenerated) "generated runtime context must be gitignored or not generated"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $script:runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    clean_green_docs_continue = $true
    docs_only_code_touched_stop_mechanical = $true
    forbidden_path_stop_mechanical = $true
    diff_too_large_stop_for_supervisor = $true
    shadow_lint_safe = $true
    runtime_context_dry_run = $true
    runtime_context_gitignored_or_not_generated = $true
    no_live_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $script:runDir "early_exit_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
