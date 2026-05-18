param(
    [string]$MissionId = "A20O_FIXTURE",
    [string]$ArtifactPath = "fixture_artifacts",
    [string]$TargetVisualLevel = "INTERNAL_NORTH_STAR_CANDIDATE",
    [string]$OutDir = "",
    [string]$TasteLedgerPath = "",
    [string]$FailureGalleryPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_visual_director_" + [System.Guid]::NewGuid().ToString("N"))
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$promptPaths = @{
    gemini = Join-Path $OutDir "gemini_visual_prompt.md"
    chatgpt = Join-Path $OutDir "chatgpt_art_direction_prompt.md"
    codex = Join-Path $OutDir "codex_patch_planner_prompt.md"
    creative_director = Join-Path $OutDir "creative_director_decision_template.md"
    next_mission = Join-Path $OutDir "next_visual_mission_prompt.md"
}

$packet = [ordered]@{
    mission_id = $MissionId
    evidence_path = $ArtifactPath
    target_visual_level = $TargetVisualLevel
    screenshot_set = @()
    hard_gate_status = "PENDING_SCREENSHOT_REVIEW"
    chess_arbiter_verdict = "PENDING"
    gemini_visual_verdict = "MISSING_INPUT"
    chatgpt_art_direction_verdict = "MISSING_INPUT"
    anti_generic_verdict = "PENDING"
    codex_feasibility_verdict = "PENDING"
    creative_director_final_verdict = "INSUFFICIENT_EVIDENCE"
    public_screenshot_level = "INTERNAL_PROTOTYPE_ONLY"
    awwwards_app_craft_score = 0
    visual_competence_score = 14
    top_defects = @()
    top_strengths = @()
    required_patch = "Collect screenshots, run hard gates, and select a constrained patch only after evidence."
    allowed_next_action = "build_visual_court_packet"
    blocked_reasons = @()
    next_mission_prompt_path = $promptPaths.next_mission
    taste_ledger_path = $TasteLedgerPath
    failure_gallery_path = $FailureGalleryPath
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    runtime_user_approval_required = $false
}

$packetPath = Join-Path $OutDir "visual_court_packet.json"
$packet | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $packetPath -Encoding UTF8

@"
# Gemini Visual Perceiver Prompt

Mode: read-only visual perception. This file is generated for a future optional call; this script does not call Gemini.

Mission: $MissionId
Evidence path: $ArtifactPath
Target visual level: $TargetVisualLevel

Inspect screenshots for visible reality only: board pollution, piece readability, composition, premium feeling, generic UI, public screenshot readiness, and visible defects. Hard gates override praise.

Return strict JSON. Do not include MICRO_PROMPT or codex_prompt.
"@ | Set-Content -LiteralPath $promptPaths.gemini -Encoding UTF8

@"
# ChatGPT Product And Art Direction Prompt

Mode: read-only product/art critique. This file is generated for a future optional call; this script does not call ChatGPT.

Mission: $MissionId
Evidence path: $ArtifactPath

Judge NeuroChess identity, chess learning usefulness, emotional pull, Awwwards-grade craft translation, and product-grade quality. Do not reward spectacle over chess clarity.
"@ | Set-Content -LiteralPath $promptPaths.chatgpt -Encoding UTF8

@"
# Codex Visual Patch Planner Prompt

Mission: $MissionId

Propose three constrained patch plans from screenshot defects:
- delete-first fixes;
- reshape fixes;
- add-ambition fixes.

Include allowed paths, forbidden paths, exact stop conditions, evidence requirements, screenshot requirements, hard gates, validation commands, safety constraints, no road push, and no merge.
"@ | Set-Content -LiteralPath $promptPaths.codex -Encoding UTF8

@"
# Creative Director Decision Template

Allowed decisions:
- accept
- patch
- rework
- abandon
- human_review_required
- insufficient_evidence

Hard gates veto all praise. Missing screenshots cannot be public-teaser-ready. Generic praise is insufficient.
"@ | Set-Content -LiteralPath $promptPaths.creative_director -Encoding UTF8

[ordered]@{
    packet_path = $packetPath
    output_dir = $OutDir
    generated_files = @($packetPath, $promptPaths.gemini, $promptPaths.chatgpt, $promptPaths.codex, $promptPaths.creative_director)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
} | ConvertTo-Json -Depth 6
