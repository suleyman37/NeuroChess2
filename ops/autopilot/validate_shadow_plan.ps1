param(
  [string]$PlanJson = "",
  [string]$InputPath = "",
  [int]$MaxFiles = 1,
  [int]$MaxDiffLines = 1000,
  [switch]$AllowDeletes
)

$ErrorActionPreference = "Stop"

function Invoke-Parser {
  $script = Join-Path $PSScriptRoot "parse_shadow_plan.ps1"
  if ($PlanJson) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -PlanJson $PlanJson 2>&1
  } elseif ($InputPath) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -InputPath $InputPath 2>&1
  } else {
    throw "Provide -PlanJson or -InputPath."
  }
  $raw = ($output -join "`n")
  return [ordered]@{ exit_code = $LASTEXITCODE; json = ($raw | ConvertFrom-Json); raw = $raw }
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

function Normalize-Text {
  param($Value, [switch]$Lower)
  if ($null -eq $Value) { return "" }
  $text = ([string]$Value -replace "\s+", " ").Trim()
  if ($Lower) { $text = $text.ToLowerInvariant() }
  return $text
}

function Normalize-Path {
  param($Value)
  return ((Normalize-Text $Value) -replace "\\", "/")
}

function Normalize-PathList {
  param($Value)
  return @(As-Array $Value | ForEach-Object { Normalize-Path $_ } | Where-Object { $_ } | Sort-Object -Unique)
}

function Test-PathLike {
  param([string]$Path, [string]$Pattern)
  return ((Normalize-Path $Path) -like (Normalize-Path $Pattern))
}

function Test-AnyPathLike {
  param([string]$Path, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if (Test-PathLike $Path $pattern) { return $true }
  }
  return $false
}

function Normalize-Check {
  param($Value)
  $text = (Normalize-Text $Value).ToLowerInvariant() -replace "\\", "/"
  if ($text -eq "diffcheck" -or $text -match '(^| )git diff --check($| )') { return "git diff --check" }
  if ($text -match 'tools/plan_guard\.py') { return "tools/plan_guard.py" }
  return $text
}

function Normalize-CheckList {
  param($Value)
  $items = @()
  foreach ($entry in @(As-Array $Value)) {
    foreach ($part in ([string]$entry -split "(?:`r`n|`n|`r|;|,)")) {
      $normalized = Normalize-Check $part
      if ($normalized) { $items += $normalized }
    }
  }
  return @($items | Sort-Object -Unique)
}

function Get-BranchStrategy {
  param($Plan)
  if (Has-Property $Plan "planned_branch") {
    return Normalize-Text $Plan.planned_branch.strategy -Lower
  }
  return ""
}

function Get-NormalizedPlan {
  param($Plan)
  $branch = [ordered]@{ strategy = ""; branch_name = "" }
  if (Has-Property $Plan "planned_branch") {
    $branch.strategy = Normalize-Text $Plan.planned_branch.strategy -Lower
    $branch.branch_name = Normalize-Text $Plan.planned_branch.branch_name
  }
  $diff = [ordered]@{ min = 0; max = 0 }
  if (Has-Property $Plan "expected_diff_lines") {
    try { $diff.min = [int]$Plan.expected_diff_lines.min } catch {}
    try { $diff.max = [int]$Plan.expected_diff_lines.max } catch {}
  }
  return [ordered]@{
    schema_version = Normalize-Text $Plan.schema_version
    mission_id = Normalize-Text $Plan.mission_id
    risk_tier = Normalize-Text $Plan.risk_tier -Lower
    work_type = Normalize-Text $Plan.work_type -Lower
    goal = Normalize-Text $Plan.goal
    planned_read_paths = @(Normalize-PathList $Plan.planned_read_paths)
    planned_create_paths = @(Normalize-PathList $Plan.planned_create_paths)
    planned_modify_paths = @(Normalize-PathList $Plan.planned_modify_paths)
    planned_delete_paths = @(Normalize-PathList $Plan.planned_delete_paths)
    planned_commands = @(As-Array $Plan.planned_commands | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ })
    planned_checks = @(Normalize-CheckList $Plan.planned_checks)
    planned_artifacts = @(As-Array $Plan.planned_artifacts | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ } | Sort-Object -Unique)
    planned_branch = $branch
    expected_diff_lines = $diff
    evidence_plan = @(As-Array $Plan.evidence_plan | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ } | Sort-Object -Unique)
    assumptions = @(As-Array $Plan.assumptions | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ })
    uncertainties = @(As-Array $Plan.uncertainties | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ })
    stop_before_work_if = @(As-Array $Plan.stop_before_work_if | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ } | Sort-Object -Unique)
  }
}

