param(
  [Parameter(Mandatory = $true)][string]$ContractPath,
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "mission_contract_validation\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Has-Property {
  param($Object, [string]$Name)
  return ($Object.PSObject.Properties.Name -contains $Name)
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  return @($Value)
}

function Normalize-PathText {
  param([string]$Path)
  return (($Path -replace "\\", "/").Trim())
}

function Test-PathLikeAny {
  param([string[]]$Paths, [string]$Pattern)
  foreach ($path in $Paths) {
    if ((Normalize-PathText $path) -like (Normalize-PathText $Pattern)) { return $true }
  }
  return $false
}

$contract = Get-Content -LiteralPath $ContractPath -Raw | ConvertFrom-Json
$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

$required = @(
  "mission_id",
  "risk_tier",
  "work_type",
  "goal",
  "expected_changed_files",
  "allowed_paths",
  "forbidden_paths",
  "max_files",
  "max_diff_lines",
  "expected_diff_lines_min",
  "expected_diff_lines_max",
  "expected_read_paths",
  "expected_write_paths",
  "required_checks",
  "expected_artifacts",
  "commit_policy",
  "stop_conditions",
  "red_tier_allowed",
  "backend_allowed",
  "frontend_allowed",
  "docs_rebuild_allowed",
  "package_changes_allowed"
)

foreach ($field in $required) {
  if (-not (Has-Property $contract $field)) {
    $violations.Add("missing required field: $field") | Out-Null
  }
}

if ((As-Array $contract.expected_changed_files).Count -eq 0) {
  $violations.Add("expected_changed_files is empty") | Out-Null
}
if ((As-Array $contract.allowed_paths).Count -eq 0) {
  $violations.Add("allowed_paths is empty") | Out-Null
}
if ((As-Array $contract.forbidden_paths).Count -eq 0) {
  $violations.Add("forbidden_paths is empty") | Out-Null
}
if ((As-Array $contract.stop_conditions).Count -eq 0) {
  $violations.Add("stop_conditions is empty") | Out-Null
}
if (-not (Has-Property $contract "commit_policy") -or $null -eq $contract.commit_policy) {
  $violations.Add("commit_policy missing") | Out-Null
}
if (-not (Has-Property $contract "risk_tier") -or -not ([string]$contract.risk_tier).Trim()) {
  $violations.Add("risk_tier missing") | Out-Null
}
if (-not (Has-Property $contract "max_files") -or [int]$contract.max_files -lt 1) {
  $violations.Add("max_files missing or invalid") | Out-Null
}
if (-not (Has-Property $contract "max_diff_lines") -or [int]$contract.max_diff_lines -lt 1) {
  $violations.Add("max_diff_lines missing or invalid") | Out-Null
}

$workType = ([string]$contract.work_type).ToLowerInvariant()
if (-not $workType -or $workType -match "^(general|unknown|mixed|misc|everything)$") {
  $violations.Add("work_type is ambiguous") | Out-Null
}

$broadPatterns = @(
  "improve",
  "polish",
  "optimize",
  "refactor",
  "finalize",
  "stabilize",
  "as needed",
  "if necessary",
  "clean up everything",
  "handle everything",
  "continue the roadmap"
)
$textForBroadScan = @(
  [string]$contract.goal,
  [string]$contract.work_type,
  [string]$contract.mission_id
) -join "`n"
foreach ($pattern in $broadPatterns) {
  if ($textForBroadScan -match [regex]::Escape($pattern)) {
    $violations.Add("broad wording appears: $pattern") | Out-Null
  }
}

$expectedChanged = @(As-Array $contract.expected_changed_files | ForEach-Object { Normalize-PathText $_ })
$allowedPaths = @(As-Array $contract.allowed_paths | ForEach-Object { Normalize-PathText $_ })
$expectedWrites = @(As-Array $contract.expected_write_paths | ForEach-Object { Normalize-PathText $_ })
$pathScope = @($expectedChanged + $allowedPaths + $expectedWrites)

if ((Test-PathLikeAny $pathScope "backend/*") -and -not [bool]$contract.backend_allowed) {
  $violations.Add("backend access appears without backend_allowed=true") | Out-Null
}
if ((Test-PathLikeAny $pathScope "frontend/*") -and -not [bool]$contract.frontend_allowed) {
  $violations.Add("frontend access appears without frontend_allowed=true") | Out-Null
}
if ((Test-PathLikeAny $pathScope "docs/rebuild/*") -and -not [bool]$contract.docs_rebuild_allowed) {
  $violations.Add("docs/rebuild access appears without docs_rebuild_allowed=true") | Out-Null
}
foreach ($packagePath in @("package.json", "package-lock.json", "App.tsx")) {
  if (($pathScope -contains $packagePath) -and -not [bool]$contract.package_changes_allowed) {
    $violations.Add("package/App access appears without package_changes_allowed=true: $packagePath") | Out-Null
  }
}

$redTerms = @("practice_attempts", "due_at", "daily plan", "training_items", "scoring", "xp", "rank", "transfer", "practice")
$redScanText = @(
  [string]$contract.goal,
  [string]$contract.work_type,
  ($expectedWrites -join " "),
  ($expectedChanged -join " "),
  ($allowedPaths -join " ")
) -join "`n"
$isRed = ([string]$contract.risk_tier).ToLowerInvariant() -eq "red"
$isQuarantine = $redScanText -match "quarantine/red"
if (-not $isRed -and -not $isQuarantine -and -not [bool]$contract.red_tier_allowed) {
  foreach ($term in $redTerms) {
    $pattern = "(?i)(?<![A-Za-z0-9_])$([regex]::Escape($term))(?![A-Za-z0-9_])"
    if ($redScanText -match $pattern) {
      $violations.Add("red-tier term appears outside red-tier/quarantine scope: $term") | Out-Null
    }
  }
}

if ([int]$contract.expected_diff_lines_max -gt 0 -and [int]$contract.expected_diff_lines_min -gt [int]$contract.expected_diff_lines_max) {
  $violations.Add("expected_diff_lines_min exceeds expected_diff_lines_max") | Out-Null
}

$result = [ordered]@{
  validation_result = if ($violations.Count -eq 0) { "PASS" } else { "FAIL" }
  valid = ($violations.Count -eq 0)
  violations = @($violations)
  warnings = @($warnings)
  mission_id = $contract.mission_id
  report_path = (Join-Path $ReportDir "mission_contract_validation.json")
  live_chatgpt_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $result.report_path -Encoding UTF8
$result | ConvertTo-Json -Depth 10
if ($violations.Count -eq 0) { exit 0 }
exit 1
