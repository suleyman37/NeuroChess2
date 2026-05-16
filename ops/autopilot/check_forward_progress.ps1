param(
  [string]$ResultJson = "",
  [string]$InputPath = "",
  [string]$LedgerPath = "",
  [int]$MaxConsecutiveNoProgress = 2,
  [int]$WindowSize = 5,
  [int]$NoProgressInWindowRequiresPulse = 3
)

$ErrorActionPreference = "Stop"

function Read-ResultInput {
  if ($ResultJson) { return ($ResultJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -ResultJson or -InputPath."
}

function Get-Value {
  param($Object, [string]$Name, $Default = "")
  if ($null -eq $Object) { return $Default }
  $property = $Object.PSObject.Properties[$Name]
  if ($property) { return $property.Value }
  return $Default
}

function Test-TruthyString {
  param($Value)
  if ($null -eq $Value) { return $false }
  return ([string]$Value).Trim().Length -gt 0
}

function Get-List {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  if ($Value -is [System.Collections.IEnumerable]) {
    $items = @()
    foreach ($item in $Value) { $items += $item }
    return @($items)
  }
  return @($Value)
}

function Classify-ForwardProgress {
  param($Entry)
  $evidence = @()
  $reasons = @()

  if (Test-TruthyString (Get-Value $Entry "commit_sha")) { $evidence += "commit_created" }

  $branch = [string](Get-Value $Entry "branch")
  $evidencePack = [string](Get-Value $Entry "evidence_pack_path")
  if ($branch -and $branch -ne "road-to-V2" -and $evidencePack) {
    $evidence += "ephemeral_branch_with_evidence_pack"
  }

  if (Test-TruthyString (Get-Value $Entry "external_report_path")) { $evidence += "external_report_or_artifact" }
  if (Test-TruthyString (Get-Value $Entry "artifact_path")) { $evidence += "external_report_or_artifact" }

  $testsRun = @(Get-List (Get-Value $Entry "tests_run"))
  if ($testsRun.Count -gt 0) {
    $evidence += "meaningful_test_or_smoke_evidence"
  }

  $pulse = [string](Get-Value $Entry "strategic_pulse_decision")
  if ($pulse -and $pulse -notin @("CONTINUE", "NONE", "")) { $evidence += "strategic_pulse_changed_direction" }

  $contractResult = [string](Get-Value $Entry "contract_result")
  $stopReason = [string](Get-Value $Entry "stop_reason")
  if (($contractResult -match "MISMATCH|FAIL") -and ((Test-TruthyString (Get-Value $Entry "external_report_path")) -or $stopReason)) {
    $evidence += "mission_contract_mismatch_with_repairable_report"
  }

  if ([int](Get-Value $Entry "files_changed_count" 0) -le 0) { $reasons += "no files changed" }
  if (-not (Test-TruthyString (Get-Value $Entry "commit_sha"))) { $reasons += "no commit" }
  if (-not $branch) { $reasons += "no branch" }
  if (-not $evidencePack) { $reasons += "no evidence pack" }
  if (-not (Test-TruthyString (Get-Value $Entry "external_report_path")) -and -not (Test-TruthyString (Get-Value $Entry "artifact_path"))) { $reasons += "no useful report or artifact" }
  if ([bool](Get-Value $Entry "same_mission_hash_repeated" $false)) { $reasons += "same mission hash repeated" }

  return [ordered]@{
    forward_progress = ($evidence.Count -gt 0)
    evidence = @($evidence | Sort-Object -Unique)
    reasons = @($reasons | Sort-Object -Unique)
  }
}

function Read-LedgerEntries {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return @() }
  $entries = @()
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if (-not $line.Trim()) { continue }
    $entries += ($line | ConvertFrom-Json)
  }
  return @($entries)
}

try {
  $entry = Read-ResultInput
  $classification = Classify-ForwardProgress -Entry $entry
  $ledgerEntries = @(Read-LedgerEntries -Path $LedgerPath)
  $historyProgress = @()
  foreach ($ledgerEntry in $ledgerEntries) {
    $historyProgress += [bool](Get-Value $ledgerEntry "forward_progress" $false)
  }
  $combined = @($historyProgress + [bool]$classification.forward_progress)

  $consecutiveNoProgress = 0
  for ($i = $combined.Count - 1; $i -ge 0; $i--) {
    if ($combined[$i]) { break }
    $consecutiveNoProgress += 1
  }

  $window = @($combined | Select-Object -Last $WindowSize)
  $noProgressInWindow = @($window | Where-Object { -not $_ }).Count

  $decision = "CONTINUE"
  if (-not [bool]$classification.forward_progress) {
    if ($consecutiveNoProgress -ge $MaxConsecutiveNoProgress) {
      $decision = "STOP_NO_FORWARD_PROGRESS"
    } elseif ($noProgressInWindow -ge $NoProgressInWindowRequiresPulse) {
      $decision = "STRATEGIC_PULSE_REQUIRED"
    } else {
      $decision = "WARN_NO_PROGRESS"
    }
  }

  [ordered]@{
    forward_progress = [bool]$classification.forward_progress
    decision = $decision
    reasons = @($classification.reasons)
    evidence = @($classification.evidence)
    consecutive_no_progress = $consecutiveNoProgress
    no_progress_in_window = $noProgressInWindow
    window_size = $WindowSize
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  if ($decision -eq "CONTINUE" -or $decision -eq "WARN_NO_PROGRESS" -or $decision -eq "STRATEGIC_PULSE_REQUIRED") { exit 0 } else { exit 2 }
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
