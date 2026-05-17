param(
  [string]$InputPath,
  [string]$UpdateJson,
  [string]$UpdateJsonPath,
  [string]$OutPath,
  [string]$Profile = "A20_5"
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Read-OptionalJson {
  param([string]$Path)
  if (-not $Path) { return $null }
  $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-RepoRoot) $Path }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return $null }
  return (Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json)
}

function Get-Number {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return 0 }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop -or $null -eq $prop.Value) { return 0 }
  return [double]$prop.Value
}

$counterNames = @(
  "wall_clock_minutes",
  "missions_attempted",
  "missions_succeeded",
  "chatgpt_live_calls",
  "gemini_live_calls",
  "gemini_image_uploads",
  "chatgpt_image_uploads",
  "request_more_rounds",
  "format_repair_attempts",
  "prompt_bytes",
  "response_bytes",
  "branches_created",
  "commits_created",
  "pushes_attempted",
  "screenshots_generated",
  "contact_sheets_generated",
  "evidence_artifacts_count",
  "bridge_failures",
  "visual_audits",
  "strategic_pulse_calls"
)

$existing = Read-OptionalJson -Path $InputPath
if ($UpdateJsonPath) {
  $update = Read-OptionalJson -Path $UpdateJsonPath
} elseif ($UpdateJson) {
  $update = $UpdateJson | ConvertFrom-Json
} else {
  $update = $null
}

$state = [ordered]@{
  schema_version = "A20A_budget_quota_state_v1"
  profile = $(if ($existing -and $existing.profile) { [string]$existing.profile } else { $Profile })
  updated_at = (Get-Date).ToUniversalTime().ToString("o")
}

foreach ($name in $counterNames) {
  $state[$name] = (Get-Number -Object $existing -Name $name) + (Get-Number -Object $update -Name $name)
}

$state.live_chatgpt_called = $false
$state.live_gemini_called = $false
$state.product_mission_executed = $false

$json = $state | ConvertTo-Json -Depth 10
if ($OutPath) {
  $outFullPath = if ([System.IO.Path]::IsPathRooted($OutPath)) { $OutPath } else { Join-Path (Get-RepoRoot) $OutPath }
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
