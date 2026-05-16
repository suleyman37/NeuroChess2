param(
  [string]$MissionJson = "",
  [string]$InputPath = "",
  [string]$HashListJson = "",
  [string]$HashListPath = "",
  [string]$StatePath = "",
  [int]$MaxSameMissionHashRepeats = 1
)

$ErrorActionPreference = "Stop"

function Invoke-HashComputer {
  $script = Join-Path $PSScriptRoot "compute_mission_hash.ps1"
  if ($MissionJson) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -MissionJson $MissionJson 2>&1
  } elseif ($InputPath) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -InputPath $InputPath 2>&1
  } else {
    throw "Provide -MissionJson or -InputPath."
  }
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  if ($code -ne 0) { throw "compute_mission_hash failed: $raw" }
  return ($raw | ConvertFrom-Json)
}

function Get-HashListFromObject {
  param($Object)
  if ($null -eq $Object) { return @() }
  if ($Object -is [string]) { return @($Object) }
  if ($Object -is [System.Collections.IEnumerable]) {
    $items = @()
    foreach ($item in $Object) {
      if ($item -is [string]) { $items += $item }
      elseif ($item.PSObject.Properties["mission_hash"]) { $items += [string]$item.mission_hash }
    }
    return @($items | Where-Object { $_ })
  }
  foreach ($propertyName in @("mission_hashes_seen", "hashes", "mission_hashes")) {
    $property = $Object.PSObject.Properties[$propertyName]
    if ($property) { return Get-HashListFromObject -Object $property.Value }
  }
  return @()
}

function Read-PreviousHashes {
  if ($HashListJson) { return Get-HashListFromObject -Object ($HashListJson | ConvertFrom-Json) }
  if ($HashListPath) {
    if (-not (Test-Path -LiteralPath $HashListPath)) { throw "HashListPath not found: $HashListPath" }
    return Get-HashListFromObject -Object (Get-Content -LiteralPath $HashListPath -Raw | ConvertFrom-Json)
  }
  if ($StatePath) {
    if (-not (Test-Path -LiteralPath $StatePath)) { throw "StatePath not found: $StatePath" }
    return Get-HashListFromObject -Object (Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json)
  }
  return @()
}

try {
  $hashResult = Invoke-HashComputer
  $missionHash = [string]$hashResult.mission_hash
  $previousHashes = @(Read-PreviousHashes)
  $repeatCount = @($previousHashes | Where-Object { $_ -eq $missionHash }).Count
  $reasons = @()
  if ($repeatCount -gt 0) { $reasons += "mission hash already appeared in this session" }

  $decision = "CONTINUE"
  if ($repeatCount -ge $MaxSameMissionHashRepeats) {
    $decision = "STOP_REPEAT_MISSION_HASH"
  } elseif ($repeatCount -gt 0) {
    $decision = "STOP_FOR_SUPERVISOR"
  }

  [ordered]@{
    repeat_detected = ($repeatCount -gt 0)
    repeat_count = $repeatCount
    decision = $decision
    mission_hash = $missionHash
    reasons = @($reasons)
    previous_hash_count = $previousHashes.Count
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  if ($decision -eq "CONTINUE") { exit 0 } else { exit 2 }
} catch {
  [ordered]@{
    status = "fail"
    error = $_.Exception.Message
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
