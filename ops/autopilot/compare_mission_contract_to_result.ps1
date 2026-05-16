param(
  [Parameter(Mandatory = $true)][string]$ContractPath,
  [string]$ActualPath = "",
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "mission_contract_comparisons\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Normalize-PathText {
  param([string]$Path)
  return (($Path -replace "\\", "/").Trim())
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  return @($Value)
}

function Test-PathLikePattern {
  param([string]$Path, [string]$Pattern)
  return ((Normalize-PathText $Path) -like (Normalize-PathText $Pattern))
}

function Test-AnyPattern {
  param([string]$Path, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if (Test-PathLikePattern $Path $pattern) { return $true }
  }
  return $false
}

function Get-CurrentDiffLineCount {
  $sum = 0
  $numstat = git diff --numstat
  foreach ($line in $numstat) {
    $parts = $line -split "`t"
    if ($parts.Count -ge 2) {
      $add = 0
      $del = 0
      [void][int]::TryParse($parts[0], [ref]$add)
      [void][int]::TryParse($parts[1], [ref]$del)
      $sum += $add + $del
    }
  }
  return $sum
}

$contract = Get-Content -LiteralPath $ContractPath -Raw | ConvertFrom-Json
if ($ActualPath) {
  $actual = Get-Content -LiteralPath $ActualPath -Raw | ConvertFrom-Json
} else {
  $repoRoot = Get-AutopilotRepoRoot
  $actual = [pscustomobject]@{
    actual_changed_files = @(Get-AutopilotChangedPaths -Cwd $repoRoot)
    actual_diff_lines = Get-CurrentDiffLineCount
    actual_paths_touched = @(Get-AutopilotChangedPaths -Cwd $repoRoot)
    actual_checks_run = @()
    actual_artifacts_created = @()
    actual_commit_hash = ""
    actual_push_result = ""
    commit_happened = $false
    push_happened = $false
    current_branch = (git -C $repoRoot branch --show-current).Trim()
  }
}

$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$quarantine = $false
$stopForSupervisor = $false

$expectedFiles = @(As-Array $contract.expected_changed_files | ForEach-Object { Normalize-PathText $_ })
$allowedPaths = @(As-Array $contract.allowed_paths | ForEach-Object { Normalize-PathText $_ })
$forbiddenPaths = @(As-Array $contract.forbidden_paths | ForEach-Object { Normalize-PathText $_ })
$actualFiles = @(As-Array $actual.actual_changed_files | ForEach-Object { Normalize-PathText $_ })
$actualTouched = @(As-Array $actual.actual_paths_touched | ForEach-Object { Normalize-PathText $_ })
if ($actualTouched.Count -eq 0) { $actualTouched = $actualFiles }
$actualChecks = @(As-Array $actual.actual_checks_run | ForEach-Object { [string]$_ })
$actualArtifacts = @(As-Array $actual.actual_artifacts_created | ForEach-Object { [string]$_ })
$actualDiffLines = [int]$actual.actual_diff_lines

if ([int]$contract.max_files -gt 0 -and $actualFiles.Count -gt [int]$contract.max_files) {
  $violations.Add("actual changed files exceed max_files: $($actualFiles.Count) > $($contract.max_files)") | Out-Null
}

$exact = if ($contract.PSObject.Properties.Name -contains "exact_file_match") { [bool]$contract.exact_file_match } else { $true }
if ($exact) {
  foreach ($file in $actualFiles) {
    if ($expectedFiles -notcontains $file) {
      $violations.Add("actual file outside expected_changed_files: $file") | Out-Null
    }
  }
  foreach ($file in $expectedFiles) {
    if ($actualFiles -notcontains $file) {
      $violations.Add("expected file missing from actual_changed_files: $file") | Out-Null
    }
  }
}

