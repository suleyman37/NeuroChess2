param(
    [ValidateSet("Status", "PlanSandbox", "CreateSandbox", "RemoveSandbox", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BH",
    [string]$BaseCommit = "",
    [string]$SandboxRoot = "",
    [string]$SandboxName = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-RepoRoot {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultSandboxRoot {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_Agent_Worktrees"
}

function Get-HeadCommit {
    (git -C (Get-RepoRoot) rev-parse --short HEAD).Trim()
}

function Get-SafeSandboxName {
    if (-not [string]::IsNullOrWhiteSpace($SandboxName)) {
        return ($SandboxName -replace '[^A-Za-z0-9_.-]', '-')
    }
    return ("{0}-antigravity-{1}" -f $MissionId.ToLowerInvariant(), (Get-HeadCommit))
}

function New-BaseResult {
    $root = if ([string]::IsNullOrWhiteSpace($SandboxRoot)) { Get-DefaultSandboxRoot } else { $SandboxRoot }
    $commit = if ([string]::IsNullOrWhiteSpace($BaseCommit)) { Get-HeadCommit } else { $BaseCommit }
    $name = Get-SafeSandboxName
    $repoRoot = Get-RepoRoot
    $sandboxPath = Join-Path $root $name
    $insideRepo = $false
    try {
        $parent = if (Test-Path -LiteralPath $root) { (Resolve-Path -LiteralPath $root).Path } else { [System.IO.Path]::GetFullPath($root) }
        $insideRepo = $parent.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {}
    [ordered]@{
        schema_version = "antigravity_worktree_manager_result_v1"
        mission_id = $MissionId
        mode = $Mode
        status = "NOT_RUN"
        base_commit = $commit
        sandbox_root = $root
        sandbox_path = $sandboxPath
        sandbox_root_external = -not $insideRepo
        sandbox_name = $name
        road_to_v2_forbidden = $true
        disposable = $true
        antigravity_required = $false
        antigravity_called = $false
        official_repo_direct_write_forbidden = $true
        official_repo_touched_by_antigravity = $false
        origin_push_forbidden = $true
        no_secrets = $true
        no_local_runtime_commit = $true
        no_broad_delete = $true
    }
}

function Test-BaseCommitSafe {
    param([string]$Commit)
    return $Commit -match '^[0-9a-fA-F]{7,40}$'
}

function Invoke-Plan {
    $result = New-BaseResult
    if (-not $result.sandbox_root_external) {
        $result.status = "SANDBOX_ROOT_INSIDE_REPO_REJECTED"
        return $result
    }
    if (-not (Test-BaseCommitSafe -Commit $result.base_commit)) {
        $result.status = "BASE_COMMIT_INVALID"
        return $result
    }
    if ($result.sandbox_path -match "road-to-V2") {
        $result.status = "ROAD_TO_V2_SANDBOX_FORBIDDEN"
        return $result
    }
    $result.status = "ANTIGRAVITY_SANDBOX_PLAN_READY"
    $result.create_command_redacted = "git worktree add --detach <external-sandbox> <base-commit>"
    $result.remove_command_explicit_only = "git worktree remove <external-sandbox>"
    return $result
}

function Invoke-Create {
    $result = Invoke-Plan
    if ($result.status -ne "ANTIGRAVITY_SANDBOX_PLAN_READY") { return $result }
    if ($DryRun -or $Mode -eq "DryRun") {
        $result.status = "ANTIGRAVITY_SANDBOX_DRY_RUN_READY"
        $result.worktree_created = $false
        return $result
    }
    New-Item -ItemType Directory -Force -Path $result.sandbox_root | Out-Null
    if (Test-Path -LiteralPath $result.sandbox_path) {
        $result.status = "SANDBOX_ALREADY_EXISTS"
        $result.worktree_created = $false
        return $result
    }
    $output = git -C (Get-RepoRoot) worktree add --detach $result.sandbox_path $result.base_commit 2>&1
    if ($LASTEXITCODE -ne 0) {
        $result.status = "SANDBOX_CREATE_FAILED"
        $result.error_code = (($output | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
        return $result
    }
    $result.status = "ANTIGRAVITY_SANDBOX_CREATED"
    $result.worktree_created = $true
    return $result
}

function Invoke-Remove {
    $result = Invoke-Plan
    if ($result.status -ne "ANTIGRAVITY_SANDBOX_PLAN_READY") { return $result }
    if (-not (Test-Path -LiteralPath $result.sandbox_path -PathType Container)) {
        $result.status = "SANDBOX_NOT_PRESENT"
        return $result
    }
    if ($DryRun) {
        $result.status = "SANDBOX_REMOVE_DRY_RUN_READY"
        return $result
    }
    $rootFull = if (Test-Path -LiteralPath $result.sandbox_root) { (Resolve-Path -LiteralPath $result.sandbox_root).Path } else { [System.IO.Path]::GetFullPath($result.sandbox_root) }
    $pathFull = (Resolve-Path -LiteralPath $result.sandbox_path).Path
    if (-not $pathFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $result.status = "SANDBOX_REMOVE_REJECTED_PATH_ESCAPE"
        return $result
    }
    $output = git -C (Get-RepoRoot) worktree remove --force $pathFull 2>&1
    if ($LASTEXITCODE -ne 0) {
        $result.status = "SANDBOX_REMOVE_FAILED"
        $result.error_code = (($output | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
        return $result
    }
    $result.status = "ANTIGRAVITY_SANDBOX_REMOVED"
    return $result
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) "antigravity_worktree_manager_result.json"
}

if ($Mode -eq "Status") {
    $result = New-BaseResult
    $result.status = "ANTIGRAVITY_WORKTREE_MANAGER_AVAILABLE"
} elseif ($Mode -eq "PlanSandbox") {
    $result = Invoke-Plan
} elseif ($Mode -eq "CreateSandbox" -or $Mode -eq "DryRun") {
    $result = Invoke-Create
} else {
    $result = Invoke-Remove
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 50
