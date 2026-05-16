param(
  [Parameter(Mandatory = $true)][string]$MissionId,
  [string]$RiskTier = "green",
  [string]$WorkType = "",
  [string]$StartTime = "",
  [double]$ElapsedMinutes = 0,
  [string[]]$ChecksAttempted = @(),
  [string[]]$Completed = @(),
  [string[]]$Failed = @(),
  [string[]]$TechnicalProblems = @(),
  [ValidateSet("continue_smaller", "split", "revert", "ask_supervisor", "stop")]
  [string]$SuspectedNextAction = "ask_supervisor",
  [string]$CodexNotes = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $safeMission = $MissionId -replace '[^A-Za-z0-9_.-]', '_'
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "timebox_checkpoints\$safeMission`_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$repoRoot = Get-AutopilotRepoRoot
$currentBranch = (git -C $repoRoot branch --show-current).Trim()
$head = (git -C $repoRoot rev-parse --short HEAD).Trim()
$changedFiles = @(git -C $repoRoot diff --name-only)
$diffStat = git -C $repoRoot diff --stat
$gitStatus = git -C $repoRoot status --short --branch
$patch = git -C $repoRoot diff

Set-Content -LiteralPath (Join-Path $OutDir "git_status.txt") -Value ($gitStatus -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "changed_files.txt") -Value ($changedFiles -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "diff_stat.txt") -Value ($diffStat -join "`n") -Encoding UTF8
if ($patch) {
  Set-Content -LiteralPath (Join-Path $OutDir "patch.diff") -Value ($patch -join "`n") -Encoding UTF8
} else {
  Set-Content -LiteralPath (Join-Path $OutDir "patch.diff") -Value "No uncommitted diff captured." -Encoding UTF8
}
Set-Content -LiteralPath (Join-Path $OutDir "checks_attempted.txt") -Value (@($ChecksAttempted) -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "logs_missing.txt") -Value "No test logs supplied. Do not fabricate missing logs." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "codex_notes.md") -Value $(if ($CodexNotes) { $CodexNotes } else { "No Codex notes supplied." }) -Encoding UTF8

$summary = [ordered]@{
  schema_version = "A8C_timebox_checkpoint_report"
  mission_id = $MissionId
  risk_tier = $RiskTier
  work_type = $WorkType
  start_time = $StartTime
  elapsed_minutes = $ElapsedMinutes
  current_branch = $currentBranch
  current_head = $head
  changed_files = @($changedFiles)
  checks_attempted = @($ChecksAttempted)
  completed = @($Completed)
  failed = @($Failed)
  technical_problems = @($TechnicalProblems)
  suspected_next_action = $SuspectedNextAction
  report_dir = $OutDir
  missing_items = @("external test logs unless supplied")
  product_execution = $false
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "checkpoint_report.json") -Encoding UTF8

$md = @(
  "# Timebox Checkpoint Report",
  "",
  "Mission: $MissionId",
  "Risk tier: $RiskTier",
  "Work type: $WorkType",
  "Elapsed minutes: $ElapsedMinutes",
  "Current branch: $currentBranch",
  "Current HEAD: $head",
  "Suggested next action: $SuspectedNextAction"
)
$md | Set-Content -LiteralPath (Join-Path $OutDir "checkpoint_report.md") -Encoding UTF8

$summary | ConvertTo-Json -Depth 10
