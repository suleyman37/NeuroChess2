param(
  [switch]$CloseDedicatedProfile,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\persistent_chatgpt_sessions"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutDir = Join-Path $root ("A18G_stop_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$result = [ordered]@{
  mode = if ($CloseDedicatedProfile) { "close_dedicated_profile" } else { "report_only" }
  closed_dedicated_profile = $false
  no_global_chrome_kill = $true
  local_session_preserved = $true
  report_dir = $OutDir
}

if ($CloseDedicatedProfile) {
  $cleanupJson = & "$PSScriptRoot\close_chatgpt_profile_processes.ps1" -ForceClose -OutDir $OutDir
  $cleanup = $cleanupJson | ConvertFrom-Json
  $result.closed_dedicated_profile = ($cleanup.killed_processes.Count -gt 0)
  $result.cleanup = $cleanup
}

$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "persistent_transport_stop_summary.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 12
exit 0
