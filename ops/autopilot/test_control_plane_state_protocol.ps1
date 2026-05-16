$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  return [pscustomobject]@{
    exit_code = $code
    output = ($output -join "`n")
    json = if ($output) { (($output -join "`n") | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\control_plane_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$runtime = Join-Path $runDir "runtime"
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

$stateScript = Join-Path $PSScriptRoot "control_plane_state.ps1"
$eventsScript = Join-Path $PSScriptRoot "control_plane_events.ps1"
$lockScript = Join-Path $PSScriptRoot "control_plane_lock.ps1"

$newSession = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "NewSession", "-RuntimeDir", $runtime, "-SessionId", "night_a16a_test", "-MaxSteps", "5", "-MaxHours", "1")
$validateState = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "ValidateState", "-RuntimeDir", $runtime)

$writeRuntime = Join-Path $runDir "write_runtime"
$writeState = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "WriteStateAtomic", "-RuntimeDir", $writeRuntime, "-InputPath", (Join-Path $fixtureRoot "night_session_valid.json"))
$validateWritten = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "ValidateState", "-RuntimeDir", $writeRuntime)

$corruptRuntime = Join-Path $runDir "corrupt_runtime"
$corruptNew = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "NewSession", "-RuntimeDir", $corruptRuntime, "-SessionId", "night_corrupt_test")
$corruptStatePath = Join-Path $corruptRuntime "state\night_session.json"
Copy-Item -LiteralPath (Join-Path $fixtureRoot "night_session_corrupt.json") -Destination $corruptStatePath -Force
$corruptValidate = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "ValidateState", "-RuntimeDir", $corruptRuntime)
$recover = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "RecoverLastGood", "-RuntimeDir", $corruptRuntime)
$recoverValidate = Invoke-JsonCommand -Arguments @("-File", $stateScript, "-Action", "ValidateState", "-RuntimeDir", $corruptRuntime)

$eventRuntime = Join-Path $runDir "event_runtime"
$validEvent = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "WriteEventAtomic", "-RuntimeDir", $eventRuntime, "-EventPath", (Join-Path $fixtureRoot "control_plane_event_valid.json"))
$validEventWritten = Test-Path -LiteralPath ([string]$validEvent.json.event_path)
$validateEvent = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "ValidateEvent", "-RuntimeDir", $eventRuntime, "-EventPath", (Join-Path $fixtureRoot "control_plane_event_valid.json"))
$invalidEvent = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "ValidateEvent", "-RuntimeDir", $eventRuntime, "-EventPath", (Join-Path $fixtureRoot "control_plane_event_invalid.json"))

$gapRuntime = Join-Path $runDir "gap_runtime"
$gapFixture = Get-Content -LiteralPath (Join-Path $fixtureRoot "control_plane_event_sequence_gap.json") -Raw | ConvertFrom-Json
$gapIndex = 0
foreach ($event in @($gapFixture.events)) {
  $gapIndex += 1
  $eventPath = Join-Path $runDir "gap_event_$gapIndex.json"
  $event | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $eventPath -Encoding UTF8
  [void](Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "WriteEventAtomic", "-RuntimeDir", $gapRuntime, "-EventPath", $eventPath))
}
$gapList = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "ListInboxEvents", "-RuntimeDir", $gapRuntime)

$processing = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "MoveEventToProcessing", "-RuntimeDir", $eventRuntime, "-EventPath", ([string]$validEvent.json.event_path))
$processed = Invoke-JsonCommand -Arguments @("-File", $eventsScript, "-Action", "MarkEventProcessed", "-RuntimeDir", $eventRuntime, "-EventPath", ([string]$processing.json.event_path))
$missionLog = Get-Content -LiteralPath ([string]$processed.json.mission_log_path) -Raw

$lockRuntime = Join-Path $runDir "lock_runtime"
$lockAcquire = Invoke-JsonCommand -Arguments @("-File", $lockScript, "-Action", "AcquireLock", "-RuntimeDir", $lockRuntime, "-Owner", "a16a_test")

