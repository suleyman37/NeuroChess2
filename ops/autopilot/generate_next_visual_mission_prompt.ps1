param(
    [string]$VerdictPath,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($VerdictPath) -or -not (Test-Path -LiteralPath $VerdictPath)) {
    throw "VerdictPath is required."
}

$verdict = Get-Content -LiteralPath $VerdictPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) "next_visual_mission_prompt.md"
}

$defects = if ($verdict.top_defects) { ($verdict.top_defects -join ", ") } else { "none recorded" }
$blocked = if ($verdict.blocked_reasons) { ($verdict.blocked_reasons -join ", ") } else { "none recorded" }

@"
# Next NeuroChess Visual Mission Prompt

## Objective

Execute the Creative Director decision for mission `$($verdict.mission_id)`: `$($verdict.selected_action)`.

Required patch:
$($verdict.required_patch)

## Allowed Paths

- `frontend/src/dev/**` only when a DEV-only visual route is explicitly in scope.
- `scripts/browser_a20*.mjs` for targeted browser evidence.
- `docs/autopilot/**`
- `docs/design/**`
- `ops/autopilot/**`

## Forbidden Paths

- `backend/**`
- `frontend/src/App.tsx` unless a minimal hidden DEV-only route is explicitly required.
- `docs/rebuild/**`
- `plan/**`
- `package.json`
- `package-lock.json`
- `.serena/**`
- `ops/autopilot/local/**`
- screenshots, images, videos, models, textures, and QA artifacts inside the repo.

## Exact Stop Conditions

- chessboard fidelity fails;
- pre-feedback hint appears;
- board pollution appears;
- product data mutation risk appears;
- package files change;
- road-to-V2 push or merge is attempted;
- human verification, login, CAPTCHA, 2FA, or consent is required;
- generated patch does not improve visible evidence by generation 2;
- runtime starts producing process without product value.

## Evidence Requirements

- screenshot/contact sheet path outside repo;
- hard gate JSON;
- visual court packet;
- Creative Director verdict;
- before/after comparison when patching;
- final evidence manifest.

## Screenshot Requirements

- observe;
- try_before_feedback;
- feedback_success;
- feedback_miss;
- replay if available;
- reduced motion/fallback if visual effects changed.

## Hard Gates

- Strict Chessboard Fidelity Gate;
- Anti-Spoiler Visual State Gate;
- Cheap UI / Dev-HUD Rejection Policy;
- No Generic Glow Law;
- Sacred Board Contract.

## Validation Commands

```powershell
git diff --check
powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1
powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurochess_visual_training_system.ps1
python tools/plan_guard.py
```

Run frontend build/typecheck only if frontend files changed.

## Safety Constraints

- no road push;
- no merge;
- no A21 launch;
- no Night Mode launch;
- no live LLM call unless explicitly enabled;
- no human verification bypass;
- no fake XP/rank/Elo/Transfer;
- no screenshots or QA artifacts committed.

## Current Defects

$defects

## Blocked Reasons

$blocked
"@ | Set-Content -LiteralPath $OutPath -Encoding UTF8

$verdict.next_mission_prompt_path = $OutPath
$verdict | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $VerdictPath -Encoding UTF8

[ordered]@{
    next_mission_prompt_path = $OutPath
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
} | ConvertTo-Json -Depth 6
