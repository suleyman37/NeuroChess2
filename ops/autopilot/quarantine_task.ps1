param(
  [Parameter(Mandatory=$true)][string]$TaskJson,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][string]$RunDir,
  [string]$Reason = "policy_quarantine"
)

. "$PSScriptRoot\lib.ps1"

$task = $TaskJson | ConvertFrom-Json
$branch = "autopilot/$($task.id)"
$result = [ordered]@{
  task_id = $task.id
  branch = $branch
  reason = $Reason
  pushed = $false
}

Push-Location $Worktree
try {
  $changed = @(Get-AutopilotChangedPaths -Cwd $Worktree)
  if ($changed.Count -gt 0) {
    foreach ($path in $changed) {
      if (-not (Test-AutopilotForbiddenPath $path)) {
        git add -- $path
      }
    }
    git commit -m "Quarantine $($task.id)" | Out-File -Encoding utf8 (Join-Path $RunDir "quarantine_commit.log")
    git push origin HEAD:$branch | Out-File -Encoding utf8 (Join-Path $RunDir "quarantine_push.log")
    $result.pushed = $true
  }
} finally {
  Pop-Location
}

Write-AutopilotJson -Path (Join-Path $RunDir "quarantine.json") -Value $result
$result | ConvertTo-Json -Depth 12
