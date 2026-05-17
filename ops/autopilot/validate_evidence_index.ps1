param(
  [string]$IndexPath,
  [switch]$VerifyExists
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-ArtifactFullPath {
  param([string]$Path)
  if (-not $Path) { return $null }
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

if (-not $IndexPath) { throw "IndexPath is required" }
$indexFullPath = if ([System.IO.Path]::IsPathRooted($IndexPath)) { $IndexPath } else { Join-Path (Get-RepoRoot) $IndexPath }
if (-not (Test-Path -LiteralPath $indexFullPath -PathType Leaf)) {
  throw "Evidence index not found: $indexFullPath"
}

$requiredFields = @(
  "schema_version",
  "run_id",
  "mission_id",
  "branch",
  "artifact_id",
  "artifact_type",
  "artifact_path",
  "created_at",
  "producer",
  "required_for_e2e",
  "exists_at_append"
)
$validTypes = @("test_log", "screenshot", "contact_sheet", "visual_brief", "gemini_json", "chatgpt_json", "report", "db_snapshot", "git_diff", "console_log", "network_log", "other")
$entries = 0
$warnings = New-Object System.Collections.Generic.List[string]
$missingRequired = New-Object System.Collections.Generic.List[string]

foreach ($line in Get-Content -LiteralPath $indexFullPath) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $entries += 1
  try {
    $entry = $line | ConvertFrom-Json
  } catch {
    $missingRequired.Add("line_${entries}: invalid JSON") | Out-Null
    continue
  }
  foreach ($field in $requiredFields) {
    if ($null -eq $entry.PSObject.Properties[$field]) {
      $missingRequired.Add("line_${entries}: missing $field") | Out-Null
    }
  }
  if ($entry.artifact_type -and ($validTypes -notcontains [string]$entry.artifact_type)) {
    $warnings.Add("line_${entries}: unknown artifact_type $($entry.artifact_type)") | Out-Null
  }
  $path = [string]$entry.artifact_path
  $exists = [bool]$entry.exists_at_append
  if ($VerifyExists) {
    $fullPath = Resolve-ArtifactFullPath -Path $path
    $exists = if ($fullPath) { Test-Path -LiteralPath $fullPath -PathType Leaf } else { $false }
  }
  if ([bool]$entry.required_for_e2e -and -not $exists) {
    $missingRequired.Add("$($entry.artifact_id): $path") | Out-Null
  } elseif (-not [bool]$entry.required_for_e2e -and -not $exists) {
    $warnings.Add("$($entry.artifact_id): optional artifact missing") | Out-Null
  }
}

if ($missingRequired.Count -gt 0) {
  $resultName = "STOP_MISSING_REQUIRED_EVIDENCE"
} elseif ($warnings.Count -gt 0) {
  $resultName = "WARN_MISSING_OPTIONAL"
} else {
  $resultName = "PASS"
}

$result = [ordered]@{
  evidence_index_result = $resultName
  entries = $entries
  missing_required = @($missingRequired)
  warnings = @($warnings)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($missingRequired.Count -gt 0) { exit 2 }
exit 0
