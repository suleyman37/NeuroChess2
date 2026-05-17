param(
  [string]$EvidenceRoot,
  [string]$OutPath,
  [string]$Nonce = "A20K_STRICT_VISUAL_CONTEXT"
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-FromRepo {
  param([string]$Path)
  if (-not $Path) { return $null }
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

$context = [ordered]@{
  schema_version = "A20K_strict_gemini_visual_context_v1"
  nonce = $Nonce
  evidence_root = $EvidenceRoot
  role = "strict_read_only_visual_auditor"
  hard_instruction = "If board geometry, piece readability, board cleanliness, or pre-feedback anti-spoiler semantics fail, return BLOCK_VISUAL."
  required_json_fields = @(
    "schema",
    "nonce",
    "mode",
    "verdict",
    "prototype_grade",
    "product_grade",
    "game_changer_grade",
    "hard_gates",
    "fatal_defects",
    "allowed_next_action",
    "findings",
    "must_not_do",
    "done"
  )
  hard_gates = @(
    "chessboard_geometry_uniform",
    "top_down_readability",
    "pieces_immediately_readable",
    "board_surface_unpolluted",
    "overlays_pedagogical_not_decorative",
    "pre_feedback_no_spoiler",
    "primary_action_clear",
    "no_fake_gamification",
    "no_dev_hud_dominance",
    "premium_identity"
  )
  forbidden_response_fields = @("MICRO_PROMPT", "codex_prompt")
  placeholder_policy = "Generic praise, enum echoes, or missing concrete visible findings produce GEMINI_CRITIQUE_INSUFFICIENT."
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

if ($OutPath) {
  $resolved = Resolve-FromRepo $OutPath
  $parent = Split-Path -Parent $resolved
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $context | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resolved -Encoding UTF8
}

$context | ConvertTo-Json -Depth 10
exit 0
