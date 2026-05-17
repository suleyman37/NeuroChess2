param(
  [string]$PacketPath,
  [string]$GeminiResultPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-PathFromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

function Get-FieldValue {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

if (-not $PacketPath) { throw "PacketPath is required" }
if (-not $GeminiResultPath) { throw "GeminiResultPath is required" }

$packet = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $PacketPath) -Raw | ConvertFrom-Json
$gemini = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $GeminiResultPath) -Raw | ConvertFrom-Json

$expectedVerdict = [string]$packet.expected_verdict
$actualVerdict = [string]$gemini.verdict
$missedClaims = New-Object System.Collections.Generic.List[string]

if ($expectedVerdict -eq "BLOCK_VISUAL" -and $actualVerdict -ne "BLOCK_VISUAL") {
  $missedClaims.Add("expected BLOCK_VISUAL, got $actualVerdict") | Out-Null
} elseif ($expectedVerdict -eq "WARNING_VISUAL" -and (@("WARNING_VISUAL", "BLOCK_VISUAL") -notcontains $actualVerdict)) {
  $missedClaims.Add("expected WARNING_VISUAL or BLOCK_VISUAL, got $actualVerdict") | Out-Null
}

foreach ($claim in @($packet.mandatory_unsafe_claims)) {
  $value = Get-FieldValue -Object $gemini.visual_checks -Name ([string]$claim)
  if (-not [bool]$value) {
    $missedClaims.Add([string]$claim) | Out-Null
  }
}

$failed = ($missedClaims.Count -gt 0)
$result = [ordered]@{
  canary_result = $(if ($failed) { "STOP_AUDITOR_CANARY_FAILED" } else { "PASS" })
  missed_claims = $missedClaims.ToArray()
  recommended_action = $(if ($failed) { "QUARANTINE" } else { "CONTINUE" })
  gemini_verdict = $actualVerdict
  canary_type = [string]$packet.canary_type
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($failed) { exit 2 }
exit 0
