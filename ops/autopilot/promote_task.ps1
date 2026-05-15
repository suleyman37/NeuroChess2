param(
  [Parameter(Mandatory=$true)][string]$TaskJson,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][string]$RunDir,
  [string]$Message
)

. "$PSScriptRoot\lib.ps1"

$task = $TaskJson | ConvertFrom-Json
$risk = [string]$task.risk_tier

$result = [ordered]@{
  task_id = $task.id
  risk_tier = $risk
  promoted = $false
  quarantined = $false
  commit = $null
  push = $false
  notes = @()
}

if ($risk -eq "write_sensitive") {
  $result.quarantined = $true
  $result.notes += "write_sensitive tasks are not promoted directly during bootstrap."
  Write-AutopilotJson -Path (Join-Path $RunDir "promotion.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

Assert-NoForbiddenChangedPath -Cwd $Worktree
$changed = @(Get-AutopilotChangedPaths -Cwd $Worktree)
if ($changed.Count -eq 0) {
  $result.notes += "No changed files to promote."
  Write-AutopilotJson -Path (Join-Path $RunDir "promotion.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

Push-Location $Worktree
try {
  foreach ($path in $changed) {
    git add -- $path
  }
  $staged = @(git diff --cached --name-only)
  if ($staged.Count -eq 0) {
    throw "No staged files after explicit add."
  }
  $commitMessage = if ($Message) { $Message } else { [string]$task.title }
  git commit -m $commitMessage | Out-File -Encoding utf8 (Join-Path $RunDir "commit.log")
  $commit = git rev-parse --short HEAD
  git push origin HEAD:road-to-V2 | Out-File -Encoding utf8 (Join-Path $RunDir "push.log")
  $result.promoted = $true
  $result.commit = $commit
  $result.push = $true
} finally {
  Pop-Location
}

Write-AutopilotJson -Path (Join-Path $RunDir "promotion.json") -Value $result
$result | ConvertTo-Json -Depth 12
