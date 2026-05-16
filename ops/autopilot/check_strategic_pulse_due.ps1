param(
  [string]$StatePath = "",
  [int]$NormalEvery = 3,
  [int]$DeepEvery = 9,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "strategic_pulse_due\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if ($StatePath) {
  $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
} else {
  $state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
}

function Get-StateValue {
  param($Object, [string]$Name, $Default)
  if ($Object.PSObject.Properties.Name -contains $Name) {
    return $Object.$Name
  }
  return $Default
}

$success = [int](Get-StateValue $state "successful_missions_since_last_pulse" 0)
$deep = [int](Get-StateValue $state "successful_missions_since_last_deep_pulse" 0)
$failures = [int](Get-StateValue $state "consecutive_failures" 0)
$firewallRejects = [int](Get-StateValue $state "prompt_firewall_rejects" 0)
$requestMoreExceeded = [bool](Get-StateValue $state "request_more_limit_exceeded" $false)
$bridgeInstability = [bool](Get-StateValue $state "chatgpt_bridge_instability" $false)
$timeboxExceeded = [bool](Get-StateValue $state "task_exceeds_timebox" $false)
$diffTooLarge = [bool](Get-StateValue $state "diff_too_large" $false)
$scopeTooLarge = [bool](Get-StateValue $state "scope_larger_than_expected" $false)
$redRisk = [bool](Get-StateValue $state "unexpected_red_tier_risk" $false)
$roadSafety = [bool](Get-StateValue $state "road_to_v2_safety_issue" $false)
$checksInconsistent = [bool](Get-StateValue $state "tests_checks_inconsistent" $false)

$reasons = [System.Collections.Generic.List[string]]::new()
$pulseType = "none"

if ($failures -ge 2) { $reasons.Add("2 consecutive failures") | Out-Null }
if ($firewallRejects -ge 2) { $reasons.Add("Prompt Firewall rejected twice") | Out-Null }
if ($requestMoreExceeded) { $reasons.Add("REQUEST_MORE limit exceeded") | Out-Null }
if ($bridgeInstability) { $reasons.Add("ChatGPT bridge instability") | Out-Null }
if ($timeboxExceeded) { $reasons.Add("task exceeds timebox") | Out-Null }
if ($diffTooLarge) { $reasons.Add("diff too large") | Out-Null }
if ($scopeTooLarge) { $reasons.Add("scope larger than expected") | Out-Null }
if ($redRisk) { $reasons.Add("unexpected red-tier risk") | Out-Null }
if ($roadSafety) { $reasons.Add("road-to-V2 safety issue") | Out-Null }
if ($checksInconsistent) { $reasons.Add("tests/checks inconsistent") | Out-Null }

if ($reasons.Count -gt 0) {
  $pulseType = "emergency"
} elseif ($deep -ge $DeepEvery) {
  $pulseType = "deep"
  $reasons.Add("deep pulse threshold reached") | Out-Null
} elseif ($success -ge $NormalEvery) {
  $pulseType = "normal"
  $reasons.Add("normal pulse threshold reached") | Out-Null
}

$result = [ordered]@{
  pulse_due = ($pulseType -ne "none")
  pulse_type = $pulseType
  reasons = @($reasons)
  successful_missions_since_last_pulse = $success
  successful_missions_since_last_deep_pulse = $deep
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir "strategic_pulse_due.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 8
