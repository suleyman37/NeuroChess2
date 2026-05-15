param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
if (-not $OutDir) { $OutDir = Split-Path -Parent (Resolve-Path $InputPath) }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-Extraction {
  param([hashtable]$Payload, [int]$ExitCode)
  $json = $Payload | ConvertTo-Json -Depth 12
  Set-Content -LiteralPath (Join-Path $OutDir "supervisor_extraction.json") -Value $json -Encoding UTF8
  Write-Output $json
  exit $ExitCode
}

$raw = Get-Content -LiteralPath $InputPath -Raw
$trim = $raw.Trim()
$escapedNonce = [regex]::Escape($Nonce)

if (-not $trim) {
  Write-Extraction @{ valid = $false; reason = "empty_response"; nonce = $Nonce } 1
}

$rootMatch = [regex]::Match($trim, '^\s*<NC_SUPERVISOR_RESPONSE nonce="([^"]+)">')
if (-not $rootMatch.Success) {
  Write-Extraction @{ valid = $false; reason = "missing_supervisor_response_root"; nonce = $Nonce } 1
}
if ($rootMatch.Groups[1].Value -ne $Nonce) {
  Write-Extraction @{ valid = $false; reason = "wrong nonce"; expected_nonce = $Nonce; observed_nonce = $rootMatch.Groups[1].Value } 1
}

if ($trim -notmatch '</NC_SUPERVISOR_RESPONSE>\s*$') {
  Write-Extraction @{ valid = $false; reason = "text_after_final_response_block_or_missing_close"; nonce = $Nonce } 1
}

$doneMatches = [regex]::Matches($trim, '<NC_DONE nonce="([^"]+)">DONE</NC_DONE>')
if ($doneMatches.Count -eq 0) {
  Write-Extraction @{ valid = $false; reason = "missing DONE"; nonce = $Nonce } 1
}
if ($doneMatches.Count -gt 1) {
  Write-Extraction @{ valid = $false; reason = "duplicated DONE"; nonce = $Nonce; count = $doneMatches.Count } 1
}
if ($doneMatches[0].Groups[1].Value -ne $Nonce) {
  Write-Extraction @{ valid = $false; reason = "wrong nonce"; expected_nonce = $Nonce; observed_nonce = $doneMatches[0].Groups[1].Value } 1
}

$afterDone = $trim.Substring($doneMatches[0].Index + $doneMatches[0].Length).Trim()
if ($afterDone -ne "</NC_SUPERVISOR_RESPONSE>") {
  Write-Extraction @{ valid = $false; reason = "DONE_not_final_meaningful_block"; nonce = $Nonce; trailing = $afterDone } 1
}

$responsePattern = '(?s)^\s*<NC_SUPERVISOR_RESPONSE nonce="' + $escapedNonce + '">\s*(.*?)\s*<NC_DONE nonce="' + $escapedNonce + '">DONE</NC_DONE>\s*</NC_SUPERVISOR_RESPONSE>\s*$'
$bodyMatch = [regex]::Match($trim, $responsePattern)
if (-not $bodyMatch.Success) {
  Write-Extraction @{ valid = $false; reason = "response_body_parse_failed"; nonce = $Nonce } 1
}

$body = $bodyMatch.Groups[1].Value.Trim()
$verdictMatch = [regex]::Match($body, '(?s)<VERDICT>\s*(.*?)\s*</VERDICT>')
if (-not $verdictMatch.Success) {
  Write-Extraction @{ valid = $false; reason = "missing_verdict"; nonce = $Nonce } 1
}
$verdict = $verdictMatch.Groups[1].Value.Trim()

$microMatches = [regex]::Matches($body, '(?s)<MICRO_PROMPT>\s*(.*?)\s*</MICRO_PROMPT>')
if ($microMatches.Count -gt 1) {
  Write-Extraction @{ valid = $false; reason = "multiple_micro_prompts"; nonce = $Nonce; count = $microMatches.Count } 1
}

if ($verdict -eq "STOP") {
  $stopMatch = [regex]::Match($body, '(?s)<STOP_REASON>\s*(.*?)\s*</STOP_REASON>')
  if (-not $stopMatch.Success) {
    Write-Extraction @{ valid = $false; reason = "missing_stop_reason"; nonce = $Nonce; verdict = $verdict } 1
  }
  $stopPath = Join-Path $OutDir "stop_reason.md"
  Set-Content -LiteralPath $stopPath -Value $stopMatch.Groups[1].Value.Trim() -Encoding UTF8
  Write-Extraction @{
    valid = $true
    verdict = "STOP"
    nonce = $Nonce
    stop_reason_path = $stopPath
    response_path = (Resolve-Path $InputPath).Path
  } 0
}

if ($verdict -ne "CONTINUE_WITH_MICRO_PROMPT") {
  Write-Extraction @{ valid = $false; reason = "unknown_verdict"; nonce = $Nonce; verdict = $verdict } 1
}

if ($microMatches.Count -ne 1) {
  Write-Extraction @{ valid = $false; reason = "missing_micro_prompt"; nonce = $Nonce; verdict = $verdict } 1
}

$auditMatch = [regex]::Match($body, '(?s)<PROMPT_SELF_AUDIT>\s*(.*?)\s*</PROMPT_SELF_AUDIT>')
if (-not $auditMatch.Success) {
  Write-Extraction @{ valid = $false; reason = "missing_prompt_self_audit"; nonce = $Nonce; verdict = $verdict } 1
}

$microPath = Join-Path $OutDir "extracted_micro_prompt.md"
Set-Content -LiteralPath $microPath -Value $microMatches[0].Groups[1].Value.Trim() -Encoding UTF8

$responsePath = Join-Path $OutDir "extracted_response.txt"
Set-Content -LiteralPath $responsePath -Value $trim -Encoding UTF8

Write-Extraction @{
  valid = $true
  verdict = $verdict
  nonce = $Nonce
  response_path = $responsePath
  micro_prompt_path = $microPath
  prompt_self_audit = $auditMatch.Groups[1].Value.Trim()
} 0
