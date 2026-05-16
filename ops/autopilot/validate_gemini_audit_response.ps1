param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce
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

function Parse-Score {
  param([string]$Block, [string]$Name, [double]$Min, [double]$Max, [System.Collections.Generic.List[string]]$Violations)
  $match = [regex]::Match($Block, "(?m)^\s*$([regex]::Escape($Name))\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$")
  if (-not $match.Success) {
    Add-Violation -List $Violations -Message "missing score: $Name"
    return $null
  }
  $value = [double]$match.Groups[1].Value
  if ($value -lt $Min -or $value -gt $Max) {
    Add-Violation -List $Violations -Message "score out of range: $Name"
  }
  return $value
}

if (-not (Test-Path -LiteralPath $InputPath)) { throw "Gemini audit response not found: $InputPath" }

$raw = Get-Content -LiteralPath $InputPath -Raw
$trimmed = $raw.Trim()
$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$scores = [ordered]@{}

$blockMatch = [regex]::Match($trimmed, '^\s*<NC_GEMINI_AUDIT\s+nonce="([^"]+)">\s*(.*?)\s*</NC_GEMINI_AUDIT>\s*$', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $blockMatch.Success) {
  Add-Violation -List $violations -Message "missing single NC_GEMINI_AUDIT block or free prose outside block"
}

$openMatches = [regex]::Matches($trimmed, '<NC_GEMINI_AUDIT\s+nonce="([^"]+)">')
if ($openMatches.Count -ne 1) {
  Add-Violation -List $violations -Message "expected exactly one NC_GEMINI_AUDIT opening tag"
}
$openNonce = if ($openMatches.Count -ge 1) { $openMatches[0].Groups[1].Value } else { "" }
if ($openNonce -ne $Nonce) {
  Add-Violation -List $violations -Message "opening nonce mismatch"
}

$donePattern = '<NC_DONE\s+nonce="' + [regex]::Escape($Nonce) + '">DONE</NC_DONE>'
if (-not [regex]::IsMatch($trimmed, $donePattern)) {
  Add-Violation -List $violations -Message "missing nonce-bound NC_DONE"
}

if ($trimmed -match "(?i)MICRO_PROMPT") {
  Add-Violation -List $violations -Message "Gemini response must not include MICRO_PROMPT"
}
if ($trimmed -match "(?i)codex_prompt") {
  Add-Violation -List $violations -Message "Gemini response must not include codex_prompt"
}

$mode = Get-TagText -Raw $trimmed -Tag "MODE"
$verdict = Get-TagText -Raw $trimmed -Tag "VERDICT"
$requiredAction = Get-TagText -Raw $trimmed -Tag "REQUIRED_ACTION"
$mustNotDo = Get-TagText -Raw $trimmed -Tag "MUST_NOT_DO"

$modeVerdicts = @{
  prompt_auditor = @("APPROVE", "NARROW", "REJECT", "QUARANTINE")
  visual_court = @("PASS_VISUAL", "WARNING_VISUAL", "BLOCK_VISUAL")
  long_horizon_critic = @("REPORT_ONLY")
}
$requiredActions = @("none", "narrow_prompt", "repair_prompt", "force_strategic_pulse", "quarantine", "block_visual", "record_report")

if (-not $mode -or -not $modeVerdicts.ContainsKey($mode)) {
  Add-Violation -List $violations -Message "MODE is missing or invalid"
} elseif ($modeVerdicts[$mode] -notcontains $verdict) {
  Add-Violation -List $violations -Message "VERDICT $verdict is invalid for MODE $mode"
}
if (-not $requiredAction -or $requiredActions -notcontains $requiredAction) {
  Add-Violation -List $violations -Message "REQUIRED_ACTION is missing or invalid"
}
if (-not $mustNotDo) {
  Add-Violation -List $violations -Message "MUST_NOT_DO is required"
}

$scoreBlock = Get-TagText -Raw $trimmed -Tag "SCORES"
if (-not $scoreBlock) {
  Add-Violation -List $violations -Message "missing SCORES"
} else {
  $scores.scope_risk = Parse-Score -Block $scoreBlock -Name "scope_risk" -Min 0 -Max 5 -Violations $violations
  $scores.product_value = Parse-Score -Block $scoreBlock -Name "product_value" -Min 0 -Max 5 -Violations $violations
  $scores.safety_risk = Parse-Score -Block $scoreBlock -Name "safety_risk" -Min 0 -Max 5 -Violations $violations
  $scores.automation_drift_risk = Parse-Score -Block $scoreBlock -Name "automation_drift_risk" -Min 0 -Max 5 -Violations $violations
  $scores.confidence = Parse-Score -Block $scoreBlock -Name "confidence" -Min 0 -Max 1 -Violations $violations
}

$findingsBlock = Get-TagText -Raw $trimmed -Tag "FINDINGS"
if (-not $findingsBlock) {
  Add-Violation -List $violations -Message "missing FINDINGS"
} else {
  $findings = @($findingsBlock -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^- " })
  if ($findings.Count -gt 5) {
    Add-Violation -List $violations -Message "findings exceed maximum of 5"
  }
}

$valid = $violations.Count -eq 0
$result = [ordered]@{
  valid = $valid
  mode = $mode
  verdict = $verdict
  required_action = $requiredAction
  violations = @($violations)
  warnings = @($warnings)
  scores = $scores
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  codex_execution = $false
  commit = $false
  push = $false
}
$result | ConvertTo-Json -Depth 12
if ($valid) { exit 0 } else { exit 1 }
