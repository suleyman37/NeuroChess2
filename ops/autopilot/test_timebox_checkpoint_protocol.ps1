$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-TimeboxFixture {
  param([string]$FixturePath, [string]$OutDir)
  $json = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_mission_timebox.ps1") -FixturePath $FixturePath -ReportDir $OutDir
  return $json | ConvertFrom-Json
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\timebox_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"

$fresh = Invoke-TimeboxFixture -FixturePath (Join-Path $fixtureRoot "timebox_fresh_mission.json") -OutDir (Join-Path $runDir "fresh")
$warning = Invoke-TimeboxFixture -FixturePath (Join-Path $fixtureRoot "timebox_warning_due.json") -OutDir (Join-Path $runDir "warning")
$stop = Invoke-TimeboxFixture -FixturePath (Join-Path $fixtureRoot "timebox_stop_due.json") -OutDir (Join-Path $runDir "stop")
$longTests = Invoke-TimeboxFixture -FixturePath (Join-Path $fixtureRoot "timebox_long_tests_allowed.json") -OutDir (Join-Path $runDir "long_tests")
$repair = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_mission_timebox.ps1") `
  -MissionId "TIMEBOX_REPAIR_LIMIT" `
  -RiskTier "green" `
  -WorkType "automation-safety" `
  -ElapsedMinutes 2 `
  -RepairAttempts 2 `
  -MaxRepairAttempts 2 `
  -ReportDir (Join-Path $runDir "repair_limit")) | ConvertFrom-Json

$checkpoint = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_timebox_checkpoint_report.ps1") `
  -MissionId "TIMEBOX_TEST_REPORT" `
  -RiskTier "green" `
  -WorkType "automation-safety" `
  -ElapsedMinutes 11 `
  -ChecksAttempted @("git diff --check") `
  -Completed @("created protocol files") `
  -Failed @("mission exceeded checkpoint") `
  -TechnicalProblems @("none") `
  -SuspectedNextAction "ask_supervisor" `
  -CodexNotes "Test checkpoint report only." `
  -OutDir (Join-Path $runDir "checkpoint_report")) | ConvertFrom-Json

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$policyText = Get-Content -LiteralPath (Join-Path $PSScriptRoot "timebox_policy.yaml") -Raw
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($fresh.timebox_decision -eq "CONTINUE") "fresh mission should continue"
Assert-True ($warning.timebox_decision -eq "WARN") "warning fixture should warn"
Assert-True ($stop.timebox_decision -eq "CHECKPOINT_STOP") "stop fixture should checkpoint stop"
Assert-True ($repair.timebox_decision -eq "STOP_FOR_SUPERVISOR") "repair limit should stop for supervisor"
Assert-True ($longTests.timebox_decision -eq "CONTINUE") "long tests fixture should not stop active work"
Assert-True (($longTests.reasons -join "`n") -match "tracked separately") "long test separation reason missing"
Assert-True (Test-Path -LiteralPath (Join-Path $checkpoint.report_dir "checkpoint_report.json")) "checkpoint report json missing"
Assert-True (Test-Path -LiteralPath (Join-Path $checkpoint.report_dir "git_status.txt")) "checkpoint git status missing"
Assert-True (Test-Path -LiteralPath (Join-Path $checkpoint.report_dir "patch.diff")) "checkpoint patch missing"
Assert-True (-not [bool]$state.hard_kill_enabled) "state hard_kill_enabled must remain false"
Assert-True ($policyText -match "hard_kill_enabled:\s*false") "policy hard_kill_enabled must remain false"
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
    fresh_continue = $true
    warning_warn = $true
    stop_checkpoint_stop = $true
    repair_stop_for_supervisor = $true
    long_tests_separate = $true
    checkpoint_report_created = $true
    hard_kill_disabled = $true
    no_live_product_mission = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "timebox_checkpoint_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
