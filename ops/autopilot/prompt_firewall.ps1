param(
  [Parameter(Mandatory = $true)][string]$ExtractionJson,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
if (-not $OutDir) { $OutDir = Split-Path -Parent (Resolve-Path $ExtractionJson) }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-Firewall {
  param([hashtable]$Payload, [int]$ExitCode)
  $json = $Payload | ConvertTo-Json -Depth 12
  Set-Content -LiteralPath (Join-Path $OutDir "prompt_firewall.json") -Value $json -Encoding UTF8
  Write-Output $json
  exit $ExitCode
}

function Get-MicroPromptFields {
  param([string]$Text)
  $fields = @{}
  $current = $null
  $known = @("id","risk_tier","work_type","goal","allowed_paths","forbidden_paths","max_files","max_diff_lines","timebox_minutes","required_checks","stop_conditions","commit_policy","codex_prompt")
  foreach ($line in ($Text -split "`r?`n")) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$' -and ($known -contains $matches[1])) {
      $current = $matches[1]
      $fields[$current] = $matches[2]
      continue
    }
    if ($current) {
      $fields[$current] = ($fields[$current] + "`n" + $line).Trim()
    }
  }
  return $fields
}

function Get-ListItems {
  param([string]$Value)
  @($Value -split "`r?`n" | ForEach-Object { $_.Trim() -replace '^-\s*','' } | Where-Object { $_ })
}

$extraction = Get-Content -LiteralPath $ExtractionJson -Raw | ConvertFrom-Json
if (-not $extraction.valid) {
  Write-Firewall @{ verdict = "fail"; eligible_for_execution = $false; reasons = @("Extraction invalid: $($extraction.reason)") } 1
}

if ($extraction.verdict -eq "STOP") {
  Write-Firewall @{ verdict = "pass"; eligible_for_execution = $false; reasons = @("Supervisor returned STOP."); supervisor_verdict = "STOP" } 0
}

$micro = Get-Content -LiteralPath $extraction.micro_prompt_path -Raw
$fields = Get-MicroPromptFields -Text $micro
$reasons = New-Object System.Collections.Generic.List[string]

$required = @("id","risk_tier","work_type","goal","allowed_paths","forbidden_paths","max_files","max_diff_lines","timebox_minutes","required_checks","stop_conditions","commit_policy","codex_prompt")
foreach ($field in $required) {
  if (-not $fields.ContainsKey($field) -or -not ([string]$fields[$field]).Trim()) {
    $reasons.Add("missing required field: $field") | Out-Null
  }
}

$audit = [string]$extraction.prompt_self_audit
$quality = 0
if ($audit -match 'quality_score_0_to_10:\s*([0-9]+)') {
  $quality = [int]$matches[1]
} else {
  $reasons.Add("missing quality_score_0_to_10") | Out-Null
}
if ($quality -lt 8) {
  $reasons.Add("quality_score below 8") | Out-Null
}

$auditMatches = [regex]::Matches($audit, '(^|\n)([A-Za-z0-9_]+):\s*(PASS|FAIL)\s*($|\n)')
foreach ($match in $auditMatches) {
  $item = $match.Groups[2].Value
  $value = $match.Groups[3].Value
  if ($value -eq "FAIL" -and $item -ne "main_risks") {
    $reasons.Add("hard self-audit item failed: $item") | Out-Null
  }
}

$risk = ([string]$fields["risk_tier"]).ToLowerInvariant()
$workType = ([string]$fields["work_type"]).ToLowerInvariant()
$goal = ([string]$fields["goal"]).Trim()
$allowed = Get-ListItems ([string]$fields["allowed_paths"])
$forbidden = Get-ListItems ([string]$fields["forbidden_paths"])
$commitPolicy = ([string]$fields["commit_policy"]).ToLowerInvariant()
$allText = ($micro + "`n" + $audit).ToLowerInvariant()

if ($goal -match '\b(and|also)\b|;') {
  $reasons.Add("goal appears to contain more than one objective") | Out-Null
}
if ($allowed.Count -eq 0) { $reasons.Add("allowed_paths empty") | Out-Null }
if ($forbidden.Count -eq 0) { $reasons.Add("forbidden_paths empty") | Out-Null }
foreach ($numeric in @("max_files","max_diff_lines","timebox_minutes")) {
  if ($fields.ContainsKey($numeric) -and ([string]$fields[$numeric]) -notmatch '^\s*[0-9]+\s*$') {
    $reasons.Add("$numeric must be numeric") | Out-Null
  }
}

$mixCount = 0
foreach ($kind in @("docs","frontend","backend")) {
  if ($workType -match $kind) { $mixCount++ }
}
if ($mixCount -gt 1) {
  $reasons.Add("work_type mixes docs/backend/frontend") | Out-Null
}

$allowedJoined = ($allowed -join "`n").ToLowerInvariant()
if ($workType -match 'docs' -and $allowedJoined -match '(^|[\n ])(frontend/|backend/|app\.tsx|package\.json|package-lock\.json)') {
  $reasons.Add("docs-only work touches code/package paths") | Out-Null
}
if ($workType -match 'frontend' -and $allowedJoined -match 'backend/') {
  $reasons.Add("frontend work touches backend") | Out-Null
}
if ($workType -match 'backend' -and $allowedJoined -match 'frontend/') {
  $reasons.Add("backend work touches frontend") | Out-Null
}
if ($risk -match 'red' -and $commitPolicy -match 'auto.?push|road-to-v2') {
  $reasons.Add("red-tier tries to auto-push directly to road-to-V2") | Out-Null
}

$sensitive = @("practice","training_items","practice_attempts","due_at","daily plan","scoring","reveal solution","xp","rank","transfer")
if ($risk -notmatch 'red') {
  foreach ($term in $sensitive) {
    $termPattern = '(?<![A-Za-z0-9_])' + [regex]::Escape($term) + '(?![A-Za-z0-9_])'
    if ($allText -match $termPattern) {
      $reasons.Add("sensitive term outside red-tier: $term") | Out-Null
    }
  }
}

if ($allText -match '/games/\{game_id\}/review|/games/.+/review') {
  $reasons.Add("forbidden /games/{game_id}/review requested") | Out-Null
}
if ($allText -match 'git\s+add\s+-a') {
  $reasons.Add("forbidden git add -A requested") | Out-Null
}

$vagueTerms = @("improve","polish","optimize","refactor","finalize","stabilize","as needed","if necessary","clean up everything","continue the roadmap","make it better","handle everything","fix all")
foreach ($term in $vagueTerms) {
  if ($allText -match [regex]::Escape($term)) {
    $reasons.Add("broad/vague language detected: $term") | Out-Null
  }
}

if ($reasons.Count -gt 0) {
  Write-Firewall @{
    verdict = "fail"
    eligible_for_execution = $false
    reasons = @($reasons)
    quality_score_0_to_10 = $quality
  } 1
}

Write-Firewall @{
  verdict = "pass"
  eligible_for_execution = $true
  reasons = @()
  quality_score_0_to_10 = $quality
  fields = $fields
} 0
