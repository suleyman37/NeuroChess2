param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce,
  [string]$OutDir = "",
  [string]$BacklogPath = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "strategic_pulse_response\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $BacklogPath) {
  $BacklogPath = Join-Path $PSScriptRoot "strategic_backlog.md"
}

function Get-Block {
  param([string]$Text, [string]$Name)
  $match = [regex]::Match($Text, "(?s)<$Name>\s*(.*?)\s*</$Name>")
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return ""
}

function Write-StrategicResult {
  param($Payload, [int]$ExitCode)
  $Payload | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "strategic_pulse_result.json") -Encoding UTF8
  $Payload | ConvertTo-Json -Depth 10
  exit $ExitCode
}

$raw = Get-Content -LiteralPath $InputPath -Raw
$trim = $raw.Trim()
$escapedNonce = [regex]::Escape($Nonce)
$allowedDecisions = @("CONTINUE", "NARROW", "SPLIT", "PIVOT", "HARDEN", "RETURN_TO_PRODUCT", "QUARANTINE", "STOP")
$allowedModes = @("micro_prompt_now", "backlog_only", "stop_for_review")
$reasons = [System.Collections.Generic.List[string]]::new()

if ($trim -notmatch "(?s)^<NC_STRATEGIC_PULSE nonce=`"$escapedNonce`">.*</NC_STRATEGIC_PULSE>$") {
  $reasons.Add("missing strategic pulse block or nonce mismatch") | Out-Null
}
$doneMatches = [regex]::Matches($trim, "<NC_DONE nonce=`"$escapedNonce`">DONE</NC_DONE>")
if ($doneMatches.Count -ne 1) {
  $reasons.Add("missing or duplicated nonce-bound DONE") | Out-Null
} else {
  $afterDone = $trim.Substring($doneMatches[0].Index + $doneMatches[0].Length).Trim()
  if ($afterDone -ne "</NC_STRATEGIC_PULSE>") {
    $reasons.Add("DONE is not final meaningful block") | Out-Null
  }
}

$decision = Get-Block $trim "DECISION"
if ($allowedDecisions -notcontains $decision) {
  $reasons.Add("unknown decision: $decision") | Out-Null
}

$scoresText = Get-Block $trim "SCORES"
$scoreMap = @{}
foreach ($name in @("product_progress", "automation_friction", "risk_exposure", "strategic_coherence")) {
  if ($scoresText -match "(?m)^$name\s*:\s*([0-5])\s*$") {
    $scoreMap[$name] = [int]$matches[1]
  } else {
    $reasons.Add("invalid score: $name") | Out-Null
  }
}
if ($scoresText -match '(?m)^confidence\s*:\s*(0(\.\d+)?|1(\.0+)?)\s*$') {
  $scoreMap["confidence"] = [double]$matches[1]
} else {
  $reasons.Add("invalid confidence") | Out-Null
}

$nextBestMove = Get-Block $trim "NEXT_BEST_MOVE"
$doNotDo = Get-Block $trim "DO_NOT_DO"
$why = Get-Block $trim "WHY"
$geniusSpark = Get-Block $trim "GENIUS_SPARK"
$executionMode = Get-Block $trim "EXECUTION_MODE"

if (-not $nextBestMove) { $reasons.Add("missing NEXT_BEST_MOVE") | Out-Null }
if (-not $doNotDo) { $reasons.Add("missing DO_NOT_DO") | Out-Null }
if (-not $why) { $reasons.Add("missing WHY") | Out-Null }
if ($allowedModes -notcontains $executionMode) { $reasons.Add("invalid execution mode: $executionMode") | Out-Null }
if ($geniusSpark) {
  $sparkLines = @($geniusSpark -split "`r?`n" | Where-Object { $_.Trim() })
  if ($sparkLines.Count -gt 5) {
    $reasons.Add("GENIUS_SPARK exceeds 5 lines") | Out-Null
  }
}

if ($reasons.Count -gt 0) {
  Write-StrategicResult ([ordered]@{
    valid = $false
    reasons = @($reasons)
    decision = $decision
    genius_spark_recorded = $false
  }) 1
}

$recorded = $false
if ($geniusSpark) {
  $entry = @(
    "",
    "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $decision",
    "",
    "Next best move: $nextBestMove",
    "",
    "Genius Spark:",
    $geniusSpark,
    "",
    "Execution: backlog only. Not auto-executed."
  ) -join "`n"
  Add-Content -LiteralPath $BacklogPath -Value $entry -Encoding UTF8
  $recorded = $true
}

Write-StrategicResult ([ordered]@{
  valid = $true
  decision = $decision
  execution_mode = $executionMode
  next_best_move = $nextBestMove
  do_not_do = $doNotDo
  genius_spark = $geniusSpark
  genius_spark_recorded = $recorded
  scores = $scoreMap
  live_chatgpt_called = $false
}) 0
