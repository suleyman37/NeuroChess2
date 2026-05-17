param(
  [string]$InputPath,
  [string]$PolicyPath = (Join-Path $PSScriptRoot "long_run_safety_policy.yaml"),
  [string]$Profile = "A20_5"
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-Number {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return 0 }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop -or $null -eq $prop.Value) { return 0 }
  return [double]$prop.Value
}

function Read-BudgetPolicy {
  param([string]$Path, [string]$ProfileName)
  $policy = [ordered]@{
    max_wall_clock_minutes = 180
    max_chatgpt_calls = 40
    max_gemini_calls = 20
    max_image_uploads = 20
    max_request_more_rounds = 6
    max_format_repairs = 4
    max_branches_created = 5
    warn_at_percent = 80
  }
  $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-RepoRoot) $Path }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return $policy }
  $key = $ProfileName -replace '\.', '_'
  $inProfile = $false
  foreach ($line in Get-Content -LiteralPath $fullPath) {
    if ($line -match ("^\s{{2}}{0}:\s*$" -f [regex]::Escape($key))) {
      $inProfile = $true
      continue
    }
    if ($inProfile -and $line -match '^\s{2}\S') {
      break
    }
    if ($inProfile -and $line -match '^\s{4}([A-Za-z0-9_]+):\s*([0-9]+)\s*$') {
      $policy[$Matches[1]] = [double]$Matches[2]
    }
  }
  return $policy
}

if (-not $InputPath) { throw "InputPath is required" }
$statePath = if ([System.IO.Path]::IsPathRooted($InputPath)) { $InputPath } else { Join-Path (Get-RepoRoot) $InputPath }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$profileName = if ($state.profile) { [string]$state.profile } else { $Profile }
$policy = Read-BudgetPolicy -Path $PolicyPath -ProfileName $profileName

$checks = @(
  @{ name = "wall_clock_minutes"; value = (Get-Number $state "wall_clock_minutes"); max = [double]$policy.max_wall_clock_minutes },
  @{ name = "chatgpt_live_calls"; value = (Get-Number $state "chatgpt_live_calls"); max = [double]$policy.max_chatgpt_calls },
  @{ name = "gemini_live_calls"; value = (Get-Number $state "gemini_live_calls"); max = [double]$policy.max_gemini_calls },
  @{ name = "image_uploads"; value = ((Get-Number $state "gemini_image_uploads") + (Get-Number $state "chatgpt_image_uploads")); max = [double]$policy.max_image_uploads },
  @{ name = "request_more_rounds"; value = (Get-Number $state "request_more_rounds"); max = [double]$policy.max_request_more_rounds },
  @{ name = "format_repair_attempts"; value = (Get-Number $state "format_repair_attempts"); max = [double]$policy.max_format_repairs },
  @{ name = "branches_created"; value = (Get-Number $state "branches_created"); max = [double]$policy.max_branches_created }
)

$warnings = New-Object System.Collections.Generic.List[string]
$violations = New-Object System.Collections.Generic.List[string]
$warnAt = [double]$policy.warn_at_percent
foreach ($check in $checks) {
  if ($check.max -le 0) { continue }
  if ($check.value -gt $check.max) {
    $violations.Add(("{0}={1} exceeds max {2}" -f $check.name, $check.value, $check.max)) | Out-Null
  } elseif ($check.value -eq $check.max) {
    $violations.Add(("{0}={1} reached max {2}" -f $check.name, $check.value, $check.max)) | Out-Null
  } elseif (($check.value / $check.max * 100) -ge $warnAt) {
    $warnings.Add(("{0}={1} is at or above {2}% of max {3}" -f $check.name, $check.value, $warnAt, $check.max)) | Out-Null
  }
}

if ($violations.Count -gt 0) {
  $budgetResult = "STOP_QUOTA_EXCEEDED"
  $action = "STOP"
} elseif ($warnings.Count -gt 0) {
  $budgetResult = "WARN_QUOTA_NEAR_CAP"
  $action = "DRAIN"
} else {
  $budgetResult = "PASS"
  $action = "CONTINUE"
}

$result = [ordered]@{
  budget_result = $budgetResult
  warnings = @($warnings)
  violations = @($violations)
  recommended_action = $action
  profile = $profileName
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($violations.Count -gt 0) { exit 2 }
exit 0
