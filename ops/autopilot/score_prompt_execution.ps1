param(
  [string]$EntryJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-EntryInput {
  if ($EntryJson) { return ($EntryJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -EntryJson or -InputPath."
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

function Normalize-Check {
  param($Value)
  $text = ([string]$Value -replace "\\", "/").Trim().ToLowerInvariant()
  $text = $text -replace "\s+", " "
  if ($text -eq "diffcheck" -or $text -match '(^| )git diff --check($| )') { return "git diff --check" }
  if ($text -match 'tools/plan_guard\.py') { return "tools/plan_guard.py" }
  return $text
}

function Normalize-CheckList {
  param($Value)
  $items = @()
  foreach ($entry in @(As-Array $Value)) {
    foreach ($part in ([string]$entry -split "(?:`r`n|`n|`r|;|,)")) {
      $normalized = Normalize-Check $part
      if ($normalized) { $items += $normalized }
    }
  }
  return @($items | Sort-Object -Unique)
}

function Add-Positive {
  param([ref]$Score, [System.Collections.Generic.List[string]]$Factors, [int]$Points, [string]$Label)
  $Score.Value += $Points
  $Factors.Add("+$Points $Label") | Out-Null
}

function Add-Penalty {
  param([ref]$Score, [System.Collections.Generic.List[string]]$Penalties, [int]$Points, [string]$Label)
  $Score.Value -= $Points
  $Penalties.Add("-$Points $Label") | Out-Null
}

try {
  $entry = Read-EntryInput
  $score = 0
  $positive = [System.Collections.Generic.List[string]]::new()
  $penalties = [System.Collections.Generic.List[string]]::new()

  $checksRequired = @(Normalize-CheckList $entry.checks_required)
  $checksRun = @(Normalize-CheckList $entry.checks_run)
  $allRequiredRun = $true
  foreach ($check in $checksRequired) {
    if ($checksRun -notcontains $check) { $allRequiredRun = $false }
  }

  if ((Has-Property $entry "objective_atomic") -and [bool]$entry.objective_atomic) { Add-Positive ([ref]$score) $positive 15 "objective was atomic and respected" }
  if ((Has-Property $entry "allowed_paths_respected") -and [bool]$entry.allowed_paths_respected) { Add-Positive ([ref]$score) $positive 10 "allowed paths respected" }
  if (-not ((Has-Property $entry "forbidden_path_touched") -and [bool]$entry.forbidden_path_touched)) { Add-Positive ([ref]$score) $positive 10 "forbidden paths avoided" }
  if ([int]$entry.max_files -ge 0 -and [int]$entry.files_changed_count -le [int]$entry.max_files) { Add-Positive ([ref]$score) $positive 10 "file count within max_files" }
  if ([int]$entry.max_diff_lines -ge 0 -and [int]$entry.diff_lines -le [int]$entry.max_diff_lines) { Add-Positive ([ref]$score) $positive 10 "diff lines within max_diff_lines" }
  if ($checksRequired.Count -gt 0 -and $allRequiredRun) { Add-Positive ([ref]$score) $positive 10 "required checks all run" }
  if ([bool]$entry.checks_passed) { Add-Positive ([ref]$score) $positive 10 "required checks pass" }
  if ([string]$entry.mission_contract_result -in @("MATCH", "PASS")) { Add-Positive ([ref]$score) $positive 10 "Mission Contract MATCH" }
  if ([string]$entry.shadow_plan_result -in @("MATCH", "PASS", "NOT_APPLICABLE", "")) { Add-Positive ([ref]$score) $positive 5 "Shadow Plan MATCH or not applicable" }
  if (-not [bool]$entry.repair_used) { Add-Positive ([ref]$score) $positive 5 "no format repair needed" }
  if (-not [bool]$entry.request_more_used) { Add-Positive ([ref]$score) $positive 5 "no unnecessary REQUEST_MORE" }
  if ([string]$entry.forward_progress_result -in @("PASS", "CONTINUE", "TRUE") -or [bool]$entry.forward_progress) { Add-Positive ([ref]$score) $positive 5 "Forward Progress true" }
  if ([string]$entry.product_gate_result -in @("PASS", "WARN")) { Add-Positive ([ref]$score) $positive 5 "Product Gate PASS/WARN" }
  if ([bool]$entry.final_report_clear) { Add-Positive ([ref]$score) $positive 5 "final report clear and actionable" }

  if ([string]$entry.mission_contract_result -match "MISMATCH|FAIL|STOP") { Add-Penalty ([ref]$score) $penalties 20 "Mission Contract mismatch" }
  if ((Has-Property $entry "forbidden_path_touched") -and [bool]$entry.forbidden_path_touched) { Add-Penalty ([ref]$score) $penalties 20 "forbidden path touched" }
  if ((Has-Property $entry "red_tier_outside_quarantine") -and [bool]$entry.red_tier_outside_quarantine) { Add-Penalty ([ref]$score) $penalties 20 "red-tier outside quarantine" }
  if ([bool]$entry.repair_used) { Add-Penalty ([ref]$score) $penalties 15 "prompt required repair" }
  if ([bool]$entry.request_more_used -and [bool]$entry.request_more_unnecessary) { Add-Penalty ([ref]$score) $penalties 10 "REQUEST_MORE caused by missing obvious context" }
  if (-not ([string]$entry.forward_progress_result -in @("PASS", "CONTINUE", "TRUE")) -and -not [bool]$entry.forward_progress) { Add-Penalty ([ref]$score) $penalties 10 "no forward progress" }
  if ([string]$entry.product_gate_result -match "FAIL|LOW|NO|STRATEGIC_PULSE_REQUIRED") { Add-Penalty ([ref]$score) $penalties 10 "product value missing without safety justification" }
  if ([bool]$entry.broad_wording_found) { Add-Penalty ([ref]$score) $penalties 10 "vague or broad wording found" }
  if (-not [bool]$entry.final_report_clear) { Add-Penalty ([ref]$score) $penalties 10 "final report incomplete" }
  if ([bool]$entry.product_code_merged_to_road_when_forbidden) { Add-Penalty ([ref]$score) $penalties 30 "product code merged to road-to-V2 when forbidden" }

  if ($score -gt 100) { $score = 100 }
  if ($score -lt 0) { $score = 0 }

  $band = "dangerous / should be redesigned"
  if ($score -ge 90) { $band = "excellent prompt" }
  elseif ($score -ge 75) { $band = "good prompt" }
  elseif ($score -ge 60) { $band = "usable but needs improvement" }
  elseif ($score -ge 40) { $band = "weak prompt" }

  $recommendation = "Keep style; continue measuring real execution outcomes."
  if ($score -lt 75) { $recommendation = "Tighten prompt scope, checks, product value, and stop conditions before reuse." }
  if (@($penalties | Where-Object { $_ -match "Mission Contract|forbidden|red-tier" }).Count -gt 0) { $recommendation = "Redesign prompt before reuse; safety mismatch detected." }

  [ordered]@{
    prompt_execution_score = $score
    score_band = $band
    positive_factors = @($positive)
    penalties = @($penalties)
    recommended_prompt_improvement = $recommendation
    self_rated_quality_score_ignored = (Has-Property $entry "quality_score")
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    prompt_execution_score = 0
    score_band = "dangerous / should be redesigned"
    positive_factors = @()
    penalties = @($_.Exception.Message)
    recommended_prompt_improvement = "Fix malformed ledger entry."
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
