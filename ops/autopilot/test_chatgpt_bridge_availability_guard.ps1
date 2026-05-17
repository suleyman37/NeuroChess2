$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-Availability {
  param([string]$Fixture, [int[]]$AcceptExitCodes = @(0))
  $script = Join-Path $PSScriptRoot "check_chatgpt_bridge_availability.ps1"
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

$ready = Invoke-Availability -Fixture "chatgpt_availability_composer_ready.json" -AcceptExitCodes @(0)
Assert-True ($ready.availability -eq "READY" -and [bool]$ready.ready) "composer-ready fixture should return READY"

$loading = Invoke-Availability -Fixture "chatgpt_availability_loading_interstitial.json" -AcceptExitCodes @(2)
Assert-True ($loading.stop_reason -eq "STOP_PROJECT_LOADING_INTERSTITIAL") "loading fixture stop reason mismatch"

$humanEn = Invoke-Availability -Fixture "chatgpt_availability_human_verification_en.json" -AcceptExitCodes @(2)
Assert-True ($humanEn.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") "English human verification stop reason mismatch"

$humanFr = Invoke-Availability -Fixture "chatgpt_availability_human_verification_fr.json" -AcceptExitCodes @(2)
Assert-True ($humanFr.stop_reason -eq "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED") "French human verification stop reason mismatch"

$noComposer = Invoke-Availability -Fixture "chatgpt_availability_no_composer.json" -AcceptExitCodes @(2)
Assert-True ($noComposer.stop_reason -eq "STOP_COMPOSER_NOT_FOUND") "no-composer fixture stop reason mismatch"

$wrong = Invoke-Availability -Fixture "chatgpt_availability_wrong_project.json" -AcceptExitCodes @(2)
Assert-True ($wrong.stop_reason -eq "STOP_WRONG_CHATGPT_PROJECT_CONTEXT") "wrong-project fixture stop reason mismatch"

foreach ($result in @($ready, $loading, $humanEn, $humanFr, $noComposer, $wrong)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
  Assert-True (-not [bool]$result.browser_opened) "fixture mode must not open a browser"
}

$scriptText = @(
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs") -Raw),
  (Get-Content -LiteralPath (Join-Path $PSScriptRoot "check_chatgpt_bridge_availability.ps1") -Raw)
) -join "`n"
Assert-True ($scriptText -notmatch '(?is)\.click\([^)]*(i am human|je suis humain|captcha|verify you are human)') "scripts must not click human verification controls"
Assert-True ($scriptText -notmatch '(?is)getByText\([^)]*(i am human|je suis humain|captcha|verify you are human)') "scripts must not target human verification text for automation"

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
Assert-True ($state.chatgpt_bridge_availability_guard_version -eq "A18E") "state missing A18E guard version"
Assert-True ([bool]$state.human_verification_guard_available) "state must mark guard available"
Assert-True (-not [bool]$state.human_verification_auto_bypass_enabled) "auto bypass must remain disabled"
Assert-True ([bool]$state.bridge_availability_required_before_chatgpt_call) "availability gate must be required"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    composer_ready = $ready.availability
    loading_interstitial = $loading.stop_reason
    human_verification_en = $humanEn.stop_reason
    human_verification_fr = $humanFr.stop_reason
    no_composer = $noComposer.stop_reason
    wrong_project = $wrong.stop_reason
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_human_verification_automation = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
