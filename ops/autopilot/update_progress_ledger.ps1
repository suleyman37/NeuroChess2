param(
  [string]$EntryJson = "",
  [string]$InputPath = "",
  [string]$LedgerPath = "",
  [string]$RuntimeDir = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultRuntimeDir {
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE "AgentOS\runtime") }
  return "C:\Users\suley\AgentOS\runtime"
}

function Read-EntryInput {
  if ($EntryJson) { return ($EntryJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -EntryJson or -InputPath."
}

function Test-EntryObject {
  param($Entry)
  $violations = @()
  foreach ($field in @("schema_version", "session_id", "mission_id", "mission_hash", "started_at", "ended_at", "status", "forward_progress")) {
    if ($null -eq $Entry.PSObject.Properties[$field]) { $violations += "missing field: $field" }
  }
  if ($Entry.PSObject.Properties["schema_version"] -and $Entry.schema_version -ne "A16B_progress_ledger_entry_v1") {
    $violations += "schema_version must be A16B_progress_ledger_entry_v1"
  }
  return @($violations)
}

if (-not $LedgerPath) {
  if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultRuntimeDir }
  $LedgerPath = Join-Path $RuntimeDir "progress_ledger.jsonl"
}

try {
  $entry = Read-EntryInput
  $violations = @(Test-EntryObject -Entry $entry)
  if ($violations.Count -gt 0) { throw "Invalid progress ledger entry: $($violations -join '; ')" }

  $parent = Split-Path -Parent $LedgerPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $beforeCount = if (Test-Path -LiteralPath $LedgerPath) { @((Get-Content -LiteralPath $LedgerPath) | Where-Object { $_.Trim() }).Count } else { 0 }
  $line = $entry | ConvertTo-Json -Compress -Depth 20
  Add-Content -LiteralPath $LedgerPath -Value $line -Encoding UTF8
  $afterCount = @((Get-Content -LiteralPath $LedgerPath) | Where-Object { $_.Trim() }).Count

  [ordered]@{
    status = "appended"
    ledger_path = $LedgerPath
    before_count = $beforeCount
    after_count = $afterCount
    append_only = ($afterCount -eq ($beforeCount + 1))
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    error = $_.Exception.Message
    ledger_path = $LedgerPath
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
