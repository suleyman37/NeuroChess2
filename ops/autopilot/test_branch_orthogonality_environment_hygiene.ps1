$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonScript {
  param(
    [string]$Script,
    [string[]]$Arguments = @(),
    [int[]]$AcceptExitCodes = @(0)
  )
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  $text = ($output | Out-String).Trim()
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Script $($Arguments -join ' '). Output: $text"
  try {
    return ($text | ConvertFrom-Json)
  } catch {
    throw "Script did not return JSON: $Script. Output: $text"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixtures = Join-Path $PSScriptRoot "fixtures"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20b_guard_pack_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$emptyOverlap = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_branch_file_overlap.ps1") -Arguments @(
  "-LockPath", (Join-Path $fixtures "branch_locks_empty.jsonl"),
  "-PathList", "backend/tests/test_new_readonly_contract.py"
)
Assert-True ($emptyOverlap.overlap_result -eq "PASS") "empty branch lock file should pass"

$nonOverlap = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_branch_file_overlap.ps1") -Arguments @(
  "-LockPath", (Join-Path $fixtures "branch_locks_backend_existing.jsonl"),
  "-PathList", "backend/tests/test_other_readonly_contract.py"
)
Assert-True ($nonOverlap.overlap_result -eq "PASS") "non-overlapping planned writes should pass"

$overlap = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_branch_file_overlap.ps1") -Arguments @(
  "-LockPath", (Join-Path $fixtures "branch_locks_backend_existing.jsonl"),
  "-PathList", "backend/tests/test_exercise_detail_readonly.py"
)
Assert-True ($overlap.overlap_result -eq "OVERLAP_DETECTED") "overlapping planned write should be detected"
Assert-True (@($overlap.overlapping_files).Count -eq 1) "overlap should report the file"

$rejectDecision = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_branch_overlap_decision.ps1") -Arguments @(
  "-OverlapJsonPath", (Join-Path $fixtures "branch_overlap_detected_reject.json")
)
Assert-True ($rejectDecision.decision -eq "REJECT_MISSION") "default overlap decision should reject"

$stackDecision = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_branch_overlap_decision.ps1") -Arguments @(
  "-OverlapJsonPath", (Join-Path $fixtures "branch_overlap_stack_allowed.json")
)
Assert-True ($stackDecision.decision -eq "STACK_ON_PREVIOUS_BRANCH") "explicit safe dependency should stack"

$redMetadataPath = Join-Path $tempRoot "red_overlap_metadata.json"
Set-Content -LiteralPath $redMetadataPath -Value '{"risk_tier":"red","explicit_dependency":false}' -Encoding UTF8
$redDecision = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_branch_overlap_decision.ps1") -Arguments @(
  "-OverlapJsonPath", (Join-Path $fixtures "branch_overlap_detected_reject.json"),
  "-MissionMetadataPath", $redMetadataPath
)
Assert-True ($redDecision.decision -eq "QUARANTINE_REQUIRED") "red-tier overlap should quarantine"

$runtimeRegistry = Join-Path $tempRoot "process_registry.jsonl"
$registerProcess = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "register_runtime_process.ps1") -Arguments @(
  "-RegistryPath", $runtimeRegistry,
  "-RunId", "fixture-run",
  "-MissionId", "fixture-mission",
  "-ProcessName", "node",
  "-ProcessId", "999993",
  "-CommandSummary", "fixture registration only",
  "-ExpectedPort", "5173",
  "-Status", "exited"
)
Assert-True ($registerProcess.register_process_result -eq "PASS") "process registration should pass"

$processClean = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_runtime_process_registry.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "runtime_process_registry_clean.jsonl")
)
Assert-True ($processClean.process_registry_result -eq "PASS") "clean process registry should pass"

$processStale = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_runtime_process_registry.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "runtime_process_registry_stale.jsonl")
) -AcceptExitCodes @(2)
Assert-True ($processStale.process_registry_result -eq "STOP_STALE_REGISTERED_PROCESS") "stale process registry should stop"

