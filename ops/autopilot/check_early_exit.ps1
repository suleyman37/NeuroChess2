param(
  [Parameter(Mandatory = $true)][string]$MissionId,
  [Parameter(Mandatory = $true)][string]$RiskTier,
  [Parameter(Mandatory = $true)][string]$WorkType,
  [string[]]$AllowedPaths = @(),
  [string[]]$ForbiddenPaths = @(),
  [int]$MaxFiles = 0,
  [int]$MaxDiffLines = 0,
  [int]$TimeboxMinutes = 0,
  [string]$ReportDir = "",
  [string]$FixturePath = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "early_exit\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Normalize-PathText {
  param([string]$Path)
  return (($Path -replace "\\", "/").Trim())
}

function Test-PathLike {
  param([string]$Path, [string]$Pattern)
  $pathNorm = Normalize-PathText $Path
  $patternNorm = Normalize-PathText $Pattern
  return ($pathNorm -like $patternNorm)
}

function Test-CodePath {
  param([string]$Path)
  $p = Normalize-PathText $Path
  return (
    $p -like "frontend/*" -or
    $p -like "backend/*" -or
    $p -eq "App.tsx" -or
    $p -eq "package.json" -or
    $p -eq "package-lock.json" -or
    $p -like "plan/*"
  )
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

if ($FixturePath) {
  $fixture = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
  $changedFiles = @($fixture.changed_files | ForEach-Object { Normalize-PathText $_ })
  $diffLines = [int]$fixture.diff_lines
  $diffCheckPass = [bool]$fixture.diff_check_pass
  $elapsedMinutes = [int]$fixture.elapsed_minutes
  $redKeywordsPresent = [bool]$fixture.red_keywords_present
  $tddViolation = [bool]$fixture.tdd_separation_violation
  $branchViolation = [bool]$fixture.branch_policy_violation
  $repeatedFailureCount = [int]$fixture.repeated_failure_count
} else {
  $repoRoot = Get-AutopilotRepoRoot
  $changedFiles = @(Get-AutopilotChangedPaths -Cwd $repoRoot | ForEach-Object { Normalize-PathText $_ })
  $diffLines = Get-CurrentDiffLineCount
  git diff --check | Out-Null
  $diffCheckPass = ($LASTEXITCODE -eq 0)
  $elapsedMinutes = 0
  $redKeywordsPresent = $false
  $tddViolation = $false
  $branchViolation = $false
  $repeatedFailureCount = 0
}

$violations = [System.Collections.Generic.List[string]]::new()
$reasons = [System.Collections.Generic.List[string]]::new()
$decision = "CONTINUE"

foreach ($path in $changedFiles) {
  foreach ($pattern in $ForbiddenPaths) {
    if (Test-PathLike $path $pattern) {
      $violations.Add("forbidden path touched: $path") | Out-Null
    }
  }
  if (Test-AutopilotForbiddenPath $path) {
    $violations.Add("local forbidden generated/noise path touched: $path") | Out-Null
  }
}

if ($WorkType.ToLowerInvariant() -match "docs-only|docs_only") {
  foreach ($path in $changedFiles) {
    if (Test-CodePath $path) {
      $violations.Add("docs-only task touched code path: $path") | Out-Null
    }
  }
}

$hasFrontend = @($changedFiles | Where-Object { $_ -like "frontend/*" }).Count -gt 0
$hasBackend = @($changedFiles | Where-Object { $_ -like "backend/*" }).Count -gt 0
if ($hasFrontend -and $hasBackend -and $WorkType.ToLowerInvariant() -notmatch "fullstack|mixed_allowed") {
  $violations.Add("frontend and backend touched without permission") | Out-Null
}

foreach ($pkg in @("package.json", "package-lock.json")) {
  if (($changedFiles -contains $pkg) -and ($AllowedPaths -notcontains $pkg)) {
    $violations.Add("package file touched without explicit permission: $pkg") | Out-Null
  }
}

if (-not $diffCheckPass) {
  $violations.Add("git diff --check failed") | Out-Null
}
if ($MaxFiles -gt 0 -and $changedFiles.Count -gt $MaxFiles) {
  $violations.Add("changed file count exceeds max_files: $($changedFiles.Count) > $MaxFiles") | Out-Null
}
if ($redKeywordsPresent -and $RiskTier.ToLowerInvariant() -ne "red") {
  $violations.Add("red-tier keyword present outside red-tier context") | Out-Null
}
if ($tddViolation) {
  $violations.Add("TDD separation rule violated") | Out-Null
}
if ($branchViolation) {
  $violations.Add("branch policy violated") | Out-Null
}
if ($repeatedFailureCount -ge 3) {
  $violations.Add("repeated check failure limit exceeded") | Out-Null
}

if ($violations.Count -gt 0) {
  $decision = "STOP_MECHANICAL"
} elseif ($MaxDiffLines -gt 0 -and $diffLines -gt $MaxDiffLines) {
  $decision = "STOP_FOR_SUPERVISOR"
  $reasons.Add("diff exceeds max_diff_lines: $diffLines > $MaxDiffLines") | Out-Null
} elseif ($TimeboxMinutes -gt 0 -and $elapsedMinutes -gt $TimeboxMinutes) {
  $decision = "STOP_FOR_SUPERVISOR"
  $reasons.Add("task exceeds timebox: $elapsedMinutes > $TimeboxMinutes") | Out-Null
}

$reportPath = Join-Path $ReportDir "early_exit_report.json"
$payload = [ordered]@{
  early_exit = ($decision -ne "CONTINUE")
  decision = $decision
  reasons = @($reasons)
  violations = @($violations)
  suggested_next_action = if ($decision -eq "CONTINUE") { "continue" } elseif ($decision -eq "STOP_FOR_SUPERVISOR") { "ask supervisor with compact evidence" } else { "stop locally and fix mechanical violation" }
  mission_id = $MissionId
  risk_tier = $RiskTier
  work_type = $WorkType
  changed_files = @($changedFiles)
  changed_file_count = $changedFiles.Count
  diff_lines = $diffLines
  report_path = $reportPath
}

$payload | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$payload | ConvertTo-Json -Depth 10
if ($decision -eq "CONTINUE") { exit 0 }
if ($decision -eq "STOP_FOR_SUPERVISOR") { exit 2 }
exit 1
