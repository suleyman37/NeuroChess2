$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonScript {
  param(
    [string]$Script,
    [string[]]$Arguments = @(),
    [int[]]$AcceptExitCodes = @(0)
  )
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  $text = ($output | Out-String).Trim()
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Script $($Arguments -join ' '). Output: $text"
  try {
    return ($text | ConvertFrom-Json)
  } catch {
    throw "Script did not return JSON: $Script. Output: $text"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixtures = Join-Path $PSScriptRoot "fixtures"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20d_dynamic_objective_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$reservoirPath = Join-Path $tempRoot "objective_reservoir.json"
$reservoir = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_objective_reservoir.ps1") -Arguments @(
  "-ContextPath", (Join-Path $fixtures "objective_reservoir_initial.json"),
  "-OutPath", $reservoirPath
)
Assert-True ($reservoir.schema_version -eq "A20D_objective_reservoir_v1") "objective reservoir schema mismatch"
Assert-True ($reservoir.objective_count -ge 2) "objective reservoir should include fixture candidates"
Assert-True ($reservoir.high_value_count -ge 1) "objective reservoir should rank high-value candidates"
Assert-True (Test-Path -LiteralPath $reservoirPath -PathType Leaf) "objective reservoir output missing"

$backendScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_objective_candidate.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "objective_candidate_backend_e2e.json")
)
Assert-True ($backendScore.objective_score_result -eq "PASS") "high-value backend objective should pass"

$frontendScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_objective_candidate.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "objective_candidate_frontend_visual.json")
)
Assert-True ($frontendScore.objective_score_result -eq "PASS") "frontend visual objective should pass with visual provider available"

$lowValueScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_objective_candidate.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "objective_candidate_low_value_docs.json")
) -AcceptExitCodes @(2)
Assert-True ($lowValueScore.objective_score_result -eq "REJECT_LOW_MARGINAL_VALUE") "low-value docs filler should reject"

$denyDrain = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_drain_permit.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "drain_permit_quota_met_but_time_remaining.json")
) -AcceptExitCodes @(2)
Assert-True ($denyDrain.drain_permit -eq "DENY_DRAIN") "quota reached early with high-value time remaining should deny DRAIN"
Assert-True ($denyDrain.required_next_action -eq "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE") "denied early drain should ask architect for next objective"

$allowDrain = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_drain_permit.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "drain_permit_no_high_value_objectives.json")
)
Assert-True ($allowDrain.drain_permit -eq "ALLOW_DRAIN") "no high-value objectives should allow DRAIN"

$shortTimePath = Join-Path $tempRoot "drain_time_short.json"
Set-Content -LiteralPath $shortTimePath -Encoding UTF8 -Value @'
{
  "run_state": {
    "quota_reached": true,
    "remaining_time_minutes": 12,
    "strategic_pulse_ran": true,
    "report_complete": true,
    "evidence_complete": true,
    "branches_classified": true
  },
  "objective_reservoir": {
    "high_value_count": 1,
    "candidates": [
      { "objective_id": "late_objective", "marginal_value_score": 85, "red_tier_risk": 0, "branch_overlap_risk": 0 }
    ]
  }
}
'@
$shortTimeDrain = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_drain_permit.ps1") -Arguments @("-InputPath", $shortTimePath)
Assert-True ($shortTimeDrain.drain_permit -eq "ALLOW_DRAIN") "remaining time too short should allow DRAIN"

$overlapCandidatePath = Join-Path $tempRoot "overlap_candidate.json"
Set-Content -LiteralPath $overlapCandidatePath -Encoding UTF8 -Value @'
{
  "objective_id": "overlap_risk_fixture",
  "category": "BACKEND_READONLY_E2E",
  "north_star_vector": ["honest feedback"],
  "expected_e2e_potential": true,
  "expected_branch_count": 1,
  "expected_files": ["backend/tests/test_conflicting.py"],
  "expected_time_minutes_min": 25,
  "expected_time_minutes_max": 45,
  "branch_overlap_risk": 85,
  "red_tier_risk": 0,
  "visual_audit_required": false,
  "visual_provider_available": true,
  "evidence_expected": ["test"],
  "marginal_value_score": 82,
  "confidence": 0.8,
  "reason_to_do_now": "fixture",
  "reason_not_to_do": "overlap",
  "recommended_phase": "ADAPTIVE_EXTENSION"
}
'@
$overlapScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_objective_candidate.ps1") -Arguments @("-CandidatePath", $overlapCandidatePath) -AcceptExitCodes @(2)
Assert-True ($overlapScore.objective_score_result -eq "REJECT_LOW_MARGINAL_VALUE") "high branch overlap risk should reject objective"

