param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$fixtureRoot = Join-Path $repoRoot "ops\autopilot\fixtures"
$selector = Join-Path $repoRoot "ops\autopilot\select_internal_skills.ps1"
$validator = Join-Path $repoRoot "ops\autopilot\validate_internal_skill_selection.ps1"

$checks = [ordered]@{}
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
  param([string]$Name, [string]$Message)
  $checks[$Name] = "FAIL"
  $failures.Add($Message) | Out-Null
}

function Add-Pass {
  param([string]$Name)
  if (-not $checks.Contains($Name)) { $checks[$Name] = "PASS" }
}

function Invoke-Select {
  param([string]$Fixture)
  $path = Join-Path $fixtureRoot $Fixture
  return powershell -ExecutionPolicy Bypass -File $selector -InputPath $path | ConvertFrom-Json
}

function Assert-Contains {
  param([string]$CheckName, $Array, [string]$Value)
  if (@($Array) -contains $Value) { Add-Pass $CheckName } else { Add-Failure $CheckName "Expected '$Value'." }
}

function Assert-Result {
  param([string]$CheckName, $Selection, [string]$Expected)
  if ([string]$Selection.selection_result -eq $Expected) { Add-Pass $CheckName } else { Add-Failure $CheckName "Expected $Expected, got $($Selection.selection_result)." }
}

function Validate-Selection {
  param([string]$CheckName, $Selection)
  $json = $Selection | ConvertTo-Json -Depth 12 -Compress
  $temp = New-TemporaryFile
  try {
    Set-Content -LiteralPath $temp.FullName -Value $json -Encoding UTF8
    $validation = powershell -ExecutionPolicy Bypass -File $validator -InputPath $temp.FullName | ConvertFrom-Json
    if ($validation.valid) { Add-Pass $CheckName } else { Add-Failure $CheckName "Validation failed: $(@($validation.violations) -join '; ')" }
  } finally {
    Remove-Item -LiteralPath $temp.FullName -Force -ErrorAction SilentlyContinue
  }
}

$docs = Invoke-Select "skill_selection_docs_contract.json"
Assert-Result "docs_contract_pass" $docs "PASS"
Assert-Contains "docs_contract_north_star" $docs.selected_skills "neurochess-product-north-star"
Assert-Contains "docs_contract_shadow" $docs.selected_skills "mission-contract-shadow-plan"
Validate-Selection "docs_contract_validates" $docs

$backend = Invoke-Select "skill_selection_backend_readonly.json"
Assert-Result "backend_readonly_pass" $backend "PASS"
Assert-Contains "backend_readonly_proof" $backend.selected_skills "backend-readonly-proof"
Assert-Contains "backend_tdd" $backend.selected_skills "neurochess-tdd-behavior-contract"
Assert-Contains "backend_shadow" $backend.selected_skills "mission-contract-shadow-plan"
Validate-Selection "backend_validates" $backend

$frontend = Invoke-Select "skill_selection_frontend_desktop_ui.json"
Assert-Result "frontend_desktop_pass" $frontend "PASS"
Assert-Contains "frontend_visual" $frontend.selected_skills "frontend-visual-review"
Assert-Contains "frontend_desktop_design" $frontend.selected_skills "neurochess-desktop-game-like-interface-design"
Assert-Contains "frontend_react" $frontend.selected_skills "neurochess-react-performance-review"
Assert-Contains "frontend_testing_visual_proof" $frontend.selected_skills "neurochess-testing-visual-proof"
Assert-Contains "frontend_product_ux_critic" $frontend.selected_skills "neurochess-product-ux-critic"
Validate-Selection "frontend_validates" $frontend

$visual = Invoke-Select "skill_selection_frontend_visual_review.json"
Assert-Result "visual_review_pass" $visual "PASS"
Assert-Contains "visual_review_visual_skill" $visual.selected_skills "frontend-visual-review"
Assert-Contains "visual_review_gemini" $visual.selected_skills "gemini-auditor"
Assert-Contains "visual_review_testing_visual_proof" $visual.selected_skills "neurochess-testing-visual-proof"
Validate-Selection "visual_validates" $visual

$night = Invoke-Select "skill_selection_night_mode.json"
Assert-Result "night_mode_pass" $night "PASS"
Assert-Contains "night_product_safe" $night.selected_skills "product-safe-night-mode"
Assert-Contains "night_morning" $night.selected_skills "morning-intelligence-report"
Assert-Contains "night_security_repo_hygiene" $night.selected_skills "neurochess-security-repo-hygiene"
Validate-Selection "night_validates" $night

$gemini = Invoke-Select "skill_selection_gemini_audit.json"
Assert-Result "gemini_planner_rejected" $gemini "FAIL"
Assert-Contains "gemini_auditor_selected" $gemini.selected_skills "gemini-auditor"
if ((@($gemini.conflicts) -join "`n") -match "planner|prompt generator") { Add-Pass "gemini_conflict_reason" } else { Add-Failure "gemini_conflict_reason" "Gemini-as-planner conflict missing." }

$morning = Invoke-Select "skill_selection_morning_report.json"
Assert-Result "morning_report_pass" $morning "PASS"
Assert-Contains "morning_report_skill" $morning.selected_skills "morning-intelligence-report"
Validate-Selection "morning_validates" $morning

$red = Invoke-Select "skill_selection_red_tier_rejected.json"
Assert-Result "red_tier_rejected" $red "FAIL"
if ((@($red.conflicts) -join "`n") -match "Red-tier") { Add-Pass "red_tier_conflict_reason" } else { Add-Failure "red_tier_conflict_reason" "Red-tier conflict missing." }

$mixed = Invoke-Select "skill_selection_conflicting_backend_frontend.json"
Assert-Result "backend_frontend_conflict_rejected" $mixed "FAIL"
if ((@($mixed.conflicts) -join "`n") -match "Frontend/backend") { Add-Pass "backend_frontend_conflict_reason" } else { Add-Failure "backend_frontend_conflict_reason" "Frontend/backend conflict missing." }

foreach ($selection in @($docs, $backend, $frontend, $visual, $night, $morning)) {
  foreach ($skill in @($selection.selected_skills)) {
    if ($skill -match "frontend-design|shadcn|ui-ux-pro-max|make-interfaces-feel-better|external_skills|quarantine") {
      Add-Failure "no_external_skill_selected" "External skill selected: $skill"
    }
  }
}
Add-Pass "no_external_skill_selected"

$productDirty = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx
if (-not $productDirty) { Add-Pass "no_frontend_backend_docs_rebuild_touched" } else { Add-Failure "no_frontend_backend_docs_rebuild_touched" "Forbidden product paths dirty: $productDirty" }

$trackedRaw = git -C $repoRoot ls-files "external_skills/quarantine/*" "external_skills/audited/raw/*" "external_skills/adapted/raw/*"
$badRaw = @($trackedRaw | Where-Object { $_ -ne "external_skills/quarantine/.gitkeep" })
if ($badRaw.Count -eq 0) { Add-Pass "no_raw_external_skills_committed" } else { Add-Failure "no_raw_external_skills_committed" "Raw external content tracked: $($badRaw -join ', ')" }

$result = [ordered]@{
  status = if ($failures.Count -eq 0) { "pass" } else { "fail" }
  checks = $checks
  failures = @($failures)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  skills_live_activation_enabled = $false
}

$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
exit 0
