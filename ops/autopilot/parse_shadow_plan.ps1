param(
  [string]$PlanJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-ShadowPlanInput {
  if ($PlanJson) { return $PlanJson }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return Get-Content -LiteralPath $InputPath -Raw
  }
  throw "Provide -PlanJson or -InputPath."
}

try {
  $raw = Read-ShadowPlanInput
  $errors = [System.Collections.Generic.List[string]]::new()
  $plan = $null
  try {
    $plan = $raw | ConvertFrom-Json
  } catch {
    $errors.Add("invalid JSON: $($_.Exception.Message)") | Out-Null
  }

  $payload = [ordered]@{
    valid_parse = ($errors.Count -eq 0)
    plan = $plan
    errors = @($errors)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $payload | ConvertTo-Json -Depth 30
  if ($errors.Count -eq 0) { exit 0 }
  exit 1
} catch {
  [ordered]@{
    valid_parse = $false
    plan = $null
    errors = @($_.Exception.Message)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
