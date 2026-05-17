param(
  [string]$FixturePath = "",
  [string]$InputJson = "",
  [string]$ReportDir = ""
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

function Read-AvailabilityInput {
  if ($InputJson) { return ($InputJson | ConvertFrom-Json) }
  if ($FixturePath) {
    if (-not (Test-Path -LiteralPath $FixturePath)) { throw "FixturePath not found: $FixturePath" }
    return (Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json)
  }
  throw "Provide -FixturePath or -InputJson. Fixture mode does not open a browser or call ChatGPT."
}

function Test-RegexAny {
  param([string]$Text, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if ($Text -match $pattern) { return $true }
  }
  return $false
}

function Get-AvailabilityResult {
  param($AvailabilityInput)

  $title = [string](Get-Field $AvailabilityInput "title" "")
  $pageText = [string](Get-Field $AvailabilityInput "page_text" "")
  $currentUrl = [string](Get-Field $AvailabilityInput "current_url" "")
  $projectName = [string](Get-Field $AvailabilityInput "project_name" "NeuroChess Supervisor")
  $composerFound = [bool](Get-Field $AvailabilityInput "composer_found" $false)
  $projectContextVerified = [bool](Get-Field $AvailabilityInput "project_context_verified" $false)
  $text = "$title`n$pageText`n$currentUrl"

  $humanVerification = Test-RegexAny $text @(
    "je\s+suis\s+humain",
    "i\s+am\s+human",
    "verify\s+you\s+are\s+human",
    "human\s+verification",
    "captcha",
    "challenge",
    "checking\s+your\s+browser",
    "v[ée]rification\s+humaine",
    "cloudflare"
  )
  $loadingInterstitial = Test-RegexAny $text @(
    "un\s+instant",
    "just\s+a\s+moment",
    "one\s+moment",
    "chargement",
    "\bloading\b",
    "patientez",
    "v[ée]rification"
  )

  $availability = "READY"
  $stopReason = ""
  $recommended = "CONTINUE"
  if (-not $projectContextVerified) {
    $availability = "WRONG_PROJECT_OR_CONTEXT"
    $stopReason = "STOP_WRONG_CHATGPT_PROJECT_CONTEXT"
    $recommended = "STOP_WRONG_CONTEXT"
  } elseif ($humanVerification) {
    $availability = "HUMAN_VERIFICATION_REQUIRED"
    $stopReason = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED"
    $recommended = "STOP_FOR_MANUAL_VERIFICATION"
  } elseif ($loadingInterstitial -and -not $composerFound) {
    $availability = "LOADING_INTERSTITIAL"
    $stopReason = "STOP_PROJECT_LOADING_INTERSTITIAL"
    $recommended = "STOP_FOR_MANUAL_VERIFICATION"
  } elseif (-not $composerFound) {
    $availability = "COMPOSER_NOT_FOUND"
    $stopReason = "STOP_COMPOSER_NOT_FOUND"
    $recommended = "STOP_FOR_READY_REPAIR"
  }

  if ($availability -eq "READY" -and ([string]::IsNullOrWhiteSpace($currentUrl) -or -not $projectContextVerified)) {
    $availability = "UNKNOWN_BLOCKED_STATE"
    $stopReason = "STOP_BRIDGE_AVAILABILITY_UNKNOWN_BLOCKED"
    $recommended = "STOP_FOR_READY_REPAIR"
  }

  [ordered]@{
    availability = $availability
    ready = ($availability -eq "READY")
    stop_reason = $stopReason
    composer_found = $composerFound
    project_context_verified = $projectContextVerified
    project_name = $projectName
    human_verification_detected = $humanVerification
    loading_interstitial_detected = $loadingInterstitial
    recommended_action = $recommended
    current_url_recorded = -not [string]::IsNullOrWhiteSpace($currentUrl)
    fixture_mode = [bool]$FixturePath -or [bool]$InputJson
    browser_opened = $false
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  }
}

$inputObject = Read-AvailabilityInput
$result = Get-AvailabilityResult -AvailabilityInput $inputObject

if ($ReportDir) {
  New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
  $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $ReportDir "chatgpt_bridge_availability.json") -Encoding UTF8
}

$result | ConvertTo-Json -Depth 10
if ($result.ready) { exit 0 }
exit 2
