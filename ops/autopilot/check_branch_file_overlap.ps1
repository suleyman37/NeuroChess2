param(
  [string]$LockPath,
  [string]$PathList,
  [string[]]$PlannedWritePaths = @()
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

function Is-RedTierPath {
  param([string]$Path)
  $patterns = @("Practice", "due_at", "Daily Plan", "training_items", "practice_attempts", "scoring", "XP", "rank", "Transfer")
  foreach ($pattern in $patterns) {
    if ($Path -match [regex]::Escape($pattern)) { return $true }
  }
  return $false
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

if (-not $LockPath) { $LockPath = Get-DefaultLockPath }
$lockFullPath = if ([System.IO.Path]::IsPathRooted($LockPath)) { $LockPath } else { Join-Path (Get-RepoRoot) $LockPath }

$planned = New-Object System.Collections.Generic.List[string]
foreach ($path in @($PlannedWritePaths)) {
  if (-not [string]::IsNullOrWhiteSpace($path)) { $planned.Add((Normalize-PathValue -Path $path)) | Out-Null }
}
if ($PathList) {
  foreach ($path in ($PathList -split ",")) {
    if (-not [string]::IsNullOrWhiteSpace($path)) { $planned.Add((Normalize-PathValue -Path $path)) | Out-Null }
  }
}
if ($planned.Count -eq 0) { throw "At least one planned write path is required" }

$locks = @(Read-JsonLines -Path $lockFullPath)
$overlappingFiles = New-Object System.Collections.Generic.List[string]
$conflictingBranches = New-Object System.Collections.Generic.List[string]
$redTierOverlap = $false

foreach ($plannedPath in $planned) {
  $normalizedPlanned = $plannedPath.ToLowerInvariant()
  foreach ($lock in $locks) {
    if ([string]$lock.status -ne "active") { continue }
    if (([string]$lock.lock_type) -eq "read_only") { continue }
    $lockedPath = Normalize-PathValue -Path ([string]$lock.file_path)
    if ($lockedPath.ToLowerInvariant() -eq $normalizedPlanned) {
      if (-not $overlappingFiles.Contains($plannedPath)) { $overlappingFiles.Add($plannedPath) | Out-Null }
      if ($lock.branch_name -and -not $conflictingBranches.Contains([string]$lock.branch_name)) {
        $conflictingBranches.Add([string]$lock.branch_name) | Out-Null
      }
      if (Is-RedTierPath -Path $plannedPath) { $redTierOverlap = $true }
    }
  }
}

if ($overlappingFiles.Count -eq 0) {
  $overlapResult = "PASS"
  $action = "CONTINUE"
} elseif ($redTierOverlap) {
  $overlapResult = "STOP_BRANCH_ORTHOGONALITY_VIOLATION"
  $action = "STOP"
} else {
  $overlapResult = "OVERLAP_DETECTED"
  $action = "REJECT_MISSION"
}

$result = [ordered]@{
  overlap_result = $overlapResult
  overlapping_files = $overlappingFiles.ToArray()
  conflicting_branches = $conflictingBranches.ToArray()
  red_tier_overlap = [bool]$redTierOverlap
  recommended_action = $action
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($overlapResult -eq "STOP_BRANCH_ORTHOGONALITY_VIOLATION") { exit 2 }
exit 0
