param(
  [string]$RunDir = "",
  [string]$Reason = "STOP",
  [string]$Details = ""
)

$ErrorActionPreference = "Stop"

if (-not $RunDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_stop"
  $RunDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
}

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

$report = [ordered]@{
  status = "STOP"
  reason = $Reason
  details = $Details
  timestamp = (Get-Date -Format o)
  no_execution = $true
  no_commit = $true
  no_push = $true
}

$json = $report | ConvertTo-Json -Depth 8
Set-Content -LiteralPath (Join-Path $RunDir "stop_report.json") -Value $json -Encoding UTF8
Set-Content -LiteralPath (Join-Path $RunDir "stop_report.md") -Value "# STOP`n`nReason: $Reason`n`n$Details`n" -Encoding UTF8
$json
exit 1
