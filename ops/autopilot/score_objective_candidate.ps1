param(
  [string]$CandidatePath,
  [string]$InputPath,
  [string]$CandidateJson
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

if ($CandidateJson) {
  $candidate = $CandidateJson | ConvertFrom-Json
} else {
  $sourcePath = if ($CandidatePath) { $CandidatePath } else { $InputPath }
  if (-not $sourcePath) { throw "CandidatePath, InputPath, or CandidateJson is required" }
  $candidate = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $sourcePath) -Raw | ConvertFrom-Json
}

$category = [string](Get-Field $candidate "category" "DISTRACTION")
$value = [int](Get-Number $candidate "marginal_value_score" 0)
$branchRisk = [int](Get-Number $candidate "branch_overlap_risk" 0)
$redRisk = [int](Get-Number $candidate "red_tier_risk" 0)
$risk = [Math]::Max($branchRisk, $redRisk)
$visualRequired = Get-Bool $candidate "visual_audit_required" $false
$visualAvailable = Get-Bool $candidate "visual_provider_available" $true
$expectedTimeMax = [int](Get-Number $candidate "expected_time_minutes_max" 0)
$remaining = [int](Get-Number $candidate "remaining_time_minutes" 9999)
$warnings = New-Object System.Collections.Generic.List[string]
$reasons = New-Object System.Collections.Generic.List[string]

if ($visualRequired -and -not $visualAvailable) {
  $risk = [Math]::Min(100, $risk + 35)
  $warnings.Add("visual audit required but no visual provider available") | Out-Null
}
if ($branchRisk -ge 50) { $warnings.Add("branch overlap risk is elevated") | Out-Null }
if ($expectedTimeMax -gt 0 -and $expectedTimeMax -gt $remaining) {
  $risk = [Math]::Min(100, $risk + 25)
  $warnings.Add("expected time exceeds remaining safe window") | Out-Null
}

$allowedMiddleCategories = @("BRANCH_CONSOLIDATION", "TEST_OR_SMOKE_EVIDENCE", "VISUAL_REVIEW_OR_CANARY", "EVIDENCE_AMPLIFICATION", "MORNING_REPORT_PREP")
if ($redRisk -gt 70 -or $risk -gt 70) {
  $scoreResult = "REJECT_LOW_MARGINAL_VALUE"
  $action = "REJECT"
  $reasons.Add("risk score exceeds safe continuation threshold") | Out-Null
} elseif ($category -eq "DISTRACTION" -or $value -lt 50) {
  $scoreResult = "REJECT_LOW_MARGINAL_VALUE"
  $action = "REJECT"
  $reasons.Add("objective does not clear marginal value threshold") | Out-Null
} elseif ($value -ge 70 -and $risk -le 40) {
  $scoreResult = "PASS"
  $action = "CONTINUE"
  $reasons.Add("high-value objective inside risk bounds") | Out-Null
} elseif ($value -ge 50 -and $allowedMiddleCategories -contains $category -and $risk -le 70) {
  $scoreResult = "WARN"
  $action = "CONTINUE"
  $reasons.Add("allowed continuation only for consolidation or evidence value") | Out-Null
} else {
  $scoreResult = "REJECT_LOW_MARGINAL_VALUE"
  $action = "REJECT"
  $reasons.Add("objective does not meet continuation policy") | Out-Null
}

$result = [ordered]@{
  objective_score_result = $scoreResult
  objective_id = [string](Get-Field $candidate "objective_id" "")
  category = $category
  marginal_value_score = $value
  risk_score = [int]$risk
  warnings = @($warnings)
  reasons = @($reasons)
  recommended_action = $action
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($scoreResult -eq "REJECT_LOW_MARGINAL_VALUE") { exit 2 }
exit 0
