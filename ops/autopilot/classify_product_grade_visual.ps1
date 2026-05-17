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
$reasons = New-Object System.Collections.Generic.List[string]

$cheapUiResult = [string](Get-Prop $inputObject "cheap_ui_result" "PASS_PRODUCT_UI")
$genericUiResult = [string](Get-Prop $inputObject "generic_ui_result" "PASS_NON_GENERIC")
$chessPass = ([string](Get-Prop $inputObject "chessboard_fidelity_result" "BLOCK_CHESS_FIDELITY") -eq "PASS_CHESS_FIDELITY")
$antiSpoilerPass = ([string](Get-Prop $inputObject "anti_spoiler_visual_state_result" "BLOCK_STATE_SEMANTICS") -eq "PASS_STATE_SEMANTICS")

$technicalPrototypePass = [bool](Get-Prop $inputObject "technical_prototype_safe" $false)
if (-not $technicalPrototypePass) { $reasons.Add("technical_prototype_not_proven") | Out-Null }
if (-not $chessPass) { $reasons.Add("chessboard_fidelity_not_product_grade") | Out-Null }
if (-not $antiSpoilerPass) { $reasons.Add("anti_spoiler_not_product_grade") | Out-Null }
if (-not [bool](Get-Prop $inputObject "no_fake_claims" $false)) { $reasons.Add("fake_claims_or_truthfulness_risk") | Out-Null }
if ($cheapUiResult -eq "BLOCK_CHEAP_UI") { $reasons.Add("cheap_ui_block") | Out-Null }
if ($cheapUiResult -eq "WARN_DEV_HUD") { $reasons.Add("dev_hud_warning") | Out-Null }
if ($genericUiResult -eq "BLOCK_GENERIC_UI") { $reasons.Add("generic_ui_block") | Out-Null }
if (-not [bool](Get-Prop $inputObject "premium_first_viewport" $false)) { $reasons.Add("premium_first_viewport_missing") | Out-Null }
if (-not [bool](Get-Prop $inputObject "board_centered" $false)) { $reasons.Add("board_not_centered") | Out-Null }

$productPass = (
  $technicalPrototypePass -and
  $chessPass -and
  $antiSpoilerPass -and
  [bool](Get-Prop $inputObject "no_fake_claims" $false) -and
  $cheapUiResult -ne "BLOCK_CHEAP_UI" -and
  $genericUiResult -ne "BLOCK_GENERIC_UI" -and
  [bool](Get-Prop $inputObject "premium_first_viewport" $false) -and
  [bool](Get-Prop $inputObject "board_centered" $false)
)

$gameChangerPass = (
  $productPass -and
  [bool](Get-Prop $inputObject "memorable_identity" $false) -and
  [bool](Get-Prop $inputObject "board_as_artifact" $false) -and
  [bool](Get-Prop $inputObject "state_meaning_without_labels" $false) -and
  [bool](Get-Prop $inputObject "premium_visual_depth" $false) -and
  [bool](Get-Prop $inputObject "emotional_clarity" $false) -and
  -not [bool](Get-Prop $inputObject "prototype_feeling_dominates" $true)
)
if ($productPass -and -not $gameChangerPass) { $reasons.Add("game_changer_threshold_not_met") | Out-Null }

$result = [ordered]@{
  schema_version = "A20K_product_grade_visual_classification_v1"
  subject = [string](Get-Prop $inputObject "subject" "unknown")
  technical_prototype_grade = $(if ($technicalPrototypePass) { "TECHNICAL_PROTOTYPE_PASS" } else { "TECHNICAL_PROTOTYPE_FAIL" })
  product_grade = $(if ($productPass) { "PRODUCT_GRADE_PASS" } else { "PRODUCT_GRADE_FAIL" })
  game_changer_grade = $(if ($gameChangerPass) { "GAME_CHANGER_PASS" } else { "GAME_CHANGER_FAIL" })
  cheap_ui_result = $cheapUiResult
  generic_ui_result = $genericUiResult
  product_grade_pass = $productPass
  game_changer_pass = $gameChangerPass
  reasons = @($reasons)
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if (-not $productPass -or $cheapUiResult -eq "BLOCK_CHEAP_UI" -or $genericUiResult -eq "BLOCK_GENERIC_UI") { exit 2 }
exit 0
