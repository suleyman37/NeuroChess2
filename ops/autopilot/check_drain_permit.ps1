param(
  [string]$InputPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-PathFromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

function Get-Number {
  param($Object, [string]$Name, [double]$Default = 0)
  $value = Get-Field -Object $Object -Name $Name -Default $null
  if ($null -eq $value -or $value -eq "") { return $Default }
  return [double]$value
}

function Get-Bool {
  param($Object, [string]$Name, [bool]$Default = $false)
  $value = Get-Field -Object $Object -Name $Name -Default $null
  if ($null -eq $value) { return $Default }
  if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) { return $Default }
  return [System.Convert]::ToBoolean($value)
}

if (-not $InputPath) { throw "InputPath is required" }
$input = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $InputPath) -Raw | ConvertFrom-Json
$run = Get-Field $input "run_state" $input
$reservoir = Get-Field $input "objective_reservoir" $null
$reasons = New-Object System.Collections.Generic.List[string]
$blockers = New-Object System.Collections.Generic.List[string]

$remaining = [int](Get-Number $run "remaining_time_minutes" 0)
$quotaReached = Get-Bool $run "quota_reached" $false
$strategicPulse = Get-Bool $run "strategic_pulse_ran" $false
$reportComplete = Get-Bool $run "report_complete" $false
$evidenceComplete = Get-Bool $run "evidence_complete" $true
$branchesClassified = Get-Bool $run "branches_classified" $true
$hardStop = Get-Bool $run "hard_stop_condition" $false
$killSwitch = Get-Bool $run "kill_switch_present" $false
$budgetNearCap = Get-Bool $run "budget_near_cap" $false
$environmentDrain = Get-Bool $run "environment_requires_drain" $false
$branchBlocked = Get-Bool $run "branch_orthogonality_blocks_safe_work" $false
$timeToDrain = Get-Bool $run "time_to_drain_window_reached" $false

$highValueCount = 0
if ($reservoir) {
  if ($null -ne (Get-Field $reservoir "high_value_count" $null)) {
    $highValueCount = [int](Get-Number $reservoir "high_value_count" 0)
  } else {
    foreach ($candidate in @((Get-Field $reservoir "candidates" @()))) {
      if ([int](Get-Number $candidate "marginal_value_score" 0) -ge 70 -and [int](Get-Number $candidate "red_tier_risk" 0) -le 40 -and [int](Get-Number $candidate "branch_overlap_risk" 0) -le 40) {
        $highValueCount += 1
      }
    }
  }
}

if ($hardStop) { $reasons.Add("hard stop condition") | Out-Null }
if ($killSwitch) { $reasons.Add("kill switch present") | Out-Null }
if ($timeToDrain -or $remaining -lt 20) { $reasons.Add("time to drain window reached") | Out-Null }
if ($budgetNearCap) { $reasons.Add("budget or quota near cap") | Out-Null }
if ($environmentDrain) { $reasons.Add("environment hygiene requires drain") | Out-Null }
if ($branchBlocked) { $reasons.Add("branch orthogonality blocks safe work") | Out-Null }
if ($highValueCount -eq 0) { $reasons.Add("no high-value objectives remain") | Out-Null }
if ($strategicPulse -and $reportComplete -and $branchesClassified -and $evidenceComplete) {
  $reasons.Add("strategic pulse and control plane can drain with complete report") | Out-Null
}

if ($quotaReached -and $remaining -ge 45 -and $highValueCount -gt 0) {
  $blockers.Add("quota reached early but high-value safe objectives remain and time is available") | Out-Null
}
if (-not $evidenceComplete) { $blockers.Add("evidence index has missing required evidence") | Out-Null }
if (-not $branchesClassified) { $blockers.Add("branches exist without classification") | Out-Null }
if (-not $strategicPulse) { $blockers.Add("Strategic Pulse has not run") | Out-Null }
if (-not $reportComplete -and ($remaining -ge 20 -or $highValueCount -gt 0)) { $blockers.Add("report is not complete") | Out-Null }

if ($blockers.Count -gt 0 -and -not ($hardStop -or $killSwitch -or $budgetNearCap -or $environmentDrain)) {
  $permit = "DENY_DRAIN"
  if (-not $evidenceComplete) { $next = "EVIDENCE_AMPLIFICATION" }
  elseif ($quotaReached -and $remaining -ge 45 -and $highValueCount -gt 0) { $next = "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE" }
  elseif (-not $branchesClassified) { $next = "CONSOLIDATE" }
  else { $next = "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE" }
} else {
  $permit = "ALLOW_DRAIN"
  $next = "DRAIN"
}

$result = [ordered]@{
  drain_permit = $permit
  reasons = @($reasons)
  blockers = @($blockers)
  high_value_objectives_remaining = $highValueCount
  required_next_action = $next
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($permit -eq "DENY_DRAIN") { exit 2 }
exit 0
