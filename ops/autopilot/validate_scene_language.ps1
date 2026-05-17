param(
  [string]$ScenePath
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

function Has-AnyText {
  param($Values, [string[]]$Patterns)
  $text = (@($Values) | ForEach-Object { [string]$_ }) -join " "
  foreach ($pattern in $Patterns) {
    if ($text -match $pattern) { return $true }
  }
  return $false
}

function Add-Violation {
  param([System.Collections.Generic.List[string]]$Violations, [string]$Value)
  $Violations.Add($Value) | Out-Null
}

if (-not $ScenePath) { throw "ScenePath is required" }
$scene = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $ScenePath) -Raw | ConvertFrom-Json
$violations = New-Object System.Collections.Generic.List[string]

$required = @(
  "schema_version",
  "scene_id",
  "learning_state",
  "board_role",
  "board_readability_rule",
  "camera_mode",
  "atmosphere_family",
  "reference_inspirations",
  "allowed_effects",
  "forbidden_effects",
  "artifacts",
  "motion_policy",
  "performance_budget",
  "accessibility_mode",
  "screenshot_requirements",
  "visual_audit_questions"
)

foreach ($field in $required) {
  if ($null -eq $scene.PSObject.Properties[$field] -or [string]$scene.$field -eq "") {
    Add-Violation $violations "missing_$field"
  }
}

$allowedStates = @("observe", "detect", "try_before_feedback", "feedback_success", "feedback_miss", "replay", "explore", "memory", "transfer")
if ($scene.learning_state -and (@($allowedStates) -notcontains [string]$scene.learning_state)) {
  Add-Violation $violations "invalid_learning_state"
}

$allowedCameras = @("locked_orthographic", "subtle_parallax", "fixed_perspective_low_motion")
$forbiddenCameras = @("free_camera_spin", "dramatic_orbit_loop", "zoom_jumps", "motion_sickness_camera")
if ($scene.camera_mode -and (@($forbiddenCameras) -contains [string]$scene.camera_mode)) {
  Add-Violation $violations "forbidden_camera_mode"
}
if ($scene.camera_mode -and (@($allowedCameras) -notcontains [string]$scene.camera_mode)) {
  Add-Violation $violations "camera_mode_not_allowed"
}

$allowedEffects = @($scene.allowed_effects)
if ($allowedEffects -contains "meaningless_glow") { Add-Violation $violations "meaningless_glow" }
if ($allowedEffects -contains "camera_spin") { Add-Violation $violations "camera_spin_effect" }
if ($allowedEffects -contains "board_obscuring_fog") { Add-Violation $violations "board_obscuring_effect" }
if ($allowedEffects -contains "random_particles") { Add-Violation $violations "random_particles" }
if ($allowedEffects -contains "fake_xp_rank_transfer") { Add-Violation $violations "fake_xp_rank_transfer" }
if ($allowedEffects -contains "fake_neuroscience") { Add-Violation $violations "fake_neuroscience" }
if ($allowedEffects -contains "fake_elo") { Add-Violation $violations "fake_elo" }
if ($allowedEffects -contains "mobile_layout") { Add-Violation $violations "mobile_layout" }

$allowedText = ($allowedEffects + @($scene.artifacts) + @($scene.visual_audit_questions)) -join " "
if ($allowedText -match "(?i)\bXP\b|rank|Transfer") { Add-Violation $violations "fake_xp_rank_transfer_text" }
if ($allowedText -match "(?i)brain.?wave|neuroscience|cortex") { Add-Violation $violations "fake_neuroscience_text" }
if ($allowedText -match "(?i)\bElo\b") { Add-Violation $violations "fake_elo_text" }
if ($allowedText -match "(?i)mobile-first|bottom nav") { Add-Violation $violations "mobile_first_layout_text" }

$boardText = ("{0} {1}" -f [string]$scene.board_role, [string]$scene.board_readability_rule)
if ($boardText -match "(?i)obscur|hidden|covered") { Add-Violation $violations "board_obscured" }
foreach ($word in @("central", "stable", "readable")) {
  if ($boardText -notmatch $word) { Add-Violation $violations "board_readability_missing_$word" }
}

if ($null -eq $scene.accessibility_mode -or -not [bool]$scene.accessibility_mode.reduced_motion_required) {
  Add-Violation $violations "reduced_motion_fallback_missing"
}
if ($null -eq $scene.accessibility_mode -or -not ([string]$scene.accessibility_mode.fallback_mode -match "2d|2D|two_d|two-dimensional")) {
  Add-Violation $violations "two_d_fallback_missing"
}

if ($null -eq $scene.performance_budget) {
  Add-Violation $violations "performance_budget_missing"
} else {
  if (-not $scene.performance_budget.target_desktop_fps) { Add-Violation $violations "target_desktop_fps_missing" }
  if (-not $scene.performance_budget.graceful_minimum_fps) { Add-Violation $violations "graceful_minimum_fps_missing" }
  if ($null -eq $scene.performance_budget.max_postprocess_passes) { Add-Violation $violations "max_postprocess_passes_missing" }
}

if ($violations.Count -gt 0) {
  $resultName = "REJECT_SCENE_LANGUAGE"
  $action = "REPAIR_SCENE"
  $exitCode = 2
} else {
  $resultName = "PASS"
  $action = "CONTINUE"
  $exitCode = 0
}

$result = [ordered]@{
  scene_language_result = $resultName
  scene_id = [string]$scene.scene_id
  learning_state = [string]$scene.learning_state
  violations = @($violations)
  board_readability_verified = ($violations -notcontains "board_obscured" -and ($violations | Where-Object { $_ -like "board_readability_missing_*" }).Count -eq 0)
  reduced_motion_fallback_required = [bool]$scene.accessibility_mode.reduced_motion_required
  performance_budget_required = ($null -ne $scene.performance_budget)
  recommended_action = $action
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 12
exit $exitCode
