param(
  [string]$InputPath,
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

if (-not $InputPath) { throw "InputPath is required" }
$input = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $InputPath) -Raw | ConvertFrom-Json

$report = [ordered]@{
  schema_version = "A20C_visual_debt_report_v1"
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  branch = [string]$input.branch
  commit = $(if ($input.commit) { [string]$input.commit } else { $null })
  visual_verdict_history = @($input.provider_results)
  issue_category = $(if ($input.current_visual_result.issue_category) { [string]$input.current_visual_result.issue_category } else { "unknown" })
  screenshot_paths = @($input.screenshot_paths)
  reviewer = "autopilot_visual_halting"
  one_shot_fix_attempted = ([int]$input.fix_attempts_used -gt 0)
  final_classification = $(if ($input.final_classification) { [string]$input.final_classification } else { "READY_TO_REVIEW_WITH_VISUAL_DEBT" })
  morning_review_recommendation = "Review visual debt before product merge; do not continue pixel pushing during long run."
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $report | ConvertTo-Json -Depth 10
if ($OutPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
