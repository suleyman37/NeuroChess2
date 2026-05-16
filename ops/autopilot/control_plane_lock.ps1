param(
  [ValidateSet("AcquireLock", "CheckLock", "ReleaseLock", "ReportStaleLock")]
  [string]$Action = "CheckLock",
  [string]$RuntimeDir = "",
  [string]$Owner = "",
  [int]$StaleAfterSeconds = 3600,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Get-DefaultControlPlaneRuntimeDir {
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE "AgentOS\runtime") }
  return "C:\Users\suley\AgentOS\runtime"
}

function Get-LockPath {
  param([string]$Root)
  return (Join-Path $Root "locks\control_plane.lock.json")
}

function Test-PidAlive {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return $false }
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    return ($null -ne $process)
  } catch {
    return $false
  }
}

function Read-Lock {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-LockStatus {
  param([string]$Path, [int]$StaleSeconds)
  $lock = Read-Lock -Path $Path
  if ($null -eq $lock) {
    return [ordered]@{ locked = $false; active = $false; stale = $false; lock_path = $Path; lock = $null }
  }
  $pidAlive = Test-PidAlive -ProcessId ([int]$lock.pid)
  $age = 0
  try {
    $age = [math]::Max(0, ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse([string]$lock.acquired_at)).TotalSeconds)
  } catch {
    $age = [double]::PositiveInfinity
  }
  $stale = (-not $pidAlive) -or ($age -gt $StaleSeconds)
  return [ordered]@{
    locked = $true
    active = ($pidAlive -and -not $stale)
    stale = $stale
    age_seconds = [math]::Round($age, 2)
    pid_alive = $pidAlive
    lock_path = $Path
    lock = $lock
  }
}

if (-not $RuntimeDir) {
  $RuntimeDir = Get-DefaultControlPlaneRuntimeDir
}
New-Item -ItemType Directory -Force -Path (Join-Path $RuntimeDir "locks") | Out-Null
$lockPath = Get-LockPath -Root $RuntimeDir

try {
  switch ($Action) {
    "AcquireLock" {
      $status = Get-LockStatus -Path $lockPath -StaleSeconds $StaleAfterSeconds
      if ($status.locked -and (-not $Force)) {
        $payload = [ordered]@{
          status = "blocked"
          acquired = $false
          reason = if ($status.stale) { "stale_lock_present" } else { "active_lock_present" }
          lock_status = $status
          live_chatgpt_called = $false
          product_mission_executed = $false
          real_process_kill_performed = $false
          commit = $false
          push = $false
        }
        $payload | ConvertTo-Json -Depth 12
        exit 2
      }
      if (-not $Owner) { $Owner = "control_plane_$PID" }
      $lock = [ordered]@{
        schema_version = "A16A_control_plane_lock_v1"
        owner = $Owner
        pid = $PID
        acquired_at = [DateTimeOffset]::UtcNow.ToString("o")
        runtime_dir = $RuntimeDir
      }
      $tmp = "$lockPath.tmp"
      $lock | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tmp -Encoding UTF8
      Move-Item -LiteralPath $tmp -Destination $lockPath -Force
      $payload = [ordered]@{ status = "acquired"; acquired = $true; lock_path = $lockPath; lock = $lock }
    }
    "CheckLock" {
      $payload = Get-LockStatus -Path $lockPath -StaleSeconds $StaleAfterSeconds
      $payload.status = if ($payload.locked) { "locked" } else { "unlocked" }
    }
    "ReportStaleLock" {
      $status = Get-LockStatus -Path $lockPath -StaleSeconds $StaleAfterSeconds
      $payload = [ordered]@{
        status = if ($status.stale) { "stale_lock_reported" } else { "no_stale_lock" }
        stale = $status.stale
        deleted = $false
        lock_status = $status
      }
    }
    "ReleaseLock" {
      if (-not (Test-Path -LiteralPath $lockPath)) {
        $payload = [ordered]@{ status = "not_locked"; released = $false; lock_path = $lockPath }
      } else {
        $lock = Read-Lock -Path $lockPath
        if ((-not $Force) -and $Owner -and $lock.owner -ne $Owner) {
          throw "Lock owner mismatch. Use -Force for explicit release in tests."
        }
        Remove-Item -LiteralPath $lockPath -Force
        $payload = [ordered]@{ status = "released"; released = $true; lock_path = $lockPath }
      }
    }
  }
  $payload.live_chatgpt_called = $false
  $payload.product_mission_executed = $false
  $payload.real_process_kill_performed = $false
  $payload.commit = $false
  $payload.push = $false
  $payload | ConvertTo-Json -Depth 12
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    action = $Action
    error = $_.Exception.Message
    lock_path = $lockPath
    live_chatgpt_called = $false
    product_mission_executed = $false
    real_process_kill_performed = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
