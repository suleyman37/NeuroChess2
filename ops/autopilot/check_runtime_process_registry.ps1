param(
  [string]$RegistryPath,
  [string]$FixturePath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultRegistryPath {
  return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\process_registry.jsonl")
}

function Read-JsonLines {
  param([string]$Path)
  $items = New-Object System.Collections.Generic.List[object]
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $items.ToArray() }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $items.Add(($line | ConvertFrom-Json)) | Out-Null
  }
  return $items.ToArray()
}

$fixtureMode = [bool]$FixturePath
if ($FixturePath) {
  $fullPath = if ([System.IO.Path]::IsPathRooted($FixturePath)) { $FixturePath } else { Join-Path (Get-RepoRoot) $FixturePath }
} else {
  if (-not $RegistryPath) { $RegistryPath = Get-DefaultRegistryPath }
  $fullPath = if ([System.IO.Path]::IsPathRooted($RegistryPath)) { $RegistryPath } else { Join-Path (Get-RepoRoot) $RegistryPath }
}

$entries = @(Read-JsonLines -Path $fullPath)
$stale = New-Object System.Collections.Generic.List[object]

foreach ($entry in $entries) {
  if ([string]$entry.owner -ne "autopilot") { continue }
  if ([string]$entry.status -eq "exited") { continue }
  $isRunning = $false
  if ($fixtureMode) {
    $isRunning = ([string]$entry.status -eq "running")
  } else {
    $process = Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue
    $isRunning = ($null -ne $process)
  }
  if ($isRunning) {
    $stale.Add([ordered]@{
      pid = [int]$entry.pid
      process_name = [string]$entry.process_name
      mission_id = [string]$entry.mission_id
      cleanup_policy = [string]$entry.cleanup_policy
      expected_port = $entry.expected_port
    }) | Out-Null
  }
}

if ($stale.Count -gt 0) {
  $resultName = "STOP_STALE_REGISTERED_PROCESS"
  $action = "DRAIN"
} else {
  $resultName = "PASS"
  $action = "CONTINUE"
}

$result = [ordered]@{
  process_registry_result = $resultName
  stale_processes = $stale.ToArray()
  recommended_action = $action
  registry_path = $fullPath
  fixture_mode = $fixtureMode
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($stale.Count -gt 0) { exit 2 }
exit 0
