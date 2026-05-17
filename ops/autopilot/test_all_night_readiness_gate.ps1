$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$reportPath = Join-Path $repoRoot "docs/autopilot/A20M_VISUAL_COURT_AND_ALL_NIGHT_READINESS_GATE.md"
$reservoirPath = Join-Path $repoRoot "docs/autopilot/A21_OBJECTIVE_RESERVOIR_DRAFT.md"
$policyPath = Join-Path $repoRoot "ops/autopilot/all_night_readiness_policy.yaml"

Assert-True (Test-Path -LiteralPath $reportPath -PathType Leaf) "A20M report missing"
Assert-True (Test-Path -LiteralPath $reservoirPath -PathType Leaf) "A21 objective reservoir draft missing"
Assert-True (Test-Path -LiteralPath $policyPath -PathType Leaf) "all-night readiness policy missing"

$report = Get-Content -LiteralPath $reportPath -Raw
$reservoir = Get-Content -LiteralPath $reservoirPath -Raw
$policy = Get-Content -LiteralPath $policyPath -Raw

foreach ($required in @(
  "CHESS_FIDELITY_PASS",
  "PRODUCT_GRADE_WITH_DEBT",
  "REVOLUTIONARY_CANDIDATE",
  "INTERNAL_NORTH_STAR_CANDIDATE",
  "REVOLUTIONARY_CANDIDATE_CONFIRMED_FOR_HUMAN_REVIEW",
  "GO_FOR_LIMITED_3H_REHEARSAL",
  "A20N_LIMITED_3H_ALL_NIGHT_REHEARSAL"
)) {
  Assert-True ($report -match [regex]::Escape($required)) "report missing required token: $required"
}

foreach ($required in @(
  "A21 was not launched",
  "Night Mode was not launched",
  "An all-night run was not started",
  '`road-to-V2` was not pushed',
  "Live ChatGPT was not called",
  "Live Gemini was not called"
)) {
  Assert-True ($report -match [regex]::Escape($required)) "report missing safety statement: $required"
}

foreach ($required in @(
  "docs/autopilot/POLICY_KERNEL_FREEZE.md",
  "docs/autopilot/BUDGET_QUOTA_METER.md",
  "docs/autopilot/KILL_SWITCH_FILE_PROTOCOL.md",
  "docs/autopilot/EVIDENCE_INDEX_PROTOCOL.md",
  "docs/autopilot/BRANCH_ORTHOGONALITY_POLICY.md",
  "docs/autopilot/ENVIRONMENT_HYGIENE_PROTOCOL.md",
  "docs/autopilot/VISUAL_HALTING_LIMIT.md",
  "docs/autopilot/OBJECTIVE_RESERVOIR_PROTOCOL.md",
  "docs/autopilot/PRODUCTIVE_TIME_GOVERNOR.md",
  "docs/autopilot/MARGINAL_VALUE_GATE.md",
  "docs/autopilot/DRAIN_PERMIT_POLICY.md"
)) {
  Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot $required) -PathType Leaf) "required policy doc missing: $required"
  Assert-True ($policy -match [regex]::Escape($required)) "policy does not reference required doc: $required"
}

$objectiveCount = ([regex]::Matches($reservoir, "^## Objective ", [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
Assert-True ($objectiveCount -ge 8 -and $objectiveCount -le 15) "reservoir objective count should be 8-15, found $objectiveCount"

foreach ($required in @(
  "lane:",
  "product value:",
  "risk tier:",
  "allowed paths:",
  "forbidden paths:",
  "measurable output:",
  "evidence required:",
  "stop conditions:",
  "max files:",
  "max diff lines:",
  "screenshots required:",
  "browser smoke required:",
  "human review required before merge:"
)) {
  Assert-True ($reservoir -match [regex]::Escape($required)) "reservoir missing required field label: $required"
}

foreach ($forbidden in @(
  "active Practice mutation",
  '`due_at` changes',
  "Daily Plan mutation",
  '`training_items` writes',
  '`practice_attempts` writes',
  "scoring/result writes",
  "DB migrations",
  '`package.json` or `package-lock.json` changes',
  'auto-merge to `road-to-V2`'
)) {
  Assert-True ($reservoir -match [regex]::Escape($forbidden)) "reservoir missing forbidden lane: $forbidden"
}

foreach ($required in @(
  "selected_readiness_verdict: GO_FOR_LIMITED_3H_REHEARSAL",
  "selected_next_mission: A20N_LIMITED_3H_ALL_NIGHT_REHEARSAL",
  "visual_classification: REVOLUTIONARY_CANDIDATE_CONFIRMED_FOR_HUMAN_REVIEW",
  "runtime_user_approval_required: false",
  "live_chatgpt_called: false",
  "live_gemini_called: false",
  "product_mission_executed: false",
  "deterministic_hard_gates_override_gemini_or_autonomous_scores"
)) {
  Assert-True ($policy -match [regex]::Escape($required)) "policy missing required token: $required"
}

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbiddenTouched = @($changed | Where-Object {
  $_ -like "frontend/*" -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -like "ops/autopilot/local/*" -or
  $_ -like ".serena/*"
})
Assert-True ($forbiddenTouched.Count -eq 0) "forbidden files touched: $($forbiddenTouched -join ', ')"

$assetLike = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|gif|webp|avif|mp4|mov|webm|glb|fbx|obj|ktx|texture)$' })
Assert-True ($assetLike.Count -eq 0) "screenshots/images/assets must not be staged or dirty: $($assetLike -join ', ')"

$result = [ordered]@{
  status = "pass"
  visual_classification = "REVOLUTIONARY_CANDIDATE_CONFIRMED_FOR_HUMAN_REVIEW"
  readiness_verdict = "GO_FOR_LIMITED_3H_REHEARSAL"
  objective_count = $objectiveCount
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  road_to_v2_pushed = $false
  night_mode_launched = $false
  a21_launched = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
