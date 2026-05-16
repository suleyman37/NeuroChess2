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

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Test-EntryObject {
  param($Entry)
  $required = @(
    "schema_version", "prompt_id", "mission_id", "session_id", "created_at",
    "prompt_source", "prompt_format", "prompt_hash", "risk_tier", "work_type",
    "goal", "allowed_paths", "expected_changed_files", "max_files",
    "max_diff_lines", "prompt_firewall_result", "mission_contract_result",
    "execution_status", "stop_reason", "checks_required", "checks_run",
    "checks_passed", "prompt_execution_score", "lessons"
  )
  $violations = @()
  foreach ($field in $required) {
    if (-not (Has-Property $Entry $field)) { $violations += "missing field: $field" }
  }
  if ((Has-Property $Entry "schema_version") -and $Entry.schema_version -ne "A16F_prompt_ledger_entry_v1") {
    $violations += "schema_version must be A16F_prompt_ledger_entry_v1"
  }
  return @($violations)
}

if (-not $LedgerPath) {
  if (-not $RuntimeDir) { $RuntimeDir = Get-DefaultRuntimeDir }
  $LedgerPath = Join-Path $RuntimeDir "prompt_ledger.jsonl"
}

try {
  $entry = Read-EntryInput
  $violations = @(Test-EntryObject -Entry $entry)
  if ($violations.Count -gt 0) { throw "Invalid prompt ledger entry: $($violations -join '; ')" }
  $parent = Split-Path -Parent $LedgerPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $beforeCount = if (Test-Path -LiteralPath $LedgerPath) { @((Get-Content -LiteralPath $LedgerPath) | Where-Object { $_.Trim() }).Count } else { 0 }
  Add-Content -LiteralPath $LedgerPath -Value ($entry | ConvertTo-Json -Compress -Depth 30) -Encoding UTF8
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
    ledger_path = $LedgerPath
    error = $_.Exception.Message
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
