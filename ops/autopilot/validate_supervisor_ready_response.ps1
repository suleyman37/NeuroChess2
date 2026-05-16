param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce,
  [string]$ProjectName = "NeuroChess Supervisor",
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"

function Get-TagText {
  param([string]$Raw, [string]$Tag)
  $match = [regex]::Match($Raw, "<$Tag>\s*(.*?)\s*</$Tag>", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $match.Success) { return $null }
  return $match.Groups[1].Value.Trim()
}

function Add-Violation {
  param([System.Collections.Generic.List[string]]$List, [string]$Message)
  $List.Add($Message) | Out-Null
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "READY response not found: $InputPath"
}

$raw = Get-Content -LiteralPath $InputPath -Raw
$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$canaryResults = [ordered]@{}

$openMatches = [regex]::Matches($raw, '<NC_SUPERVISOR_READY\s+nonce="([^"]+)">')
if ($openMatches.Count -ne 1) {
  Add-Violation -List $violations -Message "expected exactly one NC_SUPERVISOR_READY opening tag"
}
$openNonce = if ($openMatches.Count -ge 1) { $openMatches[0].Groups[1].Value } else { "" }
if ($openNonce -ne $Nonce) {
  Add-Violation -List $violations -Message "opening nonce mismatch"
}

$donePattern = '<NC_DONE\s+nonce="' + [regex]::Escape($Nonce) + '">DONE</NC_DONE>'
if (-not [regex]::IsMatch($raw, $donePattern)) {
  Add-Violation -List $violations -Message "missing nonce-bound NC_DONE"
}

$project = Get-TagText -Raw $raw -Tag "PROJECT"
if ($project -ne $ProjectName) {
  Add-Violation -List $violations -Message "PROJECT must be $ProjectName"
}

$ready = Get-TagText -Raw $raw -Tag "READY"
if ($ready -ne "YES") {
  Add-Violation -List $violations -Message "READY must be YES"
}

$canaryBlock = Get-TagText -Raw $raw -Tag "CANARY_CHECKS"
if (-not $canaryBlock) {
  Add-Violation -List $violations -Message "missing CANARY_CHECKS"
} else {
  foreach ($check in @(
    "nonce_protocol",
    "micro_prompt_only",
    "forbidden_paths_known",
    "red_tier_known",
    "git_add_A_forbidden"
  )) {
    $pattern = "(?m)^\s*$([regex]::Escape($check))\s*:\s*(PASS|FAIL)\s*$"
    $match = [regex]::Match($canaryBlock, $pattern)
    if (-not $match.Success) {
      Add-Violation -List $violations -Message "missing canary $check"
      $canaryResults[$check] = "MISSING"
    } else {
      $value = $match.Groups[1].Value
      $canaryResults[$check] = $value
      if ($value -ne "PASS") {
        Add-Violation -List $violations -Message "canary $check is $value"
      }
    }
  }
}

if ($ReportDir) {
  New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
}

$valid = $violations.Count -eq 0
$result = [ordered]@{
  valid = $valid
  validation_result = if ($valid) { "PASS" } else { "FAIL" }
  project = $project
  ready = $ready
  canary_checks = $canaryResults
  violations = @($violations)
  warnings = @($warnings)
  live_chatgpt_called = $false
  product_mission_executed = $false
}

if ($ReportDir) {
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $ReportDir "supervisor_ready_validation.json") -Encoding UTF8
}

$result | ConvertTo-Json -Depth 8
if ($valid) { exit 0 } else { exit 1 }
