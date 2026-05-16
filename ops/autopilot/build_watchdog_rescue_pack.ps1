param(
  [Parameter(Mandatory = $true)][string]$Reason,
  [string]$HeartbeatPath = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $safeReason = $Reason -replace "[^A-Za-z0-9_.-]", "_"
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "watchdog_rescue\$safeReason`_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$repoRoot = Get-AutopilotRepoRoot
$branch = (git -C $repoRoot branch --show-current).Trim()
$head = (git -C $repoRoot rev-parse --short HEAD).Trim()
$gitStatus = git -C $repoRoot status --short --branch
$diffStat = git -C $repoRoot diff --stat
$changedFiles = git -C $repoRoot diff --name-only
$patch = git -C $repoRoot diff

Set-Content -LiteralPath (Join-Path $OutDir "git_status.txt") -Value ($gitStatus -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "branch.txt") -Value $branch -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "head.txt") -Value $head -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "diff_stat.txt") -Value ($diffStat -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "changed_files.txt") -Value ($changedFiles -join "`n") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "patch.diff") -Value $(if ($patch) { $patch -join "`n" } else { "No uncommitted diff captured." }) -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "watchdog_reason.txt") -Value $Reason -Encoding UTF8

if ($HeartbeatPath -and (Test-Path -LiteralPath $HeartbeatPath)) {
  Copy-Item -LiteralPath $HeartbeatPath -Destination (Join-Path $OutDir "heartbeat.json") -Force
} else {
  Set-Content -LiteralPath (Join-Path $OutDir "heartbeat.json") -Value "{}" -Encoding UTF8
}

$postMortem = @(
  "# Watchdog Rescue Post-Mortem",
  "",
  "Reason: $Reason",
  "Branch: $branch",
  "HEAD: $head",
  "",
  "No git reset, stash, clean, push, branch deletion, or process kill was performed."
)
$postMortem | Set-Content -LiteralPath (Join-Path $OutDir "post_mortem.md") -Encoding UTF8

[ordered]@{
  status = "created"
  report_dir = $OutDir
  reason = $Reason
  branch = $branch
  head = $head
  files = @(
    "git_status.txt",
    "branch.txt",
    "head.txt",
    "diff_stat.txt",
    "changed_files.txt",
    "patch.diff",
    "heartbeat.json",
    "watchdog_reason.txt",
    "post_mortem.md"
  )
  road_to_v2_mutated = $false
  git_stash_run = $false
  git_reset_run = $false
  git_clean_run = $false
  push_run = $false
  branch_deleted = $false
  real_process_kill_performed = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 10
