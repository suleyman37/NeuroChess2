param(
  [Parameter(Mandatory = $true)][string]$BranchName,
  [string]$BaseBranch = "road-to-V2",
  [string]$EvidenceDir = "",
  [string]$ChecksSummary = "",
  [string]$AllowedPathReport = "",
  [switch]$DryRun,
  [switch]$AllowQuarantinePromotion
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$repoRoot = Get-AutopilotRepoRoot
if (-not $EvidenceDir) {
  $EvidenceDir = Join-Path (Get-AutopilotArtifactRoot) "branches\promotion_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

function Write-Promotion {
  param($Payload, [int]$ExitCode)
  Write-AutopilotJson -Path (Join-Path $EvidenceDir "promotion_report.json") -Value $Payload
  $Payload | ConvertTo-Json -Depth 12
  exit $ExitCode
}

if (($BranchName -like "quarantine/*" -or $BranchName -like "auto/red-*") -and -not $AllowQuarantinePromotion) {
  Write-Promotion ([ordered]@{
    status = "refused"
    reason = "red_or_quarantine_branch_not_auto_promotable"
    branch_name = $BranchName
    dry_run = [bool]$DryRun
  }) 2
}

if ($BranchName -eq $BaseBranch -or $BranchName -eq "origin/$BaseBranch") {
  Write-Promotion ([ordered]@{
    status = "refused"
    reason = "task branch cannot be base branch"
    branch_name = $BranchName
  }) 1
}

Push-Location $repoRoot
try {
  $branchExists = $false
  git show-ref --verify --quiet "refs/heads/$BranchName"
  if ($LASTEXITCODE -eq 0) { $branchExists = $true }
  if (-not $branchExists -and -not $DryRun) {
    Write-Promotion ([ordered]@{ status = "fail"; reason = "branch_not_found"; branch_name = $BranchName }) 1
  }

  if ($ChecksSummary -and (Test-Path -LiteralPath $ChecksSummary)) {
    $checksText = Get-Content -LiteralPath $ChecksSummary -Raw
    if ($checksText -match '(?i)\bFAIL\b') {
      Write-Promotion ([ordered]@{ status = "fail"; reason = "checks_summary_contains_fail"; branch_name = $BranchName }) 1
    }
  }

  if ($AllowedPathReport -and (Test-Path -LiteralPath $AllowedPathReport)) {
    $pathText = Get-Content -LiteralPath $AllowedPathReport -Raw
    if ($pathText -match '(?i)\bFAIL\b|forbidden') {
      Write-Promotion ([ordered]@{ status = "fail"; reason = "allowed_path_report_failed"; branch_name = $BranchName }) 1
    }
  }

  $current = (git branch --show-current).Trim()
  $status = @(git status --porcelain=v1)
  $baseHead = (git rev-parse --short $BaseBranch).Trim()
  $originHead = (git rev-parse --short "origin/$BaseBranch").Trim()

  if ($status.Count -gt 0) {
    Write-Promotion ([ordered]@{ status = "fail"; reason = "repo_not_clean"; branch_name = $BranchName; current_branch = $current }) 1
  }
  if ($baseHead -ne $originHead) {
    Write-Promotion ([ordered]@{ status = "NEED_REBASE_OR_RERUN"; reason = "base_branch_moved"; branch_name = $BranchName }) 3
  }

  if ($DryRun) {
    Write-Promotion ([ordered]@{
      status = "dry_run"
      branch_name = $BranchName
      base_branch = $BaseBranch
      fast_forward_only = $true
      merge_commits_allowed = $false
      force_push_allowed = $false
      push = $false
    }) 0
  }

  git switch $BaseBranch | Out-File -Encoding utf8 (Join-Path $EvidenceDir "switch_base.log")
  git merge --ff-only $BranchName | Out-File -Encoding utf8 (Join-Path $EvidenceDir "ff_merge.log")
  git push origin $BaseBranch | Out-File -Encoding utf8 (Join-Path $EvidenceDir "push.log")
  $newHead = (git rev-parse --short HEAD).Trim()

  Write-Promotion ([ordered]@{
    status = "promoted"
    branch_name = $BranchName
    base_branch = $BaseBranch
    head = $newHead
    push = $true
    fast_forward_only = $true
  }) 0
} finally {
  Pop-Location
}
