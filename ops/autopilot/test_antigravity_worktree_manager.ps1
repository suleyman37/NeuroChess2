$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "antigravity_worktree_manager.ps1"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$head = (git -C $repoRoot rev-parse --short HEAD).Trim()
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_antigravity_worktree_test_{0}" -f [guid]::NewGuid().ToString("N"))

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Manager {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "manager failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    $status = Invoke-Manager -Arguments @("-Mode", "Status", "-MissionId", "A20BH", "-BaseCommit", $head, "-SandboxRoot", $tempRoot, "-NoPrompt")
    Assert-True ($status.status -eq "ANTIGRAVITY_WORKTREE_MANAGER_AVAILABLE") "status not available"
    Assert-True (-not [bool]$status.antigravity_required) "Antigravity should not be required"
    Assert-True (-not [bool]$status.antigravity_called) "Antigravity must not be called"

    $plan = Invoke-Manager -Arguments @("-Mode", "PlanSandbox", "-MissionId", "A20BH", "-BaseCommit", $head, "-SandboxRoot", $tempRoot, "-NoPrompt")
    Assert-True ($plan.status -eq "ANTIGRAVITY_SANDBOX_PLAN_READY") "sandbox plan not ready"
    Assert-True ([bool]$plan.sandbox_root_external) "sandbox root should be external"
    Assert-True ($plan.base_commit -eq $head) "sandbox should use exact source commit"
    Assert-True ([bool]$plan.road_to_v2_forbidden) "road-to-V2 must be forbidden"
    Assert-True ([bool]$plan.official_repo_direct_write_forbidden) "official repo direct write must be forbidden"

    $dryCreate = Invoke-Manager -Arguments @("-Mode", "CreateSandbox", "-MissionId", "A20BH", "-BaseCommit", $head, "-SandboxRoot", $tempRoot, "-DryRun", "-NoPrompt")
    Assert-True ($dryCreate.status -eq "ANTIGRAVITY_SANDBOX_DRY_RUN_READY") "dry create should not create a worktree"
    Assert-True (-not [bool]$dryCreate.worktree_created) "dry create created a worktree"

    $insideRepo = Invoke-Manager -Arguments @("-Mode", "PlanSandbox", "-MissionId", "A20BH", "-BaseCommit", $head, "-SandboxRoot", (Join-Path $repoRoot "ops\autopilot\local\bad"), "-NoPrompt")
    Assert-True ($insideRepo.status -eq "SANDBOX_ROOT_INSIDE_REPO_REJECTED") "inside-repo sandbox root should be rejected"

    $invalidCommit = Invoke-Manager -Arguments @("-Mode", "PlanSandbox", "-MissionId", "A20BH", "-BaseCommit", "not-a-commit", "-SandboxRoot", $tempRoot, "-NoPrompt")
    Assert-True ($invalidCommit.status -eq "BASE_COMMIT_INVALID") "invalid base commit should be rejected"

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -match "worktree add --detach") "manager should support detached worktree creation"
    Assert-True ($source -match "worktree remove --force") "manager should expose explicit rollback/removal"
    Assert-True ($source -notmatch "git push") "manager must not push"

    [ordered]@{
        status = "pass"
        tests = 9
        worktree_manager = $true
        external_root_required = $true
        exact_base_commit = $true
        antigravity_not_required = $true
        official_repo_direct_write_forbidden = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
