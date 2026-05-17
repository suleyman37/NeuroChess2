param(
  [string]$ChessboardScorePath,
  [string]$AntiSpoilerScorePath,
  [string]$ProductGradePath,
  [string]$GeminiPath
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

function Read-JsonPath {
  param([string]$Path)
  if (-not $Path) { return $null }
  return Get-Content -LiteralPath (Resolve-FromRepo $Path) -Raw | ConvertFrom-Json
}

function Get-Prop {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $ChessboardScorePath) { throw "ChessboardScorePath is required" }
if (-not $AntiSpoilerScorePath) { throw "AntiSpoilerScorePath is required" }
if (-not $ProductGradePath) { throw "ProductGradePath is required" }

$chess = Read-JsonPath $ChessboardScorePath
$anti = Read-JsonPath $AntiSpoilerScorePath
$product = Read-JsonPath $ProductGradePath
$gemini = Read-JsonPath $GeminiPath
$reasons = New-Object System.Collections.Generic.List[string]

$chessResult = [string](Get-Prop $chess "chessboard_fidelity_result" "BLOCK_CHESS_FIDELITY")
$antiResult = [string](Get-Prop $anti "anti_spoiler_visual_state_result" "BLOCK_STATE_SEMANTICS")
$productGrade = [string](Get-Prop $product "product_grade" "PRODUCT_GRADE_FAIL")
$cheapUi = [string](Get-Prop $product "cheap_ui_result" "PASS_PRODUCT_UI")
$genericUi = [string](Get-Prop $product "generic_ui_result" "PASS_NON_GENERIC")

$geminiVerdict = [string](Get-Prop $gemini "verdict" "")
$geminiPlaceholder = $false
if ($gemini) {
  $geminiPlaceholder = ([bool](Get-Prop $gemini "placeholder_level" $false) -or $geminiVerdict -match "\|" -or $geminiVerdict -eq "" -or [string](Get-Prop $gemini "strongest_variant" "") -match "\|")
}
$geminiOverridden = $false

if ($chessResult -eq "BLOCK_CHESS_FIDELITY") {
  $visualResult = "BLOCK_CHESS_FIDELITY"
  $finalVerdict = "NEEDS_REWORK"
  $reasons.Add("chessboard_fidelity_hard_gate_failed") | Out-Null
  if ($geminiVerdict -eq "PASS_VISUAL") { $geminiOverridden = $true }
} elseif ($antiResult -eq "BLOCK_STATE_SEMANTICS") {
  $visualResult = "BLOCK_STATE_SEMANTICS"
  $finalVerdict = "NEEDS_REWORK"
  $reasons.Add("anti_spoiler_state_hard_gate_failed") | Out-Null
  if ($geminiVerdict -eq "PASS_VISUAL") { $geminiOverridden = $true }
} elseif ($cheapUi -eq "BLOCK_CHEAP_UI") {
  $visualResult = "BLOCK_CHEAP_UI"
  $finalVerdict = "NEEDS_REWORK"
  $reasons.Add("cheap_ui_hard_gate_failed") | Out-Null
  if ($geminiVerdict -eq "PASS_VISUAL") { $geminiOverridden = $true }
} elseif ($genericUi -eq "BLOCK_GENERIC_UI") {
  $visualResult = "BLOCK_GENERIC_UI"
  $finalVerdict = "NEEDS_REWORK"
  $reasons.Add("generic_ui_hard_gate_failed") | Out-Null
  if ($geminiVerdict -eq "PASS_VISUAL") { $geminiOverridden = $true }
} elseif ($geminiPlaceholder) {
  $visualResult = "GEMINI_CRITIQUE_INSUFFICIENT"
  $finalVerdict = "READY_WITH_VISUAL_DEBT"
  $reasons.Add("gemini_placeholder_or_non_decisive") | Out-Null
} elseif ($productGrade -eq "PRODUCT_GRADE_PASS") {
  $visualResult = "PASS_PRODUCT_GRADE"
  $finalVerdict = "READY_TO_REVIEW"
  $reasons.Add("all_strict_visual_gates_passed") | Out-Null
} else {
  $visualResult = "PASS_PROTOTYPE_ONLY"
  $finalVerdict = "READY_WITH_VISUAL_DEBT"
  $reasons.Add("technical_prototype_only_product_grade_not_met") | Out-Null
}

$result = [ordered]@{
  schema_version = "A20K_strict_visual_firewall_decision_v1"
  visual_firewall_result = $visualResult
  final_verdict = $finalVerdict
  gemini_overridden = $geminiOverridden
  reasons = @($reasons)
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($finalVerdict -eq "NEEDS_REWORK" -or $visualResult -eq "GEMINI_CRITIQUE_INSUFFICIENT") { exit 2 }
exit 0