foreach ($file in $actualFiles) {
  if ($allowedPaths.Count -gt 0 -and -not (Test-AnyPattern $file $allowedPaths)) {
    $violations.Add("actual file outside allowed_paths: $file") | Out-Null
  }
  foreach ($pattern in $forbiddenPaths) {
    if (Test-PathLikePattern $file $pattern) {
      $violations.Add("forbidden path touched: $file") | Out-Null
      if ($file -like "backend/*" -or $file -like "frontend/*") { $quarantine = $true }
    }
  }
  if (Test-AutopilotForbiddenPath $file) {
    $violations.Add("local forbidden generated/noise path touched: $file") | Out-Null
  }
}

if ([int]$contract.max_diff_lines -gt 0 -and $actualDiffLines -gt [int]$contract.max_diff_lines) {
  $stopForSupervisor = $true
  $violations.Add("actual diff lines exceed max_diff_lines: $actualDiffLines > $($contract.max_diff_lines)") | Out-Null
}
if ([int]$contract.expected_diff_lines_max -gt 0 -and $actualDiffLines -gt [int]$contract.expected_diff_lines_max) {
  $stopForSupervisor = $true
  $violations.Add("actual diff lines exceed expected_diff_lines_max: $actualDiffLines > $($contract.expected_diff_lines_max)") | Out-Null
}
if ([int]$contract.expected_diff_lines_min -gt 0 -and $actualDiffLines -lt [int]$contract.expected_diff_lines_min) {
  $warnings.Add("actual diff lines below expected_diff_lines_min: $actualDiffLines < $($contract.expected_diff_lines_min)") | Out-Null
}

$workType = ([string]$contract.work_type).ToLowerInvariant()
if ($workType -match "docs-only|docs_only") {
  foreach ($file in $actualFiles) {
    if ($file -like "backend/*" -or $file -like "frontend/*" -or $file -like "plan/*" -or $file -eq "App.tsx" -or $file -eq "package.json" -or $file -eq "package-lock.json") {
      $violations.Add("docs-only mission touched code/product path: $file") | Out-Null
    }
  }
}

$hasFrontend = @($actualFiles | Where-Object { $_ -like "frontend/*" }).Count -gt 0
$hasBackend = @($actualFiles | Where-Object { $_ -like "backend/*" }).Count -gt 0
if ($hasFrontend -and $hasBackend -and (-not [bool]$contract.frontend_allowed -or -not [bool]$contract.backend_allowed)) {
  $violations.Add("frontend/backend mixed without explicit permission") | Out-Null
}
if ($hasBackend -and -not [bool]$contract.backend_allowed) {
  $violations.Add("backend changed without backend_allowed=true") | Out-Null
}
if ($hasFrontend -and -not [bool]$contract.frontend_allowed) {
  $violations.Add("frontend changed without frontend_allowed=true") | Out-Null
}
if (@($actualFiles | Where-Object { $_ -like "docs/rebuild/*" }).Count -gt 0 -and -not [bool]$contract.docs_rebuild_allowed) {
  $violations.Add("docs/rebuild changed without docs_rebuild_allowed=true") | Out-Null
}
foreach ($pkg in @("package.json", "package-lock.json", "App.tsx")) {
  if (($actualFiles -contains $pkg) -and -not [bool]$contract.package_changes_allowed) {
    $violations.Add("package/App file changed without permission: $pkg") | Out-Null
  }
}

foreach ($check in @(As-Array $contract.required_checks)) {
  if ($actualChecks -notcontains [string]$check) {
    $violations.Add("required check missing: $check") | Out-Null
  }
}

foreach ($artifact in @(As-Array $contract.expected_artifacts)) {
  if ($actualArtifacts -notcontains [string]$artifact) {
    $violations.Add("expected artifact missing: $artifact") | Out-Null
  }
}

