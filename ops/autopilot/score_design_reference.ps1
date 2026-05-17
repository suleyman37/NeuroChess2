param(
  [string]$ReferencePath
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

function Get-Score {
  param($Scores, [string]$Name)
  $prop = $Scores.PSObject.Properties[$Name]
  if ($null -eq $prop) { return 0 }
  return [int]$prop.Value
}

if (-not $ReferencePath) { throw "ReferencePath is required" }
$reference = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $ReferencePath) -Raw | ConvertFrom-Json
if ([bool]$reference.copyrighted_assets_stored) { throw "Reference stores forbidden assets." }

$scores = $reference.scores
$weighted = (
  (Get-Score $scores "clarity") +
  (Get-Score $scores "speed") +
  (Get-Score $scores "premium_feel") +
  (Get-Score $scores "atmosphere") +
  (Get-Score $scores "game_like_feedback") +
  (Get-Score $scores "desktop_command_center") +
  (Get-Score $scores "motion_quality") +
  (Get-Score $scores "decision_visibility") +
  (Get-Score $scores "learning_relevance")
)
$max = 45
$percent = [Math]::Round(($weighted / $max) * 100, 2)

$result = [ordered]@{
  schema_version = "A20E_design_reference_score_v1"
  reference_id = [string]$reference.reference_id
  reference = [string]$reference.name
  corpus_type = [string]$reference.corpus_type
  weighted_score = $weighted
  max_score = $max
  score_percent = $percent
  neurochess_usage = [string]$reference.neurochess_usage
  risk_if_copied_badly = [string]$reference.risk_if_copied_badly
  copyrighted_assets_stored = [bool]$reference.copyrighted_assets_stored
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
