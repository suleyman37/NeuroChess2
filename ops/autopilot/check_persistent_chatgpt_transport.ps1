param(
  [string]$FixturePath = "",
  [string]$InputJson = ""
)

$ErrorActionPreference = "Stop"

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Read-Input {
  if ($InputJson) { return ($InputJson | ConvertFrom-Json) }
  if ($FixturePath) {
    if (-not (Test-Path -LiteralPath $FixturePath)) { throw "FixturePath not found: $FixturePath" }
    return (Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json)
  }
  throw "Provide -FixturePath or -InputJson. This check does not open a browser."
}

$inputObject = Read-Input

$projectContextVerified = [bool](Get-Field $inputObject "project_context_verified" $false)
$composerFound = [bool](Get-Field $inputObject "composer_found" $false)
$humanVerification = [bool](Get-Field $inputObject "human_verification_detected" $false)
$loadingInterstitial = [bool](Get-Field $inputObject "loading_interstitial_detected" $false)
$browserConnected = [bool](Get-Field $inputObject "browser_connected" $true)
$pageOpen = [bool](Get-Field $inputObject "page_open" $true)
$pageCrashed = [bool](Get-Field $inputObject "page_crashed" $false)
$missionActive = [bool](Get-Field $inputObject "mission_active" $false)
$requestMoreRounds = [int](Get-Field $inputObject "request_more_rounds" 0)
$requestMoreLimit = [int](Get-Field $inputObject "request_more_limit" 2)
$messagesInSession = [int](Get-Field $inputObject "messages_in_session" 0)
$messageThreshold = [int](Get-Field $inputObject "rollover_threshold_messages" 12)
$missionsInSession = [int](Get-Field $inputObject "missions_in_session" 0)
$missionThreshold = [int](Get-Field $inputObject "rollover_threshold_missions" 5)

$availability = "READY"
$stopReason = ""
$recommended = "CONTINUE"
$persistentReady = $true

if (-not $browserConnected -or -not $pageOpen -or $pageCrashed) {
  $availability = "BRIDGE_UNAVAILABLE"
  $persistentReady = $false
  if ($pageCrashed -and -not $missionActive) {
    $stopReason = ""
    $recommended = "SOFT_REOPEN_ONCE"
  } else {
    $stopReason = "STOP_BRIDGE_UNAVAILABLE"
    $recommended = "STOP"
  }
} elseif (-not $projectContextVerified) {
  $availability = "WRONG_PROJECT_OR_CONTEXT"
  $persistentReady = $false
  $stopReason = "STOP_WRONG_CHATGPT_PROJECT_CONTEXT"
  $recommended = "STOP"
} elseif ($humanVerification) {
  $availability = "HUMAN_VERIFICATION_REQUIRED"
  $persistentReady = $false
  $stopReason = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
  $recommended = "STOP"
} elseif ($loadingInterstitial -and -not $composerFound) {
  $availability = "LOADING_INTERSTITIAL"
  $persistentReady = $false
  $stopReason = "STOP_PROJECT_LOADING_INTERSTITIAL"
  $recommended = "SOFT_RELOAD_ONCE"
} elseif (-not $composerFound) {
  $availability = "COMPOSER_NOT_FOUND"
  $persistentReady = $false
  $stopReason = "STOP_COMPOSER_NOT_FOUND"
  $recommended = "SOFT_RELOAD_ONCE"
}

if ($persistentReady -and $requestMoreRounds -gt $requestMoreLimit) {
  $persistentReady = $false
  $availability = "REQUEST_MORE_LIMIT_EXCEEDED"
  $stopReason = "STOP_REQUEST_MORE_LIMIT"
  $recommended = "STOP"
}

if ($persistentReady -and ($messagesInSession -ge $messageThreshold -or $missionsInSession -ge $missionThreshold)) {
  $persistentReady = $false
  $availability = "SESSION_THRESHOLD_REACHED"
  $stopReason = ""
  $recommended = "ROLLOVER_REQUIRED"
}

$result = [ordered]@{
  persistent_transport_ready = $persistentReady
  availability = $availability
  stop_reason = $stopReason
  same_page_reused = [bool](Get-Field $inputObject "same_page_reused" $false)
  same_browser_reused = [bool](Get-Field $inputObject "same_browser_reused" $false)
  same_conversation_id = [bool](Get-Field $inputObject "same_conversation_id" $false)
  project_context_verified = $projectContextVerified
  composer_found = $composerFound
  human_verification_detected = $humanVerification
  loading_interstitial_detected = $loadingInterstitial
  recommended_action = $recommended
  fixture_mode = [bool]($FixturePath -or $InputJson)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  browser_opened = $false
}

$result | ConvertTo-Json -Depth 10
if ($persistentReady -or $recommended -eq "ROLLOVER_REQUIRED" -or $recommended -eq "SOFT_REOPEN_ONCE") { exit 0 }
exit 2
