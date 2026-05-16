$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\red_tier_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$greenMission = Join-Path $PSScriptRoot "fixtures\green_mission_docs_only.json"
$practiceMission = Join-Path $PSScriptRoot "fixtures\red_tier_mission_practice_attempt.json"
$dueAtMission = Join-Path $PSScriptRoot "fixtures\red_tier_mission_due_at.json"

$green = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_risk_tier.ps1") -MissionJson $greenMission -OutDir (Join-Path $runDir "green_classification")) | ConvertFrom-Json
$practice = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_risk_tier.ps1") -MissionJson $practiceMission -OutDir (Join-Path $runDir "practice_classification")) | ConvertFrom-Json
$dueAt = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_risk_tier.ps1") -MissionJson $dueAtMission -OutDir (Join-Path $runDir "due_at_classification")) | ConvertFrom-Json

$evidenceDir = Join-Path $runDir "evidence"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$rollback = Join-Path $evidenceDir "rollback_plan.md"
Set-Content -LiteralPath $rollback -Value "Rollback plan marker for preflight test." -Encoding UTF8

$preflightRoadJson = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate_red_tier_preflight.ps1") `
  -MissionJson $practiceMission `
  -BranchName "quarantine/red-practice-red-test-20260516-013000" `
  -EvidenceDir $evidenceDir `
  -RiskClassificationPath $practice.classification_path `
  -RollbackPlanPath $rollback `
  -RequiredChecks @("db_snapshot_before_after") `
  -CurrentBranchOverride "road-to-V2" `
  -OutDir (Join-Path $runDir "preflight_road") 2>$null
$preflightRoadCode = $LASTEXITCODE
$preflightRoad = $preflightRoadJson | ConvertFrom-Json

$preflightBranchJson = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate_red_tier_preflight.ps1") `
  -MissionJson $practiceMission `
  -BranchName "auto/red-practice-red-test-20260516-013000" `
  -EvidenceDir $evidenceDir `
  -RiskClassificationPath $practice.classification_path `
  -RollbackPlanPath $rollback `
  -RequiredChecks @("db_snapshot_before_after") `
  -CurrentBranchOverride "quarantine/red-practice-red-test-20260516-013000" `
  -OutDir (Join-Path $runDir "preflight_branch") 2>$null
$preflightBranchCode = $LASTEXITCODE
$preflightBranch = $preflightBranchJson | ConvertFrom-Json

$promoteJson = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "promote_ephemeral_branch.ps1") `
  -BranchName "quarantine/red-practice-red-test-20260516-013000" `
  -EvidenceDir (Join-Path $runDir "promotion_refusal") `
  -DryRun
$promoteCode = $LASTEXITCODE
$promote = $promoteJson | ConvertFrom-Json

$evidencePack = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_red_tier_evidence_pack.ps1") `
  -MissionJson $practiceMission `
  -ClassificationJson $practice.classification_path `
  -BranchName "quarantine/red-practice-red-test-20260516-013000" `
  -BaseHead $startHead `
  -OutDir (Join-Path $runDir "red_evidence_pack")) | ConvertFrom-Json

$policyText = Get-Content -LiteralPath (Join-Path $PSScriptRoot "red_tier_policy.yaml") -Raw
$fixturePolicyText = Get-Content -LiteralPath (Join-Path $PSScriptRoot "fixtures\red_tier_policy_valid.yaml") -Raw
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($green.risk_tier -eq "green") "docs-only sample should classify green"
Assert-True ($practice.risk_tier -eq "red") "practice_attempt sample should classify red"
Assert-True (@($practice.red_flags) -contains "practice_attempts write") "practice_attempt red flag missing"
Assert-True ($dueAt.risk_tier -eq "red") "due_at sample should classify red"
Assert-True (@($dueAt.red_flags) -contains "due_at mutation") "due_at red flag missing"
Assert-True ($preflightRoadCode -ne 0) "preflight should reject road-to-V2 current branch"
Assert-True ($preflightRoad.reasons -contains "current branch must not be road-to-V2") "road-to-V2 rejection reason missing"
Assert-True ($preflightBranchCode -ne 0) "preflight should reject non-quarantine branch name"
Assert-True ($preflightBranch.reasons -contains "branch name must start with quarantine/red-") "quarantine branch rejection reason missing"
Assert-True ($promoteCode -eq 2) "promotion should refuse quarantine branch"
Assert-True ($promote.status -eq "refused") "promotion refusal status mismatch"
Assert-True ($evidencePack.status -eq "BLOCKED") "evidence pack skeleton should be blocked"
Assert-True (@($evidencePack.blocking_items) -contains "db_snapshot_before_required.txt") "DB snapshot before placeholder missing"
Assert-True (@($evidencePack.blocking_items) -contains "db_snapshot_after_required.txt") "DB snapshot after placeholder missing"
Assert-True ($policyText -match "red_tier_auto_promote:\s*false") "red tier policy must disable auto promote"
Assert-True ($fixturePolicyText -match "requires_quarantine_branch:\s*true") "red tier policy fixture must require quarantine"
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
    docs_only_classified_green = $true
    practice_attempt_classified_red = $true
    due_at_classified_red = $true
    preflight_rejects_road_to_v2 = $true
    preflight_requires_quarantine_branch = $true
    promotion_refuses_quarantine_red = $true
    evidence_pack_marks_db_snapshots_required = $true
    no_live_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "red_tier_quarantine_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
