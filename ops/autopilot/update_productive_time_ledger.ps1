param(
  [string]$InputPath,
  [string]$UpdateJson,
  [string]$UpdateJsonPath,
  [string]$OutPath
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

function Read-JsonOrEmpty {
  param([string]$Path)
  if (-not $Path) { return $null }
  $fullPath = Resolve-PathFromRepo -Path $Path
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return $null }
  return Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json
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

$existing = Read-JsonOrEmpty -Path $InputPath
if ($UpdateJsonPath) { $update = Read-JsonOrEmpty -Path $UpdateJsonPath }
elseif ($UpdateJson) { $update = $UpdateJson | ConvertFrom-Json }
else { $update = $null }

$names = @(
  "wall_clock_elapsed",
  "useful_mission_minutes_estimate",
  "time_in_expansion",
  "time_in_consolidation",
  "time_in_adaptive_extension",
  "time_in_drain",
  "time_waiting_for_bridge",
  "time_waiting_for_tests",
  "time_waiting_for_visual_audit",
  "missions_attempted",
  "high_value_missions",
  "low_value_missions",
  "e2e_deliverables",
  "branch_consolidations",
  "evidence_amplifications"
)

$ledger = [ordered]@{
  schema_version = "A20D_productive_time_ledger_v1"
  updated_at = (Get-Date).ToUniversalTime().ToString("o")
  target_wall_clock_minutes = [int](Get-Number $existing "target_wall_clock_minutes" 360)
  hard_cap_minutes = [int](Get-Number $existing "hard_cap_minutes" 360)
  drain_required_by_minutes = [int](Get-Number $existing "drain_required_by_minutes" 330)
  useful_work_target_ratio = [double](Get-Number $existing "useful_work_target_ratio" 0.65)
  minimum_meaningful_mission_minutes = [int](Get-Number $existing "minimum_meaningful_mission_minutes" 20)
}
foreach ($name in $names) {
  $ledger[$name] = (Get-Number $existing $name 0) + (Get-Number $update $name 0)
}

$elapsed = [double]$ledger.wall_clock_elapsed
$useful = [double]$ledger.useful_mission_minutes_estimate
$ratio = if ($elapsed -gt 0) { [Math]::Round($useful / $elapsed, 3) } else { 0 }
$remaining = [double]$ledger.hard_cap_minutes - $elapsed
$ledger.productive_utilization_ratio = $ratio
$ledger.remaining_time_minutes = [Math]::Max(0, [Math]::Round($remaining, 2))

if ($elapsed -ge [double]$ledger.hard_cap_minutes) {
  $status = "STOP_TIME_EXCEEDED"
  $action = "STOP"
} elseif ($remaining -lt [double]$ledger.minimum_meaningful_mission_minutes -or $elapsed -ge [double]$ledger.drain_required_by_minutes) {
  $status = "TIME_TO_DRAIN"
  $action = "DRAIN"
} elseif ($ratio -lt [double]$ledger.useful_work_target_ratio) {
  $status = "LOW_UTILIZATION"
  $action = "ASK_ARCHITECT_FOR_HIGHER_VALUE_OBJECTIVE"
} else {
  $status = "HEALTHY"
  $action = "CONTINUE"
}

$ledger.productive_time_status = $status
$ledger.recommended_action = $action
$ledger.live_chatgpt_called = $false
$ledger.live_gemini_called = $false
$ledger.product_mission_executed = $false

$json = $ledger | ConvertTo-Json -Depth 10
if ($OutPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
