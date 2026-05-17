param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$skillsRoot = Join-Path $repoRoot ".agents\skills"

$requiredSkills = @(
  "neurochess-product-north-star",
  "mission-contract-shadow-plan",
  "product-safe-night-mode",
  "backend-readonly-proof",
  "frontend-visual-review",
  "neurochess-desktop-game-like-interface-design",
  "neurochess-react-performance-review",
  "neurochess-tdd-behavior-contract",
  "gemini-auditor",
  "morning-intelligence-report",
  "neurochess-testing-visual-proof",
  "neurochess-security-repo-hygiene",
  "neurochess-product-ux-critic",
  "neurochess-learning-loop-accelerator"
)

$designSkills = @(
  "frontend-visual-review",
  "neurochess-desktop-game-like-interface-design",
  "neurochess-react-performance-review",
  "neurochess-testing-visual-proof",
  "neurochess-product-ux-critic"
)

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

function Require-Contains {
  param([string]$CheckName, [string]$Text, [string]$Pattern, [string]$Message)
  if ($Text -match $Pattern) { Add-Pass $CheckName } else { Add-Failure $CheckName $Message }
}

$skillTexts = @{}
foreach ($skill in $requiredSkills) {
  $skillDir = Join-Path $skillsRoot $skill
  $skillFile = Join-Path $skillDir "SKILL.md"
  if (Test-Path -LiteralPath $skillDir) { Add-Pass "folder_exists_$skill" } else { Add-Failure "folder_exists_$skill" "Missing skill folder: $skill" }
  if (Test-Path -LiteralPath $skillFile) {
    Add-Pass "skill_md_exists_$skill"
    $text = Get-Content -LiteralPath $skillFile -Raw
    $skillTexts[$skill] = $text
    Require-Contains "metadata_name_$skill" $text "(?m)^name:\s*$([regex]::Escape($skill))\s*$" "Missing name metadata for $skill"
    Require-Contains "metadata_description_$skill" $text "(?m)^description:\s*.{20,}$" "Missing description metadata for $skill"
    Require-Contains "control_plane_$skill" $text "cannot override the local Control Plane" "Missing Control Plane authority rule in $skill"
    Require-Contains "mission_contract_$skill" $text "cannot bypass Mission Contract" "Missing Mission Contract rule in $skill"
    Require-Contains "shadow_plan_$skill" $text "cannot bypass Shadow Plan" "Missing Shadow Plan rule in $skill"
    Require-Contains "red_tier_$skill" $text "cannot weaken red-tier rules" "Missing red-tier rule in $skill"
  } else {
    Add-Failure "skill_md_exists_$skill" "Missing SKILL.md for $skill"
  }
}

foreach ($skill in $designSkills) {
  if ($skillTexts.ContainsKey($skill)) {
    $text = $skillTexts[$skill]
    Require-Contains "desktop_first_$skill" $text "(desktop-first|PC / desktop-first|PC-first)" "Missing desktop-first policy in $skill"
    if ($text -match "(?i)(mobile-first as primary|primary goal.*mobile-first|mobile-first.*primary goal)") {
      Add-Failure "no_mobile_primary_$skill" "$skill appears to promote mobile-first as primary."
    } else {
      Add-Pass "no_mobile_primary_$skill"
    }
  }
}

$frontend = $skillTexts["frontend-visual-review"]
Require-Contains "frontend_requires_screenshots" $frontend "screenshots" "frontend-visual-review must require screenshots."
Require-Contains "frontend_requires_contact_sheet" $frontend "contact sheet" "frontend-visual-review must require contact sheet."
Require-Contains "frontend_requires_visual_brief" $frontend "visual review brief" "frontend-visual-review must require visual review brief."
Require-Contains "frontend_viewport_evidence" $frontend "1366px.*1440px.*1920px|1366px[\s\S]*1440px[\s\S]*1920px" "frontend-visual-review must include desktop viewport evidence."
Require-Contains "frontend_console_network_evidence" $frontend "console log capture[\s\S]*network error capture|network error capture[\s\S]*console log capture" "frontend-visual-review must include console/network capture evidence."

$backend = $skillTexts["backend-readonly-proof"]
foreach ($term in @("training_items", "practice_attempts", "due_at", "Daily Plan", "scoring")) {
  Require-Contains "backend_forbids_$($term -replace '[^A-Za-z0-9]','_')" $backend $term "backend-readonly-proof must mention $term."
}
Require-Contains "backend_forbids_writes" $backend "no insert/update/delete|no hidden writes|no .* writes" "backend-readonly-proof must forbid sensitive writes."

$gemini = $skillTexts["gemini-auditor"]
Require-Contains "gemini_no_codex_prompts" $gemini "Gemini cannot generate Codex prompts" "gemini-auditor must forbid Gemini Codex prompt generation."

