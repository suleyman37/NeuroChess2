param(
  [string]$DesignBriefPath,
  [string]$TasteProxyPath,
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

if (-not $DesignBriefPath) { throw "DesignBriefPath is required" }
if (-not $TasteProxyPath) { throw "TasteProxyPath is required" }
$brief = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $DesignBriefPath) -Raw | ConvertFrom-Json
$proxy = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $TasteProxyPath) -Raw | ConvertFrom-Json

$packet = [ordered]@{
  schema_version = "A20G_design_jury_packet_v1"
  packet_id = "design_jury_packet_$([guid]::NewGuid().ToString("N"))"
  design_brief = $brief
  screenshot_artifacts = @($brief.screenshot_requirements)
  selected_references = @($brief.reference_inspirations)
  taste_proxy_summary = [ordered]@{
    proxy_id = $proxy.proxy_id
    positive_signal_count = @($proxy.positive_taste_signals).Count
    negative_signal_count = @($proxy.negative_taste_signals).Count
    runtime_user_input_required = $false
  }
  design_rubric = @("desktop_first", "board_centered", "decision_clarity", "cta_truthfulness", "no_fake_gamification", "no_generic_saas_drift", "learning_loop_support")
  visual_court_questions = @(
    "Does this design feel like a desktop strategic cockpit?",
    "Is the board/position central?",
    "Is it drifting toward generic SaaS?",
    "Does it have game-like feedback without fake gamification?",
    "Does motion serve state?",
    "Is 3D clarifying the decision or distracting from it?",
    "Is the primary action obvious?",
    "Does the UI accelerate the Potential Unlock Loop?"
  )
  forbidden_runtime_instruction = "Runtime user approval is forbidden; return NO_WINNER or NEEDS_HUMAN_REVIEW_AFTER_RUN if unsafe."
  runtime_user_input_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $packet | ConvertTo-Json -Depth 30
if ($OutPath) {
  $full = Resolve-PathFromRepo -Path $OutPath
  $dir = Split-Path -Parent $full
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -LiteralPath $full -Value $json -Encoding UTF8
}

$json
exit 0
