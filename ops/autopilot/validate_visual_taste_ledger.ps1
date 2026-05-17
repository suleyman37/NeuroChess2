param(
  [string]$LedgerPath
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

if (-not $LedgerPath) { throw "LedgerPath is required" }
$fullPath = Resolve-PathFromRepo -Path $LedgerPath
if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Ledger not found: $fullPath" }

$validVerdicts = @("LOVE", "LIKE", "NEUTRAL", "DISLIKE", "REJECT")
$required = @("schema_version", "timestamp", "artifact_path", "surface", "branch", "verdict", "reason", "visual_traits", "what_to_repeat", "what_to_avoid", "related_reference", "neurochess_relevance", "notes")
$entries = 0
$violations = New-Object System.Collections.Generic.List[string]

foreach ($line in Get-Content -LiteralPath $fullPath) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $entries += 1
  try {
    $entry = $line | ConvertFrom-Json
  } catch {
    $violations.Add("line_${entries}: invalid JSON") | Out-Null
    continue
  }
  foreach ($field in $required) {
    if ($null -eq $entry.PSObject.Properties[$field]) { $violations.Add("line_${entries}: missing $field") | Out-Null }
  }
  if ($entry.verdict -and $validVerdicts -notcontains [string]$entry.verdict) {
    $violations.Add("line_${entries}: invalid verdict $($entry.verdict)") | Out-Null
  }
}

$resultName = if ($violations.Count -gt 0) { "FAIL" } else { "PASS" }
[ordered]@{
  visual_taste_ledger_result = $resultName
  entries = $entries
  violations = @($violations)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 10
if ($violations.Count -gt 0) { exit 2 }
exit 0
