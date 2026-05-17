param(
  [string]$MissionPath,
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

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $MissionPath) { throw "MissionPath is required" }
$mission = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $MissionPath) -Raw | ConvertFrom-Json
$fixtures = Join-Path $PSScriptRoot "fixtures"
$selected = @((Get-Field $mission "selected_references" @()))
if ($selected.Count -eq 0) {
  $selected = @("linear", "figma", "orano", "igloo", "balatro")
}

$referenceFiles = @{
  igloo = "design_reference_igloo.json"
  messenger = "design_reference_messenger.json"
  orano = "design_reference_orano.json"
  shader = "design_reference_shader.json"
  som = "design_reference_som.json"
  linear = "design_reference_linear.json"
  figma = "design_reference_figma.json"
  balatro = "design_reference_balatro.json"
}

$references = @()
foreach ($id in $selected) {
  if (-not $referenceFiles.ContainsKey([string]$id)) { continue }
  $ref = Get-Content -LiteralPath (Join-Path $fixtures $referenceFiles[[string]$id]) -Raw | ConvertFrom-Json
  $references += [ordered]@{
    reference_id = [string]$ref.reference_id
    name = [string]$ref.name
    learn = @($ref.learn)
    do_not_copy = @($ref.do_not_copy)
  }
}

$surface = [string](Get-Field $mission "surface" "frontend surface")
$boardRole = [string](Get-Field $mission "board_role" "central decision stage when board is present")
$brief = [ordered]@{
  schema_version = "A20E_design_brief_v1"
  surface = $surface
  user_state = [string](Get-Field $mission "user_state" "reviewing a chess decision")
  product_intent = [string](Get-Field $mission "product_intent" "make a real-game decision understandable and actionable")
  desktop_target = [string](Get-Field $mission "desktop_target" "1366/1440/1920 desktop-first")
  primary_action = [string](Get-Field $mission "primary_action" "one truthful next action")
  board_role = $boardRole
  position_artifact_role = [string](Get-Field $mission "position_artifact_role" "the key position should feel like an inspectable artifact")
  reference_inspirations = @($references)
  interaction_expectations = @("mouse and keyboard first", "primary action visible without scroll", "feedback appears near the decision")
  visual_hierarchy_expectations = @("board or key position dominates", "support panels frame the decision", "metrics support action instead of becoming the page")
  motion_expectations = @("motion communicates state or feedback only", "no decorative motion without learning purpose")
  forbidden_design_drift = @("mobile bottom nav", "generic metric table", "fake Practice ready", "XP/rank/Transfer", "meaningless glow", "SaaS landing-page style")
  screenshot_requirements = @("1366 desktop", "1440 desktop", "contact sheet", "failure screenshot if smoke fails")
  gemini_visual_court_questions = @("Is this drifting toward generic SaaS?", "Is the board or key position central?", "Are any fake Practice, XP, rank, or Transfer claims present?", "Does the UI support the learning loop?")
  expected_pass_fail_criteria = @("desktop-first >= 4", "decision clarity >= 4", "CTA truthfulness = 5", "no fake gamification = 5", "generic SaaS drift <= 2")
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $brief | ConvertTo-Json -Depth 20
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
    "# NeuroChess Frontend Design Brief",
    "",
    "Surface: $surface",
    "Desktop target: $($brief.desktop_target)",
    "Primary action: $($brief.primary_action)",
    "Board role: $boardRole",
    "Position artifact role: $($brief.position_artifact_role)",
    "",
    "Forbidden drift:",
    ($brief.forbidden_design_drift | ForEach-Object { "- $_" })
  ) -join "`n"
  Set-Content -LiteralPath $mdFullPath -Value $md -Encoding UTF8
}

$json
exit 0
