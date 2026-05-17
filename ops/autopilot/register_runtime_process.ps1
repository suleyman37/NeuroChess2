param(
  [string]$RegistryPath,
  [string]$RunId = "manual",
  [string]$MissionId = "manual",
  [string]$ProcessName,
  [int]$ProcessId,
  [string]$CommandSummary,
  [int]$ExpectedPort = 0,
  [string]$CleanupPolicy = "report_only",
  [string]$Status = "running"
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultRegistryPath {
  return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\process_registry.jsonl")
}

if (-not $RegistryPath) { $RegistryPath = Get-DefaultRegistryPath }
if (-not $ProcessName) { throw "ProcessName is required" }
if (-not $ProcessId) { throw "ProcessId is required" }
if (-not $CommandSummary) { $CommandSummary = $ProcessName }

$registryFullPath = if ([System.IO.Path]::IsPathRooted($RegistryPath)) { $RegistryPath } else { Join-Path (Get-RepoRoot) $RegistryPath }
$registryDir = Split-Path -Parent $registryFullPath
if ($registryDir) { New-Item -ItemType Directory -Force -Path $registryDir | Out-Null }

$entry = [ordered]@{
  schema_version = "A20B_runtime_process_entry_v1"
  run_id = $RunId
  mission_id = $MissionId
  process_name = $ProcessName
  pid = $ProcessId
  command_summary = $CommandSummary
  started_at = (Get-Date).ToUniversalTime().ToString("o")
  expected_port = $(if ($ExpectedPort -gt 0) { $ExpectedPort } else { $null })
  owner = "autopilot"
  cleanup_policy = $CleanupPolicy
  status = $Status
}

Add-Content -LiteralPath $registryFullPath -Value ($entry | ConvertTo-Json -Compress -Depth 10) -Encoding UTF8

$result = [ordered]@{
  register_process_result = "PASS"
  registry_path = $registryFullPath
  pid = $ProcessId
  process_name = $ProcessName
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
