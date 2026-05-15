param(
  [switch]$Apply,
  [string]$EvidenceRoot = "",
  [string[]]$MockBranches = @(),
  [string]$MockCurrentBranch = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$repoRoot = Get-AutopilotRepoRoot
if (-not $EvidenceRoot) {
  $EvidenceRoot = Join-Path (Get-AutopilotArtifactRoot) "branches"
}
$reportDir = Join-Path (Get-AutopilotArtifactRoot) "branches\cleanup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$protected = @("road-to-V2", "main", "master")

function Get-ArchivedBranchNames {
  param([string]$Root)
  $names = @()
  if (-not (Test-Path -LiteralPath $Root)) { return $names }
  foreach ($manifestPath in Get-ChildItem -LiteralPath $Root -Recurse -Filter manifest.json -ErrorAction SilentlyContinue) {
    try {
      $manifest = Get-Content -LiteralPath $manifestPath.FullName -Raw | ConvertFrom-Json
      if ($manifest.branch_name) { $names += [string]$manifest.branch_name }
    } catch {
      continue
    }
  }
  return @($names | Select-Object -Unique)
}

Push-Location $repoRoot
try {
  $currentBranch = if ($MockCurrentBranch) { $MockCurrentBranch } else { (git branch --show-current).Trim() }
  $branches = if ($MockBranches.Count -gt 0) {
    $MockBranches
  } else {
    @(git branch --format='%(refname:short)' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  }
  $worktreeBranches = @()
  if ($MockBranches.Count -eq 0) {
    $worktreeBranches = @(git worktree list --porcelain | Where-Object { $_ -like "branch refs/heads/*" } | ForEach-Object { $_ -replace '^branch refs/heads/', '' })
  }
  $archived = Get-ArchivedBranchNames -Root $EvidenceRoot
  $items = [System.Collections.Generic.List[object]]::new()
  $deleted = [System.Collections.Generic.List[string]]::new()

  foreach ($branch in $branches) {
    $reasons = [System.Collections.Generic.List[string]]::new()
    $isTask = ($branch -like "auto/*" -or $branch -like "quarantine/*")
    if (-not $isTask) { $reasons.Add("not_ephemeral_branch") | Out-Null }
    if ($protected -contains $branch -or $branch -like "origin/*") { $reasons.Add("protected_branch") | Out-Null }
    if ($branch -eq $currentBranch) { $reasons.Add("current_branch") | Out-Null }
    if ($worktreeBranches -contains $branch) { $reasons.Add("active_worktree") | Out-Null }
    if ($archived -notcontains $branch) { $reasons.Add("missing_archive_manifest") | Out-Null }
    if ($branch -like "quarantine/*") { $reasons.Add("quarantine_retention_not_evaluated_for_auto_delete") | Out-Null }

    $eligible = $isTask -and $reasons.Count -eq 0
    $items.Add([ordered]@{
      branch = $branch
      eligible_for_deletion = $eligible
      reasons = @($reasons)
    }) | Out-Null

    if ($Apply -and $eligible) {
      git branch -D $branch | Out-File -Encoding utf8 -Append (Join-Path $reportDir "deletions.log")
      $deleted.Add($branch) | Out-Null
    }
  }

  $report = [ordered]@{
    mode = if ($Apply) { "apply" } else { "dry_run" }
    deleted = @($deleted)
    protected_branches = $protected
    current_branch = $currentBranch
    evidence_root = $EvidenceRoot
    archive_manifest_required = $true
    candidates = @($items)
    report_dir = $reportDir
  }
  Write-AutopilotJson -Path (Join-Path $reportDir "cleanup_report.json") -Value $report
  $report | ConvertTo-Json -Depth 12
} finally {
  Pop-Location
}
