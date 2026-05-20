$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "antigravity_agent_bridge.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_antigravity_bridge_{0}" -f [guid]::NewGuid().ToString("N"))
$expected = (git -C (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path rev-parse --short HEAD).Trim()

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Bridge {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "bridge failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Write-ProposalPack {
    param([string]$Dir, [string]$Nonce, [string]$FilePath, [bool]$PackageTouched = $false)
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    [ordered]@{
        proposal_id = "a20bk-fixture"
        nonce = $Nonce
        source_agent = "fixture"
        source_worktree = "C:/Users/suley/Documents/Dev/NeuroChess_Agent_Worktrees/a20bk-fixture"
        base_commit = $expected
        objective = "Harmless bridge fixture proposal"
        files_changed = @($FilePath)
        allowed_paths = @((Split-Path $FilePath -Parent).Replace("\", "/") + "/")
        forbidden_paths = @("backend/**", "package.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
        dependencies_added = @()
        package_files_touched = $PackageTouched
        backend_touched = $false
        frontend_dev_only = $true
        screenshots_path = "external-only"
        tests_run = @("fixture")
        test_results = [ordered]@{ fixture = "pass" }
        known_risks = @("fixture only")
        rollback_plan = "Delete the fixture file from the sandbox proposal."
        recommended_codex_action = "ACCEPT"
    } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Dir "proposal.json") -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "patch.diff") -Value @(
        "diff --git a/$FilePath b/$FilePath",
        "new file mode 100644",
        "index 0000000..3333333",
        "--- /dev/null",
        "+++ b/$FilePath",
        "@@ -0,0 +1,3 @@",
        "+# Antigravity Bridge Fixture",
        "+",
        "+Safe dummy proposal."
    ) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "summary.md") -Value "Safe fixture proposal for bridge testing." -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "risk_report.json") -Value '{"risk":"low"}' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "test_report.json") -Value '{"tests":"fixture pass"}' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "files_touched.txt") -Value $FilePath -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $Dir "integration_notes.md") -Value "Rollback by deleting the fixture file." -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

    $status = Invoke-Bridge -Arguments @("-Mode", "Status", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($status.status -eq "ANTIGRAVITY_AGENT_BRIDGE_READY") "bridge status missing"

    $prepared = Invoke-Bridge -Arguments @("-Mode", "PrepareInbox", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($prepared.status -eq "ANTIGRAVITY_INBOX_PREPARED") "inbox should be prepared"
    Assert-True (Test-Path -LiteralPath (Join-Path $tempRoot "inbox\work_order.md")) "work order missing"

    $missing = Invoke-Bridge -Arguments @("-Mode", "CheckOutbox", "-ArtifactRoot", $tempRoot, "-NoPrompt")
    Assert-True ($missing.status -eq "PROPOSAL_NOT_FOUND") "missing proposal should return PROPOSAL_NOT_FOUND"

    $safe = Join-Path $tempRoot "outbox\proposal_pack"
    Write-ProposalPack -Dir $safe -Nonce "a20bk-safe-nonce" -FilePath "frontend/src/dev/antigravity-spikes/bridge-fixture.md"
    $valid = Invoke-Bridge -Arguments @("-Mode", "ValidateOutbox", "-ArtifactRoot", $tempRoot, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "nonce_safe.json"), "-NoPrompt")
    Assert-True ($valid.status -eq "ANTIGRAVITY_BRIDGE_PROPOSAL_VALID") "safe dummy proposal should validate"

    $unsafeRoot = Join-Path $tempRoot "unsafe"
    $unsafePack = Join-Path $unsafeRoot "outbox\proposal_pack"
    Write-ProposalPack -Dir $unsafePack -Nonce "a20bk-unsafe-nonce" -FilePath "package.json" -PackageTouched $true
    $unsafe = Invoke-Bridge -Arguments @("-Mode", "ValidateOutbox", "-ArtifactRoot", $unsafeRoot, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "nonce_unsafe.json"), "-NoPrompt")
    Assert-True ($unsafe.status -eq "ANTIGRAVITY_BRIDGE_PROPOSAL_REJECTED") "unsafe proposal should reject"

    $manualRoot = Join-Path $tempRoot "manual"
    $manual = Invoke-Bridge -Arguments @("-Mode", "CreateManualBridge", "-ArtifactRoot", $manualRoot, "-NoPrompt")
    Assert-True ($manual.status -eq "ANTIGRAVITY_MANUAL_BRIDGE_CREATED") "manual bridge should be created"

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch '\[System\.Windows\.Forms\.SendKeys\]|WScript\.Shell.*SendKeys') "bridge must not use SendKeys APIs"
    Assert-True ($source -notmatch "git commit") "bridge must not commit"
    Assert-True ($source -notmatch "git push") "bridge must not push"

    [ordered]@{
        status = "pass"
        tests = 12
        file_inbox_outbox_bridge_fixture = $true
        proposal_not_found = $true
        unsafe_proposal_rejected = $true
        safe_dummy_proposal_validates = $true
        manual_fallback_created = $true
        antigravity_cannot_commit_or_push = $true
    } | ConvertTo-Json -Depth 12
} finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
