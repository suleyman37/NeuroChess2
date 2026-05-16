param(
  [string]$StatePath = "",
  [string]$FixturePath = "",
  [int]$AssistantResponseThreshold = 0,
  [int]$MissionThreshold = 0
)

$ErrorActionPreference = "Stop"

function Read-JsonObject {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "JSON input not found: $Path"
  }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-IntValue {
  param($Object, [string]$Name, [int]$DefaultValue = 0)
  if ($null -eq $Object.PSObject.Properties[$Name]) { return $DefaultValue }
  if ($null -eq $Object.$Name) { return $DefaultValue }
  return [int]$Object.$Name
}

function Get-BoolValue {
  param($Object, [string]$Name)
  if ($null -eq $Object.PSObject.Properties[$Name]) { return $false }
  if ($null -eq $Object.$Name) { return $false }
  return [bool]$Object.$Name
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ($FixturePath) {
  $state = Read-JsonObject -Path $FixturePath
} elseif ($StatePath) {
  $state = Read-JsonObject -Path $StatePath
} else {
  $state = Read-JsonObject -Path (Join-Path $repoRoot "ops\autopilot\state.json")
}

if ($AssistantResponseThreshold -le 0) {
  $AssistantResponseThreshold = Get-IntValue -Object $state -Name "rollover_threshold_assistant_responses" -DefaultValue 15
}
if ($MissionThreshold -le 0) {
  $MissionThreshold = Get-IntValue -Object $state -Name "rollover_threshold_missions" -DefaultValue 5
}

$assistantResponses = Get-IntValue -Object $state -Name "assistant_responses_in_session"
$missions = Get-IntValue -Object $state -Name "missions_in_session"
$invalidResponses = Get-IntValue -Object $state -Name "invalid_supervisor_responses_in_session"

$reasons = [System.Collections.Generic.List[string]]::new()
if ($assistantResponses -ge $AssistantResponseThreshold) {
  $reasons.Add("assistant_responses_in_session >= $AssistantResponseThreshold") | Out-Null
}
if ($missions -ge $MissionThreshold) {
  $reasons.Add("missions_in_session >= $MissionThreshold") | Out-Null
}
if ($invalidResponses -ge 2) {
  $reasons.Add("invalid_supervisor_responses_in_session >= 2") | Out-Null
}
foreach ($flag in @(
  "strategic_pulse_completed",
  "request_more_repeated",
  "bridge_instability",
  "supervisor_drift_canary_failed",
  "wrong_model_or_mode_response",
  "format_drift",
  "repeated_missing_nonce_done",
  "broad_prompts_twice",
  "stale_or_wrong_project_conversation"
)) {
  if (Get-BoolValue -Object $state -Name $flag) {
    $reasons.Add($flag) | Out-Null
  }
}

$due = $reasons.Count -gt 0
[ordered]@{
  rollover_due = $due
  reasons = @($reasons)
  assistant_responses_in_session = $assistantResponses
  missions_in_session = $missions
  recommended_action = if ($due) { "start_new_supervisor_session" } else { "continue_current_session" }
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 6