$commitAllowed = $true
$pushAllowed = $true
if ($contract.commit_policy -and ($contract.commit_policy.PSObject.Properties.Name -contains "commit_allowed")) {
  $commitAllowed = [bool]$contract.commit_policy.commit_allowed
}
if ($contract.commit_policy -and ($contract.commit_policy.PSObject.Properties.Name -contains "push_allowed")) {
  $pushAllowed = [bool]$contract.commit_policy.push_allowed
}
$commitHappened = $false
$pushHappened = $false
if ($actual.PSObject.Properties.Name -contains "commit_happened") { $commitHappened = [bool]$actual.commit_happened }
if ($actual.PSObject.Properties.Name -contains "push_happened") { $pushHappened = [bool]$actual.push_happened }
if (-not $commitHappened -and ($actual.PSObject.Properties.Name -contains "actual_commit_hash") -and [string]$actual.actual_commit_hash) { $commitHappened = $true }
if (-not $pushHappened -and ($actual.PSObject.Properties.Name -contains "actual_push_result") -and [string]$actual.actual_push_result) { $pushHappened = $true }
if ($commitHappened -and -not $commitAllowed) {
  $violations.Add("commit happened when commit_policy forbids it") | Out-Null
}
if ($pushHappened -and -not $pushAllowed) {
  $violations.Add("push happened when push policy forbids it") | Out-Null
}

$redTerms = @("practice_attempts", "due_at", "daily_plan", "daily plan", "training_items", "scoring", "xp", "rank", "transfer")
$actualText = (@($actualFiles + $actualTouched) -join " ").ToLowerInvariant()
$branch = if ($actual.PSObject.Properties.Name -contains "current_branch") { [string]$actual.current_branch } else { "" }
foreach ($term in $redTerms) {
  $pattern = "(?i)(?<![A-Za-z0-9_])$([regex]::Escape($term))(?![A-Za-z0-9_])"
  if ($actualText -match $pattern -and $branch -notlike "quarantine/red*") {
    $quarantine = $true
    $violations.Add("red-tier path or term touched outside quarantine: $term") | Out-Null
  }
}

$contractResult = "PASS"
if ($violations.Count -gt 0) {
  if ($quarantine) {
    $contractResult = "QUARANTINE_REQUIRED"
  } elseif ($stopForSupervisor) {
    $contractResult = "STOP_FOR_SUPERVISOR"
  } else {
    $contractResult = "FAIL"
  }
}

$result = [ordered]@{
  contract_result = $contractResult
  violations = @($violations)
  warnings = @($warnings)
  expected = [ordered]@{
    expected_changed_files = @($expectedFiles)
    allowed_paths = @($allowedPaths)
    forbidden_paths = @($forbiddenPaths)
    max_files = $contract.max_files
    max_diff_lines = $contract.max_diff_lines
    required_checks = @(As-Array $contract.required_checks)
    expected_artifacts = @(As-Array $contract.expected_artifacts)
  }
  actual = [ordered]@{
    actual_changed_files = @($actualFiles)
    actual_diff_lines = $actualDiffLines
    actual_checks_run = @($actualChecks)
    actual_artifacts_created = @($actualArtifacts)
    commit_happened = $commitHappened
    push_happened = $pushHappened
    current_branch = $branch
  }
  recommended_next_action = if ($contractResult -eq "PASS") { "continue to controlled commit/push if mission policy allows" } elseif ($contractResult -eq "QUARANTINE_REQUIRED") { "stop and quarantine/archive evidence" } elseif ($contractResult -eq "STOP_FOR_SUPERVISOR") { "stop and ask supervisor with contract mismatch evidence" } else { "stop and fix mechanical mismatch" }
  report_path = (Join-Path $ReportDir "mission_contract_comparison.json")
  live_chatgpt_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $result.report_path -Encoding UTF8
$result | ConvertTo-Json -Depth 20
switch ($contractResult) {
  "PASS" { exit 0 }
  "STOP_FOR_SUPERVISOR" { exit 2 }
  "QUARANTINE_REQUIRED" { exit 3 }
  default { exit 1 }
}
