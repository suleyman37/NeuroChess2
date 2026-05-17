param(
  [string]$LedgerPath,
  [string]$EntryJsonPath,
  [string]$EntryJson
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

if (-not $LedgerPath) {
  $LedgerPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\visual_taste_ledger.jsonl"
}
if ($EntryJsonPath) {
  $entry = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $EntryJsonPath) -Raw | ConvertFrom-Json
} elseif ($EntryJson) {
  $entry = $EntryJson | ConvertFrom-Json
} else {
  throw "EntryJsonPath or EntryJson is required"
}

$validVerdicts = @("LOVE", "LIKE", "NEUTRAL", "DISLIKE", "REJECT")
if ($validVerdicts -notcontains [string]$entry.verdict) { throw "Invalid taste verdict: $($entry.verdict)" }

$record = [ordered]@{
  schema_version = "A20E_visual_taste_ledger_entry_v1"
  timestamp = $(if ($entry.timestamp) { [string]$entry.timestamp } else { (Get-Date).ToUniversalTime().ToString("o") })
  artifact_path = [string]$entry.artifact_path
  surface = [string]$entry.surface
  branch = [string]$entry.branch
  verdict = [string]$entry.verdict
  reason = [string]$entry.reason
  visual_traits = @($entry.visual_traits)
  what_to_repeat = @($entry.what_to_repeat)
  what_to_avoid = @($entry.what_to_avoid)
  related_reference = [string]$entry.related_reference
  neurochess_relevance = [string]$entry.neurochess_relevance
  notes = [string]$entry.notes
}

$ledgerFullPath = Resolve-PathFromRepo -Path $LedgerPath
$ledgerDir = Split-Path -Parent $ledgerFullPath
if ($ledgerDir) { New-Item -ItemType Directory -Force -Path $ledgerDir | Out-Null }
Add-Content -LiteralPath $ledgerFullPath -Value ($record | ConvertTo-Json -Depth 10 -Compress) -Encoding UTF8

[ordered]@{
  append_result = "PASS"
  ledger_path = $ledgerFullPath
  verdict = $record.verdict
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 10
exit 0
