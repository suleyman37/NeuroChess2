$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-Validation {
  param([string]$MissionPath, [string]$OutDir)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate_tdd_separation.ps1") -MissionJson $MissionPath -OutDir $OutDir
  $code = $LASTEXITCODE
  $json = if ($output) { ($output -join "`n") | ConvertFrom-Json } else { $null }
  return [ordered]@{ exit_code = $code; result = $json }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\tdd_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$docsMission = Join-Path $PSScriptRoot "fixtures\green_mission_docs_only.json"
$testOnlyMission = Join-Path $PSScriptRoot "fixtures\tdd_test_only_mission.json"
$implementationMission = Join-Path $PSScriptRoot "fixtures\tdd_implementation_only_mission.json"
$mixedMission = Join-Path $PSScriptRoot "fixtures\tdd_mixed_test_and_impl_mission.json"
$redPracticeMission = Join-Path $PSScriptRoot "fixtures\tdd_red_tier_practice_mission.json"

$docsValidation = Invoke-Validation -MissionPath $docsMission -OutDir (Join-Path $runDir "docs_validation")
$testOnlyClassification = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_tdd_phase.ps1") -MissionJson $testOnlyMission -OutDir (Join-Path $runDir "test_only_classification")) | ConvertFrom-Json
$testOnlyValidation = Invoke-Validation -MissionPath $testOnlyMission -OutDir (Join-Path $runDir "test_only_validation")
$implValidation = Invoke-Validation -MissionPath $implementationMission -OutDir (Join-Path $runDir "implementation_validation")
$mixedValidation = Invoke-Validation -MissionPath $mixedMission -OutDir (Join-Path $runDir "mixed_validation")
$redPracticeValidation = Invoke-Validation -MissionPath $redPracticeMission -OutDir (Join-Path $runDir "red_practice_validation")
$evidencePack = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_tdd_evidence_pack.ps1") -MissionJson $implementationMission -OutDir (Join-Path $runDir "tdd_evidence_pack")) | ConvertFrom-Json

$policyText = Get-Content -LiteralPath (Join-Path $PSScriptRoot "tdd_policy.yaml") -Raw
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($docsValidation.exit_code -eq 0) "docs-only mission should be allowed"
Assert-True ($docsValidation.result.tdd_phase -eq "docs_only") "docs-only phase mismatch"
Assert-True ($testOnlyClassification.tdd_phase -eq "test_contract") "test-only mission should classify test_contract"
Assert-True ($testOnlyValidation.exit_code -eq 0) "test-only mission should validate"
Assert-True ($implValidation.exit_code -ne 0) "implementation-only amber mission without prior marker should be rejected"
Assert-True (@($implValidation.result.violations) -contains "amber/red implementation requires prior test contract id, commit, or evidence pack") "implementation rejection reason missing"
Assert-True ($mixedValidation.exit_code -ne 0) "mixed amber mission should be rejected"
Assert-True ($mixedValidation.result.tdd_phase -eq "mixed_invalid") "mixed phase mismatch"
Assert-True ($redPracticeValidation.exit_code -ne 0) "red-tier practice mixed mission should be rejected"
Assert-True ($redPracticeValidation.result.tdd_phase -eq "mixed_invalid") "red practice mixed phase mismatch"
Assert-True ($evidencePack.status -eq "BLOCKED") "TDD evidence pack should be BLOCKED"
Assert-True (@($evidencePack.blocking_items) -contains "failing_test_before_implementation.log") "failing test evidence placeholder missing"
Assert-True ($policyText -match "red_tier_requires_tdd_separation:\s*true") "policy missing red-tier separation requirement"
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
    docs_only_allowed = $true
    test_only_classified_test_contract = $true
    implementation_without_prior_rejected = $true
    mixed_amber_rejected = $true
    red_practice_mixed_rejected = $true
    evidence_pack_marks_missing_evidence_blocking = $true
    no_live_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "tdd_separation_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