$missingEvidencePath = Join-Path $tempRoot "drain_missing_evidence.json"
Set-Content -LiteralPath $missingEvidencePath -Encoding UTF8 -Value @'
{
  "run_state": {
    "quota_reached": true,
    "remaining_time_minutes": 80,
    "strategic_pulse_ran": true,
    "report_complete": true,
    "evidence_complete": false,
    "branches_classified": true
  },
  "objective_reservoir": {
    "high_value_count": 0,
    "candidates": []
  }
}
'@
$missingEvidence = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_drain_permit.ps1") -Arguments @("-InputPath", $missingEvidencePath) -AcceptExitCodes @(2)
Assert-True ($missingEvidence.drain_permit -eq "DENY_DRAIN") "missing evidence after quota should deny DRAIN"
Assert-True ($missingEvidence.required_next_action -eq "EVIDENCE_AMPLIFICATION") "missing evidence should force evidence amplification"

$drainRejected = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_dynamic_objective_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "dynamic_decision_drain_rejected_early.json")
) -AcceptExitCodes @(2)
Assert-True ($drainRejected.dynamic_objective_decision -eq "REJECT_DRAIN_DENIED") "ChatGPT Architect DRAIN should reject when Drain Permit denies it"

$extendAccepted = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_dynamic_objective_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "dynamic_decision_extend_product.json")
)
Assert-True ($extendAccepted.dynamic_objective_decision -eq "ACCEPT_OBJECTIVE") "adaptive extension should accept only a marginal-value PASS objective"

$consolidateAccepted = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_dynamic_objective_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "dynamic_decision_consolidate.json")
)
Assert-True ($consolidateAccepted.dynamic_objective_decision -eq "ACCEPT_OBJECTIVE") "consolidation objective should be accepted when it clears middle-value gate"

$lowUtilization = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "update_productive_time_ledger.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "productive_time_low_utilization.json")
)
Assert-True ($lowUtilization.productive_time_status -eq "LOW_UTILIZATION") "productive time ledger should detect low utilization"

$healthyUtilization = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "update_productive_time_ledger.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "productive_time_healthy.json")
)
Assert-True ($healthyUtilization.productive_time_status -eq "HEALTHY") "productive time ledger should detect healthy utilization"

$timeToDrainPath = Join-Path $tempRoot "productive_time_drain.json"
Set-Content -LiteralPath $timeToDrainPath -Encoding UTF8 -Value @'
{
  "target_wall_clock_minutes": 360,
  "hard_cap_minutes": 360,
  "drain_required_by_minutes": 330,
  "useful_work_target_ratio": 0.65,
  "minimum_meaningful_mission_minutes": 20,
  "wall_clock_elapsed": 345,
  "useful_mission_minutes_estimate": 260,
  "time_in_expansion": 220,
  "missions_attempted": 6,
  "high_value_missions": 5,
  "low_value_missions": 0,
  "e2e_deliverables": 5
}
'@
$timeToDrain = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "update_productive_time_ledger.ps1") -Arguments @("-InputPath", $timeToDrainPath)
Assert-True ($timeToDrain.productive_time_status -eq "TIME_TO_DRAIN") "productive time ledger should detect TIME_TO_DRAIN"

foreach ($result in @($reservoir, $backendScore, $frontendScore, $lowValueScore, $denyDrain, $allowDrain, $shortTimeDrain, $overlapScore, $missingEvidence, $drainRejected, $extendAccepted, $consolidateAccepted, $lowUtilization, $healthyUtilization, $timeToDrain)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbidden = @($changed | Where-Object {
  $_ -like "frontend/*" -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -eq "App.tsx"
})
Assert-True ($forbidden.Count -eq 0) "product files touched: $($forbidden -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.dynamic_objective_replanning_version -eq "A20D") "state missing A20D dynamic objective version"
Assert-True ([bool]$state.objective_reservoir_available) "state must mark objective reservoir available"
Assert-True ([bool]$state.productive_time_governor_available) "state must mark productive time governor available"
Assert-True ([bool]$state.adaptive_extension_phase_available) "state must mark adaptive extension available"
Assert-True ([bool]$state.drain_permit_policy_available) "state must mark drain permit available"
Assert-True ([bool]$state.marginal_value_gate_available) "state must mark marginal value gate available"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    objective_reservoir_builds = "PASS"
    backend_objective_score = $backendScore.objective_score_result
    frontend_visual_objective_score = $frontendScore.objective_score_result
    low_value_docs_filler = $lowValueScore.objective_score_result
    quota_early_drain_denied = $denyDrain.drain_permit
    no_high_value_drain_allowed = $allowDrain.drain_permit
    remaining_time_short = $shortTimeDrain.drain_permit
    branch_overlap_rejects = $overlapScore.objective_score_result
    missing_evidence_next_action = $missingEvidence.required_next_action
    architect_drain_rejected = $drainRejected.dynamic_objective_decision
    adaptive_extension_accepted = $extendAccepted.dynamic_objective_decision
    productive_time_low_utilization = $lowUtilization.productive_time_status
    productive_time_healthy = $healthyUtilization.productive_time_status
    productive_time_drain = $timeToDrain.productive_time_status
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
