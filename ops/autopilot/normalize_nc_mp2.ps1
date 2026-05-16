param(
  [string]$RawText = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Parser {
  $script = Join-Path $PSScriptRoot "parse_nc_mp2.ps1"
  if ($RawText) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -RawText $RawText 2>&1
  } elseif ($InputPath) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -InputPath $InputPath 2>&1
  } else {
    throw "Provide -RawText or -InputPath."
  }
  $raw = ($output -join "`n")
  $json = $raw | ConvertFrom-Json
  return [ordered]@{ exit_code = $LASTEXITCODE; json = $json; raw = $raw }
}

function Normalize-Text {
  param($Value, [switch]$Lower)
  if ($null -eq $Value) { return "" }
  $text = ([string]$Value -replace "\s+", " ").Trim()
  if ($Lower) { $text = $text.ToLowerInvariant() }
  return $text
}

function Normalize-Path {
  param($Value)
  return ((Normalize-Text $Value) -replace "\\", "/")
}

function Normalize-List {
  param($Value, [switch]$PathLike)
  $items = @()
  foreach ($item in @($Value)) {
    $normalized = if ($PathLike) { Normalize-Path $item } else { Normalize-Text $item }
    if ($normalized) { $items += $normalized }
  }
  return @($items | Sort-Object -Unique)
}

try {
  $parsed = Invoke-Parser
  if (-not [bool]$parsed.json.valid_parse) {
    [ordered]@{
      normalized = $false
      errors = @($parsed.json.errors)
      live_chatgpt_called = $false
      product_mission_executed = $false
      codex_execution = $false
      commit = $false
      push = $false
    } | ConvertTo-Json -Depth 10
    exit 1
  }

  $fields = $parsed.json.fields
  $normalized = [ordered]@{
    id = Normalize-Text $fields.id
    tier = Normalize-Text $fields.tier -Lower
    type = Normalize-Text $fields.type -Lower
    goal = Normalize-Text $fields.goal
    allow = @(Normalize-List $fields.allow -PathLike)
    deny = @(Normalize-List $fields.deny -PathLike)
    max_files = Normalize-Text $fields.max_files
    max_diff = Normalize-Text $fields.max_diff
    checks = @(Normalize-List $fields.checks)
    stop = @(Normalize-List $fields.stop)
    commit = Normalize-Text $fields.commit -Lower
    intent = Normalize-Text $fields.intent
  }

  foreach ($property in $fields.PSObject.Properties) {
    if (-not $normalized.Contains($property.Name)) {
      $normalized[$property.Name] = Normalize-Text $property.Value
    }
  }

  $missionHashInput = [ordered]@{
    mission_id = $normalized.id
    risk_tier = $normalized.tier
    work_type = $normalized.type
    goal = $normalized.goal
    allowed_paths = @($normalized.allow)
    forbidden_paths = @($normalized.deny)
    expected_changed_files = @($normalized.allow)
    max_files = $normalized.max_files
    max_diff_lines = $normalized.max_diff
    required_checks = @($normalized.checks)
    stop_conditions = @($normalized.stop)
    compact_intent = $normalized.intent
  }

  [ordered]@{
    normalized = $true
    fields = $normalized
    mission_hash_input = $missionHashInput
    errors = @()
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    normalized = $false
    errors = @($_.Exception.Message)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
