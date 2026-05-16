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
  Assert-True ($code -eq 0) "Unexpected exit code $code. Output: $raw"
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$resolver = Join-Path $PSScriptRoot "resolve_gemini_audit_decision.ps1"
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_decision_dryrun_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Resolve-Fixture {
  param([string]$Name)
  return Invoke-JsonCommand -Arguments @("-File", $resolver, "-InputPath", (Join-Path $fixtureRoot $Name))
}

$approveSafe = Resolve-Fixture "gemini_decision_approve_safe.json"
$approveContractFail = Resolve-Fixture "gemini_decision_approve_but_contract_fails.json"
$narrow = Resolve-Fixture "gemini_decision_narrow.json"
$reject = Resolve-Fixture "gemini_decision_reject.json"
$quarantine = Resolve-Fixture "gemini_decision_quarantine.json"
$visualPass = Resolve-Fixture "gemini_decision_visual_pass.json"
$visualWarning = Resolve-Fixture "gemini_decision_visual_warning.json"
$visualBlock = Resolve-Fixture "gemini_decision_visual_block.json"
$reportOnly = Resolve-Fixture "gemini_decision_report_only.json"
$bypass = Resolve-Fixture "gemini_decision_invalid_bypass_safety.json"

Assert-True ($approveSafe.json.decision_result -eq "CONTINUE" -and -not [bool]$approveSafe.json.deterministic_gate_override) "APPROVE with gates PASS should continue"
Assert-True ($approveContractFail.json.decision_result -eq "STOP_DETERMINISTIC_GATE" -and [bool]$approveContractFail.json.deterministic_gate_override) "APPROVE must not bypass Mission Contract failure"
Assert-True (($approveContractFail.json.reasons -join "`n") -match "mission_contract_result") "Mission Contract failure should be named"
Assert-True ($narrow.json.decision_result -eq "REQUEST_PLANNER_NARROWING") "NARROW should request planner narrowing"
Assert-True ($reject.json.decision_result -eq "STOP_FOR_STRATEGIC_PULSE") "REJECT should stop for Strategic Pulse"
Assert-True ($quarantine.json.decision_result -eq "QUARANTINE_REQUIRED") "QUARANTINE should require quarantine"
Assert-True ($visualPass.json.decision_result -eq "CONTINUE") "PASS_VISUAL with artifacts should continue"
Assert-True ($visualWarning.json.decision_result -eq "REQUEST_PLANNER_NARROWING") "WARNING_VISUAL should not auto-ready or auto-merge"
Assert-True ($visualBlock.json.decision_result -eq "BLOCK_VISUAL_REWORK") "BLOCK_VISUAL should map to rework"
Assert-True ($reportOnly.json.decision_result -eq "RECORD_LONG_HORIZON_REPORT") "REPORT_ONLY should be recorded only"
Assert-True ($bypass.json.decision_result -eq "STOP_DETERMINISTIC_GATE" -and [bool]$bypass.json.deterministic_gate_override) "Safety bypass attempts must stop deterministically"
Assert-True (($bypass.json.reasons -join "`n") -match "bypass|ignore|forbidden") "Bypass stop should explain the safety attempt"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ([string]$state.gemini_auditor_decision_dryrun_version -eq "A16I") "state should record A16I decision dry-run version"
Assert-True ([bool]$state.gemini_auditor_decision_dryrun_passed) "state should record A16I dry-run passed"
Assert-True ([bool]$state.gemini_auditor_control_plane_mapping_available) "state should expose Control Plane mapping availability"
Assert-True (-not [bool]$state.gemini_auditor_live_enforcement_enabled) "Gemini live enforcement must remain disabled"

$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
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
    approve_all_gates_pass_continue = "PASS"
    approve_contract_fail_stops = "PASS"
    narrow_requests_planner_narrowing = "PASS"
    reject_stops_for_pulse = "PASS"
    quarantine_required = "PASS"
    visual_pass_with_evidence_continues = "PASS"
    visual_warning_not_auto_merge = "PASS"
    visual_block_rework = "PASS"
    report_only_recorded = "PASS"
    safety_bypass_stops = "PASS"
    deterministic_gate_override = "PASS"
    no_live_gemini_call = $true
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "gemini_auditor_decision_dryrun_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
