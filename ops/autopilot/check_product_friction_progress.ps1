param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [int]$WindowSize = 3,
  [int]$MaxInfraOnly = 2,
  [int]$FakeRiskLimit = 1
)

$ErrorActionPreference = "Stop"

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

try {
  if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
  $raw = Get-Content -LiteralPath $InputPath -Raw
  $data = $raw | ConvertFrom-Json
  $reviews = if ($data.PSObject.Properties.Name -contains "reviews") { @($data.reviews) } else { @($data) }
  $window = @($reviews | Select-Object -Last $WindowSize)
  $reasons = [System.Collections.Generic.List[string]]::new()

  $noFrictionReduced = 0
  $infraOnly = 0
  $fakeRisk = 0
  foreach ($review in $window) {
    if (@(As-Array $review.friction_reduced).Count -eq 0) { $noFrictionReduced += 1 }
    if (([string]$review.unlock_value).Trim().ToLowerInvariant() -eq "infra_only") { $infraOnly += 1 }
    if (([string]$review.fake_progress_risk).Trim().ToLowerInvariant() -in @("medium", "high")) { $fakeRisk += 1 }
  }

  if ($noFrictionReduced -ge $WindowSize) {
    $reasons.Add("no product friction reduced in last $WindowSize mission(s)") | Out-Null
  }
  if ($infraOnly -gt $MaxInfraOnly) {
    $reasons.Add("too many infra-only missions in window: $infraOnly") | Out-Null
  }
  if ($fakeRisk -gt $FakeRiskLimit) {
    $reasons.Add("recurring fake progress risk in window: $fakeRisk") | Out-Null
  }

  $result = "OK"
  if ($noFrictionReduced -ge $WindowSize) {
    $result = "STRATEGIC_PULSE_REQUIRED"
  }
  if ($infraOnly -gt $MaxInfraOnly -or $fakeRisk -gt $FakeRiskLimit) {
    $result = "RETURN_TO_PRODUCT_REQUIRED"
  }
  if ($reasons.Count -gt 0 -and $result -eq "OK") { $result = "WARN" }

  [ordered]@{
    friction_progress_result = $result
    reasons = @($reasons)
    window_size = $window.Count
    no_friction_reduced_count = $noFrictionReduced
    infra_only_count = $infraOnly
    fake_progress_risk_count = $fakeRisk
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  if ($result -eq "RETURN_TO_PRODUCT_REQUIRED") { exit 2 }
  exit 0
} catch {
  [ordered]@{
    friction_progress_result = "WARN"
    reasons = @($_.Exception.Message)
    window_size = 0
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
