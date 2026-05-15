param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [string]$BaseBranch = "road-to-V2"
)

. "$PSScriptRoot\lib.ps1"

$repo = Get-AutopilotRepoRoot
$root = Get-AutopilotWorktreeRoot
New-Item -ItemType Directory -Force -Path $root | Out-Null

$safeTaskId = $TaskId -replace "[^A-Za-z0-9_.-]", "_"
$worktree = Join-Path $root $safeTaskId
$branch = "autopilot/$safeTaskId"

Push-Location $repo
try {
  git fetch origin | Out-Null
  if (Test-Path $worktree) {
    git worktree remove --force $worktree 2>$null | Out-Null
  }
  git worktree add -B $branch $worktree $BaseBranch | Out-Null
} finally {
  Pop-Location
}

[pscustomobject]@{
  task_id = $TaskId
  worktree = $worktree
  branch = $branch
} | ConvertTo-Json -Depth 8
