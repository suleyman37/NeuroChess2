param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [string]$OutDir = "",
  [string]$TestContractId = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\tdd_evidence" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$missionRaw = Get-Content -LiteralPath $MissionJson -Raw
$mission = $missionRaw | ConvertFrom-Json
$classification = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_tdd_phase.ps1") -MissionJson $MissionJson -OutDir $OutDir) | ConvertFrom-Json

$contractId = if ($TestContractId) { $TestContractId } elseif ($mission.prior_test_contract_id) { [string]$mission.prior_test_contract_id } else { "BLOCKING: prior test contract id required" }

Set-Content -LiteralPath (Join-Path $OutDir "mission_brief.md") -Value $missionRaw -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "test_contract_id.txt") -Value $contractId -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "prior_test_commit.txt") -Value "BLOCKING: prior test commit not supplied." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "failing_test_before_implementation.log") -Value "BLOCKING: failing test log before implementation required." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "passing_test_after_implementation.log") -Value "BLOCKING: passing test log after implementation required." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "implementation_diff.patch") -Value "BLOCKING: implementation diff not captured yet." -Encoding UTF8
Set-Content -LiteralPath (Join-Path $OutDir "validation_summary.md") -Value "BLOCKING: validation summary not complete." -Encoding UTF8

$blockingItems = @(
  "prior_test_commit.txt",
  "failing_test_before_implementation.log",
  "passing_test_after_implementation.log",
  "implementation_diff.patch",
  "validation_summary.md"
)
if ($contractId -like "BLOCKING:*") {
  $blockingItems += "test_contract_id.txt"
}

$manifest = [ordered]@{
  schema_version = "A7_tdd_evidence_pack"
  status = "BLOCKED"
  reason = "TDD evidence placeholders are blocking"
  mission_id = [string]$mission.id
  tdd_phase = [string]$classification.tdd_phase
  evidence_dir = $OutDir
  blocking_items = $blockingItems
  product_execution = $false
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "manifest.json") -Encoding UTF8
$manifest | ConvertTo-Json -Depth 10
