$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonScript {
  param([string]$ScriptPath, [string[]]$Arguments = @(), [int]$ExpectedExitCode = 0)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments
  $exitCode = $LASTEXITCODE
  Assert-True ($exitCode -eq $ExpectedExitCode) "Unexpected exit code $exitCode for $ScriptPath"
  return ($output | Out-String | ConvertFrom-Json)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\session_rollovers" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"

$dueByMessages = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "check_session_rollover_due.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtureRoot "session_rollover_due_by_messages.json")
)
Assert-True ([bool]$dueByMessages.rollover_due) "rollover should be due by assistant responses"
Assert-True ($dueByMessages.recommended_action -eq "start_new_supervisor_session") "due by messages should recommend new session"

$dueByMissions = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "check_session_rollover_due.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtureRoot "session_rollover_due_by_missions.json")
)
Assert-True ([bool]$dueByMissions.rollover_due) "rollover should be due by missions"

$notDue = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "check_session_rollover_due.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtureRoot "session_rollover_not_due.json")
)
Assert-True (-not [bool]$notDue.rollover_due) "rollover should not be due"
Assert-True ($notDue.recommended_action -eq "continue_current_session") "not due should continue session"

$handoff = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "build_supervisor_handoff_pack.ps1") -Arguments @(
  "-OutDir", (Join-Path $runDir "handoff")
)
Assert-True (Test-Path -LiteralPath $handoff.handoff_pack_path) "handoff pack missing"
$handoffText = Get-Content -LiteralPath $handoff.handoff_pack_path -Raw
foreach ($required in @(
  "project_name: NeuroChess Supervisor",
  "## Last 8 Commits",
  "## Current Product Checkpoint",
  "## Current Automation Stack",
  "## Current Disabled Features",
  "## Active Risks",
  "## Current Forbidden Zones",
  "## Red-Tier Rules",
  "## Required Response Formats",
  "Do not provide broad prompts. Use MICRO_PROMPT only when asked."
)) {
  Assert-True ($handoffText.Contains($required)) "handoff pack missing section: $required"
}
Assert-True (-not [bool]$handoff.includes_full_patch) "handoff must not include full patch"
Assert-True (-not [bool]$handoff.live_chatgpt_called) "handoff builder must not call ChatGPT"

$validReady = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "validate_supervisor_ready_response.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtureRoot "supervisor_ready_valid.txt"),
  "-Nonce", "A12_READY_NONCE",
  "-ReportDir", (Join-Path $runDir "ready-valid")
)
Assert-True ([bool]$validReady.valid) "valid READY response should pass"

$invalidMissingDone = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "validate_supervisor_ready_response.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtureRoot "supervisor_ready_invalid_missing_done.txt"),
  "-Nonce", "A12_READY_NONCE",
  "-ReportDir", (Join-Path $runDir "ready-missing-done")
) -ExpectedExitCode 1
Assert-True (-not [bool]$invalidMissingDone.valid) "missing DONE should fail"

$canaryFailPath = Join-Path $runDir "supervisor_ready_canary_fail.txt"
(Get-Content -LiteralPath (Join-Path $fixtureRoot "supervisor_ready_valid.txt") -Raw).Replace("red_tier_known: PASS", "red_tier_known: FAIL") |
  Set-Content -LiteralPath $canaryFailPath -Encoding UTF8
$invalidCanary = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "validate_supervisor_ready_response.ps1") -Arguments @(
  "-InputPath", $canaryFailPath,
  "-Nonce", "A12_READY_NONCE",
  "-ReportDir", (Join-Path $runDir "ready-canary-fail")
) -ExpectedExitCode 1
Assert-True (-not [bool]$invalidCanary.valid) "failing canary should fail"

foreach ($result in @($dueByMessages, $dueByMissions, $notDue, $handoff, $validReady)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "scripts must not call live ChatGPT"
  Assert-True (-not [bool]$result.product_mission_executed) "scripts must not execute product missions"
}

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.chatgpt_project_name -eq "NeuroChess Supervisor") "state must record project name"
Assert-True (-not [bool]$state.session_rollover_enabled) "session rollover must remain disabled"
Assert-True ([bool]$state.supervisor_ready_required) "supervisor READY must be required"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    rollover_due_by_assistant_responses = "PASS"
    rollover_due_by_missions = "PASS"
    rollover_not_due = "PASS"
    handoff_pack_sections = "PASS"
    valid_ready_response = "PASS"
    invalid_ready_missing_done = "PASS"
    canary_checks_required = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
  }
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "session_rollover_protocol_test_result.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
exit 0
