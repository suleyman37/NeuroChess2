param(
  [string]$TaskId,
  [switch]$DryRun
)

. "$PSScriptRoot\lib.ps1"

$repo = Get-AutopilotRepoRoot
$runDir = New-AutopilotRunDir -Name "run_once"

Write-AutopilotGitPrecheck -Cwd $repo -OutFile (Join-Path $runDir "main_precheck.txt")

$taskJson = & "$PSScriptRoot\take_task.ps1" -TaskId $TaskId -JsonOnly
$task = $taskJson | ConvertFrom-Json
if (-not $task.id) {
  & "$PSScriptRoot\write_report.ps1" -RunDir $runDir -TaskId "none" -Status "no_task" | Out-Null
  exit 0
}

if ($DryRun) {
  $summary = [ordered]@{
    task_id = $task.id
    status = "dry_run"
    run_dir = $runDir
    would_prepare_worktree = $false
    would_execute_codex = $false
    would_run_checks = $false
    would_commit = $false
    would_push = $false
    notes = @(
      "DryRun is non-executing by contract.",
      "No worktree was prepared.",
      "No Codex CLI command was run.",
      "No promotion, commit, or push was attempted."
    )
  }
  Write-AutopilotJson -Path (Join-Path $runDir "run_once_dry_run_summary.json") -Value $summary
  & "$PSScriptRoot\write_report.ps1" -RunDir $runDir -TaskId $task.id -Status "dry_run" | Out-Null
  $summary | ConvertTo-Json -Depth 8
  exit 0
}

$worktreeInfoJson = & "$PSScriptRoot\prepare_worktree.ps1" -TaskId $task.id
$worktreeInfo = $worktreeInfoJson | ConvertFrom-Json

$execute = & "$PSScriptRoot\execute_task.ps1" -TaskJson $taskJson -Worktree $worktreeInfo.worktree -RunDir $runDir
$execute | Set-Content -Encoding utf8 -Path (Join-Path $runDir "execute_stdout.json")
if ($LASTEXITCODE -ne 0) {
  & "$PSScriptRoot\quarantine_task.ps1" -TaskJson $taskJson -Worktree $worktreeInfo.worktree -RunDir $runDir -Reason "execute_failed" | Out-Null
  & "$PSScriptRoot\write_report.ps1" -RunDir $runDir -TaskId $task.id -Status "execute_failed" | Out-Null
  exit 1
}

$profile = if ($task.checks_profile) { [string]$task.checks_profile } else { "docs_only" }
& "$PSScriptRoot\run_checks.ps1" -Profile $profile -Cwd $worktreeInfo.worktree -RunDir $runDir | Set-Content -Encoding utf8 -Path (Join-Path $runDir "checks_stdout.json")
if ($LASTEXITCODE -ne 0) {
  & "$PSScriptRoot\quarantine_task.ps1" -TaskJson $taskJson -Worktree $worktreeInfo.worktree -RunDir $runDir -Reason "checks_failed" | Out-Null
  & "$PSScriptRoot\write_report.ps1" -RunDir $runDir -TaskId $task.id -Status "checks_failed" | Out-Null
  exit 1
}

& "$PSScriptRoot\run_local_text_critic.ps1" -Cwd $worktreeInfo.worktree -RunDir $runDir -TaskJson $taskJson | Set-Content -Encoding utf8 -Path (Join-Path $runDir "text_critic_stdout.json")
& "$PSScriptRoot\run_local_vision_critic.ps1" -RunDir $runDir | Set-Content -Encoding utf8 -Path (Join-Path $runDir "vision_critic_stdout.json")

Add-AutopilotCompletedTask -TaskId $task.id
& "$PSScriptRoot\write_report.ps1" -RunDir $runDir -TaskId $task.id -Status "pass" | Out-Null

$summary = [ordered]@{
  task_id = $task.id
  status = "pass"
  run_dir = $runDir
  worktree = $worktreeInfo.worktree
}
Write-AutopilotJson -Path (Join-Path $runDir "run_once_summary.json") -Value $summary
$summary | ConvertTo-Json -Depth 8
