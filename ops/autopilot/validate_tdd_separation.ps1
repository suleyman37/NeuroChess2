param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\tdd_validation" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$classification = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_tdd_phase.ps1") -MissionJson $MissionJson -OutDir $OutDir) | ConvertFrom-Json
$mission = Get-Content -LiteralPath $MissionJson -Raw | ConvertFrom-Json
$risk = ([string]$mission.risk_tier).ToLowerInvariant()
$phase = [string]$classification.tdd_phase
$reasons = [System.Collections.Generic.List[string]]::new()
$violations = [System.Collections.Generic.List[string]]::new()

foreach ($reason in @($classification.reasons)) { $reasons.Add([string]$reason) | Out-Null }
foreach ($violation in @($classification.violations)) { $violations.Add([string]$violation) | Out-Null }

if (-not [bool]$classification.valid) {
  $violations.Add("classification invalid") | Out-Null
}

if (($risk -eq "amber" -or $risk -eq "red") -and $phase -eq "mixed_invalid") {
  $violations.Add("mixed test and implementation mission rejected for amber/red") | Out-Null
}

if ($phase -eq "implementation" -and ($risk -eq "amber" -or $risk -eq "red")) {
  $hasPrior =
    -not [string]::IsNullOrWhiteSpace([string]$mission.prior_test_contract_id) -or
    -not [string]::IsNullOrWhiteSpace([string]$mission.prior_test_commit) -or
    -not [string]::IsNullOrWhiteSpace([string]$mission.prior_test_evidence_pack)
  if (-not $hasPrior) {
    $violations.Add("amber/red implementation requires prior test contract id, commit, or evidence pack") | Out-Null
  }
}

if ($phase -eq "unknown") {
  $violations.Add("unknown TDD phase rejected") | Out-Null
}

$valid = $violations.Count -eq 0
$result = [ordered]@{
  valid = $valid
  tdd_phase = $phase
  risk_tier = $risk
  reasons = @($reasons)
  violations = @($violations)
  product_execution = $false
  mission_json = (Resolve-Path $MissionJson).Path
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "tdd_separation_validation.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
if (-not $valid) { exit 1 }
exit 0
