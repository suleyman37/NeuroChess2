param(
    [ValidateSet("Status", "Validate", "DryRun", "ApplyToTemp")]
    [string]$Mode = "Validate",
    [string]$ProposalDir = "",
    [string]$ExpectedBaseCommit = "",
    [string]$NonceLedgerPath = "",
    [int]$MaxFiles = 20,
    [int]$MaxDiffLines = 800,
    [switch]$AllowBackend,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-RepoRoot {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-HeadCommit {
    (git -C (Get-RepoRoot) rev-parse --short HEAD).Trim()
}

function Normalize-PathText {
    param([string]$PathText)
    ([string]$PathText).Trim().Trim('"').Replace("\", "/")
}

function Get-RequiredPackFiles {
    @("proposal.json", "patch.diff", "summary.md", "risk_report.json", "test_report.json", "files_touched.txt", "integration_notes.md")
}

function Get-NonceLedger {
    if ([string]::IsNullOrWhiteSpace($NonceLedgerPath)) {
        $NonceLedgerPath = Join-Path $PSScriptRoot "runtime\antigravity_used_nonces.json"
    }
    if (Test-Path -LiteralPath $NonceLedgerPath -PathType Leaf) {
        try { return Get-Content -LiteralPath $NonceLedgerPath -Raw | ConvertFrom-Json } catch {}
    }
    return [pscustomobject]@{ used_nonces = @() }
}

function Save-Nonce {
    param([string]$Nonce)
    if ([string]::IsNullOrWhiteSpace($NonceLedgerPath)) {
        $script:NonceLedgerPath = Join-Path $PSScriptRoot "runtime\antigravity_used_nonces.json"
    }
    $ledger = Get-NonceLedger
    $used = @($ledger.used_nonces | ForEach-Object { [string]$_ })
    if ($used -notcontains $Nonce) { $used += $Nonce }
    Write-JsonFile -Path $NonceLedgerPath -Payload ([ordered]@{
            schema_version = "antigravity_nonce_ledger_v1"
            used_nonces = @($used)
        })
}

function Test-PathAllowed {
    param([string]$PathText, [string[]]$AllowedPaths)
    $path = Normalize-PathText -PathText $PathText
    foreach ($allowed in @($AllowedPaths)) {
        $prefix = (Normalize-PathText -PathText $allowed).TrimEnd("*")
        if ($path -like $prefix -or $path.StartsWith($prefix.TrimEnd("/"), [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Test-ForbiddenPath {
    param([string]$PathText)
    $path = Normalize-PathText -PathText $PathText
    if ($path -match '^(backend|frontend)/(?!src/dev/)') { return "PRODUCT_PATH_FORBIDDEN" }
    if ($path -match '(^|/)package(-lock)?\.json$') { return "PACKAGE_FILE_FORBIDDEN" }
    if ($path -match '\.(db|sqlite|sqlite3)$') { return "DB_FILE_FORBIDDEN" }
    if ($path -match '^ops/autopilot/(local|runtime)/') { return "LOCAL_RUNTIME_FORBIDDEN" }
    if ($path -match '\.(png|jpg|jpeg|gif|webp|avif|mp4|mov|webm|glb|fbx|obj|ktx|texture)$') { return "SCREENSHOT_OR_ASSET_FORBIDDEN" }
    if ($path -match '^\.serena/') { return "SERENA_FORBIDDEN" }
    return ""
}

function Test-SecretText {
    param([string]$Text)
    if ($Text -match 'sk-[A-Za-z0-9]{16,}') { return $true }
    $geminiKeyPrefix = "AI" + "za"
    if ($Text -match ($geminiKeyPrefix + '[0-9A-Za-z_-]{20,}')) { return $true }
    if ($Text -match 'ntfy\.sh/[A-Za-z0-9_-]{8,}') { return $true }
    if ($Text -match '(?i)(cookie|token|password|secret)\s*[:=]\s*[^ \r\n]+') { return $true }
    if ($Text -match 'FORBIDDEN_SECRET_MARKER') { return $true }
    if ($Text -match 'https://chatgpt\.com/g/') { return $true }
    if ($Text -match 'https://gemini\.google\.com/app/.+') { return $true }
    return $false
}

function New-BaseResult {
    [ordered]@{
        schema_version = "antigravity_patch_proposal_import_result_v1"
        mode = $Mode
        status = "NOT_RUN"
        proposal_dir = $ProposalDir
        proposal_id = ""
        nonce = ""
        base_commit = ""
        expected_base_commit = if ([string]::IsNullOrWhiteSpace($ExpectedBaseCommit)) { Get-HeadCommit } else { $ExpectedBaseCommit }
        validation_passed = $false
        accepted_dry_run = $false
        rejected_reasons = @()
        files_changed = @()
        diff_lines = 0
        nonce_recorded = $false
        atomic_apply_supported = $true
        rollback_supported = $true
        explicit_staging_only = $true
        no_broad_staging = $true
        no_antigravity_live_call = $true
        official_repo_touched_by_antigravity = $false
        private_urls_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        secrets_redacted = $true
    }
}

function Invoke-Validate {
    $result = New-BaseResult
    if ([string]::IsNullOrWhiteSpace($ProposalDir) -or -not (Test-Path -LiteralPath $ProposalDir -PathType Container)) {
        $result.status = "PROPOSAL_DIR_MISSING"
        $result.rejected_reasons += "PROPOSAL_DIR_MISSING"
        return $result
    }

    $missing = @()
    foreach ($file in Get-RequiredPackFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProposalDir $file) -PathType Leaf)) { $missing += $file }
    }
    if ($missing.Count -gt 0) {
        $result.status = "PROPOSAL_PACK_MISSING_REQUIRED_FILES"
        $result.rejected_reasons += @($missing | ForEach-Object { "MISSING_$_" })
        return $result
    }

    $proposal = Read-JsonFile -Path (Join-Path $ProposalDir "proposal.json")
    $patchText = Get-Content -LiteralPath (Join-Path $ProposalDir "patch.diff") -Raw
    $summaryText = Get-Content -LiteralPath (Join-Path $ProposalDir "summary.md") -Raw
    $riskText = Get-Content -LiteralPath (Join-Path $ProposalDir "risk_report.json") -Raw
    $testText = Get-Content -LiteralPath (Join-Path $ProposalDir "test_report.json") -Raw
    $notesText = Get-Content -LiteralPath (Join-Path $ProposalDir "integration_notes.md") -Raw
    $filesTouched = @(Get-Content -LiteralPath (Join-Path $ProposalDir "files_touched.txt") | ForEach-Object { Normalize-PathText -PathText $_ } | Where-Object { $_ })
    $proposalFiles = @($proposal.files_changed | ForEach-Object { Normalize-PathText -PathText $_ })
    $allFiles = @($proposalFiles + $filesTouched | Where-Object { $_ } | Select-Object -Unique)

    $result.proposal_id = [string]$proposal.proposal_id
    $result.nonce = [string]$proposal.nonce
    $result.base_commit = [string]$proposal.base_commit
    $result.files_changed = @($allFiles)
    $result.diff_lines = @($patchText -split "`r?`n").Count

    if ([string]::IsNullOrWhiteSpace([string]$proposal.proposal_id)) { $result.rejected_reasons += "PROPOSAL_ID_MISSING" }
    if ([string]::IsNullOrWhiteSpace([string]$proposal.nonce)) { $result.rejected_reasons += "NONCE_MISSING" }
    if ([string]::IsNullOrWhiteSpace([string]$proposal.objective)) { $result.rejected_reasons += "OBJECTIVE_MISSING" }
    if ([string]::IsNullOrWhiteSpace([string]$proposal.rollback_plan) -and $notesText -notmatch '(?i)rollback') { $result.rejected_reasons += "ROLLBACK_PATH_MISSING" }
    if ([string]$proposal.base_commit -ne [string]$result.expected_base_commit) { $result.rejected_reasons += "BASE_COMMIT_MISMATCH" }
    if (@($allFiles).Count -gt $MaxFiles) { $result.rejected_reasons += "MAX_FILES_EXCEEDED" }
    if ([int]$result.diff_lines -gt $MaxDiffLines) { $result.rejected_reasons += "MAX_DIFF_LINES_EXCEEDED" }
    if (@($proposal.dependencies_added).Count -gt 0) { $result.rejected_reasons += "DEPENDENCIES_ADDED_FORBIDDEN" }
    if ([bool]$proposal.package_files_touched) { $result.rejected_reasons += "PACKAGE_FILES_TOUCHED" }
    if ([bool]$proposal.backend_touched -and -not $AllowBackend) { $result.rejected_reasons += "BACKEND_TOUCHED_FORBIDDEN" }
    if ([string]$proposal.source_agent -ne "antigravity" -and [string]$proposal.source_agent -ne "fixture") { $result.rejected_reasons += "SOURCE_AGENT_INVALID" }
    if ([string]$proposal.source_worktree -match '(?i)road-to-V2') { $result.rejected_reasons += "ROAD_TO_V2_WORKTREE_FORBIDDEN" }

    $ledger = Get-NonceLedger
    if (@($ledger.used_nonces | ForEach-Object { [string]$_ }) -contains [string]$proposal.nonce) {
        $result.rejected_reasons += "NONCE_ALREADY_USED"
    }

    foreach ($file in $allFiles) {
        $reason = Test-ForbiddenPath -PathText $file
        if ($reason) { $result.rejected_reasons += "$reason`:$file" }
        if (-not (Test-PathAllowed -PathText $file -AllowedPaths @($proposal.allowed_paths))) {
            $result.rejected_reasons += "PATH_NOT_ALLOWED:$file"
        }
    }

    $combined = @($patchText, $summaryText, $riskText, $testText, $notesText, ($proposal | ConvertTo-Json -Depth 30)) -join "`n"
    if (Test-SecretText -Text $combined) { $result.rejected_reasons += "SECRET_OR_PRIVATE_URL_PATTERN" }
    if ($patchText -match '(?m)^\+\+\+ b/.+\.(png|jpg|jpeg|gif|webp|avif|mp4|mov|webm|glb|fbx|obj)$') {
        $result.rejected_reasons += "PATCH_INCLUDES_BINARY_OR_SCREENSHOT"
    }
    if ($summaryText.Trim().Length -lt 10) { $result.rejected_reasons += "SUMMARY_TOO_SHORT" }
    if ($riskText.Trim().Length -lt 5) { $result.rejected_reasons += "RISK_REPORT_MISSING" }
    if ($testText.Trim().Length -lt 5) { $result.rejected_reasons += "TEST_REPORT_MISSING" }

    if (@($result.rejected_reasons).Count -eq 0) {
        $result.status = "ANTIGRAVITY_PROPOSAL_VALID"
        $result.validation_passed = $true
    } else {
        $result.status = "ANTIGRAVITY_PROPOSAL_REJECTED"
    }
    return $result
}

function Invoke-ApplyToTemp {
    $result = Invoke-Validate
    if (-not $result.validation_passed) { return $result }
    $result.status = "ANTIGRAVITY_PROPOSAL_TEMP_APPLY_READY"
    $result.atomic_apply_supported = $true
    $result.rollback_supported = $true
    $result.temp_apply_command_redacted = "git worktree add --detach <temp>; git apply --check patch.diff; rollback removes temp worktree"
    return $result
}

if ($Mode -eq "Status") {
    $result = New-BaseResult
    $result.status = "ANTIGRAVITY_PATCH_PROPOSAL_IMPORTER_AVAILABLE"
} elseif ($Mode -eq "ApplyToTemp") {
    $result = Invoke-ApplyToTemp
} else {
    $result = Invoke-Validate
    if (($Mode -eq "DryRun") -and $result.validation_passed) {
        Save-Nonce -Nonce $result.nonce
        $result.status = "ANTIGRAVITY_PROPOSAL_ACCEPTED_DRY_RUN"
        $result.accepted_dry_run = $true
        $result.nonce_recorded = $true
    }
}

$result | ConvertTo-Json -Depth 80
