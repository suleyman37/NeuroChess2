param(
  [string]$MissionJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-MissionInput {
  if ($MissionJson) { return ($MissionJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -MissionJson or -InputPath."
}

function Get-ObjectValue {
  param($Object, [string]$Name, $Default = "")
  if ($null -eq $Object) { return $Default }
  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name)) { return $Object[$Name] }
    return $Default
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) { return $property.Value }
  return $Default
}

function Normalize-Text {
  param($Value, [switch]$Lower)
  if ($null -eq $Value) { return "" }
  $text = [string]$Value
  $text = ($text -replace "\s+", " ").Trim()
  if ($Lower) { $text = $text.ToLowerInvariant() }
  return $text
}

function Normalize-PathText {
  param($Value)
  $text = Normalize-Text $Value
  return (($text -replace "\\", "/").Trim())
}

function Convert-ToList {
  param($Value, [switch]$SplitListStrings)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if ($SplitListStrings) {
      return @($Value -split "[,;`r`n]+" | ForEach-Object { $_ } | Where-Object { $_ -ne $null })
    }
    return @($Value)
  }
  if ($Value -is [System.Collections.IEnumerable]) {
    $items = @()
    foreach ($item in $Value) { $items += $item }
    return $items
  }
  return @($Value)
}

function Normalize-TextArray {
  param($Value, [switch]$PathLike, [switch]$Lower, [switch]$SplitListStrings)
  $items = Convert-ToList -Value $Value -SplitListStrings:$SplitListStrings
  $normalized = @()
  foreach ($item in $items) {
    $entry = if ($PathLike) { Normalize-PathText $item } else { Normalize-Text $item -Lower:$Lower }
    if ($entry) { $normalized += $entry }
  }
  return @($normalized | Sort-Object -Unique)
}

function Get-MissionHashBasis {
  param($Mission)
  return [ordered]@{
    mission_id = Normalize-Text (Get-ObjectValue $Mission "mission_id")
    risk_tier = Normalize-Text (Get-ObjectValue $Mission "risk_tier") -Lower
    work_type = Normalize-Text (Get-ObjectValue $Mission "work_type") -Lower
    goal = Normalize-Text (Get-ObjectValue $Mission "goal")
    allowed_paths = @(Normalize-TextArray (Get-ObjectValue $Mission "allowed_paths") -PathLike -SplitListStrings)
    forbidden_paths = @(Normalize-TextArray (Get-ObjectValue $Mission "forbidden_paths") -PathLike -SplitListStrings)
    expected_changed_files = @(Normalize-TextArray (Get-ObjectValue $Mission "expected_changed_files") -PathLike -SplitListStrings)
    max_files = Normalize-Text (Get-ObjectValue $Mission "max_files")
    max_diff_lines = Normalize-Text (Get-ObjectValue $Mission "max_diff_lines")
    required_checks = @(Normalize-TextArray (Get-ObjectValue $Mission "required_checks") -SplitListStrings)
    stop_conditions = @(Normalize-TextArray (Get-ObjectValue $Mission "stop_conditions") -SplitListStrings)
    codex_prompt = Normalize-Text (Get-ObjectValue $Mission "codex_prompt")
    compact_intent = Normalize-Text (Get-ObjectValue $Mission "compact_intent")
  }
}

function Get-RequiredFieldViolations {
  param($Mission)
  $violations = @()
  foreach ($field in @("risk_tier", "work_type", "goal", "allowed_paths", "forbidden_paths", "expected_changed_files", "max_files", "max_diff_lines", "required_checks", "stop_conditions")) {
    $value = Get-ObjectValue $Mission $field $null
    if ($null -eq $value -or (Normalize-Text $value) -eq "") {
      $violations += "missing or empty field: $field"
    }
  }
  return @($violations)
}

function Get-Sha256Hex {
  param([string]$Text)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash($bytes)
    return (-join ($hashBytes | ForEach-Object { $_.ToString("x2") }))
  } finally {
    $sha.Dispose()
  }
}

try {
  $mission = Read-MissionInput
  $basis = Get-MissionHashBasis -Mission $mission
  $canonical = $basis | ConvertTo-Json -Compress -Depth 20
  $violations = @(Get-RequiredFieldViolations -Mission $mission)
  $payload = [ordered]@{
    mission_hash = Get-Sha256Hex -Text $canonical
    normalized_fields = $basis
    hash_basis_summary = "sha256 over normalized mission contract fields"
    validation_warnings = @($violations)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    repo_files_modified = $false
    commit = $false
    push = $false
  }
  $payload | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    error = $_.Exception.Message
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    repo_files_modified = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
