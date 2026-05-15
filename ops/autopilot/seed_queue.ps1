param([switch]$Overwrite)

. "$PSScriptRoot\lib.ps1"

$queue = Join-Path (Get-AutopilotRepoRoot) "ops\autopilot\queue.yaml"
if ((Test-Path $queue) -and -not $Overwrite) {
  Write-Output "Queue already exists: $queue"
  exit 0
}

Write-Output "Seed queue is version-controlled in ops/autopilot/queue.yaml. Use apply_patch for repo edits."
