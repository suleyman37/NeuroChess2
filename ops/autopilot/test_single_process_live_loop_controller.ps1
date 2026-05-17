$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-Fixture {
  param([string]$Fixture, [int[]]$AcceptExitCodes = @(0))
  $script = Join-Path $PSScriptRoot "run_single_process_live_loop_controller.ps1"
  $fixturePath = Join-Path (Join-Path $PSScriptRoot "fixtures") $Fixture
  $outDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\single_process_live_loop" ("fixture_" + [IO.Path]::GetFileNameWithoutExtension($Fixture) + "_" + (Get-Date -Format "yyyyMMdd_HHmmssfff"))
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -FixturePath $fixturePath -OutputDir $outDir 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Fixture. Output: $($output -join "`n")"
  $summaryPath = Join-Path $outDir "single_process_wrapper_summary.json"
  Assert-True (Test-Path -LiteralPath $summaryPath) "wrapper summary missing for $Fixture. Output: $($output -join "`n")"
  $json = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
  return $json.single_process_result
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$success = Invoke-Fixture -Fixture "single_process_success_sequence.json" -AcceptExitCodes @(0)
Assert-True ($success.final_verdict -eq "PASS_SINGLE_PROCESS_TRANSPORT") "successful fixture should pass"
Assert-True ($success.message_1_result -eq "PASS" -and $success.message_2_result -eq "PASS") "both messages should pass"

$timeout = Invoke-Fixture -Fixture "single_process_message1_timeout.json" -AcceptExitCodes @(2)
Assert-True ($timeout.final_verdict -eq "FAIL_TRANSPORT_RESPONSE_TIMEOUT") "message 1 timeout should fail"

$invalidJson = Invoke-Fixture -Fixture "single_process_invalid_json.json" -AcceptExitCodes @(2)
Assert-True ($invalidJson.stop_reason -eq "STOP_TRANSPORT_JSON_INVALID") "invalid JSON should fail closed"

$nonceMismatch = Invoke-Fixture -Fixture "single_process_nonce_mismatch.json" -AcceptExitCodes @(2)
Assert-True ($nonceMismatch.stop_reason -in @("STOP_TRANSPORT_JSON_INVALID", "STOP_TRANSPORT_NONCE_MISMATCH")) "nonce mismatch should fail closed"

$human = Invoke-Fixture -Fixture "single_process_human_verification.json" -AcceptExitCodes @(2)
Assert-True ($human.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") "human verification stop mismatch"

$wrong = Invoke-Fixture -Fixture "single_process_wrong_project.json" -AcceptExitCodes @(2)
Assert-True ($wrong.stop_reason -eq "STOP_WRONG_CHATGPT_PROJECT_CONTEXT") "wrong project stop mismatch"

$composer = Invoke-Fixture -Fixture "single_process_composer_missing.json" -AcceptExitCodes @(2)
Assert-True ($composer.stop_reason -eq "STOP_COMPOSER_NOT_FOUND") "composer missing stop mismatch"

foreach ($result in @($success, $timeout, $invalidJson, $nonceMismatch, $human, $wrong, $composer)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
  Assert-True ([bool]$result.no_micro_prompt_requested) "fixture mode must not request micro-prompt"
}

$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_single_process_loop.mjs") -Raw
Assert-True ($source -notmatch '(?is)\.click\([^)]*(i am human|je suis humain|captcha|verify you are human)') "script must not click human verification controls"
Assert-True ($source -notmatch '(?is)getByText\([^)]*(i am human|je suis humain|captcha|verify you are human)') "script must not target human verification text"

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbidden = @($changed | Where-Object {
  $_ -like "frontend/*" -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -eq "App.tsx" -or
  $_ -like "ops/autopilot/local/*"
})
Assert-True ($forbidden.Count -eq 0) "forbidden/local files touched: $($forbidden -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.single_process_live_loop_controller_version -eq "A18H") "state missing A18H controller version"
Assert-True (-not [bool]$state.live_rolling_loop_enabled) "live rolling loop must remain disabled"
Assert-True (-not [bool]$state.live_control_plane_enabled) "live control plane must remain disabled"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    successful_sequence = $success.final_verdict
    message1_timeout = $timeout.final_verdict
    invalid_json = $invalidJson.stop_reason
    nonce_mismatch = $nonceMismatch.stop_reason
    human_verification = $human.stop_reason
    wrong_project = $wrong.stop_reason
    composer_missing = $composer.stop_reason
    no_micro_prompt = "PASS"
    fixture_mode_no_chatgpt = "PASS"
    no_live_gemini = "PASS"
    no_product_work = "PASS"
    no_product_files_touched = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
