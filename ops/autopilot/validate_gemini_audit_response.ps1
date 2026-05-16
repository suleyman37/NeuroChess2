param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce
)

$ErrorActionPreference = "Stop"

function Add-Violation {
  param([System.Collections.Generic.List[string]]$List, [string]$Message)
  $List.Add($Message) | Out-Null
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-TagText {
  param([string]$Raw, [string]$Tag)
  $match = [regex]::Match($Raw, "<$Tag>\s*(.*?)\s*</$Tag>", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $match.Success) { return $null }
  return $match.Groups[1].Value.Trim()
}

function Parse-ScoreLine {
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

function Find-JsonObjectText {
  param([string]$Raw)
  $fenced = [regex]::Match($Raw, '```(?:json)?\s*(\{[\s\S]*?\})\s*```', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($fenced.Success) { return $fenced.Groups[1].Value.Trim() }

  $start = $Raw.IndexOf("{")
  while ($start -ge 0) {
    $depth = 0
    $inString = $false
    $escape = $false
    for ($i = $start; $i -lt $Raw.Length; $i++) {
      $ch = $Raw[$i]
      if ($escape) {
        $escape = $false
        continue
      }
      if ($ch -eq "\") {
        $escape = $true
        continue
      }
      if ($ch -eq '"') {
        $inString = -not $inString
        continue
      }
      if ($inString) { continue }
      if ($ch -eq "{") { $depth++ }
      if ($ch -eq "}") {
        $depth--
        if ($depth -eq 0) {
          return $Raw.Substring($start, $i - $start + 1).Trim()
        }
      }
    }
    $next = $Raw.IndexOf("{", $start + 1)
    $start = $next
  }
  return ""
}

function ConvertFrom-JsonMaybe {
  param([string]$Raw)
  $jsonText = Find-JsonObjectText -Raw $Raw
  if (-not $jsonText) { return $null }
  try {
    return [ordered]@{
      text = $jsonText
      value = ($jsonText | ConvertFrom-Json)
    }
  } catch {
    return $null
  }
}

function Test-ScoreValue {
  param($Scores, [string]$Name, [double]$Min, [double]$Max, [System.Collections.Generic.List[string]]$Violations)
  if (-not (Has-Property $Scores $Name)) {
    Add-Violation -List $Violations -Message "missing score: $Name"
    return $null
  }
  try {
    $value = [double]$Scores.$Name
  } catch {
    Add-Violation -List $Violations -Message "score is not numeric: $Name"
    return $null
  }
  if ($value -lt $Min -or $value -gt $Max) {
    Add-Violation -List $Violations -Message "score out of range: $Name"
  }
  return $value
}

function Validate-CommonFields {
  param([string]$Mode, [string]$Verdict, [string]$RequiredAction, [System.Collections.Generic.List[string]]$Violations)
  $modeVerdicts = @{
    prompt_auditor = @("APPROVE", "NARROW", "REJECT", "QUARANTINE")
    visual_court = @("PASS_VISUAL", "WARNING_VISUAL", "BLOCK_VISUAL")
    long_horizon_critic = @("REPORT_ONLY")
  }
  $requiredActions = @("none", "narrow_prompt", "repair_prompt", "force_strategic_pulse", "quarantine", "block_visual", "record_report")

  if (-not $Mode -or -not $modeVerdicts.ContainsKey($Mode)) {
    Add-Violation -List $Violations -Message "MODE is missing or invalid"
  } elseif ($modeVerdicts[$Mode] -notcontains $Verdict) {
    Add-Violation -List $Violations -Message "VERDICT $Verdict is invalid for MODE $Mode"
  }

  if (-not $RequiredAction -or $requiredActions -notcontains $RequiredAction) {
    Add-Violation -List $Violations -Message "REQUIRED_ACTION is missing or invalid"
  }
}

if (-not (Test-Path -LiteralPath $InputPath)) { throw "Gemini audit response not found: $InputPath" }

$raw = Get-Content -LiteralPath $InputPath -Raw
$trimmed = $raw.Trim()
$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$scores = [ordered]@{}
$format = "unknown"
$mode = $null
$verdict = $null
$requiredAction = $null

if ($trimmed -match "(?i)MICRO_PROMPT") {
  Add-Violation -List $violations -Message "Gemini response must not include MICRO_PROMPT"
}
if ($trimmed -match "(?i)codex_prompt") {
  Add-Violation -List $violations -Message "Gemini response must not include codex_prompt"
}
if ($trimmed -match "(?im)^\s*(create|modify|edit|delete|run|commit|push)\s+.+") {
  Add-Violation -List $violations -Message "Gemini response appears to include executable implementation instructions"
}

$json = ConvertFrom-JsonMaybe -Raw $trimmed
if ($json) {
  $format = "json"
  $obj = $json.value
  $mode = [string]$obj.mode
  $verdict = [string]$obj.verdict
  $requiredAction = [string]$obj.required_action

  if ([string]$obj.schema -ne "NC_GEMINI_AUDIT_JSON/1") {
    Add-Violation -List $violations -Message "schema must be NC_GEMINI_AUDIT_JSON/1"
  }
  if ([string]$obj.nonce -ne $Nonce) {
    Add-Violation -List $violations -Message "nonce mismatch"
  }
  if ([string]$obj.done -ne $Nonce) {
    Add-Violation -List $violations -Message "done must equal nonce"
  }

  Validate-CommonFields -Mode $mode -Verdict $verdict -RequiredAction $requiredAction -Violations $violations

  if (-not (Has-Property $obj "scores")) {
    Add-Violation -List $violations -Message "missing scores"
  } else {
    $scores.scope_risk = Test-ScoreValue -Scores $obj.scores -Name "scope_risk" -Min 0 -Max 5 -Violations $violations
    $scores.product_value = Test-ScoreValue -Scores $obj.scores -Name "product_value" -Min 0 -Max 5 -Violations $violations
    $scores.safety_risk = Test-ScoreValue -Scores $obj.scores -Name "safety_risk" -Min 0 -Max 5 -Violations $violations
    $scores.automation_drift_risk = Test-ScoreValue -Scores $obj.scores -Name "automation_drift_risk" -Min 0 -Max 5 -Violations $violations
    $scores.confidence = Test-ScoreValue -Scores $obj.scores -Name "confidence" -Min 0 -Max 1 -Violations $violations
  }

  if (-not (Has-Property $obj "findings")) {
    Add-Violation -List $violations -Message "missing findings"
  } else {
    $findings = @($obj.findings)
    if ($findings.Count -gt 5) { Add-Violation -List $violations -Message "findings exceed maximum of 5" }
  }

  if (-not [string]$obj.must_not_do) {
    Add-Violation -List $violations -Message "must_not_do is required"
  }
} else {
  $format = "xml"
  $blockMatch = [regex]::Match($trimmed, '^\s*<NC_GEMINI_AUDIT\s+nonce="([^"]+)">\s*(.*?)\s*</NC_GEMINI_AUDIT>\s*$', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $blockMatch.Success) {
    Add-Violation -List $violations -Message "missing single NC_GEMINI_AUDIT block or free prose outside block"
    $format = "unknown"
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

  $mode = Get-TagText -Raw $trimmed -Tag "MODE"
  $verdict = Get-TagText -Raw $trimmed -Tag "VERDICT"
  $requiredAction = Get-TagText -Raw $trimmed -Tag "REQUIRED_ACTION"
  $mustNotDo = Get-TagText -Raw $trimmed -Tag "MUST_NOT_DO"
  Validate-CommonFields -Mode $mode -Verdict $verdict -RequiredAction $requiredAction -Violations $violations
  if (-not $mustNotDo) { Add-Violation -List $violations -Message "MUST_NOT_DO is required" }

  $scoreBlock = Get-TagText -Raw $trimmed -Tag "SCORES"
  if (-not $scoreBlock) {
    Add-Violation -List $violations -Message "missing SCORES"
  } else {
    $scores.scope_risk = Parse-ScoreLine -Block $scoreBlock -Name "scope_risk" -Min 0 -Max 5 -Violations $violations
    $scores.product_value = Parse-ScoreLine -Block $scoreBlock -Name "product_value" -Min 0 -Max 5 -Violations $violations
    $scores.safety_risk = Parse-ScoreLine -Block $scoreBlock -Name "safety_risk" -Min 0 -Max 5 -Violations $violations
    $scores.automation_drift_risk = Parse-ScoreLine -Block $scoreBlock -Name "automation_drift_risk" -Min 0 -Max 5 -Violations $violations
    $scores.confidence = Parse-ScoreLine -Block $scoreBlock -Name "confidence" -Min 0 -Max 1 -Violations $violations
  }

  $findingsBlock = Get-TagText -Raw $trimmed -Tag "FINDINGS"
  if (-not $findingsBlock) {
    Add-Violation -List $violations -Message "missing FINDINGS"
  } else {
    $findings = @($findingsBlock -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^- " })
    if ($findings.Count -gt 5) { Add-Violation -List $violations -Message "findings exceed maximum of 5" }
  }
}

$valid = $violations.Count -eq 0
$result = [ordered]@{
  valid = $valid
  format = $format
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
