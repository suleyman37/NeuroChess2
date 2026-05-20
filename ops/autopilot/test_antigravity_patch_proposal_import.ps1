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

    $missingRollback = Copy-Fixture -Name "missing_rollback"
    $p = Read-Proposal -Dir $missingRollback
    $p.nonce = "a20bm-missing-rollback-nonce"
    $p.rollback_plan = ""
    Write-Proposal -Dir $missingRollback -Proposal $p
    Set-Content -LiteralPath (Join-Path $missingRollback "integration_notes.md") -Value "No recovery plan supplied." -Encoding UTF8
    $missingRollbackResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $missingRollback, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "missing_rollback_ledger.json"), "-NoPrompt")
    Assert-True (@($missingRollbackResult.rejected_reasons) -contains "ROLLBACK_PATH_MISSING") "missing rollback path should reject"

    $missingNonce = Copy-Fixture -Name "missing_nonce"
    $p = Read-Proposal -Dir $missingNonce
    $p.nonce = ""
    Write-Proposal -Dir $missingNonce -Proposal $p
    $missingNonceResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $missingNonce, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "missing_nonce_ledger.json"), "-NoPrompt")
    Assert-True (@($missingNonceResult.rejected_reasons) -contains "NONCE_MISSING") "missing nonce should reject"

    $missingRisk = Copy-Fixture -Name "missing_risk"
    Remove-Item -LiteralPath (Join-Path $missingRisk "risk_report.json") -Force
    $missingRiskResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $missingRisk, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "missing_risk_ledger.json"), "-NoPrompt")
    Assert-True ($missingRiskResult.status -eq "PROPOSAL_PACK_MISSING_REQUIRED_FILES") "missing risk report should reject before validation"
    Assert-True (@($missingRiskResult.rejected_reasons) -contains "MISSING_risk_report.json") "missing risk report reason should be explicit"

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

    $v1Route = Copy-Fixture -Name "v1_route"
    $p = Read-Proposal -Dir $v1Route
    $p.nonce = "a20bi-v1-route-nonce"
    $p.files_changed = @("frontend/src/App.tsx")
    $p.allowed_paths = @("frontend/src/App.tsx")
    $p.frontend_dev_only = $false
    Write-Proposal -Dir $v1Route -Proposal $p
    Set-Content -LiteralPath (Join-Path $v1Route "files_touched.txt") -Value "frontend/src/App.tsx" -Encoding UTF8
    $v1RouteResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $v1Route, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "v1_route_ledger.json"), "-NoPrompt")
    Assert-True (($v1RouteResult.rejected_reasons -join "|") -match "PRODUCT_PATH_FORBIDDEN") "V1 route modification should reject"

    $legacyDev = Copy-Fixture -Name "legacy_dev_surface"
    $p = Read-Proposal -Dir $legacyDev
    $p.nonce = "a20bm-legacy-dev-surface-nonce"
    $p.files_changed = @("frontend/src/dev/antigravity/sample.tsx")
    $p.allowed_paths = @("frontend/src/dev/antigravity/")
    $p.frontend_dev_only = $true
    Write-Proposal -Dir $legacyDev -Proposal $p
    Set-Content -LiteralPath (Join-Path $legacyDev "files_touched.txt") -Value "frontend/src/dev/antigravity/sample.tsx" -Encoding UTF8
    $legacyDevResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $legacyDev, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "legacy_dev_ledger.json"), "-NoPrompt")
    Assert-True (($legacyDevResult.rejected_reasons -join "|") -match "DEV_IMPORT_SURFACE_FORBIDDEN|IMPORT_SURFACE_FORBIDDEN") "legacy dev surface should reject"

    $broad = Copy-Fixture -Name "broad"
    $p = Read-Proposal -Dir $broad
    $p.nonce = "a20bi-broad-nonce"
    $broadFiles = @(1..21 | ForEach-Object { "docs/autopilot/dev_proposal/file$_.md" })
    $p.files_changed = @($broadFiles)
    $p.allowed_paths = @("docs/autopilot/dev_proposal/")
    Write-Proposal -Dir $broad -Proposal $p
    Set-Content -LiteralPath (Join-Path $broad "files_touched.txt") -Value ($broadFiles -join [Environment]::NewLine) -Encoding UTF8
    $broadResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $broad, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "broad_ledger.json"), "-NoPrompt")
    Assert-True (@($broadResult.rejected_reasons) -contains "MAX_FILES_EXCEEDED") "broad patch should reject"

    $safeDev = Copy-Fixture -Name "safe_dev"
    $p = Read-Proposal -Dir $safeDev
    $p.nonce = "a20bi-safe-dev-nonce"
    $p.files_changed = @("frontend/src/dev/antigravity-spikes/sample.tsx")
    $p.allowed_paths = @("frontend/src/dev/antigravity-spikes/")
    $p.frontend_dev_only = $true
    Write-Proposal -Dir $safeDev -Proposal $p
    Set-Content -LiteralPath (Join-Path $safeDev "files_touched.txt") -Value "frontend/src/dev/antigravity-spikes/sample.tsx" -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $safeDev "patch.diff") -Value @(
        "diff --git a/frontend/src/dev/antigravity-spikes/sample.tsx b/frontend/src/dev/antigravity-spikes/sample.tsx",
        "new file mode 100644",
        "index 0000000..2222222",
        "--- /dev/null",
        "+++ b/frontend/src/dev/antigravity-spikes/sample.tsx",
        "@@ -0,0 +1,3 @@",
        "+export function SampleAntigravitySpike() {",
        "+  return null;",
        "+}"
    ) -Encoding UTF8
    $safeDevResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $safeDev, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "safe_dev_ledger.json"), "-NoPrompt")
    Assert-True ($safeDevResult.status -eq "ANTIGRAVITY_PROPOSAL_VALID") "safe DEV-only frontend proposal should validate in dry-run gate"

    $invalidPatch = Copy-Fixture -Name "invalid_patch"
    $p = Read-Proposal -Dir $invalidPatch
    $p.nonce = "a20bm-invalid-patch-nonce"
    Write-Proposal -Dir $invalidPatch -Proposal $p
    Set-Content -LiteralPath (Join-Path $invalidPatch "patch.diff") -Value "Conceptual diff only. Not generated by git." -Encoding UTF8
    $invalidPatchResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $invalidPatch, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "invalid_patch_ledger.json"), "-NoPrompt")
    Assert-True (($invalidPatchResult.rejected_reasons -join "|") -match "PATCH_DIFF_FORMAT_INVALID|PATCH_APPLY_CHECK_FAILED") "invalid patch.diff should reject"

    $image = Copy-Fixture -Name "image"
    $p = Read-Proposal -Dir $image
    $p.nonce = "a20bh-image-nonce"
    $p.files_changed = @("docs/autopilot/sample.png")
    $p.allowed_paths = @("docs/autopilot/")
    Write-Proposal -Dir $image -Proposal $p
    Set-Content -LiteralPath (Join-Path $image "files_touched.txt") -Value "docs/autopilot/sample.png" -Encoding UTF8
    $imageResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $image, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "image_ledger.json"), "-NoPrompt")
    Assert-True (($imageResult.rejected_reasons -join "|") -match "SCREENSHOT|ASSET") "image/screenshot should reject"

    $unsafeMarker = Copy-Fixture -Name "unsafe_marker"
    $p = Read-Proposal -Dir $unsafeMarker
    $p.nonce = "a20bh-secret-nonce"
    Write-Proposal -Dir $unsafeMarker -Proposal $p
    Add-Content -LiteralPath (Join-Path $unsafeMarker "summary.md") -Value "FORBIDDEN_SECRET_MARKER"
    $unsafeMarkerResult = Invoke-Importer -Arguments @("-Mode", "Validate", "-ProposalDir", $unsafeMarker, "-ExpectedBaseCommit", $expected, "-NonceLedgerPath", (Join-Path $tempRoot "unsafe_marker_ledger.json"), "-NoPrompt")
    Assert-True (@($unsafeMarkerResult.rejected_reasons) -contains "SECRET_OR_PRIVATE_URL_PATTERN") "unsafe marker should reject"

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch "git add -A") "importer must not use broad staging"
    Assert-True ($source -notmatch "git push") "importer must not push"

    [ordered]@{
        status = "pass"
        tests = 22
        safe_fixture_validates = $true
        duplicate_nonce_rejected = $true
        missing_nonce_rejected = $true
        missing_rollback_rejected = $true
        missing_risk_report_rejected = $true
        forbidden_paths_rejected = $true
        broad_patch_rejected = $true
        v1_route_rejected = $true
        legacy_dev_surface_rejected = $true
        safe_dev_only_frontend_validates = $true
        invalid_patch_rejected = $true
        secrets_rejected = $true
        atomic_rollback_supported = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
