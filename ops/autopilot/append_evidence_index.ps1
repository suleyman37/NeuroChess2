param(
  [string]$IndexPath,
  [string]$EntryJson,
  [string]$EntryJsonPath,
  [string]$RunId = "manual",
  [string]$MissionId = "manual",
  [string]$Branch = "road-to-V2",
  [string]$CommitSha,
  [string]$ArtifactId = "artifact",
  [string]$ArtifactType = "other",
  [string]$ArtifactPath,
  [string]$Producer = "append_evidence_index",
  [string]$RequiredForE2E = "false",
  [string]$Notes
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultIndexPath {
  return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\evidence_index.jsonl")
}

function Resolve-ArtifactFullPath {
  param([string]$Path)
  if (-not $Path) { return $null }
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

if (-not $IndexPath) { $IndexPath = Get-DefaultIndexPath }
$indexFullPath = if ([System.IO.Path]::IsPathRooted($IndexPath)) { $IndexPath } else { Join-Path (Get-RepoRoot) $IndexPath }

if ($EntryJsonPath) {
  $entrySourcePath = if ([System.IO.Path]::IsPathRooted($EntryJsonPath)) { $EntryJsonPath } else { Join-Path (Get-RepoRoot) $EntryJsonPath }
  $entryObject = Get-Content -LiteralPath $entrySourcePath -Raw | ConvertFrom-Json
} elseif ($EntryJson) {
  $entryObject = $EntryJson | ConvertFrom-Json
} else {
  $entryObject = [pscustomobject]@{
    run_id = $RunId
    mission_id = $MissionId
    branch = $Branch
    commit_sha = $CommitSha
    artifact_id = $ArtifactId
    artifact_type = $ArtifactType
    artifact_path = $ArtifactPath
    producer = $Producer
    required_for_e2e = [System.Convert]::ToBoolean($RequiredForE2E)
    notes = $Notes
  }
}

$artifactPathValue = [string]$entryObject.artifact_path
$artifactFullPath = Resolve-ArtifactFullPath -Path $artifactPathValue
$existsAtAppend = if ($artifactFullPath) { Test-Path -LiteralPath $artifactFullPath -PathType Leaf } else { $false }
$hash = $null
if ($existsAtAppend) {
  $hash = (Get-FileHash -LiteralPath $artifactFullPath -Algorithm SHA256).Hash
}

$entry = [ordered]@{
  schema_version = "A20A_evidence_index_entry_v1"
  run_id = [string]$entryObject.run_id
  mission_id = [string]$entryObject.mission_id
  branch = [string]$entryObject.branch
  commit_sha = $(if ($entryObject.commit_sha) { [string]$entryObject.commit_sha } else { $null })
  artifact_id = [string]$entryObject.artifact_id
  artifact_type = [string]$entryObject.artifact_type
  artifact_path = $artifactPathValue
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  producer = [string]$entryObject.producer
  required_for_e2e = [bool]$entryObject.required_for_e2e
  exists_at_append = [bool]$existsAtAppend
  hash_if_available = $hash
  notes = $(if ($entryObject.notes) { [string]$entryObject.notes } else { $null })
}

$indexDir = Split-Path -Parent $indexFullPath
if ($indexDir) { New-Item -ItemType Directory -Force -Path $indexDir | Out-Null }
Add-Content -LiteralPath $indexFullPath -Value ($entry | ConvertTo-Json -Compress -Depth 10) -Encoding UTF8

$result = [ordered]@{
  append_result = "PASS"
  index_path = $indexFullPath
  artifact_id = $entry.artifact_id
  exists_at_append = $entry.exists_at_append
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