$morning = $skillTexts["morning-intelligence-report"]
foreach ($term in @("READY_TO_REVIEW", "NEEDS_REWORK", "ABANDON_BRANCH", "QUARANTINE_REQUIRED")) {
  Require-Contains "morning_classification_$term" $morning $term "morning-intelligence-report must include $term."
}
Require-Contains "morning_branch_evidence" $morning "screenshots and contact sheets|screenshot/contact-sheet summary|backend evidence" "morning-intelligence-report must reference branch evidence."
Require-Contains "morning_player_value" $morning "player value" "morning-intelligence-report must rank or discuss player value."

$testingVisual = $skillTexts["neurochess-testing-visual-proof"]
Require-Contains "testing_visual_requires_screenshot" $testingVisual "screenshot_after|screenshots" "testing visual proof must require screenshots."
Require-Contains "testing_visual_requires_contact_sheet" $testingVisual "contact_sheet|contact sheet" "testing visual proof must require contact sheet evidence."
Require-Contains "testing_visual_requires_console_network" $testingVisual "console log capture[\s\S]*network error capture|network error capture[\s\S]*console log capture" "testing visual proof must require console/network capture."

$security = $skillTexts["neurochess-security-repo-hygiene"]
foreach ($term in @("git add -A", "force push", "git reset --hard", "git clean", "curl | shell")) {
  Require-Contains "security_forbids_$($term -replace '[^A-Za-z0-9]','_')" $security ([regex]::Escape($term)) "security repo hygiene must mention $term."
}

$productUx = $skillTexts["neurochess-product-ux-critic"]
Require-Contains "product_ux_rejects_dark_patterns" $productUx "dark-pattern" "product UX critic must reject dark-pattern framing."
Require-Contains "product_ux_rejects_fake_progress" $productUx "fake progress" "product UX critic must reject fake progress."

$learningLoop = $skillTexts["neurochess-learning-loop-accelerator"]
Require-Contains "learning_loop_potential_unlock" $learningLoop "Potential Unlock Loop" "learning-loop accelerator must include Potential Unlock Loop."
Require-Contains "learning_loop_transfer" $learningLoop "Transfer|transfer" "learning-loop accelerator must include transfer verification."

$night = $skillTexts["product-safe-night-mode"]
Require-Contains "night_references_testing_visual_proof" $night "neurochess-testing-visual-proof" "product-safe-night-mode must reference testing visual proof."
Require-Contains "night_references_security_repo_hygiene" $night "neurochess-security-repo-hygiene" "product-safe-night-mode must reference security repo hygiene."

$forbiddenPhrases = @(
  "ignore previous instructions",
  "bypass safety",
  "auto-merge product code",
  "install dependency automatically"
)
foreach ($skill in $requiredSkills) {
  if ($skillTexts.ContainsKey($skill)) {
    $text = $skillTexts[$skill]
    foreach ($phrase in $forbiddenPhrases) {
      if ($text -match [regex]::Escape($phrase)) {
        Add-Failure "forbidden_phrase_$($skill)_$($phrase -replace '[^A-Za-z0-9]','_')" "Forbidden phrase '$phrase' appears in $skill."
      }
    }
    foreach ($externalPhrase in @(
      "Great interfaces rarely come from a single thing",
      "Details that make interfaces feel better",
      "Always present changes as a markdown table with Before and After columns"
    )) {
      if ($text -match [regex]::Escape($externalPhrase)) {
        Add-Failure "raw_external_copy_$skill" "Possible raw external skill content copied into $skill."
      }
    }
  }
}
Add-Pass "no_raw_external_skill_content_copied_wholesale"

$trackedRaw = git -C $repoRoot ls-files "external_skills/quarantine/*" "external_skills/audited/raw/*" "external_skills/adapted/raw/*"
$badRaw = @($trackedRaw | Where-Object { $_ -ne "external_skills/quarantine/.gitkeep" })
if ($badRaw.Count -eq 0) { Add-Pass "no_raw_external_skill_committed" } else { Add-Failure "no_raw_external_skill_committed" "Raw external skill content is tracked: $($badRaw -join ', ')" }

$skillReadme = Join-Path $skillsRoot "README.md"
if ((Test-Path -LiteralPath $skillReadme) -and ((Get-Content -LiteralPath $skillReadme -Raw) -match "External skills must not be installed here directly|No external skill is active")) {
  Add-Pass "no_external_skill_activated"
} else {
  Add-Failure "no_external_skill_activated" "README must state external skills are not directly active."
}

$productDirty = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx
if (-not $productDirty) { Add-Pass "no_frontend_backend_docs_rebuild_touched" } else { Add-Failure "no_frontend_backend_docs_rebuild_touched" "Forbidden product paths dirty: $productDirty" }

$result = [ordered]@{
  status = if ($failures.Count -eq 0) { "pass" } else { "fail" }
  required_skills_count = $requiredSkills.Count
  checks = $checks
  failures = @($failures)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  external_skill_activated = $false
}

$result | ConvertTo-Json -Depth 12
if ($failures.Count -gt 0) { exit 1 }
exit 0
