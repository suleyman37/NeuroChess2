param(
  [string]$HygieneJson,
  [string]$HygieneJsonPath,
  [string]$OutPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultReportPath {
  $root = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\environment_hygiene"
  return (Join-Path $root ("environment_hygiene_report_{0}.json" -f (Get-Date -Format "yyyyMMdd_HHmmss")))
}

if ($HygieneJsonPath) {
  $fullPath = if ([System.IO.Path]::IsPathRooted($HygieneJsonPath)) { $HygieneJsonPath } else { Join-Path (Get-RepoRoot) $HygieneJsonPath }
  $hygiene = Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json
} elseif ($HygieneJson) {
  $hygiene = $HygieneJson | ConvertFrom-Json
} else {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_environment_hygiene.ps1") 2>&1
  } finally {
    $ErrorActionPreference = $previous
  }
  $hygiene = (($output | Out-String).Trim() | ConvertFrom-Json)
}

if (-not $OutPath) { $OutPath = Get-DefaultReportPath }
$outFullPath = if ([System.IO.Path]::IsPathRooted($OutPath)) { $OutPath } else { Join-Path (Get-RepoRoot) $OutPath }
$outDir = Split-Path -Parent $outFullPath
if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$report = [ordered]@{
  schema_version = "A20B_environment_hygiene_report_v1"
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  environment_hygiene_result = [string]$hygiene.environment_hygiene_result
  warnings = @($hygiene.warnings)
  violations = @($hygiene.violations)
  recommended_action = [string]$hygiene.recommended_action
  process_registry_result = $hygiene.process_registry_result
  port_registry_result = $hygiene.port_registry_result
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

Set-Content -LiteralPath $outFullPath -Value ($report | ConvertTo-Json -Depth 10) -Encoding UTF8

$result = [ordered]@{
  report_result = "PASS"
  report_path = $outFullPath
  environment_hygiene_result = $report.environment_hygiene_result
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
