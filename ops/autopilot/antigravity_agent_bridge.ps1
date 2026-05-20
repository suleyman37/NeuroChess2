param(
    [ValidateSet("Status", "PrepareInbox", "CheckOutbox", "ValidateOutbox", "CreateManualBridge", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BK",
    [string]$ArtifactRoot = "",
    [string]$InboxPath = "",
    [string]$OutboxPath = "",
    [string]$ProposalDir = "",
    [string]$ExpectedBaseCommit = "",
    [string]$NonceLedgerPath = "",
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-HeadCommit {
    (git -C (Get-RepoRoot) rev-parse --short HEAD).Trim()
}

function Get-DefaultRoot {
    "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BK_screenshot_first_transport_bridge_20260518"
}

function Resolve-BridgePaths {
    $root = if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) { Get-DefaultRoot } else { $ArtifactRoot }
    [ordered]@{
        root = $root
        inbox = if ([string]::IsNullOrWhiteSpace($InboxPath)) { Join-Path $root "inbox" } else { $InboxPath }
        outbox = if ([string]::IsNullOrWhiteSpace($OutboxPath)) { Join-Path $root "outbox" } else { $OutboxPath }
        artifacts = Join-Path $root "artifacts"
    }
}

function Write-TextFile {
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-PathInside {
    param([string]$Child, [string]$Parent)
    if ([string]::IsNullOrWhiteSpace($Child) -or [string]::IsNullOrWhiteSpace($Parent)) { return $false }
    try {
        $childFull = if (Test-Path -LiteralPath $Child) { (Resolve-Path -LiteralPath $Child).Path } else { [System.IO.Path]::GetFullPath($Child) }
        $parentFull = if (Test-Path -LiteralPath $Parent) { (Resolve-Path -LiteralPath $Parent).Path } else { [System.IO.Path]::GetFullPath($Parent) }
        return $childFull.StartsWith($parentFull.TrimEnd("\") + "\", [System.StringComparison]::OrdinalIgnoreCase) -or
            $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase)
    } catch {
        return $false
    }
}

function Assert-ExternalPath {
    param([string]$Path)
    if (Test-PathInside -Child $Path -Parent (Get-RepoRoot)) {
        throw "Bridge path must be external to the official repo."
    }
}

function New-BaseResult {
    $paths = Resolve-BridgePaths
    [ordered]@{
        schema_version = "antigravity_agent_bridge_result_v1"
        mission_id = $MissionId
        mode = $Mode
        status = "NOT_RUN"
        inbox_path = $paths.inbox
        outbox_path = $paths.outbox
        artifacts_path = $paths.artifacts
        file_bridge_external = $true
        official_repo_touched_by_antigravity = $false
        antigravity_commit_forbidden = $true
        antigravity_push_forbidden = $true
        no_blind_typing = $true
    }
}

function Invoke-PrepareInbox {
    $paths = Resolve-BridgePaths
    Assert-ExternalPath -Path $paths.root
    New-Item -ItemType Directory -Force -Path $paths.inbox, $paths.outbox, $paths.artifacts | Out-Null
    $workOrder = @"
# A20BK Tiny Bridge Test Work Order

This is a bounded bridge test, not a visual spike.

Antigravity must work only in an external sandbox/worktree under:
C:\Users\suley\Documents\Dev\NeuroChess_Agent_Worktrees

Create a Patch Proposal Pack in the outbox. Do not commit. Do not push. Do not touch the official repo.

Objective:
Create a harmless dummy DEV-only proposal pack that touches only:
frontend/src/dev/antigravity_transport_dummy/sample.md

Required pack files:
- proposal.json
- patch.diff
- summary.md
- risk_report.json
- test_report.json
- files_touched.txt
- integration_notes.md
"@
    Write-TextFile -Path (Join-Path $paths.inbox "work_order.md") -Content $workOrder
    Write-TextFile -Path (Join-Path $paths.inbox "allowed_paths.txt") -Content "frontend/src/dev/antigravity_transport_dummy/sample.md`n"
    Write-TextFile -Path (Join-Path $paths.inbox "forbidden_paths.txt") -Content "backend/**`npackage.json`npackage-lock.json`nops/autopilot/local/**`nops/autopilot/runtime/**`nroad-to-V2`n"
    $result = New-BaseResult
    $result.status = "ANTIGRAVITY_INBOX_PREPARED"
    $result.work_order_path = Join-Path $paths.inbox "work_order.md"
    return $result
}

function Get-ProposalPath {
    $paths = Resolve-BridgePaths
    if (-not [string]::IsNullOrWhiteSpace($ProposalDir)) { return $ProposalDir }
    $candidate = Join-Path $paths.outbox "proposal_pack"
    if (Test-Path -LiteralPath $candidate -PathType Container) { return $candidate }
    return $paths.outbox
}

function Invoke-CheckOutbox {
    $proposalPath = Get-ProposalPath
    $result = New-BaseResult
    $result.proposal_dir = $proposalPath
    $required = @("proposal.json", "patch.diff", "summary.md", "risk_report.json", "test_report.json", "files_touched.txt", "integration_notes.md")
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $proposalPath $_) -PathType Leaf) })
    if ($missing.Count -gt 0) {
        $result.status = "PROPOSAL_NOT_FOUND"
        $result.missing_files = @($missing)
        return $result
    }
    $result.status = "PROPOSAL_PACK_FOUND"
    return $result
}

