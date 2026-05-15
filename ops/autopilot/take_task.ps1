param(
  [string]$TaskId,
  [switch]$JsonOnly
)

. "$PSScriptRoot\lib.ps1"

$queuePath = Join-Path (Get-AutopilotRepoRoot) "ops\autopilot\queue.yaml"
if (-not (Test-Path $queuePath)) {
  throw "Queue not found: $queuePath"
}

$items = @()
$current = $null
foreach ($line in Get-Content $queuePath) {
  if ($line -match "^\s*-\s+id:\s*(.+?)\s*$") {
    if ($current) { $items += [pscustomobject]$current }
    $current = [ordered]@{ id = $matches[1].Trim() }
    continue
  }
  if ($current -and $line -match "^\s+([A-Za-z0-9_]+):\s*(.*?)\s*$") {
    $key = $matches[1]
    $value = $matches[2].Trim()
    $current[$key] = $value
  }
}
if ($current) { $items += [pscustomobject]$current }

$state = Read-AutopilotRuntimeState
$completed = @($state.completed)

if ($TaskId) {
  $task = $items | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
} else {
  $task = $items |
    Where-Object { $completed -notcontains $_.id } |
    Where-Object { $_.status -in @("ready", "queued") } |
    Select-Object -First 1
}

if (-not $task) {
  $task = [pscustomobject]@{ id = ""; status = "none"; title = "No runnable task" }
}

if ($JsonOnly) {
  $task | ConvertTo-Json -Depth 8
} else {
  $task
}
