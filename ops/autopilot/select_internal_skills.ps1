param(
  [string]$MissionJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $MissionJson -and -not $InputPath) {
  throw "Provide -MissionJson or -InputPath."
}

$mission = if ($MissionJson) { $MissionJson | ConvertFrom-Json } else { Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json }

function Add-Unique {
  param([System.Collections.Generic.List[string]]$List, [string]$Value)
  if ($Value -and -not $List.Contains($Value)) { $List.Add($Value) | Out-Null }
}

function Get-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [array]) { return @($Value | ForEach-Object { [string]$_ }) }
  return @([string]$Value)
}

function Any-Match {
  param([string[]]$Values, [string]$Pattern)
  return ((@($Values) -join "`n") -match $Pattern)
}

function Path-Match {
  param([string[]]$Values, [string]$Pattern)
  foreach ($value in @($Values)) {
    if ([string]$value -match $Pattern) { return $true }
  }
  return $false
}

function Object-Text {
  param($Value)
  if ($null -eq $Value) { return "" }
  return ($Value | ConvertTo-Json -Depth 20 -Compress)
}

$required = [System.Collections.Generic.List[string]]::new()
$optional = [System.Collections.Generic.List[string]]::new()
$rejected = [System.Collections.Generic.List[string]]::new()
$conflicts = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

$riskTier = ([string]$mission.risk_tier).Trim().ToLowerInvariant()
$workType = ([string]$mission.work_type).Trim().ToLowerInvariant()
$lane = ([string]$mission.lane).Trim().ToLowerInvariant()
$goal = [string]$mission.goal
$allowed = Get-Array $mission.allowed_paths
$forbidden = Get-Array $mission.forbidden_paths
$readPaths = Get-Array $mission.planned_read_paths
$writePaths = Get-Array $mission.planned_write_paths
$expectedChanged = Get-Array $mission.expected_changed_files
$artifacts = Get-Array $mission.expected_artifacts
$requestedSkills = Get-Array $mission.requested_skills
$allPaths = @($allowed + $forbidden + $readPaths + $writePaths + $expectedChanged)
$joinedText = @(
  [string]$mission.mission_id,
  $riskTier,
  $workType,
  $lane,
  $goal,
  ($allPaths -join " "),
  ($artifacts -join " "),
  (Object-Text $mission.product_impact_review),
  (Object-Text $mission.shadow_plan),
  [string]$mission.night_mode_phase,
  (Object-Text $mission.flags)
) -join "`n"

$hasWrites = ($writePaths.Count -gt 0) -or ($expectedChanged.Count -gt 0) -or ($workType -match 'docs-only|test-only|smoke-only|cleanup-only|frontend|backend')
$hasBackend = ($workType -match 'backend') -or (Path-Match $allPaths '^(backend)([\\/]|$)|[\\/]backend([\\/]|$)')
$hasFrontend = ($workType -match 'frontend') -or (Path-Match $allPaths '^(frontend)([\\/]|$)|[\\/]frontend([\\/]|$)')
$testsInvolved = ($workType -match 'test') -or ($joinedText -match '(?i)\btest(s|ing)?\b|unittest|pytest|smoke')
$screenshotsExpected = ($joinedText -match '(?i)screenshot|contact[_ -]?sheet|visual[_ -]?review[_ -]?brief')
$geminiRequested = ($joinedText -match '(?i)gemini|visual court|long[- ]horizon critic|prompt auditor')
$nightMode = ($joinedText -match '(?i)night mode|live pilot|rolling loop|product-safe pilot') -or ([string]$mission.night_mode_phase)
$nightFinal = ($joinedText -match '(?i)\b(final|drain|report|summary|morning)\b') -or ([string]$mission.night_mode_phase -match '(?i)drain|final|report')
$designGoal = ($joinedText -match '(?i)\b(ui|design|visual|interface|desktop|game-like|board|cta|screenshot)\b')
$productFacing = ($joinedText -match '(?i)\b(product|player|learning|frontend|backend|route|review|practice|training|chess|exercise|friction|north star|docs/rebuild|contract)\b')
$morningReport = ($joinedText -match '(?i)morning report|run summary|night report|ready_to_review|needs_rework|abandon_branch|quarantine_required')
$sensitiveRedTier = ($joinedText -match '(?i)\bPractice\b|\bdue_at\b|\bDaily Plan\b|\btraining_items?\b|\bpractice_attempts?\b|\bscoring\b|\bXP\b|\brank\b|\bTransfer\b')
$quarantineAllowed = ($riskTier -match 'red|quarantine') -and ($lane -match 'quarantine' -or [bool]$mission.control_plane_quarantine_allowed)