function Invoke-ValidateOutbox {
    $check = Invoke-CheckOutbox
    if ($check.status -ne "PROPOSAL_PACK_FOUND") { return $check }
    $expected = if ([string]::IsNullOrWhiteSpace($ExpectedBaseCommit)) { Get-HeadCommit } else { $ExpectedBaseCommit }
    $ledger = if ([string]::IsNullOrWhiteSpace($NonceLedgerPath)) {
        Join-Path ([System.IO.Path]::GetTempPath()) ("antigravity_bridge_nonce_{0}.json" -f ([guid]::NewGuid().ToString("N")))
    } else {
        $NonceLedgerPath
    }
    $importer = Join-Path $PSScriptRoot "import_antigravity_patch_proposal.ps1"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $importer -Mode Validate -ProposalDir $check.proposal_dir -ExpectedBaseCommit $expected -NonceLedgerPath $ledger -NoPrompt 2>&1
    if ($LASTEXITCODE -ne 0) { throw "proposal validation command failed: $($output | Out-String)" }
    $text = ($output | Out-String).Trim()
    $json = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
    $result = New-BaseResult
    $result.status = if ($json.validation_passed) { "ANTIGRAVITY_BRIDGE_PROPOSAL_VALID" } else { "ANTIGRAVITY_BRIDGE_PROPOSAL_REJECTED" }
    $result.importer_result = $json
    $result.proposal_dir = $check.proposal_dir
    return $result
}

function Invoke-CreateManualBridge {
    $prepared = Invoke-PrepareInbox
    $paths = Resolve-BridgePaths
    $manual = @"
# Manual Antigravity Bridge

Codex prepared an inbox/outbox bridge, but it will not type into a GUI or launch uncontrolled Antigravity automation.

Human or a future safe Antigravity transport may open the inbox work order, execute it inside an external sandbox/worktree, and write a Patch Proposal Pack to the outbox.

Codex will only validate the outbox pack after all required files exist.
"@
    Write-TextFile -Path (Join-Path $paths.artifacts "manual_bridge_instructions.md") -Content $manual
    $prepared.status = "ANTIGRAVITY_MANUAL_BRIDGE_CREATED"
    $prepared.manual_instructions_path = Join-Path $paths.artifacts "manual_bridge_instructions.md"
    return $prepared
}

if ($Mode -eq "Status") {
    $result = New-BaseResult
    $result.status = "ANTIGRAVITY_AGENT_BRIDGE_READY"
} elseif ($Mode -eq "PrepareInbox") {
    $result = Invoke-PrepareInbox
} elseif ($Mode -eq "CheckOutbox") {
    $result = Invoke-CheckOutbox
} elseif ($Mode -eq "ValidateOutbox") {
    $result = Invoke-ValidateOutbox
} elseif ($Mode -eq "CreateManualBridge") {
    $result = Invoke-CreateManualBridge
} else {
    $prepared = Invoke-PrepareInbox
    $missing = Invoke-CheckOutbox
    $result = [ordered]@{
        schema_version = "antigravity_agent_bridge_dry_run_v1"
        status = "ANTIGRAVITY_AGENT_BRIDGE_DRY_RUN_PASS"
        inbox_status = $prepared.status
        outbox_status = $missing.status
        file_bridge_external = $true
        no_blind_typing = $true
    }
}

$result | ConvertTo-Json -Depth 80
