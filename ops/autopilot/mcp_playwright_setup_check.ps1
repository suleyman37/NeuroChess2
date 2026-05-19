param(
    [string]$MissionId = "A20BC",
    [string]$ArtifactPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [switch]$MockMcpReady,
    [switch]$MockMcpMissingNativeReady,
    [switch]$MockNativeUnavailable,
    [switch]$MockSetupBlocked
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20BD") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BD_keep_open_auth_bootstrap_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BC_session_bootstrap_e2e_20260518"
    }
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Emit-Result {
    param([object]$Payload)
    Write-JsonFile -Path (Join-Path $ArtifactPath "mcp_setup_check.json") -Payload $Payload
    if ($Payload.native_playwright_fallback) {
        Write-JsonFile -Path (Join-Path $ArtifactPath "native_playwright_fallback_check.json") -Payload $Payload.native_playwright_fallback
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload ([ordered]@{
        schema_version = "mcp_playwright_setup_manifest_v1"
        mission_id = $MissionId
        status = [string]$Payload.status
        created_at = (Get-Date).ToString("o")
        repo_files_modified = $false
        package_files_modified = $false
        secrets_printed = $false
        paid_api_used = $false
    })
    $Payload | ConvertTo-Json -Depth 60
    exit 0
}

function Test-NativePlaywright {
    param([string]$StatusOverride = "")
    if (-not [string]::IsNullOrWhiteSpace($StatusOverride)) {
        return [ordered]@{
            status = $StatusOverride
            node_available = $StatusOverride -eq "NATIVE_PLAYWRIGHT_READY"
            playwright_available = $StatusOverride -eq "NATIVE_PLAYWRIGHT_READY"
            package_files_modified = $false
        }
    }
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        return [ordered]@{ status = "NATIVE_PLAYWRIGHT_UNAVAILABLE"; node_available = $false; playwright_available = $false; package_files_modified = $false }
    }
    $probePath = Join-Path $ArtifactPath "native_playwright_probe.mjs"
    @'
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const requireFromHere = createRequire(import.meta.url);

async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  try { return requireFromHere("playwright"); } catch {}
  const bundled = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules")
    : "";
  const roots = [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    path.resolve(path.dirname(process.execPath), "..", "node_modules"),
    bundled
  ].filter(Boolean);
  for (const root of roots) {
    try { return requireFromHere(path.join(root, "playwright")); } catch {}
    const pnpm = path.join(root, ".pnpm");
    if (fs.existsSync(pnpm)) {
      for (const entry of fs.readdirSync(pnpm).filter((name) => /^playwright@/.test(name)).sort().reverse()) {
        try { return requireFromHere(path.join(pnpm, entry, "node_modules", "playwright")); } catch {}
      }
    }
  }
  throw new Error("PLAYWRIGHT_UNAVAILABLE");
}

function windowsBrowserCandidates() {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
  const rels = [
    ["Google", "Chrome", "Application", "chrome.exe"],
    ["Microsoft", "Edge", "Application", "msedge.exe"]
  ];
  const candidates = [];
  for (const root of roots) {
    for (const rel of rels) candidates.push(path.join(root, ...rel));
  }
  return candidates.filter((candidate, index, arr) => arr.indexOf(candidate) === index);
}

try {
  const playwright = await loadPlaywright();
  const chromiumPath = playwright.chromium ? playwright.chromium.executablePath() : "";
  const chromiumExecutableExists = Boolean(chromiumPath && fs.existsSync(chromiumPath));
  const systemBrowserAvailable = windowsBrowserCandidates().some((candidate) => fs.existsSync(candidate));
  const launchStrategy = chromiumExecutableExists ? "bundled_chromium" : (systemBrowserAvailable ? "system_browser_channel" : "none");
  console.log(JSON.stringify({
    status: launchStrategy === "none" ? "NATIVE_PLAYWRIGHT_UNAVAILABLE" : "NATIVE_PLAYWRIGHT_READY",
    playwright_available: true,
    chromium_available: Boolean(playwright.chromium),
    chromium_executable_exists: chromiumExecutableExists,
    system_browser_available: systemBrowserAvailable,
    browser_launch_strategy: launchStrategy,
    package_files_modified: false
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    status: "NATIVE_PLAYWRIGHT_UNAVAILABLE",
    playwright_available: false,
    error_redacted: String(error && error.message ? error.message : error),
    package_files_modified: false
  }, null, 2));
}
'@ | Set-Content -LiteralPath $probePath -Encoding UTF8
    $output = & node $probePath 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) {
        return [ordered]@{ status = "NATIVE_PLAYWRIGHT_UNAVAILABLE"; node_available = $true; playwright_available = $false; error_redacted = "probe emitted no JSON"; package_files_modified = $false }
    }
    $result = $text.Substring($start) | ConvertFrom-Json
    return [ordered]@{
        status = [string]$result.status
        node_available = $true
        playwright_available = [bool]$result.playwright_available
        chromium_available = [bool]$result.chromium_available
        chromium_executable_exists = [bool]$result.chromium_executable_exists
        system_browser_available = [bool]$result.system_browser_available
        browser_launch_strategy = if ($result.browser_launch_strategy) { [string]$result.browser_launch_strategy } else { "unknown" }
        package_files_modified = $false
        error_redacted = if ($result.error_redacted) { [string]$result.error_redacted } else { "" }
    }
}

