param(
  [Parameter(Mandatory = $true)][string]$BranchName,
  [Parameter(Mandatory = $true)][string]$Reason,
  [string]$EvidenceDir = "",
  [string]$BaseBranch = "road-to-V2"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$repoRoot = Get-AutopilotRepoRoot
if (-not $EvidenceDir) {
  $safeBranch = $BranchName -replace '[\\/:"*?<>|]+', '_'
  $EvidenceDir = Join-Path (Get-AutopilotArtifactRoot) "branches\$safeBranch`_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

Push-Location $repoRoot
try {
  $branchExists = $false
  git show-ref --verify --quiet "refs/heads/$BranchName"
  if ($LASTEXITCODE -eq 0) { $branchExists = $true }

  $baseHead = (git rev-parse --short $BaseBranch).Trim()
  $taskHead = ""
  if ($branchExists) {
    $taskHead = (git rev-parse --short $BranchName).Trim()
  }

  Set-Content -LiteralPath (Join-Path $EvidenceDir "branch_name.txt") -Value $BranchName -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $EvidenceDir "base_head.txt") -Value $baseHead -Encoding UTF8
  if ($taskHead) { Set-Content -LiteralPath (Join-Path $EvidenceDir "task_head.txt") -Value $taskHead -Encoding UTF8 }
  Set-Content -LiteralPath (Join-Path $EvidenceDir "failure_reason.md") -Value $Reason -Encoding UTF8
  git status --short --branch | Set-Content -LiteralPath (Join-Path $EvidenceDir "git_status.txt") -Encoding UTF8

  if ($branchExists) {
    $mergeBase = (git merge-base $BaseBranch $BranchName).Trim()
    git diff --name-only "$mergeBase..$BranchName" | Set-Content -LiteralPath (Join-Path $EvidenceDir "changed_files.txt") -Encoding UTF8
    git diff "$mergeBase..$BranchName" | Set-Content -LiteralPath (Join-Path $EvidenceDir "diff.patch") -Encoding UTF8
    try {
      git bundle create (Join-Path $EvidenceDir "branch.bundle") $BranchName | Out-File -Encoding utf8 (Join-Path $EvidenceDir "bundle.log")
    } catch {
      $_.Exception.Message | Set-Content -LiteralPath (Join-Path $EvidenceDir "bundle_skipped.txt") -Encoding UTF8
    }
  } else {
    Set-Content -LiteralPath (Join-Path $EvidenceDir "changed_files.txt") -Value "" -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $EvidenceDir "diff.patch") -Value "" -Encoding UTF8
  }

  $manifest = [ordered]@{
    schema_version = "A5B_branch_archive_manifest"
    status = "archived"
    branch_name = $BranchName
    base_branch = $BaseBranch
    branch_exists = $branchExists
    base_head = $baseHead
    task_head = $taskHead
    reason = $Reason
    archived_at = (Get-Date).ToString("o")
    evidence_dir = $EvidenceDir
  }
  Write-AutopilotJson -Path (Join-Path $EvidenceDir "manifest.json") -Value $manifest
  $manifest | ConvertTo-Json -Depth 10
} finally {
  Pop-Location
}
