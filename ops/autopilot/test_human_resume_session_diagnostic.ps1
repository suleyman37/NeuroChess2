$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ad_human_resume_diagnostic_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

try {
    $helperPath = Join-Path $RepoRoot "ops\autopilot\diagnose_human_resume_session.ps1"
    Assert-True (Test-Path -LiteralPath $helperPath -PathType Leaf) "diagnostic helper is missing"

    $source = Get-Content -LiteralPath $helperPath -Raw
    Assert-True ($source -match "connectOverCDP") "helper must inspect the existing CDP browser"
    Assert-True ($source -match "human_verification_detected") "helper must report verification markers"
    Assert-True ($source -match "login_detected") "helper must report login markers"
    Assert-True ($source -match "resume_ready") "helper must report resume readiness"
    Assert-True ($source -match "url_redacted") "helper must redact page URLs"
    Assert-True ($source -match "cookies_read = false" -or $source -match "cookies_read") "helper must report cookie non-use"
    Assert-True ($source -notmatch '\.click\s*\(') "helper must not click"
    Assert-True ($source -notmatch '\.fill\s*\(') "helper must not fill inputs"
    Assert-True ($source -notmatch 'keyboard\.') "helper must not use keyboard automation"
    Assert-True ($source -notmatch 'setInputFiles') "helper must not upload files"
    Assert-True ($source -notmatch 'localStorage') "helper must not read localStorage"
    Assert-True ($source -notmatch 'document\.cookie') "helper must not read cookies"
    Assert-True ($source -notmatch 'browser\.close\s*\(') "helper must not close user-owned Chrome"

    $fixturePath = Join-Path $TempRoot "fixture_state.json"
    [ordered]@{
        current_state = "HUMAN_OR_AUTH_WALL"
        browser_reachable = $true
        cdp_attached = $true
        page_closed = $false
        url_redacted = $true
        human_verification_detected = $true
        login_detected = $true
        consent_detected = $false
        auth_wall_detected = $true
        composer_like_visible_count = 0
        file_input_count = 0
        resume_ready = $false
        click_attempted = $false
        type_attempted = $false
        submit_attempted = $false
        upload_attempted = $false
        bypass_attempted = $false
        cookies_read = $false
        local_storage_read = $false
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $fixturePath -Encoding UTF8

    $outPath = Join-Path $TempRoot "snapshot.json"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $helperPath `
        -ServiceName ChatGPT `
        -MissionId A20AD_TEST `
        -OutPath $outPath `
        -ArtifactPath $TempRoot `
        -FixtureStatePath $fixturePath 2>&1
    Assert-True (($output | Out-String) -match "HUMAN_RESUME_SESSION_SNAPSHOT_WRITTEN") "helper did not write fixture snapshot"
    Assert-True (Test-Path -LiteralPath $outPath -PathType Leaf) "fixture snapshot was not written"
    $snapshot = Get-Content -LiteralPath $outPath -Raw | ConvertFrom-Json
    Assert-True ($snapshot.fixture_mode -eq $true) "fixture mode was not recorded"
    Assert-True ($snapshot.current_state -eq "HUMAN_OR_AUTH_WALL") "fixture state was not preserved"
    Assert-True ($snapshot.url_redacted -eq $true) "fixture snapshot did not preserve URL redaction"
    Assert-True ($snapshot.click_attempted -eq $false) "fixture snapshot suggested clicking"
    Assert-True ($snapshot.upload_attempted -eq $false) "fixture snapshot suggested upload"
    Assert-True ($snapshot.bypass_attempted -eq $false) "fixture snapshot suggested bypass"

    [ordered]@{
        status = "pass"
        tests = 22
        helper_created = $true
        read_only_source_scan_passed = $true
        fixture_snapshot_passed = $true
        closes_user_chrome = $false
        clicks_verification = $false
        uploads_files = $false
        reads_secrets = $false
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
