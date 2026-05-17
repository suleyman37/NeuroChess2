param(
  [string]$OutPath = "",
  [string]$Nonce = ""
)

$ErrorActionPreference = "Stop"

if (-not $Nonce) { $Nonce = "A18F_VISUAL_CONTEXT" }
if (-not $OutPath) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smokes"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutPath = Join-Path $root ("gemini_visual_context_pack_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".md")
}

$content = @"
# Gemini Visual Context Pack

nonce: $Nonce

Project: NeuroChess.

Role: Gemini is Visual Court / auditor only.

Authority:
- Gemini must not plan.
- Gemini must not generate Codex prompts.
- Gemini must not write implementation instructions.
- Gemini cannot authorize execution.
- Deterministic Control Plane gates remain final.

Product context:
- NeuroChess is desktop-first / PC-first, not mobile-first.
- North Star: Help any chess player unlock their real chess potential as fast as possible through real-game decisions, active replay, honest feedback, repetition, transfer verification, and adaptive planning.

Visual audit priorities:
- board-centered desktop experience;
- CTA truthfulness;
- read-only clarity;
- no fake Practice;
- no fake XP/rank/Transfer;
- no fake neuroscience;
- no fake Elo;
- no mobile-first bottom navigation as primary UX;
- no decorative motion without learning purpose.

Response format:
- strict JSON only;
- no markdown prose outside JSON;
- no MICRO_PROMPT field;
- no codex_prompt field;
- no implementation instructions.
"@

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutPath) | Out-Null
Set-Content -LiteralPath $OutPath -Value $content -Encoding UTF8

[ordered]@{
  status = "pass"
  out_path = (Resolve-Path -LiteralPath $OutPath).Path
  nonce = $Nonce
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 6
