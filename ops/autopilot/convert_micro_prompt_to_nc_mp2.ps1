param(
  [string]$RawText = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-PromptText {
  if ($RawText) { return $RawText }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return Get-Content -LiteralPath $InputPath -Raw
  }
  throw "Provide -RawText or -InputPath."
}

function Normalize-FieldName {
  param([string]$Name)
  $name = $Name.Trim().ToLowerInvariant() -replace "[ -]", "_"
  switch ($name) {
    "mission_id" { return "id" }
    "id" { return "id" }
    "risk_tier" { return "tier" }
    "tier" { return "tier" }
    "work_type" { return "type" }
    "type" { return "type" }
    "allowed_paths" { return "allow" }
    "allow" { return "allow" }
    "forbidden_paths" { return "deny" }
    "deny" { return "deny" }
    "max_diff_lines" { return "max_diff" }
    "max_diff" { return "max_diff" }
    "required_checks" { return "checks" }
    "checks" { return "checks" }
    "stop_conditions" { return "stop" }
    "stop" { return "stop" }
    "commit_policy" { return "commit" }
    "commit" { return "commit" }
    "codex_prompt" { return "intent" }
    "intent" { return "intent" }
    "goal" { return "goal" }
    "max_files" { return "max_files" }
    default { return "" }
  }
}

function Clean-Value {
  param([string]$Value)
  $value = $Value.Trim()
  $value = $value.TrimStart("-").Trim()
  return ($value -replace "\s+", " ")
}

try {
  $text = Read-PromptText
  $fields = [ordered]@{}
  foreach ($line in @($text -split "`r?`n")) {
    if ($line -match "^\s*[-*]?\s*([A-Za-z_ -]+)\s*[:=]\s*(.+?)\s*$") {
      $key = Normalize-FieldName $matches[1]
      if ($key) {
        if (-not $fields.Contains($key)) { $fields[$key] = Clean-Value $matches[2] }
      }
    }
  }

  $required = @("id", "tier", "type", "goal", "allow", "deny", "max_files", "max_diff", "checks", "stop", "commit", "intent")
  $missing = @()
  foreach ($field in $required) {
    if (-not $fields.Contains($field) -or -not ([string]$fields[$field]).Trim()) { $missing += $field }
  }
  if ($missing.Count -gt 0) {
    [ordered]@{
      converted = $false
      errors = @("missing required field(s): $($missing -join ', ')")
      nc_mp2_text = ""
      live_chatgpt_called = $false
      product_mission_executed = $false
      codex_execution = $false
      commit = $false
      push = $false
    } | ConvertTo-Json -Depth 10
    exit 1
  }

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("NC-MP/2")
  foreach ($field in $required) {
    $lines.Add("$field=$($fields[$field])")
  }
  $lines.Add("DONE")
  $ncMp2Text = ($lines -join "`n")

  [ordered]@{
    converted = $true
    errors = @()
    nc_mp2_text = $ncMp2Text
    fields = $fields
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    converted = $false
    errors = @($_.Exception.Message)
    nc_mp2_text = ""
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
