param(
  [ValidateSet("safe", "unsafe")][string]$Mode = "safe",
  [string]$OutPath = "",
  [string[]]$ScreenshotPath = @(),
  [string]$ExpectedVisualCode = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutPath) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smokes"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutPath = Join-Path $root ("gemini_visual_review_brief_${Mode}_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json")
}

$brief = if ($Mode -eq "safe") {
  [ordered]@{
    surface = "synthetic visual smoke"
    state = "non-product test image"
    desktop_target = "synthetic desktop-neutral image"
    product_intent = "Verify Gemini can read a visible visual code and return strict JSON."
    must_be_true = @("visual code must be read exactly", "strict JSON only", "no Codex prompt")
    must_not_happen = @("no MICRO_PROMPT", "no codex_prompt", "no implementation instructions")
    north_star_question = "Does this audit mechanism help NeuroChess prove visual evidence truthfully before product work?"
    expected_visual_verdict = "PASS_VISUAL"
    expected_visual_code = $ExpectedVisualCode
    screenshot_paths = @($ScreenshotPath)
  }
} else {
  [ordered]@{
    surface = "synthetic unsafe NeuroChess UI canary"
    state = "fake frontend UI screenshot"
    desktop_target = "desktop-first review should reject mobile-first cramped primary flow"
    product_intent = "Verify Gemini blocks unsafe UI claims and fake progress indicators."
    must_be_true = @("fake Practice ready claim detected", "fake XP/rank/Transfer claim detected", "unsafe CTA detected")
    must_not_happen = @("fake Practice ready", "fake XP/rank/Transfer", "unsafe Train now CTA", "mobile-first cramped layout")
    north_star_question = "Does this UI stay truthful and learning-first?"
    expected_visual_verdict = "BLOCK_VISUAL or WARNING_VISUAL"
    screenshot_paths = @($ScreenshotPath)
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutPath) | Out-Null
$brief | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutPath -Encoding UTF8

[ordered]@{
  status = "pass"
  mode = $Mode
  out_path = (Resolve-Path -LiteralPath $OutPath).Path
  screenshot_paths = @($ScreenshotPath)
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 8
