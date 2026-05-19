$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_mcp_setup_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Setup {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mcp_playwright_setup_check.ps1") `
        -MissionId A20BC_TEST `
        -ArtifactPath $TempRoot `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected setup exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "setup did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $beforePackage = git -C $RepoRoot status --short -- package.json package-lock.json

    $nativeReady = Invoke-Setup -Arguments @("-MockMcpMissingNativeReady", "-NoPrompt")
    Assert-True ($nativeReady.status -eq "MCP_PLAYWRIGHT_NOT_AVAILABLE_NATIVE_FALLBACK_READY") "MCP missing did not fall back to native"
    Assert-True ($nativeReady.native_playwright_fallback.status -eq "NATIVE_PLAYWRIGHT_READY") "native fallback not ready in mock"
    Assert-True ($nativeReady.package_files_modified -eq $false) "package files marked modified"

    $mcpReady = Invoke-Setup -Arguments @("-MockMcpReady", "-NoPrompt")
    Assert-True ($mcpReady.status -eq "MCP_PLAYWRIGHT_READY") "MCP ready mock failed"
    Assert-True ($mcpReady.mcp_configured -eq $true) "MCP configured false"

    $unavailable = Invoke-Setup -Arguments @("-MockNativeUnavailable", "-NoPrompt")
    Assert-True ($unavailable.status -eq "MCP_PLAYWRIGHT_UNAVAILABLE_NATIVE_FALLBACK_UNAVAILABLE") "unavailable mock failed"

    $blocked = Invoke-Setup -Arguments @("-MockSetupBlocked", "-NoPrompt")
    Assert-True ($blocked.status -eq "MCP_PLAYWRIGHT_SETUP_BLOCKED") "setup blocked mock failed"

    $afterPackage = git -C $RepoRoot status --short -- package.json package-lock.json
    Assert-True (($beforePackage | Out-String) -eq ($afterPackage | Out-String)) "package file status changed"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\mcp_playwright_setup_check.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "setup check prompts user"
    Assert-True ($source -notmatch "npm install|yarn add|pnpm add") "setup check installs package dependencies"

    $artifactText = Get-ChildItem -LiteralPath $TempRoot -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"

    [ordered]@{
        status = "pass"
        tests = 8
        mcp_missing_native_fallback = $true
        local_config_only = $true
        package_files_unchanged = $true
        no_user_prompt = $true
        no_secrets_printed = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