function Test-CodexMcpConfig {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    $configCandidates = @()
    if ($env:CODEX_HOME) { $configCandidates += (Join-Path $env:CODEX_HOME "config.toml") }
    if ($env:USERPROFILE) { $configCandidates += (Join-Path $env:USERPROFILE ".codex\config.toml") }
    $configHasPlaywright = $false
    foreach ($candidate in $configCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $content = Get-Content -LiteralPath $candidate -Raw
            if ($content -match "playwright" -and $content -match "@playwright/mcp") {
                $configHasPlaywright = $true
            }
        }
    }
    [ordered]@{
        codex_cli_available = [bool]$codex
        npx_available = [bool]$npx
        config_has_playwright = [bool]$configHasPlaywright
        local_config_only = $true
    }
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

if ($MockSetupBlocked) {
    Emit-Result -Payload ([ordered]@{
        schema_version = "mcp_playwright_setup_check_v1"
        mission_id = $MissionId
        status = "MCP_PLAYWRIGHT_SETUP_BLOCKED"
        reason = "MOCK_SETUP_BLOCKED"
        native_playwright_fallback = (Test-NativePlaywright -StatusOverride "NATIVE_PLAYWRIGHT_UNAVAILABLE")
        repo_files_modified = $false
        package_files_modified = $false
        no_secrets_printed = $true
    })
}
if ($MockMcpReady) {
    Emit-Result -Payload ([ordered]@{
        schema_version = "mcp_playwright_setup_check_v1"
        mission_id = $MissionId
        status = "MCP_PLAYWRIGHT_READY"
        mcp_configured = $true
        configured_now = $false
        native_playwright_fallback = (Test-NativePlaywright -StatusOverride "NATIVE_PLAYWRIGHT_READY")
        repo_files_modified = $false
        package_files_modified = $false
        no_secrets_printed = $true
    })
}
if ($MockMcpMissingNativeReady) {
    Emit-Result -Payload ([ordered]@{
        schema_version = "mcp_playwright_setup_check_v1"
        mission_id = $MissionId
        status = "MCP_PLAYWRIGHT_NOT_AVAILABLE_NATIVE_FALLBACK_READY"
        mcp_configured = $false
        configured_now = $false
        native_playwright_fallback = (Test-NativePlaywright -StatusOverride "NATIVE_PLAYWRIGHT_READY")
        repo_files_modified = $false
        package_files_modified = $false
        no_secrets_printed = $true
    })
}
if ($MockNativeUnavailable) {
    Emit-Result -Payload ([ordered]@{
        schema_version = "mcp_playwright_setup_check_v1"
        mission_id = $MissionId
        status = "MCP_PLAYWRIGHT_UNAVAILABLE_NATIVE_FALLBACK_UNAVAILABLE"
        mcp_configured = $false
        configured_now = $false
        native_playwright_fallback = (Test-NativePlaywright -StatusOverride "NATIVE_PLAYWRIGHT_UNAVAILABLE")
        repo_files_modified = $false
        package_files_modified = $false
        no_secrets_printed = $true
    })
}

$mcp = Test-CodexMcpConfig
$native = Test-NativePlaywright
$configuredNow = $false
$mcpReady = [bool]$mcp.config_has_playwright

if (-not $mcpReady -and $mcp.codex_cli_available -and $mcp.npx_available -and -not $DryRun) {
    try {
        $codex = (Get-Command codex -ErrorAction Stop).Source
        $addOutput = & $codex mcp add playwright npx "@playwright/mcp@latest" 2>&1
        $configuredNow = ($LASTEXITCODE -eq 0)
        $mcpReady = $configuredNow
    } catch {
        $configuredNow = $false
        $mcpReady = $false
    }
}

$status = if ($mcpReady -and $configuredNow) {
    "MCP_PLAYWRIGHT_CONFIGURED_NOW_READY"
} elseif ($mcpReady) {
    "MCP_PLAYWRIGHT_READY"
} elseif ([string]$native.status -eq "NATIVE_PLAYWRIGHT_READY") {
    "MCP_PLAYWRIGHT_NOT_AVAILABLE_NATIVE_FALLBACK_READY"
} else {
    "MCP_PLAYWRIGHT_UNAVAILABLE_NATIVE_FALLBACK_UNAVAILABLE"
}

Emit-Result -Payload ([ordered]@{
    schema_version = "mcp_playwright_setup_check_v1"
    mission_id = $MissionId
    status = $status
    mcp_configured = [bool]$mcpReady
    configured_now = [bool]$configuredNow
    codex_cli_available = [bool]$mcp.codex_cli_available
    npx_available = [bool]$mcp.npx_available
    local_config_only = $true
    native_playwright_fallback = $native
    repo_files_modified = $false
    package_files_modified = $false
    no_secrets_printed = $true
    paid_api_used = $false
})
