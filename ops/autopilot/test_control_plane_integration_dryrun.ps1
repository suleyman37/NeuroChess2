param()

$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Assert-Contains {
  param($Array, [string]$Value, [string]$Message)
  Assert-True (@($Array) -contains $Value) $Message
}

function Assert-NoBadScriptCommand {
  param([string]$ScriptPath)
  $text = Get-Content -LiteralPath $ScriptPath -Raw
  $badPatterns = @(
    ("git\s+" + "add\s+" + "-A"),
    ("git\s+" + "reset\s+" + "--hard"),
    ("git\s+" + "clean\b"),
    ("push\s+" + "--force")
  )
  foreach ($pattern in $badPatterns) {
    Assert-True (-not ($text -match $pattern)) "Disallowed command pattern found in ${ScriptPath}: $pattern"
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $PSScriptRoot "run_control_plane_integration_dryrun.ps1"
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$output = & powershell -NoProfile -ExecutionPolicy Bypass -File $runner 2>&1
$code = $LASTEXITCODE
$raw = ($output -join "`n")
Assert-True ($code -eq 0) "Control Plane integration dry-run failed with exit code $code. Output: $raw"
$result = $raw | ConvertFrom-Json

Assert-True ($result.final_verdict -eq "PASS_EARLY_EXCELLENCE_DRY_RUN" -or $result.final_verdict -eq "PASS_CONTROL_PLANE_DRY_RUN") "Unexpected final verdict: $($result.final_verdict)"
Assert-True (Test-Path -LiteralPath ([string]$result.report_path)) "JSON report was not written."
Assert-True (Test-Path -LiteralPath ([string]$result.markdown_report_path)) "Markdown report was not written."
Assert-True (-not [bool]$result.live_chatgpt_called) "Dry-run must not call live ChatGPT."
Assert-True (-not [bool]$result.live_gemini_called) "Dry-run must not call live Gemini."
Assert-True (-not [bool]$result.product_mission_executed) "Dry-run must not execute product missions."

$components = $result.component_integration
foreach ($field in @(
  "session_created",
  "state_atomic",
  "events",
  "skill_selection",
  "nc_mp2_lint",
  "mission_contract",
  "shadow_plan",
  "product_gate",
  "mission_hash",
  "repeat_check",
  "goldilocks",
  "e2e_score",
  "forward_progress",
  "progress_ledger",
  "prompt_ledger",
  "phase_transitions"
)) {
  Assert-True ([bool]$components.$field) "Component was not integrated: $field"
}

$missions = @($result.simulated_missions)
Assert-True ($missions.Count -eq 4) "Expected four simulated missions."

$docs = $missions | Where-Object { $_.mission_id -eq "A17_DOCS_ENABLER_SIM" } | Select-Object -First 1
$backend = $missions | Where-Object { $_.mission_id -eq "A17_BACKEND_READONLY_E2E_SIM" } | Select-Object -First 1
$frontend = $missions | Where-Object { $_.mission_id -eq "A17_FRONTEND_VISUAL_E2E_SIM" } | Select-Object -First 1
$red = $missions | Where-Object { $_.mission_id -eq "A17_RED_TIER_REJECTED_SIM" } | Select-Object -First 1

Assert-True ($null -ne $docs) "Docs enabler mission missing."
Assert-True ($null -ne $backend) "Backend E2E mission missing."
Assert-True ($null -ne $frontend) "Frontend E2E mission missing."
Assert-True ($null -ne $red) "Red-tier rejection mission missing."

Assert-Contains $docs.selected_skills "neurochess-product-north-star" "Docs enabler should select North Star skill."
Assert-Contains $docs.selected_skills "mission-contract-shadow-plan" "Docs enabler should select Mission Contract skill."
Assert-Contains $docs.selected_skills "product-safe-night-mode" "Docs enabler should select Product-Safe Night Mode skill."
Assert-True ($docs.nc_mp2_lint -eq "PASS") "Docs NC-MP/2 lint should pass."
Assert-True ($docs.mission_contract -eq "PASS") "Docs Mission Contract should pass."
Assert-True ($docs.shadow_plan -eq "MATCH") "Docs Shadow Plan should match."
Assert-True ($docs.product_gate -eq "PASS") "Docs Product Gate should pass."
Assert-True ($docs.goldilocks -eq "GOLDILOCKS_PASS") "Docs Goldilocks should pass."
Assert-True ($docs.e2e_score -eq "ENABLER_DELIVERABLE") "Docs enabler should score as ENABLER_DELIVERABLE."

Assert-Contains $backend.selected_skills "backend-readonly-proof" "Backend mission should select backend-readonly-proof."
Assert-Contains $backend.selected_skills "neurochess-tdd-behavior-contract" "Backend mission should select TDD behavior contract."
Assert-True ($backend.e2e_score -eq "E2E_DELIVERABLE_PASS") "Backend E2E should pass."

Assert-Contains $frontend.selected_skills "frontend-visual-review" "Frontend mission should select frontend visual review."
Assert-Contains $frontend.selected_skills "neurochess-desktop-game-like-interface-design" "Frontend mission should select desktop interface design."
Assert-Contains $frontend.selected_skills "neurochess-react-performance-review" "Frontend mission should select React performance review."
Assert-Contains $frontend.selected_skills "neurochess-testing-visual-proof" "Frontend mission should select testing visual proof."
Assert-True ($frontend.e2e_score -eq "E2E_DELIVERABLE_PASS") "Frontend visual E2E should pass."

Assert-True ($red.status -eq "rejected") "Red-tier mission should be rejected before execution."
Assert-True ($red.deterministic_decision -eq "STOP_DETERMINISTIC_GATE") "Red-tier mission should stop deterministically."
Assert-True ([bool]$red.quarantine_required) "Red-tier mission should require quarantine."

Assert-True ($result.safety_drills.repeat_hash.decision -eq "STOP_REPEAT_MISSION_HASH") "Repeat hash drill should stop repeated mission."
Assert-True ($result.safety_drills.low_progress.decision -eq "STOP_NO_FORWARD_PROGRESS") "Low progress drill should stop after repeated no-progress."
Assert-True (@($result.phase_transitions).Count -eq 3) "Expected three phase transitions."

Assert-NoBadScriptCommand $runner
Assert-NoBadScriptCommand (Join-Path $PSScriptRoot "test_control_plane_integration_dryrun.ps1")

Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json | Out-Null
$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ([string]$state.control_plane_integration_dryrun_version -eq "A17") "state.json should record A17 version."
Assert-True ([bool]$state.control_plane_integration_dryrun_passed) "state.json should record A17 dry-run passed."
Assert-True (-not [bool]$state.live_control_plane_enabled) "Live Control Plane must remain disabled."
Assert-True (-not [bool]$state.live_rolling_loop_enabled) "Live rolling loop must remain disabled."

$productDirty = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True (-not $productDirty) "Forbidden product paths dirty: $productDirty"
Assert-True ($endBranch -eq $startBranch) "Branch changed during test."
Assert-True ($endHead -eq $startHead) "HEAD changed during test."

[ordered]@{
  status = "pass"
  final_verdict = $result.final_verdict
  report_path = $result.report_path
  checks = [ordered]@{
    session_created = "PASS"
    state_atomic = "PASS"
    events = "PASS"
    selected_skills_verified = "PASS"
    nc_mp2_lint_integrated = "PASS"
    mission_contract_integrated = "PASS"
    shadow_plan_integrated = "PASS"
    product_gate_integrated = "PASS"
    mission_hash_integrated = "PASS"
    forward_progress_integrated = "PASS"
    prompt_ledger_integrated = "PASS"
    goldilocks_integrated = "PASS"
    e2e_score_integrated = "PASS"
    phase_transitions_integrated = "PASS"
    destructive_command_check = "PASS"
    no_live_chatgpt_call = $true
    no_live_gemini_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
} | ConvertTo-Json -Depth 12
exit 0
