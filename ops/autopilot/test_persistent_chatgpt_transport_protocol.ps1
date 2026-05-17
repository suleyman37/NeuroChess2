$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-TransportCheck {
  param([string]$Fixture, [int[]]$AcceptExitCodes = @(0))
  $script = Join-Path $PSScriptRoot "check_persistent_chatgpt_transport.ps1"
  $fixturePath = Join-Path (Join-Path $PSScriptRoot "fixtures") $Fixture
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -FixturePath $fixturePath 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Fixture. Output: $($output -join "`n")"
  return ($output | Out-String | ConvertFrom-Json)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$healthy = Invoke-TransportCheck -Fixture "persistent_transport_ready.json" -AcceptExitCodes @(0)
Assert-True ([bool]$healthy.persistent_transport_ready) "healthy session should continue"
Assert-True ($healthy.recommended_action -eq "CONTINUE") "healthy session should continue"

$composerLost = Invoke-TransportCheck -Fixture "persistent_transport_composer_lost.json" -AcceptExitCodes @(2)
Assert-True ($composerLost.stop_reason -eq "STOP_COMPOSER_NOT_FOUND") "composer loss should stop if unrecovered"
Assert-True ($composerLost.recommended_action -eq "SOFT_RELOAD_ONCE") "composer loss should allow only bounded recovery"

$interstitial = Invoke-TransportCheck -Fixture "persistent_transport_interstitial.json" -AcceptExitCodes @(2)
Assert-True ($interstitial.stop_reason -eq "STOP_PROJECT_LOADING_INTERSTITIAL") "interstitial stop reason mismatch"

$human = Invoke-TransportCheck -Fixture "persistent_transport_human_verification.json" -AcceptExitCodes @(2)
Assert-True ($human.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") "human verification stop reason mismatch"

$wrong = Invoke-TransportCheck -Fixture "persistent_transport_wrong_context.json" -AcceptExitCodes @(2)
Assert-True ($wrong.stop_reason -eq "STOP_WRONG_CHATGPT_PROJECT_CONTEXT") "wrong context stop reason mismatch"

$crash = Invoke-TransportCheck -Fixture "persistent_transport_browser_crash.json" -AcceptExitCodes @(0)
Assert-True ($crash.recommended_action -eq "SOFT_REOPEN_ONCE") "safe page crash should allow one clean reopen"

$requestMoreJson = @'
{
  "project_context_verified": true,
  "composer_found": true,
  "browser_connected": true,
  "page_open": true,
  "request_more_rounds": 3,
  "request_more_limit": 2
}
'@
$requestMore = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_persistent_chatgpt_transport.ps1") -InputJson $requestMoreJson 2>&1
Assert-True ($LASTEXITCODE -eq 2) "REQUEST_MORE over limit should exit with stop"
$requestMoreObj = $requestMore | Out-String | ConvertFrom-Json
Assert-True ($requestMoreObj.stop_reason -eq "STOP_REQUEST_MORE_LIMIT") "REQUEST_MORE limit stop reason mismatch"

$rollover = Invoke-TransportCheck -Fixture "persistent_transport_threshold_rollover.json" -AcceptExitCodes @(0)
Assert-True ($rollover.recommended_action -eq "ROLLOVER_REQUIRED") "threshold should trigger rollover"

$dryRun = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start_persistent_chatgpt_transport.ps1") -DryRun 2>&1
Assert-True ($LASTEXITCODE -eq 0) "start dry-run should pass"
$dryRunObj = $dryRun | Out-String | ConvertFrom-Json
Assert-True (-not [bool]$dryRunObj.browser_called) "start dry-run must not open browser"

$sendOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_persistent_chatgpt_message.ps1") -Message "transport echo only" 2>&1
$sendObj = $sendOutput | Out-String | ConvertFrom-Json
Assert-True (-not [bool]$sendObj.product_mission_executed) "send helper must not execute product work"
Assert-True (-not [bool]$sendObj.live_gemini_called) "send helper must not call Gemini"

foreach ($result in @($healthy, $composerLost, $interstitial, $human, $wrong, $crash, $rollover)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
  Assert-True (-not [bool]$result.browser_opened) "fixture mode must not open browser"
}

$source = @(
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "start_persistent_chatgpt_transport.ps1") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "check_persistent_chatgpt_transport.ps1") -Raw)
) -join "`n"
Assert-True ($source -notmatch '(?is)\.click\([^)]*(i am human|je suis humain|captcha|verify you are human)') "scripts must not click human verification controls"
Assert-True ($source -notmatch '(?is)getByText\([^)]*(i am human|je suis humain|captcha|verify you are human)') "scripts must not target verification text for automation"

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
Assert-True ($state.persistent_chatgpt_transport_version -eq "A18G") "state missing A18G persistent version"
Assert-True ([bool]$state.active_session_url_reuse_available) "active session reuse should be marked available"
Assert-True ([bool]$state.human_verification_guard_available) "human verification guard must remain available"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    healthy_session_continues = "PASS"
    composer_missing_bounded_stop = "PASS"
    loading_interstitial_stop = "PASS"
    human_verification_stop = "PASS"
    wrong_context_stop = "PASS"
    page_crash_one_reopen = "PASS"
    request_more_limit = "PASS"
    threshold_rollover = "PASS"
    local_session_not_staged = "PASS"
    fixture_mode_no_chatgpt = "PASS"
    fixture_mode_no_gemini = "PASS"
    no_product_mission = "PASS"
    no_product_files_touched = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
