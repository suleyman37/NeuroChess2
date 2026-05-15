param(
  [Parameter(Mandatory = $true)][string]$MissionId,
  [Parameter(Mandatory = $true)][string]$RiskTier,
  [Parameter(Mandatory = $true)][string]$WorkType,
  [string]$BaseBranch = "road-to-V2",
  [string]$Timestamp = "",
  [string]$OutDir = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

function ConvertTo-BranchSlug {
  param([Parameter(Mandatory = $true)][string]$Value)
  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  if (-not $slug) { return "item" }
  return $slug
}

function New-EphemeralBranchName {
  param([string]$MissionId, [string]$RiskTier, [string]$WorkType, [string]$Timestamp)
  $risk = ConvertTo-BranchSlug $RiskTier
  $work = ConvertTo-BranchSlug $WorkType
  $mission = ConvertTo-BranchSlug $MissionId
  if (-not $Timestamp) { $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss" }
  $stamp = ConvertTo-BranchSlug $Timestamp
  if ($risk -eq "red") {
    return "quarantine/red-$work-$mission-$stamp"
  }
  return "auto/$risk-$work-$mission-$stamp"
}

$repoRoot = Get-AutopilotRepoRoot
if (-not $OutDir) {
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "branches\prepare_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$branchName = New-EphemeralBranchName -MissionId $MissionId -RiskTier $RiskTier -WorkType $WorkType -Timestamp $Timestamp
if ($branchName -eq $BaseBranch -or $branchName -eq "origin/$BaseBranch") {
  throw "Refusing to use base branch as task branch: $branchName"
}

Push-Location $repoRoot
try {
  $currentBranch = (git branch --show-current).Trim()
  $status = @(git status --porcelain=v1)
  $head = (git rev-parse --short HEAD).Trim()
  $originHead = (git rev-parse --short "origin/$BaseBranch").Trim()
  $baseHead = (git rev-parse --short $BaseBranch).Trim()

  $errors = [System.Collections.Generic.List[string]]::new()
  if ($currentBranch -ne $BaseBranch) { $errors.Add("current branch is $currentBranch, expected $BaseBranch") | Out-Null }
  if ($status.Count -gt 0) { $errors.Add("repo is not clean") | Out-Null }
  if ($head -ne $originHead -or $baseHead -ne $originHead) { $errors.Add("$BaseBranch is not aligned with origin/$BaseBranch") | Out-Null }

  if ($errors.Count -gt 0) {
    $manifest = [ordered]@{
      schema_version = "A5B_ephemeral_branch_manifest"
      status = "fail"
      errors = @($errors)
      branch_name = $branchName
      dry_run = [bool]$DryRun
    }
    Write-AutopilotJson -Path (Join-Path $OutDir "manifest.json") -Value $manifest
    $manifest | ConvertTo-Json -Depth 10
    exit 1
  }

  if (-not $DryRun) {
    git switch -c $branchName | Out-File -Encoding utf8 (Join-Path $OutDir "git_switch.log")
  }

  $manifest = [ordered]@{
    schema_version = "A5B_ephemeral_branch_manifest"
    status = if ($DryRun) { "dry_run" } else { "prepared" }
    mission_id = $MissionId
    risk_tier = $RiskTier
    work_type = $WorkType
    base_branch = $BaseBranch
    branch_name = $branchName
    base_head = $head
    origin_head = $originHead
    created_at = (Get-Date).ToString("o")
    dry_run = [bool]$DryRun
  }
  Write-AutopilotJson -Path (Join-Path $OutDir "manifest.json") -Value $manifest
  Set-Content -LiteralPath (Join-Path $OutDir "branch_name.txt") -Value $branchName -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $OutDir "base_head.txt") -Value $head -Encoding UTF8
  $manifest | ConvertTo-Json -Depth 10
} finally {
  Pop-Location
}
