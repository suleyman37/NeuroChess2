param(
  [string]$InputPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-FromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

function Get-Prop {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $InputPath) { throw "InputPath is required" }
$inputObject = Get-Content -LiteralPath (Resolve-FromRepo $InputPath) -Raw | ConvertFrom-Json
$violations = New-Object System.Collections.Generic.List[string]

$checks = [ordered]@{
  true_8x8_grid = [bool](Get-Prop $inputObject "true_8x8_grid" $false)
  square_dimensions_uniform = [bool](Get-Prop $inputObject "square_dimensions_uniform" $false)
  top_down_or_near_top_down = [bool](Get-Prop $inputObject "top_down_or_near_top_down" $false)
  perspective_does_not_harm_reading = [bool](Get-Prop $inputObject "perspective_does_not_harm_reading" $false)
  pieces_immediately_readable = [bool](Get-Prop $inputObject "pieces_immediately_readable" $false)
  board_surface_unpolluted = [bool](Get-Prop $inputObject "board_surface_unpolluted" $false)
  overlays_pedagogical_not_decorative = [bool](Get-Prop $inputObject "overlays_pedagogical_not_decorative" $false)
  desktop_viewports_readable = [bool](Get-Prop $inputObject "desktop_viewports_readable" $false)
  understandable_without_debug_labels = [bool](Get-Prop $inputObject "understandable_without_debug_labels" $false)
}

foreach ($entry in $checks.GetEnumerator()) {
  if (-not [bool]$entry.Value) { $violations.Add($entry.Key) | Out-Null }
}
if ([bool](Get-Prop $inputObject "decorative_artifacts_enter_playing_surface" $false)) {
  $violations.Add("decorative_artifacts_enter_playing_surface") | Out-Null
}

$resultName = "PASS_CHESS_FIDELITY"
if ($violations.Count -gt 0) { $resultName = "BLOCK_CHESS_FIDELITY" }

$result = [ordered]@{
  schema_version = "A20K_chessboard_fidelity_score_v1"
  subject = [string](Get-Prop $inputObject "subject" "unknown")
  chessboard_fidelity_result = $resultName
  hard_gates_pass = ($violations.Count -eq 0)
  hard_gates = $checks
  violations = @($violations)
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "BLOCK_CHESS_FIDELITY") { exit 2 }
exit 0
