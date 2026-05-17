param(
  [string]$InputPath = "",
  [string]$MissionJson = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonInput {
  param([string]$Path, [string]$RawJson)
  if ($RawJson) { return ($RawJson | ConvertFrom-Json) }
  if ($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Mission input not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  throw "Provide -InputPath or -MissionJson."
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Get-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [array]) { return @($Value) }
  return @($Value)
}

function Add-Reason {
  param([System.Collections.Generic.List[string]]$Reasons, [string]$Message)
  if ($Message -and -not $Reasons.Contains($Message)) { $Reasons.Add($Message) | Out-Null }
}

try {
  $mission = Read-JsonInput -Path $InputPath -RawJson $MissionJson
  $reasons = [System.Collections.Generic.List[string]]::new()
  $quarantined = [System.Collections.Generic.List[string]]::new()

  $deltaLines = [int](Get-Field $mission "planned_logical_delta_lines" 0)
  $modifiedFiles = [int](Get-Field $mission "planned_modified_files_count" 0)
  $diffLines = [int](Get-Field $mission "planned_diff_lines" 0)
  $docsApproved = [bool](Get-Field $mission "docs_approved" $false)
  $impact = ([string](Get-Field $mission "product_impact_category" "")).ToUpperInvariant()
  $hasE2e = [bool](Get-Field $mission "has_e2e_deliverable" $false)
  $friction = [bool](Get-Field $mission "product_friction_reduction" $false)
  $safetyUnlock = [bool](Get-Field $mission "safety_critical_unlock" $false)
  $failedCount = [int](Get-Field $mission "same_file_failed_attempt_count" 0)
  $failedFile = [string](Get-Field $mission "same_file_failed_path" "")

  $verdict = "GOLDILOCKS_PASS"
  $allowed = $true
  $recommended = "CONTINUE"

  if ($failedCount -ge 3) {
    $verdict = "PING_PONG_FILE_LOCK"
    $allowed = $false
    $recommended = "QUARANTINE_FILE"
    if ($failedFile) { $quarantined.Add($failedFile) | Out-Null }
    Add-Reason $reasons "Same file failed in three consecutive missions."
  } elseif ($modifiedFiles -gt 7 -or $diffLines -gt 350) {
    $verdict = "BLAST_RADIUS_REJECT"
    $allowed = $false
    $recommended = "SPLIT_REQUIRED"
    Add-Reason $reasons "Planned scope exceeds Goldilocks blast-radius limits."
  } elseif ($deltaLines -lt 15 -and -not $docsApproved -and -not $hasE2e -and -not $friction -and -not $safetyUnlock) {
    $verdict = "TINY_MISSION_REJECT"
    $allowed = $false
    $recommended = "REQUEST_LARGER_VALUE_SLICE"
    Add-Reason $reasons "Planned logical delta is below threshold without product or safety value."
  } elseif ($deltaLines -lt 15 -and $docsApproved -and -not ($impact -eq "PRODUCT_ENABLER" -or $impact -eq "SAFETY_CRITICAL")) {
    $verdict = "TINY_MISSION_REJECT"
    $allowed = $false
    $recommended = "REQUEST_PRODUCT_IMPACT_REPAIR"
    Add-Reason $reasons "Docs-only tiny mission lacks PRODUCT_ENABLER or SAFETY_CRITICAL impact."
  } else {
    Add-Reason $reasons "Mission scope is within Goldilocks limits."
  }

  [ordered]@{
    verdict = $verdict
    allowed = $allowed
    recommended_action = $recommended
    reasons = @($reasons)
    quarantined_files = @($quarantined)
    thresholds = [ordered]@{
      tiny_logic_delta_lines = 15
      max_modified_files = 7
      max_diff_lines = 350
      ping_pong_failed_write_threshold = 3
    }
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    verdict = "SPLIT_REQUIRED"
    allowed = $false
    recommended_action = "REPAIR_INPUT"
    reasons = @($_.Exception.Message)
    quarantined_files = @()
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
