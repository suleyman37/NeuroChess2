param(
  [string]$ProfilePath = "C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile",
  [switch]$ForceClose,
  [switch]$DeleteStaleLocks,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chrome_profile_cleanup"
  try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $OutDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
  } catch {
    $OutDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) "ops\autopilot\reports\generated\chrome_profile_cleanup"
  }
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$checkJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $ProfilePath -OutDir $OutDir -JsonOnly
$check = $checkJson | ConvertFrom-Json
$killed = @()
$failed = @()

if ($ForceClose -and $check.matching_process_count -gt 0) {
  foreach ($proc in @($check.matching_processes)) {
    try {
      Stop-Process -Id ([int]$proc.pid) -Force -ErrorAction Stop
      $killed += [ordered]@{
        pid = [int]$proc.pid
        command_line = [string]$proc.command_line
      }
    } catch {
      $failed += [ordered]@{
        pid = [int]$proc.pid
        error = $_.Exception.Message
        command_line = [string]$proc.command_line
      }
    }
  }
}

$deletedLocks = @()
if ($DeleteStaleLocks -and -not $ForceClose -and $check.matching_process_count -gt 0) {
  $failed += [ordered]@{
    pid = 0
    error = "Refusing to delete lock files while profile processes are running."
    command_line = ""
  }
}
if ($DeleteStaleLocks -and $check.matching_process_count -eq 0) {
  foreach ($file in @($check.lock_files)) {
    try {
      Remove-Item -LiteralPath $file -Force -ErrorAction Stop
      $deletedLocks += [string]$file
    } catch {
      $failed += [ordered]@{
        pid = 0
        error = "Failed to delete stale lock file '$file': $($_.Exception.Message)"
        command_line = ""
      }
    }
  }
}

$result = [ordered]@{
  mode = if ($ForceClose) { "force_close" } else { "report_only" }
  profile_path = [string]$check.profile_path
  matching_process_count = [int]$check.matching_process_count
  matching_processes = @($check.matching_processes)
  killed_processes = @($killed)
  failed_actions = @($failed)
  stale_lock_files_present = [bool]$check.stale_lock_files_present
  lock_files = @($check.lock_files)
  deleted_lock_files = @($deletedLocks)
  report_dir = $OutDir
  no_global_chrome_kill = $true
}

$json = $result | ConvertTo-Json -Depth 12
Set-Content -LiteralPath (Join-Path $OutDir "close_chatgpt_profile_processes.json") -Value $json -Encoding UTF8

$lines = @()
$lines += "# ChatGPT Profile Process Cleanup"
$lines += ""
$lines += "Mode: $($result.mode)"
$lines += "Profile: $($result.profile_path)"
$lines += "Matching process count: $($result.matching_process_count)"
$lines += "No global Chrome kill: true"
if ($result.matching_process_count -gt 0) {
  $lines += ""
  $lines += "Matching processes:"
  foreach ($proc in @($result.matching_processes)) {
    $lines += "- PID $($proc.pid): $($proc.command_line)"
  }
}
if (-not $ForceClose) {
  $lines += ""
  $lines += "Report-only mode. Re-run with -ForceClose to stop only matching profile processes."
}
if ($killed.Count -gt 0) {
  $lines += ""
  $lines += "Killed processes:"
  foreach ($proc in $killed) {
    $lines += "- PID $($proc.pid)"
  }
}
if ($failed.Count -gt 0) {
  $lines += ""
  $lines += "Failed actions:"
  foreach ($item in $failed) {
    $lines += "- $($item.error)"
  }
}
Set-Content -LiteralPath (Join-Path $OutDir "close_chatgpt_profile_processes.md") -Value $lines -Encoding UTF8

$json
exit $(if ($failed.Count -gt 0) { 1 } else { 0 })
