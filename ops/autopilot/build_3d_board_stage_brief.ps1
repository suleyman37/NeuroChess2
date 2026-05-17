param(
  [string]$ScenePath,
  [string]$OutJsonPath,
  [string]$OutMarkdownPath
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

if (-not $ScenePath) { throw "ScenePath is required" }
$scene = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $ScenePath) -Raw | ConvertFrom-Json

$brief = [ordered]@{
  schema_version = "A20F_3d_board_stage_brief_v1"
  scene_id = [string]$scene.scene_id
  learning_state = [string]$scene.learning_state
  board_stage_doctrine = "The 3D serves the chess decision. If 3D reduces board readability, it must recede."
  board_role = [string]$scene.board_role
  camera_mode = [string]$scene.camera_mode
  renderer_candidates = @("React Three Fiber", "Drei optional", "React Postprocessing optional", "Theatre.js optional", "WebGPU/TSL DEV-only later")
  scene_language = $scene
  accessibility = $scene.accessibility_mode
  performance_budget = $scene.performance_budget
  screenshot_requirements = @($scene.screenshot_requirements)
  visual_audit_questions = @($scene.visual_audit_questions)
  forbidden_claims = @("fake Practice", "fake XP/rank/Transfer", "fake neuroscience", "fake Elo", "meaningless glow")
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $brief | ConvertTo-Json -Depth 30
if ($OutJsonPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutJsonPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

if ($OutMarkdownPath) {
  $mdFullPath = Resolve-PathFromRepo -Path $OutMarkdownPath
  $mdDir = Split-Path -Parent $mdFullPath
  if ($mdDir) { New-Item -ItemType Directory -Force -Path $mdDir | Out-Null }
  $md = @(
    "# NeuroChess 3D Board Stage Brief",
    "",
    "Scene: $($brief.scene_id)",
    "Learning state: $($brief.learning_state)",
    "Doctrine: $($brief.board_stage_doctrine)",
    "Board role: $($brief.board_role)",
    "Camera mode: $($brief.camera_mode)",
    "",
    "Renderer candidates:",
    ($brief.renderer_candidates | ForEach-Object { "- $_" }),
    "",
    "Visual audit questions:",
    ($brief.visual_audit_questions | ForEach-Object { "- $_" })
  ) -join "`n"
  Set-Content -LiteralPath $mdFullPath -Value $md -Encoding UTF8
}

$json
exit 0
