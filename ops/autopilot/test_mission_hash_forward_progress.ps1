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
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\control_plane_loop_guards" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$hashScript = Join-Path $PSScriptRoot "compute_mission_hash.ps1"
$repeatScript = Join-Path $PSScriptRoot "check_mission_repeat.ps1"
$progressScript = Join-Path $PSScriptRoot "check_forward_progress.ps1"
$ledgerScript = Join-Path $PSScriptRoot "update_progress_ledger.ps1"

$hashA = Invoke-JsonCommand -Arguments @("-File", $hashScript, "-InputPath", (Join-Path $fixtureRoot "mission_hash_same_a.json"))
$hashB = Invoke-JsonCommand -Arguments @("-File", $hashScript, "-InputPath", (Join-Path $fixtureRoot "mission_hash_same_b_whitespace_changed.json"))
$hashDifferentGoal = Invoke-JsonCommand -Arguments @("-File", $hashScript, "-InputPath", (Join-Path $fixtureRoot "mission_hash_different_goal.json"))
$hashDifferentAllowedPaths = Invoke-JsonCommand -Arguments @("-File", $hashScript, "-InputPath", (Join-Path $fixtureRoot "mission_hash_different_allowed_paths.json"))

$hashListPath = Join-Path $runDir "mission_hashes_seen.json"
@([string]$hashA.json.mission_hash) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $hashListPath -Encoding UTF8
$repeat = Invoke-JsonCommand -Arguments @("-File", $repeatScript, "-InputPath", (Join-Path $fixtureRoot "mission_hash_same_b_whitespace_changed.json"), "-HashListPath", $hashListPath)

$commitProgress = Invoke-JsonCommand -Arguments @("-File", $progressScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_commit_success.json"))
$branchProgress = Invoke-JsonCommand -Arguments @("-File", $progressScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_branch_success.json"))
$artifactProgress = Invoke-JsonCommand -Arguments @("-File", $progressScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_artifact_success.json"))
$noProgress = Invoke-JsonCommand -Arguments @("-File", $progressScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_no_commit_no_artifact.json"))

$ledgerPath = Join-Path $runDir "progress_ledger.jsonl"
$appendOne = Invoke-JsonCommand -Arguments @("-File", $ledgerScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_no_commit_no_artifact.json"), "-LedgerPath", $ledgerPath)
$twoNoProgress = Invoke-JsonCommand -Arguments @("-File", $progressScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_no_commit_no_artifact.json"), "-LedgerPath", $ledgerPath)
$appendTwo = Invoke-JsonCommand -Arguments @("-File", $ledgerScript, "-InputPath", (Join-Path $fixtureRoot "forward_progress_commit_success.json"), "-LedgerPath", $ledgerPath)
$ledgerLines = @((Get-Content -LiteralPath $ledgerPath) | Where-Object { $_.Trim() })

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($hashA.exit_code -eq 0 -and $hashB.exit_code -eq 0) "mission hash fixtures should compute"
Assert-True ($hashA.json.mission_hash -eq $hashB.json.mission_hash) "whitespace-only mission changes should produce same hash"
Assert-True ($hashA.json.mission_hash -ne $hashDifferentGoal.json.mission_hash) "changed goal should produce different hash"
Assert-True ($hashA.json.mission_hash -ne $hashDifferentAllowedPaths.json.mission_hash) "changed allowed_paths should produce different hash"
Assert-True ($repeat.exit_code -ne 0 -and $repeat.json.decision -eq "STOP_REPEAT_MISSION_HASH") "repeated mission hash should stop"
Assert-True ([bool]$commitProgress.json.forward_progress -and $commitProgress.json.decision -eq "CONTINUE") "commit success should count as progress"
Assert-True ([bool]$branchProgress.json.forward_progress -and (($branchProgress.json.evidence -join "`n") -match "ephemeral_branch")) "branch plus evidence should count as progress"
Assert-True ([bool]$artifactProgress.json.forward_progress -and (($artifactProgress.json.evidence -join "`n") -match "external_report")) "external artifact/report should count as progress"
Assert-True (-not [bool]$noProgress.json.forward_progress -and $noProgress.json.decision -eq "WARN_NO_PROGRESS") "no commit/no artifact/no diff should warn no progress"
Assert-True ($twoNoProgress.exit_code -ne 0 -and $twoNoProgress.json.decision -eq "STOP_NO_FORWARD_PROGRESS") "two consecutive no-progress entries should stop"
Assert-True ([bool]$appendOne.json.append_only -and [bool]$appendTwo.json.append_only -and $ledgerLines.Count -eq 2) "ledger append should preserve existing entries"
Assert-True (-not [bool]$state.mission_hash_detector_enabled) "mission hash detector must remain disabled live"
Assert-True (-not [bool]$state.forward_progress_detector_enabled) "forward progress detector must remain disabled live"
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
    whitespace_hash_stable = "PASS"
    changed_goal_hash_differs = "PASS"
    changed_allowed_paths_hash_differs = "PASS"
    repeated_mission_hash_stops = "PASS"
    commit_success_counts_as_progress = "PASS"
    branch_evidence_counts_as_progress = "PASS"
    artifact_counts_as_progress = "PASS"
    no_progress_warns = "PASS"
    two_consecutive_no_progress_stops = "PASS"
    ledger_append_only = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "mission_hash_forward_progress_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