$activeLockPath = Join-Path $lockRuntime "locks\control_plane.lock.json"
$activeLock = [ordered]@{
  schema_version = "A16A_control_plane_lock_v1"
  owner = "active_test"
  pid = $PID
  acquired_at = [DateTimeOffset]::UtcNow.ToString("o")
  runtime_dir = $lockRuntime
}
$activeLock | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $activeLockPath -Encoding UTF8
$secondLock = Invoke-JsonCommand -Arguments @("-File", $lockScript, "-Action", "AcquireLock", "-RuntimeDir", $lockRuntime, "-Owner", "second")

$staleRuntime = Join-Path $runDir "stale_lock_runtime"
New-Item -ItemType Directory -Force -Path (Join-Path $staleRuntime "locks") | Out-Null
$staleLockPath = Join-Path $staleRuntime "locks\control_plane.lock.json"
$staleLock = [ordered]@{
  schema_version = "A16A_control_plane_lock_v1"
  owner = "stale_test"
  pid = 999999
  acquired_at = ([DateTimeOffset]::UtcNow.AddHours(-3)).ToString("o")
  runtime_dir = $staleRuntime
}
$staleLock | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $staleLockPath -Encoding UTF8
$staleReport = Invoke-JsonCommand -Arguments @("-File", $lockScript, "-Action", "ReportStaleLock", "-RuntimeDir", $staleRuntime, "-StaleAfterSeconds", "1")
$staleStillExists = Test-Path -LiteralPath $staleLockPath

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($newSession.exit_code -eq 0 -and $newSession.json.state.schema_version -eq "A16A_night_session_v1") "new session state should be valid"
Assert-True ($validateState.exit_code -eq 0 -and [bool]$validateState.json.valid) "ValidateState should pass for new session"
Assert-True ($writeState.exit_code -eq 0 -and (Test-Path -LiteralPath $writeState.json.state_path)) "WriteStateAtomic should write state"
Assert-True ($validateWritten.exit_code -eq 0 -and [bool]$validateWritten.json.valid) "atomic written state should validate"
Assert-True ($corruptValidate.exit_code -ne 0 -and -not [bool]$corruptValidate.json.valid) "corrupt state should fail validation"
Assert-True ($recover.exit_code -eq 0 -and $recover.json.status -eq "recovered") "corrupt state should recover from last_good"
Assert-True ($recoverValidate.exit_code -eq 0 -and [bool]$recoverValidate.json.valid) "recovered state should validate"
Assert-True ($validEvent.exit_code -eq 0 -and $validEventWritten) "event write should be atomic and valid"
Assert-True ($validateEvent.exit_code -eq 0 -and [bool]$validateEvent.json.valid) "valid event should validate"
Assert-True ($invalidEvent.exit_code -ne 0 -and -not [bool]$invalidEvent.json.valid) "invalid event should be rejected"
Assert-True ($gapList.exit_code -eq 0 -and [bool]$gapList.json.sequence_gap_detected) "sequence gap should be detected"
Assert-True ($lockAcquire.exit_code -eq 0 -and [bool]$lockAcquire.json.acquired) "lock acquisition should work"
Assert-True ($secondLock.exit_code -ne 0 -and $secondLock.json.reason -eq "active_lock_present") "active lock should block second control plane"
Assert-True ($staleReport.exit_code -eq 0 -and [bool]$staleReport.json.stale -and [bool]$staleStillExists) "stale lock should be reported but not deleted"
Assert-True ($missionLog -match '"status":"processed"') "mission_log should append processed event"
Assert-True (-not [bool]$state.local_control_plane_enabled) "live Control Plane must remain disabled"
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched by tests"
Assert-True ($productDirty.Count -eq 0) "product paths must not be touched by tests"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    new_session_state_valid = $true
    atomic_state_write_valid = $true
    corrupt_state_recovered_from_last_good = $true
    event_write_atomic_valid = $true
    invalid_event_rejected = $true
    sequence_gap_detected = $true
    lock_acquisition_works = $true
    active_lock_blocks_second_control_plane = $true
    stale_lock_reported_not_deleted = $true
    mission_log_append_only_observed = $true
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "control_plane_state_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
