param(
  [string]$ValidatedResponseJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-ValidatedResponse {
  if ($ValidatedResponseJson) { return ($ValidatedResponseJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -ValidatedResponseJson or -InputPath."
}

try {
  $response = Read-ValidatedResponse
  $action = "STOP_FOR_STRATEGIC_PULSE"
  $allowOriginal = $false
  $reasons = [System.Collections.Generic.List[string]]::new()

  if (-not [bool]$response.valid) {
    $action = "STOP_FOR_STRATEGIC_PULSE"
    $reasons.Add("invalid Gemini audit response") | Out-Null
  } else {
    switch ([string]$response.verdict) {
      "APPROVE" { $action = "CONTINUE"; $allowOriginal = $true; $reasons.Add("Gemini approved; deterministic gates still required") | Out-Null }
      "PASS_VISUAL" { $action = "CONTINUE"; $allowOriginal = $true; $reasons.Add("Visual Court passed; deterministic gates still required") | Out-Null }
      "NARROW" { $action = "REQUEST_PLANNER_NARROWING"; $reasons.Add("Gemini requested narrowing") | Out-Null }
      "WARNING_VISUAL" { $action = "REQUEST_PLANNER_NARROWING"; $reasons.Add("Visual Court warning requires narrowing or review") | Out-Null }
      "REJECT" { $action = "STOP_FOR_STRATEGIC_PULSE"; $reasons.Add("Gemini rejected original prompt") | Out-Null }
      "QUARANTINE" { $action = "QUARANTINE_REQUIRED"; $reasons.Add("Gemini requires quarantine") | Out-Null }
      "BLOCK_VISUAL" { $action = "BLOCK_VISUAL_REWORK"; $reasons.Add("Visual Court blocked branch readiness") | Out-Null }
      "REPORT_ONLY" { $action = "RECORD_LONG_HORIZON_REPORT"; $reasons.Add("Long-Horizon Critic is report-only") | Out-Null }
      default { $action = "STOP_FOR_STRATEGIC_PULSE"; $reasons.Add("unknown verdict") | Out-Null }
    }
  }

  [ordered]@{
    decision_applied = $true
    control_plane_action = $action
    allowed_to_execute_original_prompt = $allowOriginal
    deterministic_gates_still_required = $true
    gemini_can_override_deterministic_gates = $false
    reasons = @($reasons)
    live_gemini_called = $false
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    decision_applied = $false
    control_plane_action = "STOP_FOR_STRATEGIC_PULSE"
    allowed_to_execute_original_prompt = $false
    deterministic_gates_still_required = $true
    gemini_can_override_deterministic_gates = $false
    reasons = @($_.Exception.Message)
    live_gemini_called = $false
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
