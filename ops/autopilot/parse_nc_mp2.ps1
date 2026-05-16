param(
  [string]$RawText = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Read-NcMp2Text {
  if ($RawText) { return $RawText }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return Get-Content -LiteralPath $InputPath -Raw
  }
  throw "Provide -RawText or -InputPath."
}

function Split-ListValue {
  param([string]$Value)
  return @($Value -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

$requiredFields = @("id", "tier", "type", "goal", "allow", "deny", "max_files", "max_diff", "checks", "stop", "commit", "intent")
$listFields = @("allow", "deny", "checks", "stop")

try {
  $text = Read-NcMp2Text
  $text = $text.Trim([char]0xFEFF)
  $lines = @($text -split "`r?`n")
  $errors = [System.Collections.Generic.List[string]]::new()
  $fields = [ordered]@{}
  $seen = @{}

  if ($lines.Count -eq 0 -or $lines[0].Trim() -ne "NC-MP/2") {
    $errors.Add("first line must be NC-MP/2") | Out-Null
  }

  $nonEmptyLines = @($lines | Where-Object { $_.Trim() })
  if ($nonEmptyLines.Count -eq 0 -or $nonEmptyLines[-1].Trim() -ne "DONE") {
    $errors.Add("DONE required as final token") | Out-Null
  }

  for ($i = 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].Trim()
    if (-not $line) { continue }
    if ($line -eq "DONE") {
      $laterNonEmpty = @()
      if ($i -lt ($lines.Count - 1)) {
        $laterNonEmpty = @($lines[($i + 1)..($lines.Count - 1)] | Where-Object { $_.Trim() })
      }
      if ($laterNonEmpty.Count -gt 0) { $errors.Add("DONE must be final line") | Out-Null }
      continue
    }
    if ($line -notmatch "^([A-Za-z0-9_]+)=(.*)$") {
      $errors.Add("non protocol line found: $line") | Out-Null
      continue
    }
    $key = $matches[1].Trim().ToLowerInvariant()
    $value = $matches[2].Trim()
    if ($seen.ContainsKey($key)) {
      $errors.Add("duplicate field: $key") | Out-Null
      continue
    }
    $seen[$key] = $true
    if ($listFields -contains $key) {
      $fields[$key] = @(Split-ListValue $value)
    } else {
      $fields[$key] = $value
    }
  }

  foreach ($field in $requiredFields) {
    if (-not $fields.Contains($field)) {
      $errors.Add("missing required field: $field") | Out-Null
    } elseif ($listFields -contains $field) {
      if (@($fields[$field]).Count -eq 0) { $errors.Add("empty required list field: $field") | Out-Null }
    } elseif (-not ([string]$fields[$field]).Trim()) {
      $errors.Add("empty required field: $field") | Out-Null
    }
  }

  $payload = [ordered]@{
    valid_parse = ($errors.Count -eq 0)
    fields = $fields
    errors = @($errors)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $payload | ConvertTo-Json -Depth 20
  if ($errors.Count -eq 0) { exit 0 }
  exit 1
} catch {
  [ordered]@{
    valid_parse = $false
    fields = [ordered]@{}
    errors = @($_.Exception.Message)
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
