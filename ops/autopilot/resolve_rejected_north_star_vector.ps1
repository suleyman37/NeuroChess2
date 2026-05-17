param(
  [string]$InputPath = "",
  [string]$RejectionJson = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonInput {
  param([string]$Path, [string]$RawJson)
  if ($RawJson) { return ($RawJson | ConvertFrom-Json) }
  if ($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "North Star rejection input not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  throw "Provide -InputPath or -RejectionJson."
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

try {
  $input = Read-JsonInput -Path $InputPath -RawJson $RejectionJson
  $sameHashSeen = [bool](Get-Field $input "same_mission_hash_seen" $false)
  $sameFrictionRetries = [int](Get-Field $input "same_target_friction_retries" 0)
  $consecutive = [int](Get-Field $input "consecutive_north_star_rejections" 1)
  $pulseAttempted = [bool](Get-Field $input "strategic_pulse_attempted" $false)
  $pulseFailed = [bool](Get-Field $input "strategic_pulse_still_failed" $false)
  $narrowAllowed = [bool](Get-Field $input "narrow_same_friction_requested" $false)
  $reasons = [System.Collections.Generic.List[string]]::new()
  $action = "REQUEST_NEW_TARGET"

  if ($pulseAttempted -and $pulseFailed) {
    $action = if ([bool](Get-Field $input "drain_allowed" $true)) { "DRAIN" } else { "STOP_PRODUCT_DIRECTION_UNCLEAR" }
    $reasons.Add("Strategic Pulse did not repair product direction.") | Out-Null
  } elseif ($consecutive -ge 2) {
    $action = "FORCE_STRATEGIC_PULSE"
    $reasons.Add("Two consecutive North Star Vector rejections.") | Out-Null
  } elseif ($sameHashSeen) {
    $action = "REQUEST_NEW_TARGET"
    $reasons.Add("Same mission hash is forbidden after rejection.") | Out-Null
  } elseif ($narrowAllowed -and $sameFrictionRetries -lt 1) {
    $action = "NARROW_SAME_FRICTION_ONCE"
    $reasons.Add("Same target friction may be retried once only with NARROW.") | Out-Null
  } else {
    $action = "REQUEST_NEW_TARGET"
    $reasons.Add("Planner must choose a different Product Friction Register target.") | Out-Null
  }

  [ordered]@{
    recommended_action = $action
    same_hash_forbidden = $true
    same_target_retry_remaining = ($sameFrictionRetries -lt 1 -and -not $sameHashSeen)
    reasons = @($reasons)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    recommended_action = "STOP_PRODUCT_DIRECTION_UNCLEAR"
    same_hash_forbidden = $true
    same_target_retry_remaining = $false
    reasons = @($_.Exception.Message)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