try {
  $parsed = Invoke-Parser
  $violations = [System.Collections.Generic.List[string]]::new()
  $warnings = [System.Collections.Generic.List[string]]::new()
  if (-not [bool]$parsed.json.valid_parse) {
    foreach ($errorItem in @($parsed.json.errors)) { $violations.Add([string]$errorItem) | Out-Null }
    $payload = [ordered]@{ shadow_plan_result = "FAIL"; violations = @($violations); warnings = @($warnings); normalized_plan = $null }
    $payload.live_chatgpt_called = $false
    $payload.product_mission_executed = $false
    $payload.codex_execution = $false
    $payload.commit = $false
    $payload.push = $false
    $payload | ConvertTo-Json -Depth 20
    exit 1
  }

  $plan = $parsed.json.plan
  $required = @("schema_version", "mission_id", "risk_tier", "work_type", "goal", "planned_read_paths", "planned_create_paths", "planned_modify_paths", "planned_delete_paths", "planned_commands", "planned_checks", "planned_artifacts", "planned_branch", "expected_diff_lines", "evidence_plan", "assumptions", "uncertainties", "stop_before_work_if")
  foreach ($field in $required) {
    if (-not (Has-Property $plan $field)) { $violations.Add("missing required field: $field") | Out-Null }
  }

  $normalized = Get-NormalizedPlan -Plan $plan
  if ($normalized.schema_version -ne "A16D") { $violations.Add("schema_version must be A16D") | Out-Null }
  foreach ($field in @("mission_id", "risk_tier", "work_type", "goal")) {
    if (-not $normalized[$field]) { $violations.Add("$field missing") | Out-Null }
  }
  foreach ($field in @("planned_create_paths", "planned_modify_paths", "planned_checks")) {
    if (-not (Has-Property $plan $field)) { $violations.Add("$field missing") | Out-Null }
  }
  if (@($normalized.planned_checks).Count -eq 0) { $violations.Add("planned_checks missing or empty") | Out-Null }

  $writePaths = @($normalized.planned_create_paths + $normalized.planned_modify_paths + $normalized.planned_delete_paths)
  $protected = @(".serena/**", "qa_artifacts/**", ".venv/**", "backend/neurochess/data/openings_book.json", "ops/autopilot/local/chatgpt_project.local.json")
  foreach ($path in @($normalized.planned_read_paths + $writePaths)) {
    if (Test-AnyPathLike -Path $path -Patterns $protected) {
      $violations.Add("forbidden path appears in shadow plan: $path") | Out-Null
    }
  }

  if (@($normalized.planned_delete_paths).Count -gt 0 -and -not $AllowDeletes) {
    $violations.Add("planned_delete_paths non-empty without explicit delete authorization") | Out-Null
  }

  if (@($normalized.planned_create_paths + $normalized.planned_modify_paths).Count -gt $MaxFiles) {
    $violations.Add("planned writes exceed max_files: $(@($normalized.planned_create_paths + $normalized.planned_modify_paths).Count) > $MaxFiles") | Out-Null
  }
  if ([int]$normalized.expected_diff_lines.max -gt $MaxDiffLines) {
    $violations.Add("expected diff exceeds max_diff_lines: $($normalized.expected_diff_lines.max) > $MaxDiffLines") | Out-Null
  }

  $workType = $normalized.work_type
  $hasBackend = @($writePaths + $normalized.planned_read_paths | Where-Object { $_ -like "backend/*" }).Count -gt 0
  $hasFrontend = @($writePaths + $normalized.planned_read_paths | Where-Object { $_ -like "frontend/*" }).Count -gt 0
  if ($hasBackend -and $hasFrontend) {
    $violations.Add("frontend/backend mixing is not allowed in one Shadow Plan") | Out-Null
  }
  if ($workType -match "docs-only|autopilot-docs-only|safe-contract-doc-only") {
    foreach ($path in $writePaths) {
      if ($path -like "backend/*" -or $path -like "frontend/*" -or $path -like "plan/*" -or $path -eq "package.json" -or $path -eq "package-lock.json" -or $path -eq "App.tsx") {
        $violations.Add("docs-only Shadow Plan writes code/product path: $path") | Out-Null
      }
    }
  }
  if ($workType -eq "backend-readonly-only" -and (Get-BranchStrategy $plan) -ne "ephemeral") {
    $violations.Add("backend-readonly Shadow Plan requires ephemeral branch strategy") | Out-Null
  }
  if ($workType -eq "frontend-readonly-only") {
    if ((Get-BranchStrategy $plan) -ne "ephemeral") {
      $violations.Add("frontend-readonly Shadow Plan requires ephemeral branch strategy") | Out-Null
    }
    $evidence = (@($normalized.evidence_plan + $normalized.planned_artifacts + $normalized.planned_checks) -join "`n")
    if ($evidence -notmatch "(?i)screenshot|contact") { $violations.Add("frontend-readonly Shadow Plan requires screenshot/contact evidence") | Out-Null }
    if ($evidence -notmatch "(?i)visual") { $violations.Add("frontend-readonly Shadow Plan requires visual review evidence") | Out-Null }
  }

  foreach ($command in $normalized.planned_commands) {
    foreach ($pattern in @("git add -A", "git reset --hard", "git clean", "git push --force", "rm -rf", "del /s /q")) {
      if ($command -match "(?i)$([regex]::Escape($pattern))") {
        $violations.Add("destructive command planned: $pattern") | Out-Null
      }
    }
  }

  $scanText = @(
    $normalized.goal,
    (@($normalized.assumptions) -join " "),
    (@($normalized.uncertainties) -join " "),
    (@($normalized.planned_read_paths + $writePaths) -join " ")
  ) -join "`n"
  foreach ($pattern in @("improve", "polish", "optimize", "refactor", "finalize", "stabilize", "as needed", "if necessary", "clean up everything", "handle everything", "continue the roadmap", "make it better", "fix all")) {
    if ($scanText -match "(?i)$([regex]::Escape($pattern))") {
      $violations.Add("broad wording appears: $pattern") | Out-Null
    }
  }

  $redTerms = @("Practice", "due_at", "Daily Plan", "training_items", "practice_attempts", "scoring", "XP", "rank", "Transfer")
  $quarantineText = @($normalized.risk_tier, $normalized.planned_branch.strategy, $normalized.planned_branch.branch_name, (@($normalized.evidence_plan) -join " ")) -join "`n"
  $redAllowed = ($normalized.risk_tier -eq "red") -and ($quarantineText -match "(?i)quarantine")
  if (-not $redAllowed) {
    foreach ($term in $redTerms) {
      if ($scanText -match "(?i)(?<![A-Za-z0-9_])$([regex]::Escape($term))(?![A-Za-z0-9_])") {
        $violations.Add("red-tier term appears outside quarantine: $term") | Out-Null
      }
    }
  }

  $result = if ($violations.Count -eq 0) { "PASS" } else { "STOP_BEFORE_WORK" }
  $payload = [ordered]@{
    shadow_plan_result = $result
    violations = @($violations)
    warnings = @($warnings)
    normalized_plan = $normalized
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $payload | ConvertTo-Json -Depth 30
  if ($violations.Count -eq 0) { exit 0 }
  exit 2
} catch {
  [ordered]@{
    shadow_plan_result = "FAIL"
    violations = @($_.Exception.Message)
    warnings = @()
    normalized_plan = $null
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
