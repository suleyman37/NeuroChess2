param(
  [string]$RunDir,
  [string]$TaskId = "manual",
  [string]$Status = "recorded"
)

. "$PSScriptRoot\lib.ps1"

if (-not $RunDir) { $RunDir = New-AutopilotRunDir -Name "report_$TaskId" }

$report = [ordered]@{
  task_id = $TaskId
  status = $Status
  generated_at = (Get-Date).ToString("o")
  run_dir = $RunDir
  repo = Get-AutopilotRepoRoot
  git_status = (git -C (Get-AutopilotRepoRoot) status --short --branch) -join "`n"
}

Write-AutopilotJson -Path (Join-Path $RunDir "report.json") -Value $report
$report | ConvertTo-Json -Depth 12