$portClean = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_port_registry.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "port_registry_clean.json")
)
Assert-True ($portClean.port_registry_result -eq "PASS") "clean port registry should pass"

$portConflict = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_port_registry.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "port_registry_conflict.json")
) -AcceptExitCodes @(2)
Assert-True ($portConflict.port_registry_result -eq "STOP_PORT_CONFLICT") "port conflict should stop"

$hygieneClean = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_environment_hygiene.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "environment_hygiene_clean.json")
)
Assert-True ($hygieneClean.environment_hygiene_result -eq "PASS") "clean environment hygiene should pass"

$hygienePoisoned = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_environment_hygiene.ps1") -Arguments @(
  "-FixturePath", (Join-Path $fixtures "environment_hygiene_poisoned.json")
) -AcceptExitCodes @(2)
Assert-True ($hygienePoisoned.environment_hygiene_result -eq "STOP_ENVIRONMENT_POISONED") "poisoned environment should stop"

$reportPath = Join-Path $tempRoot "environment_hygiene_report.json"
$hygieneCleanPath = Join-Path $tempRoot "environment_hygiene_clean_result.json"
Set-Content -LiteralPath $hygieneCleanPath -Value ($hygieneClean | ConvertTo-Json -Depth 10) -Encoding UTF8
$report = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_environment_hygiene_report.ps1") -Arguments @(
  "-HygieneJsonPath", $hygieneCleanPath,
  "-OutPath", $reportPath
)
Assert-True ($report.report_result -eq "PASS") "environment hygiene report should pass"
Assert-True (Test-Path -LiteralPath $reportPath -PathType Leaf) "environment hygiene report file missing"

$scriptText = @(
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "register_runtime_process.ps1") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "check_runtime_process_registry.ps1") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "check_port_registry.ps1") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "check_environment_hygiene.ps1") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "build_environment_hygiene_report.ps1") -Raw)
) -join "`n"
Assert-True ($scriptText -notmatch '(?i)\btaskkill\b|Stop-Process|\bkillall\b|wmic\s+process') "scripts must not contain global process kill behavior"
Assert-True ($scriptText -notmatch '(?i)git\s+clean|reset\s+--hard|Remove-Item\s+-Recurse|rm\s+-rf') "scripts must not contain destructive cleanup behavior"

foreach ($result in @($emptyOverlap, $nonOverlap, $overlap, $rejectDecision, $stackDecision, $redDecision, $processClean, $processStale, $portClean, $portConflict, $hygieneClean, $hygienePoisoned)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbidden = @($changed | Where-Object {
  $_ -like "frontend/*" -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -eq "App.tsx"
})
Assert-True ($forbidden.Count -eq 0) "product files touched: $($forbidden -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.branch_orthogonality_version -eq "A20B") "state missing A20B branch orthogonality version"
Assert-True ([bool]$state.branch_orthogonality_available) "state must mark branch orthogonality available"
Assert-True ([bool]$state.environment_hygiene_available) "state must mark environment hygiene available"
Assert-True (-not [bool]$state.branch_orthogonality_live_enabled) "branch orthogonality live enforcement must remain disabled"
Assert-True (-not [bool]$state.environment_hygiene_live_enabled) "environment hygiene live enforcement must remain disabled"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    empty_branch_lock_file = $emptyOverlap.overlap_result
    non_overlapping_planned_writes = $nonOverlap.overlap_result
    overlapping_planned_write = $overlap.overlap_result
    overlap_default_decision = $rejectDecision.decision
    stacking_allowed_decision = $stackDecision.decision
    red_tier_overlap_decision = $redDecision.decision
    process_registry_clean = $processClean.process_registry_result
    process_registry_stale = $processStale.process_registry_result
    port_registry_clean = $portClean.port_registry_result
    port_registry_conflict = $portConflict.port_registry_result
    environment_hygiene_clean = $hygieneClean.environment_hygiene_result
    environment_hygiene_poisoned = $hygienePoisoned.environment_hygiene_result
    no_global_process_kill = $true
    no_destructive_git_cleanup = $true
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
