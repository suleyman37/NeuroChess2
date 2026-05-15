param(
  [string]$ProfilePath = "C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile",
  [string]$OutDir = "",
  [switch]$JsonOnly
)

$ErrorActionPreference = "Stop"

function Normalize-ProfilePath {
  param([string]$Path)
  $expanded = [Environment]::ExpandEnvironmentVariables($Path)
  try {
    return [IO.Path]::GetFullPath($expanded).TrimEnd('\')
  } catch {
    return $expanded.TrimEnd('\')
  }
}

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chrome_profile_locks"
  try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $OutDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
  } catch {
    $OutDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) "ops\autopilot\reports\generated\chrome_profile_locks"
  }
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$normalized = Normalize-ProfilePath -Path $ProfilePath
$profileExists = Test-Path -LiteralPath $normalized
$escaped = [regex]::Escape($normalized)

$matches = @()
$chromeProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" -ErrorAction SilentlyContinue)
foreach ($proc in $chromeProcesses) {
  $cmd = [string]$proc.CommandLine
  if ($cmd -and ($cmd -match $escaped)) {
    $matches += [ordered]@{
      pid = [int]$proc.ProcessId
      name = [string]$proc.Name
      command_line = $cmd
    }
  }
}

$lockFileNames = @("SingletonLock", "SingletonCookie", "SingletonSocket")
$lockFiles = @()
if ($profileExists) {
  foreach ($name in $lockFileNames) {
    $path = Join-Path $normalized $name
    if (Test-Path -LiteralPath $path) {
      $lockFiles += $path
    }
  }
}

$result = [ordered]@{
  status = if ($matches.Count -gt 0) { "locked" } else { "unlocked" }
  profile_path = $normalized
  profile_exists = $profileExists
  locked = ($matches.Count -gt 0)
  matching_process_count = $matches.Count
  matching_processes = @($matches)
  stale_lock_files_present = ($matches.Count -eq 0 -and $lockFiles.Count -gt 0)
  lock_files = @($lockFiles)
  checked_at = (Get-Date -Format o)
  report_dir = $OutDir
}

$json = $result | ConvertTo-Json -Depth 12
Set-Content -LiteralPath (Join-Path $OutDir "chrome_profile_lock.json") -Value $json -Encoding UTF8

if (-not $JsonOnly) {
  $lines = @()
  $lines += "# Chrome Profile Lock Check"
  $lines += ""
  $lines += "Profile: $normalized"
  $lines += "Status: $($result.status)"
  $lines += "Matching process count: $($matches.Count)"
  if ($matches.Count -gt 0) {
    $lines += ""
    $lines += "Matching processes:"
    foreach ($proc in $matches) {
      $lines += "- PID $($proc.pid): $($proc.command_line)"
    }
  }
  if ($lockFiles.Count -gt 0) {
    $lines += ""
    $lines += "Lock files:"
    foreach ($file in $lockFiles) {
      $lines += "- $file"
    }
  }
  $lines += ""
  $lines += "No process was stopped by this check."
  Set-Content -LiteralPath (Join-Path $OutDir "chrome_profile_lock.md") -Value $lines -Encoding UTF8
}

$json
exit 0
