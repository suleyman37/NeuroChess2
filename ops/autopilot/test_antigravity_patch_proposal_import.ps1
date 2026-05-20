$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "import_antigravity_patch_proposal.ps1"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixture = Join-Path $PSScriptRoot "fixtures\antigravity_patch_proposal_sample"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_antigravity_import_test_{0}" -f [guid]::NewGuid().ToString("N"))
$ledger = Join-Path $tempRoot "nonce_ledger.json"

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Importer {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "importer failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Copy-Fixture {
    param([string]$Name)
    $dest = Join-Path $tempRoot $Name
    Copy-Item -LiteralPath $fixture -Destination $dest -Recurse
    return $dest
}

function Read-Proposal {
    param([string]$Dir)
    Get-Content -LiteralPath (Join-Path $Dir "proposal.json") -Raw | ConvertFrom-Json
}

function Write-Proposal {
    param([string]$Dir, $Proposal)
    $Proposal | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $Dir "proposal.json") -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    $expected = (Read-Proposal -Dir $fixture).base_commit

    $safe = Copy-Fixture -Name "safe"
    $valid = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $safe, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", $ledger, "-NoPrompt")
    Assert-True ($valid.status -eq "ANTIGRAVITY_PROPOSAL_VALID") "safe proposal should validate"
    Assert-True ([bool]$valid.validation_passed) "safe proposal validation flag missing"
    Assert-True ([bool]$valid.atomic_apply_supported -and [bool]$valid.rollback_supported) "atomic apply/rollback support missing"

    $dry = Invoke-Importer -Arguments @("-Mode", "DryRun", "-ProposalDir", $safe, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", $ledger, "-NoPrompt")
    Assert-True ($dry.status -eq "ANTIGRAVITY_PROPOSAL_ACCEPTED_DRY_RUN") "safe proposal should be accepted in dry-run"
    Assert-True ([bool]$dry.nonce_recorded) "nonce should be recorded on dry-run accept"

    $duplicate = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $safe, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", $ledger, "-NoPrompt")
    Assert-True ($duplicate.status -eq "ANTIGRAVITY_PROPOSAL_REJECTED") "duplicate nonce should reject"
    Assert-True (@($duplicate.rejected_reasons) -contains "NONCE_ALREADY_USED") "duplicate nonce reason missing"

    $baseMismatch = Copy-Fixture -Name "base_mismatch"
    $baseResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $baseMismatch, "-ExpectedBaseCommit", "0000000", "-NonceLedgerPath", (Join-Path $tempRoot "base_ledger.json"), "-NoPrompt")
    Assert-True (@($baseResult.rejected_reasons) -contains "BASE_COMMIT_MISMATCH") "base mismatch should reject"

    $package = Copy-Fixture -Name "package"
    $p = Read-Proposal -Dir $package
    $p.nonce = "a20bh-package-nonce"
    $p.files_changed = @("package.json")
    $p.package_files_touched = $true
    $p.allowed_paths = @("package.json")
    Write-Proposal -Dir $package -Proposal $p
    Set-Content -LiteralPath (Join-Path $package "files_touched.txt") -Value "package.json" -Encoding UTF8
    Add-Content -LiteralPath (Join-Path $package "patch.diff") -Value "`ndiff --git a/package.json b/package.json`n"
    $packageResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $package, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "pkg_ledger.json"), "-NoPrompt")
    Assert-True (($packageResult.rejected_reasons -join "|") -match "PACKAGE") "package file should reject"

    $backend = Copy-Fixture -Name "backend"
    $p = Read-Proposal -Dir $backend
    $p.nonce = "a20bh-backend-nonce"
    $p.files_changed = @("backend/app.py")
    $p.backend_touched = $true
    $p.allowed_paths = @("backend/")
    Write-Proposal -Dir $backend -Proposal $p
    Set-Content -LiteralPath (Join-Path $backend "files_touched.txt") -Value "backend/app.py" -Encoding UTF8
    $backendResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $backend, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "backend_ledger.json"), "-NoPrompt")
    Assert-True (($backendResult.rejected_reasons -join "|") -match "BACKEND") "backend file should reject"

    $image = Copy-Fixture -Name "image"
    $p = Read-Proposal -Dir $image
    $p.nonce = "a20bh-image-nonce"
    $p.files_changed = @("docs/autopilot/sample.png")
    $p.allowed_paths = @("docs/autopilot/")
    Write-Proposal -Dir $image -Proposal $p
    Set-Content -LiteralPath (Join-Path $image "files_touched.txt") -Value "docs/autopilot/sample.png" -Encoding UTF8
    $imageResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $image, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "image_ledger.json"), "-NoPrompt")
    Assert-True (($imageResult.rejected_reasons -join "|") -match "SCREENSHOT|ASSET") "image/screenshot should reject"

    $secret = Copy-Fixture -Name "secret"
    $p = Read-Proposal -Dir $secret
    $p.nonce = "a20bh-secret-nonce"
    Write-Proposal -Dir $secret -Proposal $p
    Add-Content -LiteralPath (Join-Path $secret "summary.md") -Value "FORBIDDEN_SECRET_MARKER"
    $secretResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $secret, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "secret_ledger.json"), "-NoPrompt")
    Assert-True (@($secretResult.rejected_reasons) -contains "SECRET_OR_PRIVATE_URL_PATTERN") "secret pattern should reject"

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch "git add -A") "importer must not use broad staging"
    Assert-True ($source -notmatch "git push") "importer must not push"

    [ordered]@{
        status = "pass"
        tests = 12
        safe_fixture_validates = $true
        duplicate_nonce_rejected = $true
        forbidden_paths_rejected = $true
        secrets_rejected = $true
        atomic_rollback_supported = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
