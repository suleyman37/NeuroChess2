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
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20a_guard_pack_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$manifestPath = Join-Path $tempRoot "policy_kernel_manifest.json"
$manifest = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_policy_kernel_manifest.ps1") -Arguments @("-OutPath", $manifestPath)
Assert-True ($manifest.schema_version -eq "A20A_policy_kernel_manifest_v1") "policy kernel manifest schema mismatch"
Assert-True (@($manifest.files).Count -gt 0) "policy kernel manifest should include files"
Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) "manifest output file missing"

$kernelPass = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_policy_kernel_freeze.ps1") -Arguments @(
  "-BaselinePath", (Join-Path $fixtures "policy_kernel_manifest_valid.json"),
  "-CurrentPath", (Join-Path $fixtures "policy_kernel_manifest_valid.json")
)
Assert-True ($kernelPass.kernel_result -eq "PASS") "unchanged kernel should pass"

$kernelStop = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_policy_kernel_freeze.ps1") -Arguments @(
  "-BaselinePath", (Join-Path $fixtures "policy_kernel_manifest_valid.json"),
  "-CurrentPath", (Join-Path $fixtures "policy_kernel_changed.json")
) -AcceptExitCodes @(2)
Assert-True ($kernelStop.kernel_result -eq "STOP_POLICY_KERNEL_CHANGED") "changed kernel should stop"
Assert-True (@($kernelStop.changed_files).Count -ge 1) "changed kernel should identify changed files"

$budgetOk = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_budget_quota_meter.ps1") -Arguments @("-InputPath", (Join-Path $fixtures "budget_quota_ok.json"))
Assert-True ($budgetOk.budget_result -eq "PASS") "budget OK fixture should pass"

$budgetWarn = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_budget_quota_meter.ps1") -Arguments @("-InputPath", (Join-Path $fixtures "budget_quota_warning.json"))
Assert-True ($budgetWarn.budget_result -eq "WARN_QUOTA_NEAR_CAP") "budget warning fixture should warn"

$budgetStop = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_budget_quota_meter.ps1") -Arguments @("-InputPath", (Join-Path $fixtures "budget_quota_stop.json")) -AcceptExitCodes @(2)
Assert-True (($budgetStop.budget_result -eq "STOP_QUOTA_EXCEEDED") -or ($budgetStop.budget_result -eq "STOP_QUOTA_NEAR_CAP")) "budget stop fixture should stop"

$killAbsent = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_kill_switch_file.ps1") -Arguments @("-FixturePath", (Join-Path $fixtures "kill_switch_absent.json"))
Assert-True ($killAbsent.kill_switch_result -eq "CLEAR") "absent kill switch should pass"

$killPresent = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_kill_switch_file.ps1") -Arguments @("-FixturePath", (Join-Path $fixtures "kill_switch_present.json")) -AcceptExitCodes @(2)
Assert-True ($killPresent.kill_switch_result -eq "STOP_KILL_SWITCH_FILE") "present kill switch should stop"

$evidenceValid = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_evidence_index.ps1") -Arguments @(
  "-IndexPath", (Join-Path $fixtures "evidence_index_valid.jsonl"),
  "-VerifyExists"
)
Assert-True ($evidenceValid.evidence_index_result -eq "PASS") "valid evidence index should pass"

$evidenceMissing = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_evidence_index.ps1") -Arguments @(
  "-IndexPath", (Join-Path $fixtures "evidence_index_missing_artifact.jsonl"),
  "-VerifyExists"
) -AcceptExitCodes @(2)
Assert-True ($evidenceMissing.evidence_index_result -eq "STOP_MISSING_REQUIRED_EVIDENCE") "missing required evidence should stop"

$appendedIndex = Join-Path $tempRoot "evidence_index_append.jsonl"
$appendResult = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "append_evidence_index.ps1") -Arguments @(
  "-IndexPath", $appendedIndex,
  "-RunId", "fixture-run",
  "-MissionId", "fixture-mission",
  "-ArtifactId", "append-fixture",
  "-ArtifactType", "report",
  "-ArtifactPath", "ops/autopilot/fixtures/morning_report_dryrun_input.json",
  "-RequiredForE2E", "True"
)
Assert-True ($appendResult.append_result -eq "PASS") "append evidence index should pass"
$appendedValid = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_evidence_index.ps1") -Arguments @("-IndexPath", $appendedIndex, "-VerifyExists")
Assert-True ($appendedValid.evidence_index_result -eq "PASS") "appended evidence index should validate"

$morningOut = Join-Path $tempRoot "morning"
$morning = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "run_morning_report_dryrun.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "morning_report_dryrun_input.json"),
  "-OutDir", $morningOut
)
Assert-True ($morning.morning_report_dryrun_result -eq "PASS") "morning report dry-run should pass"
Assert-True (Test-Path -LiteralPath $morning.report_path -PathType Leaf) "morning report dry-run output missing"
Assert-True (@($morning.missing_sections).Count -eq 0) "morning report dry-run should include all required sections"

git -C $repoRoot check-ignore -q ops/autopilot/STOP_NOW
Assert-True ($LASTEXITCODE -eq 0) "ops/autopilot/STOP_NOW must be gitignored"

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

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    policy_kernel_manifest_builds = "PASS"
    unchanged_kernel = $kernelPass.kernel_result
    changed_kernel = $kernelStop.kernel_result
    budget_ok = $budgetOk.budget_result
    budget_warning = $budgetWarn.budget_result
    budget_stop = $budgetStop.budget_result
    kill_switch_absent = $killAbsent.kill_switch_result
    kill_switch_present = $killPresent.kill_switch_result
    evidence_index_valid = $evidenceValid.evidence_index_result
    evidence_index_missing = $evidenceMissing.evidence_index_result
    evidence_index_append = $appendResult.append_result
    morning_report_dryrun = $morning.morning_report_dryrun_result
    stop_now_gitignored = $true
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
