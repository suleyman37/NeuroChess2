param(
  [string]$CandidatePath,
  [string]$TasteProxyPath
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

function Get-Prop {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $CandidatePath) { throw "CandidatePath is required" }
if (-not $TasteProxyPath) { throw "TasteProxyPath is required" }

$candidate = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $CandidatePath) -Raw | ConvertFrom-Json
$proxy = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $TasteProxyPath) -Raw | ConvertFrom-Json
$thresholds = $proxy.thresholds
$reasons = New-Object System.Collections.Generic.List[string]

$designScore = [int](Get-Prop $candidate "design_score_base" 60)
$tasteScore = [int](Get-Prop $candidate "taste_proxy_score_base" 50)
$learningLoopScore = [int](Get-Prop $candidate "learning_loop_support_score" 50)
$genericDrift = [int](Get-Prop $candidate "generic_saas_drift_base" 0)
$genericDrift += (@(Get-Prop $candidate "generic_saas_signals" @()).Count * 15)
$genericDrift += (@(Get-Prop $candidate "anti_pattern_risks" @()).Count * 8)
if ($genericDrift -gt 100) { $genericDrift = 100 }

$hardGatesPass = $true
if ([int](Get-Prop $candidate "cta_truthfulness" 0) -lt [int]$thresholds.cta_truthfulness_required) {
  $hardGatesPass = $false
  $reasons.Add("cta_truthfulness_failed") | Out-Null
}
if ([int](Get-Prop $candidate "no_fake_gamification" 0) -lt [int]$thresholds.no_fake_gamification_required) {
  $hardGatesPass = $false
  $reasons.Add("fake_gamification_detected") | Out-Null
}
foreach ($flag in @("fake_xp_rank_transfer", "fake_neuroscience", "fake_elo", "red_tier_risk", "mobile_first_drift", "uncontrolled_3d_spectacle")) {
  if ([bool](Get-Prop $candidate $flag $false)) {
    $hardGatesPass = $false
    $reasons.Add($flag) | Out-Null
  }
}
if ([bool](Get-Prop $candidate "board_present" $true) -and -not [bool](Get-Prop $candidate "board_central" $false)) {
  $hardGatesPass = $false
  $genericDrift = [Math]::Min(100, $genericDrift + 25)
  $reasons.Add("board_not_central") | Out-Null
}
if (-not [bool](Get-Prop $candidate "desktop_first" $false)) {
  $hardGatesPass = $false
  $genericDrift = [Math]::Min(100, $genericDrift + 20)
  $reasons.Add("desktop_first_failed") | Out-Null
}
if ([string](Get-Prop $candidate "visual_provider_verdict" "PASS_VISUAL") -eq "BLOCK_VISUAL") {
  $hardGatesPass = $false
  $reasons.Add("visual_provider_block") | Out-Null
}

if ($designScore -lt [int]$thresholds.design_score_min) { $reasons.Add("design_score_below_threshold") | Out-Null }
if ($tasteScore -lt [int]$thresholds.taste_proxy_score_min) { $reasons.Add("taste_proxy_score_below_threshold") | Out-Null }
if ($genericDrift -gt [int]$thresholds.generic_saas_drift_max) { $reasons.Add("generic_saas_drift_above_threshold") | Out-Null }
if ($learningLoopScore -lt 70) { $reasons.Add("learning_loop_support_weak") | Out-Null }

if ($genericDrift -ge 60 -or [bool](Get-Prop $candidate "uncontrolled_3d_spectacle" $false) -or [bool](Get-Prop $candidate "fake_xp_rank_transfer" $false) -or [bool](Get-Prop $candidate "fake_neuroscience" $false) -or [bool](Get-Prop $candidate "fake_elo" $false)) {
  $verdict = "AUTO_BLOCK_GENERIC_UI"
} elseif (-not $hardGatesPass) {
  $verdict = "AUTO_WARNING_VISUAL_DEBT"
} elseif ($designScore -ge [int]$thresholds.design_score_min -and $tasteScore -ge [int]$thresholds.taste_proxy_score_min -and $genericDrift -le [int]$thresholds.generic_saas_drift_max -and $learningLoopScore -ge 70) {
  $verdict = "AUTO_PASS_DESIGN"
} else {
  $verdict = "AUTO_NO_WINNER"
}

$result = [ordered]@{
  candidate_id = [string](Get-Prop $candidate "candidate_id" "unknown_candidate")
  design_score = $designScore
  taste_proxy_score = $tasteScore
  generic_saas_drift = $genericDrift
  learning_loop_support_score = $learningLoopScore
  hard_gates_pass = $hardGatesPass
  verdict = $verdict
  reasons = @($reasons)
  runtime_user_input_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($verdict -eq "AUTO_BLOCK_GENERIC_UI") { exit 2 }
exit 0
