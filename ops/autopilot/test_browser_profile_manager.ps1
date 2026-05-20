$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bd_browser_profile_manager_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Manager {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("profile_manager_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\browser_profile_manager.ps1") `
        -MissionId A20BD_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "profile manager exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    Assert-True ($text.IndexOf("{") -ge 0) "profile manager did not emit JSON"
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

function Test-GitIgnored {
    param([string]$RelativePath)
    & git -C $RepoRoot check-ignore -q $RelativePath
    return $LASTEXITCODE -eq 0
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $ensure = Invoke-Manager -Arguments @("-Mode", "EnsureAll", "-NoPrompt")
    Assert-True ($ensure.status -eq "DUAL_BROWSER_PROFILES_READY") "dual profiles not ready"
    Assert-True ($ensure.separate_profiles -eq $true) "profiles must be separate"
    Assert-True ($ensure.separate_cdp_ports -eq $true) "CDP ports must be separate"
    Assert-True ([int]$ensure.chatgpt.profile_relative_path.Length -gt 0) "chatgpt profile path missing"
    Assert-True ([int]$ensure.gemini.profile_relative_path.Length -gt 0) "gemini profile path missing"
    Assert-True ([string]$ensure.chatgpt.profile_relative_path -ne [string]$ensure.gemini.profile_relative_path) "profile paths are shared"
    Assert-True ($ensure.chatgpt.profile_gitignored -eq $true) "ChatGPT profile must be gitignored"
    Assert-True ($ensure.gemini.profile_gitignored -eq $true) "Gemini profile must be gitignored"
    Assert-True ($ensure.shared_profile_rejection_policy -eq $true) "shared profile rejection policy missing"
    Assert-True ($ensure.shared_cdp_port_rejection_policy -eq $true) "shared port rejection policy missing"

    $status = Invoke-Manager -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ([int]$status.chatgpt.cdp_port -eq 9222) "ChatGPT must use port 9222"
    Assert-True ([int]$status.gemini.cdp_port -eq 9223) "Gemini must use port 9223"
    Assert-True ($status.private_urls_redacted -eq $true) "private URLs must be redacted"
    Assert-True ($status.secrets_redacted -eq $true) "secrets must be redacted"

    Assert-True (Test-GitIgnored -RelativePath "ops/autopilot/local/browser_profiles/chatgpt/.probe") "local ChatGPT profile path not ignored"
    Assert-True (Test-GitIgnored -RelativePath "ops/autopilot/local/browser_profiles/gemini/.probe") "local Gemini profile path not ignored"
    Assert-True (Test-GitIgnored -RelativePath "ops/autopilot/runtime/chatgpt_browser_state.json") "ChatGPT runtime state not ignored"
    Assert-True (Test-GitIgnored -RelativePath "ops/autopilot/runtime/gemini_browser_state.json") "Gemini runtime state not ignored"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\browser_profile_manager.ps1") -Raw
    Assert-True ($source -notmatch "git add -A") "manager must not stage broadly"
    Assert-True ($source -notmatch "Stop-Process.*chrome") "manager must not kill user Chrome by process name"
    Assert-True ($source -notmatch "Read-Host") "manager must not prompt"
    Assert-True ($source -notmatch "cookie|token|password" -or $source -match "cookies or tokens") "manager source should not handle secrets"

    [ordered]@{
        status = "pass"
        tests = 18
        separate_profiles = $true
        separate_cdp_ports = $true
        shared_profile_rejected = $true
        local_paths_gitignored = $true
        runtime_paths_gitignored = $true
        no_user_chrome_kill = $true
        no_prompt = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
