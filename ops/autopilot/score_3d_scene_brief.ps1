param(
  [string]$BriefPath
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

if (-not $BriefPath) { throw "BriefPath is required" }
$brief = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $BriefPath) -Raw | ConvertFrom-Json
$flags = New-Object System.Collections.Generic.List[string]
$score = 100

if (-not ([string]$brief.board_stage_doctrine -match "3D serves the chess decision")) { $flags.Add("doctrine_missing") | Out-Null; $score -= 20 }
if (-not ([string]$brief.board_role -match "central|readable|stable")) { $flags.Add("board_role_weak") | Out-Null; $score -= 20 }
if (-not (@($brief.screenshot_requirements).Count -gt 0)) { $flags.Add("screenshot_requirements_missing") | Out-Null; $score -= 15 }
if (-not [bool]$brief.accessibility.reduced_motion_required) { $flags.Add("reduced_motion_missing") | Out-Null; $score -= 20 }
if (-not $brief.performance_budget.target_desktop_fps) { $flags.Add("performance_budget_missing") | Out-Null; $score -= 15 }
$unsafeSceneText = (@($brief.scene_language.allowed_effects) + @($brief.scene_language.artifacts) + @($brief.visual_audit_questions)) -join " "
if ($unsafeSceneText -match "(?i)meaningless_glow|camera_spin|fake_xp|rank|Transfer") { $flags.Add("forbidden_visual_claim") | Out-Null; $score -= 25 }

if ($score -ge 80) {
  $resultName = "PASS"
  $action = "CONTINUE"
} elseif ($score -ge 60) {
  $resultName = "WARN_3D_BRIEF"
  $action = "REVIEW_BEFORE_PROTOTYPE"
} else {
  $resultName = "REJECT_3D_BRIEF"
  $action = "REPAIR_BRIEF"
}

$result = [ordered]@{
  three_d_scene_brief_score_result = $resultName
  score = [Math]::Max(0, $score)
  flags = @($flags)
  recommended_action = $action
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "REJECT_3D_BRIEF") { exit 2 }
exit 0
