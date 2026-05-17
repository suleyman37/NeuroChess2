$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-Fixture {
  param([string]$Fixture, [int[]]$AcceptExitCodes = @(0))
  $script = Join-Path $PSScriptRoot "run_chatgpt_cdp_attach_smoke.ps1"
  $fixturePath = Join-Path (Join-Path $PSScriptRoot "fixtures") $Fixture
  $outDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_cdp_attach" ("fixture_" + [IO.Path]::GetFileNameWithoutExtension($Fixture) + "_" + (Get-Date -Format "yyyyMMdd_HHmmssfff"))
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -FixturePath $fixturePath -OutputDir $outDir 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Fixture. Output: $($output -join "`n")"
  $summaryPath = Join-Path $outDir "cdp_attach_wrapper_summary.json"
  Assert-True (Test-Path -LiteralPath $summaryPath) "wrapper summary missing for $Fixture"
  return (Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json).cdp_attach_result
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$success = Invoke-Fixture -Fixture "cdp_attach_success_sequence.json" -AcceptExitCodes @(0)
Assert-True ($success.final_verdict -eq "PASS_CDP_ATTACH_TRANSPORT") "CDP success fixture should pass"
Assert-True ([bool]$success.existing_chrome_reused -and [bool]$success.existing_page_reused) "CDP success should reuse existing Chrome/page"

$connectFail = Invoke-Fixture -Fixture "cdp_attach_connect_fail.json" -AcceptExitCodes @(2)
Assert-True ($connectFail.stop_reason -eq "STOP_CDP_ATTACH_FAILED") "CDP attach fail stop mismatch"

$noTab = Invoke-Fixture -Fixture "cdp_attach_no_tab.json" -AcceptExitCodes @(2)
Assert-True ($noTab.stop_reason -eq "STOP_ACTIVE_SESSION_TAB_NOT_FOUND") "missing tab stop mismatch"

$human = Invoke-Fixture -Fixture "cdp_attach_human_verification.json" -AcceptExitCodes @(2)
Assert-True ($human.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") "human verification stop mismatch"

$composer = Invoke-Fixture -Fixture "cdp_attach_composer_missing.json" -AcceptExitCodes @(2)
Assert-True ($composer.stop_reason -eq "STOP_COMPOSER_NOT_FOUND") "composer missing stop mismatch"

$timeout = Invoke-Fixture -Fixture "cdp_attach_message_timeout.json" -AcceptExitCodes @(2)
Assert-True ($timeout.stop_reason -eq "STOP_TRANSPORT_ECHO_TIMEOUT") "timeout stop mismatch"

foreach ($result in @($success, $connectFail, $noTab, $human, $composer, $timeout)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
  Assert-True ([bool]$result.no_micro_prompt_requested) "fixture mode must not request micro-prompt"
  Assert-True (-not [bool]$result.chrome_closed_by_codex) "fixture mode must not close Chrome"
}

$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_cdp_attach_loop.mjs") -Raw
Assert-True ($source -notmatch 'launchPersistentContext|chromium\.launch\(') "CDP attach script must not launch Chrome"
Assert-True ($source -match 'connectOverCDP') "CDP attach script must use connectOverCDP"
Assert-True ($source -notmatch '(?is)\.click\([^)]*(i am human|je suis humain|captcha|verify you are human)') "script must not click human verification controls"
Assert-True ($source -notmatch '(?is)getByText\([^)]*(i am human|je suis humain|captcha|verify you are human)') "script must not target human verification text"
Assert-True ($source -notmatch 'browser\.close\(') "CDP attach script must not close user Chrome"

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
Assert-True ($state.chatgpt_cdp_attach_mode_version -eq "A18I") "state missing A18I CDP attach version"
Assert-True ([bool]$state.chatgpt_cdp_attach_available) "state should mark CDP attach available"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    success_sequence = $success.final_verdict
    connect_fail = $connectFail.stop_reason
    no_tab = $noTab.stop_reason
    human_verification = $human.stop_reason
    composer_missing = $composer.stop_reason
    timeout = $timeout.stop_reason
    no_micro_prompt = "PASS"
    no_live_chatgpt_in_fixture = "PASS"
    no_live_gemini = "PASS"
    no_product_work = "PASS"
    no_chrome_close = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
