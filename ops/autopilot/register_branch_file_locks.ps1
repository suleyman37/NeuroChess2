param(
  [string]$LockPath,
  [string]$RunId = "manual",
  [string]$MissionId = "manual",
  [string]$BranchName,
  [string]$BaseBranch = "road-to-V2",
  [string]$CommitSha,
  [string]$PathList,
  [string[]]$PlannedWritePaths = @(),
  [string]$LockType = "planned_write",
  [string]$Status = "active",
  [string]$Notes
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultLockPath {
  return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\branch_file_locks.jsonl")
}

function Normalize-PathValue {
  param([string]$Path)
  return (($Path.Trim()) -replace "\\", "/")
}

if (-not $LockPath) { $LockPath = Get-DefaultLockPath }
if (-not $BranchName) { throw "BranchName is required" }

$paths = New-Object System.Collections.Generic.List[string]
foreach ($path in @($PlannedWritePaths)) {
  if (-not [string]::IsNullOrWhiteSpace($path)) {
    $paths.Add((Normalize-PathValue -Path $path)) | Out-Null
  }
}
if ($PathList) {
  foreach ($path in ($PathList -split ",")) {
    if (-not [string]::IsNullOrWhiteSpace($path)) {
      $paths.Add((Normalize-PathValue -Path $path)) | Out-Null
    }
  }
}
if ($paths.Count -eq 0) { throw "At least one planned write path is required" }

$lockFullPath = if ([System.IO.Path]::IsPathRooted($LockPath)) { $LockPath } else { Join-Path (Get-RepoRoot) $LockPath }
$lockDir = Split-Path -Parent $lockFullPath
if ($lockDir) { New-Item -ItemType Directory -Force -Path $lockDir | Out-Null }

$registered = New-Object System.Collections.Generic.List[string]
foreach ($path in $paths) {
  $entry = [ordered]@{
    schema_version = "A20B_branch_file_lock_entry_v1"
    run_id = $RunId
    mission_id = $MissionId
    branch_name = $BranchName
    base_branch = $BaseBranch
    commit_sha = $(if ($CommitSha) { $CommitSha } else { $null })
    file_path = $path
    lock_type = $LockType
    status = $Status
    created_at = (Get-Date).ToUniversalTime().ToString("o")
    notes = $(if ($Notes) { $Notes } else { $null })
  }
  Add-Content -LiteralPath $lockFullPath -Value ($entry | ConvertTo-Json -Compress -Depth 10) -Encoding UTF8
  $registered.Add($path) | Out-Null
}

$result = [ordered]@{
  register_result = "PASS"
  lock_path = $lockFullPath
  registered_files = $registered.ToArray()
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
