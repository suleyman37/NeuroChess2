$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\ephemeral_branch_tests"
$runDir = Join-Path $outRoot (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$policyPath = Join-Path $PSScriptRoot "branch_policy.yaml"
$fixturePolicy = Join-Path $PSScriptRoot "fixtures\branch_policy_valid.yaml"
$policyText = Get-Content -LiteralPath $policyPath -Raw
$fixturePolicyText = Get-Content -LiteralPath $fixturePolicy -Raw

$prepareOut = Join-Path $runDir "prepare"
$prepareJson = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "prepare_ephemeral_branch.ps1") `
  -MissionId "A5 Step 1 Unsafe Name!" `
  -RiskTier "Green" `
  -WorkType "Docs Only" `
  -Timestamp "20260516-013000" `
  -OutDir $prepareOut `
  -DryRun
$prepareCode = $LASTEXITCODE
$prepare = $prepareJson | ConvertFrom-Json

$promoteOut = Join-Path $runDir "promote_red_refusal"
$promoteJson = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "promote_ephemeral_branch.ps1") `
  -BranchName "quarantine/red-practice-test-20260516-013000" `
  -EvidenceDir $promoteOut `
  -DryRun
$promoteCode = $LASTEXITCODE
$promote = $promoteJson | ConvertFrom-Json

$cleanupEvidenceRoot = Join-Path $runDir "empty_archives"
New-Item -ItemType Directory -Force -Path $cleanupEvidenceRoot | Out-Null
$cleanupJson = & (Join-Path $PSScriptRoot "cleanup_ephemeral_branches.ps1") `
  -EvidenceRoot $cleanupEvidenceRoot `
  -MockBranches @("road-to-V2", "auto/green-docs-test-20260516-013000", "quarantine/red-scope-test-20260516-013000") `
  -MockCurrentBranch "road-to-V2"
$cleanup = $cleanupJson | ConvertFrom-Json

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$mockAuto = @($cleanup.candidates | Where-Object { $_.branch -eq "auto/green-docs-test-20260516-013000" })[0]
$protectedBase = @($cleanup.candidates | Where-Object { $_.branch -eq "road-to-V2" })[0]
$quarantine = @($cleanup.candidates | Where-Object { $_.branch -eq "quarantine/red-scope-test-20260516-013000" })[0]

Assert-True ($policyText -match "schema_version:\s*A5B") "branch_policy.yaml missing A5B schema"
Assert-True ($fixturePolicyText -match "fast_forward_only:\s*true") "valid policy fixture missing fast-forward rule"
Assert-True ($prepare.branch_name -eq "auto/green-docs-only-a5-step-1-unsafe-name-20260516-013000") "branch sanitizer produced unexpected name: $($prepare.branch_name)"
Assert-True ([bool]$prepare.dry_run) "prepare dry-run output should report dry_run true"
Assert-True (($prepareCode -eq 0) -or ($prepare.status -eq "fail" -and ($prepare.errors -contains "repo is not clean"))) "prepare dry-run should pass when clean or fail only because this validation run has uncommitted protocol files"
Assert-True ($promoteCode -eq 2) "red/quarantine promotion should exit 2"
Assert-True ($promote.status -eq "refused") "red/quarantine promotion should be refused"
Assert-True ($promote.reason -eq "red_or_quarantine_branch_not_auto_promotable") "red/quarantine refusal reason mismatch"
Assert-True ($cleanup.mode -eq "dry_run") "cleanup should default to dry-run"
Assert-True ($cleanup.deleted.Count -eq 0) "cleanup dry-run must not delete"
Assert-True ($protectedBase.reasons -contains "protected_branch") "protected branch deletion refusal missing"
Assert-True ($mockAuto.reasons -contains "missing_archive_manifest") "missing evidence manifest should prevent deletion"
Assert-True ($quarantine.reasons -contains "quarantine_retention_not_evaluated_for_auto_delete") "quarantine retention refusal missing"
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
    policy_yaml_parse_light = $true
    branch_name_sanitizer = $true
    protected_branch_deletion_refusal = $true
    cleanup_dry_run = $true
    red_quarantine_promotion_refusal = $true
    missing_evidence_manifest_prevents_deletion = $true
    final_branch_unchanged = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "ephemeral_branch_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10

exit 0
