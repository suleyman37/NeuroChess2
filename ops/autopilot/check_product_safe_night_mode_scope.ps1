param(
  [string]$MissionJson = "",
  [string]$MicroPromptPath = "",
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $MissionJson -and -not $MicroPromptPath) {
  throw "Provide -MissionJson or -MicroPromptPath."
}

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "product_safe_night_mode\scope_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Get-ArrayStrings {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [array]) { return @($Value | ForEach-Object { [string]$_ }) }
  return @([string]$Value)
}

function Test-EphemeralBranchName {
  param([string]$BranchName)
  if ([string]::IsNullOrWhiteSpace($BranchName)) { return $false }
  if ($BranchName -eq "road-to-V2") { return $false }
  return ($BranchName -match '^(autopilot|codex|night-mode|worktree)/')
}

function Test-ContainsAny {
  param([string]$Text, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if ($Text -match $pattern) { return $true }
  }
  return $false
}

if ($MissionJson) {
  $missionRaw = Get-Content -LiteralPath $MissionJson -Raw
  $mission = $missionRaw | ConvertFrom-Json
} else {
  $promptText = Get-Content -LiteralPath $MicroPromptPath -Raw
  $missionRaw = $promptText
  $mission = [pscustomobject]@{
    id = "micro_prompt"
    risk_tier = ""
    work_type = ""
    goal = $promptText
    codex_prompt = $promptText
    allowed_paths = @()
    required_evidence = @()
  }
}

$riskTier = ([string]$mission.risk_tier).Trim().ToLowerInvariant()
$workType = ([string]$mission.work_type).Trim().ToLowerInvariant()
$branchName = ([string]$mission.branch_name).Trim()
$targetBranch = ([string]$mission.target_branch).Trim()
$promotionMode = ([string]$mission.promotion_mode).Trim().ToLowerInvariant()
$allowedPaths = @(Get-ArrayStrings $mission.allowed_paths)
$expectedFiles = @(Get-ArrayStrings $mission.expected_changed_files)
$requiredEvidenceInput = @(Get-ArrayStrings $mission.required_evidence | ForEach-Object { $_.ToLowerInvariant() })
$text = @(
  [string]$mission.id,
  [string]$mission.goal,
  [string]$mission.codex_prompt,
  [string]$mission.work_type,
  [string]$mission.risk_tier
) -join "`n"

$violations = [System.Collections.Generic.List[string]]::new()
$requiredEvidence = [System.Collections.Generic.List[string]]::new()
$scope = "unknown"
$requiresEphemeral = $false
$autoMergeToRoadAllowed = $false

$redPatterns = @(
  '(?i)\bred[- ]tier\b',
  '(?i)\bPractice\b',
  '(?i)\bpractice_attempts?\b',
  '(?i)\btraining_items?\b',
  '(?i)\bdue_at\b',
  '(?i)\bDaily Plan\b',
  '(?i)\bscoring\b',
  '(?i)\bresult recording\b',
  '(?i)\bsolution reveal\b',
  '(?i)\bXP\b',
  '(?i)\brank\b',
  '(?i)\bleague\b',
  '(?i)\bTransfer\b',
  '(?i)\bDB migrations?\b'
)

if ($riskTier -eq "red") {
  $violations.Add("red-tier missions are forbidden in Product-Safe Night Mode v0") | Out-Null
}
if (Test-ContainsAny -Text $text -Patterns $redPatterns) {
  $violations.Add("red-tier or learning-state term detected") | Out-Null
}

if ($workType -match 'docs[-_ ]?only|docs|contract|audit') {
  $scope = "docs_only"
  $autoMergeToRoadAllowed = $true
  foreach ($path in ($allowedPaths + $expectedFiles)) {
    $p = ($path -replace "\\", "/")
    if ($p -like "backend/*" -or $p -like "frontend/*" -or $p -eq "package.json" -or $p -eq "package-lock.json" -or $p -eq "App.tsx") {
      $violations.Add("docs-only Night Mode mission references product/package path: $path") | Out-Null
    }
  }
} elseif ($workType -match 'backend[-_ ]?readonly|backend[-_ ]?read[-_ ]?only') {
  $scope = "backend_readonly"
  $requiresEphemeral = $true
  $requiredEvidence.Add("anti_mutation_evidence") | Out-Null
  if (-not (Test-EphemeralBranchName $branchName)) {
    $violations.Add("backend-readonly Night Mode work requires an ephemeral branch") | Out-Null
  }
  if ($targetBranch -eq "road-to-V2" -or $promotionMode -match "auto_merge|direct_road|road") {
    $violations.Add("backend product code may not auto-merge or push directly to road-to-V2 during Night Mode") | Out-Null
  }
  if (-not (($requiredEvidenceInput -join "`n") -match "anti[_ -]?mutation")) {
    $violations.Add("backend-readonly Night Mode work requires anti-mutation evidence") | Out-Null
  }
} elseif ($workType -match 'frontend[-_ ]?readonly|frontend[-_ ]?read[-_ ]?only') {
  $scope = "frontend_readonly"
  $requiresEphemeral = $true
  $requiredEvidence.Add("screenshots_or_contact_sheet") | Out-Null
  $requiredEvidence.Add("chatgpt_visual_review_brief") | Out-Null
  if (-not (Test-EphemeralBranchName $branchName)) {
    $violations.Add("frontend-readonly Night Mode work requires an ephemeral branch") | Out-Null
  }
  if ($targetBranch -eq "road-to-V2" -or $promotionMode -match "auto_merge|direct_road|road") {
    $violations.Add("frontend product code may not auto-merge or push directly to road-to-V2 during Night Mode") | Out-Null
  }
  $evidenceText = $requiredEvidenceInput -join "`n"
  if ($evidenceText -notmatch "screenshot|contact_sheet") {
    $violations.Add("frontend-readonly Night Mode work requires screenshots or a contact sheet") | Out-Null
  }
  if ($evidenceText -notmatch "visual_review|visual review|chatgpt_visual") {
    $violations.Add("frontend-readonly Night Mode work requires a ChatGPT visual review brief") | Out-Null
  }
} elseif ($workType -match 'smoke|test[-_ ]?only|validation') {
  $scope = "smoke_test_only"
  $requiredEvidence.Add("test_or_smoke_evidence") | Out-Null
} else {
  $violations.Add("unknown or unsupported Night Mode work_type: $workType") | Out-Null
}

foreach ($path in $allowedPaths) {
  $p = ($path -replace "\\", "/")
  if ($p -eq "package.json" -or $p -eq "package-lock.json" -or $p -eq "App.tsx") {
    $violations.Add("package/App path is forbidden in Product-Safe Night Mode v0: $path") | Out-Null
  }
}

$payload = [ordered]@{
  allowed = ($violations.Count -eq 0)
  night_mode_scope = $scope
  requires_ephemeral_branch = $requiresEphemeral
  auto_merge_to_road_allowed = ($autoMergeToRoadAllowed -and $violations.Count -eq 0)
  violations = @($violations)
  required_evidence = @($requiredEvidence)
  mission_id = [string]$mission.id
  branch_name = $branchName
  target_branch = $targetBranch
  live_chatgpt_called = $false
  product_mission_executed = $false
}

$payload | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $ReportDir "product_safe_night_mode_scope.json") -Encoding UTF8
$payload | ConvertTo-Json -Depth 10
exit 0
