param(
  [string]$TaskName = "NeuroChessCodexAutopilot"
)

. "$PSScriptRoot\lib.ps1"

$repo = Get-AutopilotRepoRoot
$script = Join-Path $repo "ops\autopilot\run_once.ps1"
$tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
$runDir = New-AutopilotRunDir -Name "install_scheduler"

$result = [ordered]@{
  task_name = $TaskName
  installed = $false
  fallback = "powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/loop.ps1"
  log = Join-Path $runDir "schtasks.log"
}

try {
  schtasks /Create /TN $TaskName /TR $tr /SC MINUTE /MO 5 /F 2>&1 |
    Tee-Object -FilePath $result.log
  if ($LASTEXITCODE -eq 0) {
    $result.installed = $true
  }
} catch {
  $result.error = $_.Exception.Message
}

Write-AutopilotJson -Path (Join-Path $runDir "scheduler.json") -Value $result
$result | ConvertTo-Json -Depth 8
exit $(if ($result.installed) { 0 } else { 1 })