if ($productFacing) { Add-Unique $required "neurochess-product-north-star" }
if ($hasWrites) { Add-Unique $required "mission-contract-shadow-plan" }

if ($nightMode) {
  Add-Unique $required "product-safe-night-mode"
  Add-Unique $required "mission-contract-shadow-plan"
  Add-Unique $required "neurochess-product-north-star"
  if ($nightFinal) { Add-Unique $required "morning-intelligence-report" }
}

if ($hasBackend) {
  Add-Unique $required "backend-readonly-proof"
  Add-Unique $required "mission-contract-shadow-plan"
  if ($testsInvolved) { Add-Unique $required "neurochess-tdd-behavior-contract" }
  if ($productFacing) { Add-Unique $required "neurochess-product-north-star" }
}

if ($hasFrontend) {
  Add-Unique $required "frontend-visual-review"
  Add-Unique $required "neurochess-desktop-game-like-interface-design"
  Add-Unique $required "neurochess-react-performance-review"
  Add-Unique $required "mission-contract-shadow-plan"
  Add-Unique $required "neurochess-product-north-star"
}

if ($designGoal) {
  Add-Unique $required "neurochess-desktop-game-like-interface-design"
  if ($screenshotsExpected) { Add-Unique $required "frontend-visual-review" }
}

if ($screenshotsExpected) {
  Add-Unique $required "frontend-visual-review"
  Add-Unique $required "neurochess-desktop-game-like-interface-design"
  if ($geminiRequested -or [bool]$mission.gemini_visual_court_enabled) { Add-Unique $required "gemini-auditor" }
}

if ($geminiRequested) { Add-Unique $required "gemini-auditor" }
if ($morningReport) { Add-Unique $required "morning-intelligence-report" }

if ($joinedText -match '(?i)gemini (as|is|should be).{0,30}planner|gemini.{0,40}codex prompt|gemini.{0,40}micro_prompt') {
  Add-Unique $conflicts "Gemini audit mission treats Gemini as planner or prompt generator."
}

if ($sensitiveRedTier -and -not $quarantineAllowed) {
  Add-Unique $conflicts "Red-tier sensitive terms require red/quarantine risk tier and Control Plane quarantine approval."
}

if ($hasBackend -and $hasFrontend -and -not [bool]$mission.fullstack_sandbox_allowed) {
  Add-Unique $conflicts "Frontend/backend mixed work requires explicit fullstack sandbox policy."
}

if ($joinedText -match '(?i)mobile-first|phone-sized UI as primary|bottom navigation as primary|touch-only') {
  Add-Unique $conflicts "Mobile-first or phone-first primary design target conflicts with desktop-first NeuroChess policy."
}

$internalSkillSet = @(
  "neurochess-product-north-star",
  "mission-contract-shadow-plan",
  "product-safe-night-mode",
  "backend-readonly-proof",
  "frontend-visual-review",
  "neurochess-desktop-game-like-interface-design",
  "neurochess-react-performance-review",
  "neurochess-tdd-behavior-contract",
  "gemini-auditor",
  "morning-intelligence-report"
)
$externalNames = @(
  "frontend-design",
  "react-best-practices",
  "tdd",
  "web-design-guidelines",
  "improve-codebase-architecture",
  "find-skills",
  "skill-creator",
  "shadcn",
  "ui-ux-pro-max",
  "composition-patterns",
  "make-interfaces-feel-better"
)
foreach ($skill in $requestedSkills) {
  if ($externalNames -contains $skill) {
    Add-Unique $rejected $skill
    Add-Unique $conflicts "External skill selected directly: $skill."
  } elseif ($internalSkillSet -contains $skill) {
    Add-Unique $optional $skill
  } else {
    Add-Unique $rejected $skill
    Add-Unique $conflicts "Unknown skill requested: $skill."
  }
}

$selected = [System.Collections.Generic.List[string]]::new()
foreach ($skill in @($required + $optional)) { Add-Unique $selected $skill }

$resultStatus = if ($conflicts.Count -gt 0) { "FAIL" } elseif ($warnings.Count -gt 0) { "WARN" } else { "PASS" }
$nextAction = if ($resultStatus -eq "FAIL") { "STOP" } elseif ($resultStatus -eq "WARN") { "REPAIR_SELECTION" } else { "CONTINUE" }

[ordered]@{
  selection_result = $resultStatus
  selected_skills = @($selected)
  required_skills = @($required)
  optional_skills = @($optional)
  rejected_skills = @($rejected)
  conflicts = @($conflicts)
  warnings = @($warnings)
  authority_reminder = "Skills are procedures, not permissions."
  recommended_next_action = $nextAction
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  skills_live_activation_enabled = $false
} | ConvertTo-Json -Depth 12
exit 0
