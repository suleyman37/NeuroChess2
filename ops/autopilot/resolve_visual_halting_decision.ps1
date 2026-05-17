param(
  [string]$InputPath
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

if (-not $InputPath) { throw "InputPath is required" }
$input = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $InputPath) -Raw | ConvertFrom-Json

$fixAttempts = if ($null -ne $input.fix_attempts_used) { [int]$input.fix_attempts_used } else { 0 }
$providerResults = @($input.provider_results)
$current = $input.current_visual_result
$verdict = if ($current -and $current.verdict) { [string]$current.verdict } else { $null }
$fatalClaims = if ($current -and $null -ne $current.fatal_claims_detected) { [bool]$current.fatal_claims_detected } else { $false }
$hasProvider = ($providerResults.Count -gt 0 -or $null -ne $verdict)
$hasBlock = $false
$hasWarning = $false
$hasPass = $false
foreach ($result in $providerResults) {
  if ([string]$result.verdict -eq "BLOCK_VISUAL") { $hasBlock = $true }
  if ([string]$result.verdict -eq "WARNING_VISUAL") { $hasWarning = $true }
  if ([string]$result.verdict -eq "PASS_VISUAL") { $hasPass = $true }
}
if ($verdict -eq "BLOCK_VISUAL") { $hasBlock = $true }
if ($verdict -eq "WARNING_VISUAL") { $hasWarning = $true }
if ($verdict -eq "PASS_VISUAL") { $hasPass = $true }

if (-not $hasProvider) {
  $visualResult = "NEEDS_REWORK"
  $action = "CLASSIFY_BRANCH"
  $classification = "NEEDS_REWORK"
  $reason = "No visual provider result is available; frontend branch cannot count as full E2E."
} elseif ($hasBlock -and ($hasPass -or $hasWarning)) {
  $visualResult = $(if ($fatalClaims) { "QUARANTINE_REQUIRED" } else { "NEEDS_REWORK" })
  $action = $(if ($fatalClaims) { "QUARANTINE" } else { "CLASSIFY_BRANCH" })
  $classification = $visualResult
  $reason = "Provider disagreement includes BLOCK_VISUAL; no automatic READY_TO_REVIEW."
} elseif ($hasBlock) {
  $visualResult = $(if ($fatalClaims) { "QUARANTINE_REQUIRED" } else { "NEEDS_REWORK" })
  $action = $(if ($fatalClaims) { "QUARANTINE" } else { "CLASSIFY_BRANCH" })
  $classification = $visualResult
  $reason = "BLOCK_VISUAL stops visual iteration for the long run."
} elseif ($hasWarning -and $fixAttempts -lt 1) {
  $visualResult = "ONE_SHOT_FIX_ALLOWED"
  $action = "FIX_ONCE"
  $classification = $null
  $reason = "First WARNING_VISUAL allows one semantic fix attempt."
} elseif ($hasWarning) {
  $visualResult = "READY_WITH_VISUAL_DEBT"
  $action = "CLASSIFY_BRANCH"
  $classification = "READY_TO_REVIEW_WITH_VISUAL_DEBT"
  $reason = "Warning remains after one attempt; stop pixel pushing and record visual debt."
} elseif ($hasPass) {
  $visualResult = "CONTINUE"
  $action = "CONTINUE"
  $classification = "READY_TO_REVIEW"
  $reason = "PASS_VISUAL with no blocking provider disagreement."
} else {
  $visualResult = "NEEDS_REWORK"
  $action = "CLASSIFY_BRANCH"
  $classification = "NEEDS_REWORK"
  $reason = "Unrecognized visual verdict state."
}

$result = [ordered]@{
  visual_halting_result = $visualResult
  fix_attempts_used = $fixAttempts
  recommended_action = $action
  final_classification = $classification
  reason = $reason
  provider_results = $providerResults
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
