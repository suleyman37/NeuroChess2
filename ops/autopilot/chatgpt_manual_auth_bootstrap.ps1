param(
    [ValidateSet("Status", "LaunchAuthWindow", "PollSessionReady", "ResumeE2E", "StopSupervisorBrowser", "BuildReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BD",
    [string]$ArtifactPath = "",
    [string]$ProfilePath = "",
    [string]$PoolConfigPath = "",
    [string]$StatePath = "",
    [switch]$NoPrompt,
    [int]$MaxWaitMinutes = 60,
    [switch]$KeepOpen,
    [int]$DebugPort = 9229,
    [switch]$DryRun,
    [switch]$MockPoolMissing,
    [switch]$MockLaunchSuccess,
    [switch]$MockHumanActionRequired,
    [switch]$MockSessionReady,
    [switch]$MockBrowserClosed,
    [switch]$MockTimeout,
    [switch]$MockSendSuccess,
    [switch]$MockResponseJsonOk
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BD_keep_open_auth_bootstrap_20260518"
}
if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $ProfilePath = Join-Path $PSScriptRoot "local\playwright_supervisor_profile"
}
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) {
    $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\chatgpt_manual_auth_state.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json }
    return $null
}

function Remove-SensitiveAlertFields {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Array]) {
        return @($Value | ForEach-Object { Remove-SensitiveAlertFields -Value $_ })
    }
    if ($Value -is [pscustomobject]) {
        foreach ($property in @($Value.PSObject.Properties)) {
            if ($property.Name -match "ntfy_topic") {
                $property.Value = "[redacted]"
            } elseif ($property.Name -match "alert_body_preview") {
                $property.Value = $null
            } elseif ($null -ne $property.Value -and ($property.Value -is [pscustomobject] -or $property.Value -is [System.Array])) {
                $property.Value = Remove-SensitiveAlertFields -Value $property.Value
            }
        }
    }
    return $Value
}

function New-Manifest {
    param([string]$Status)
    [ordered]@{
        schema_version = "chatgpt_manual_auth_bootstrap_manifest_v1"
        mission_id = $MissionId
        status = $Status
        created_at = (Get-Date).ToString("o")
        artifact_path = $ArtifactPath
        profile_path_redacted = $true
        private_urls_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        secrets_redacted = $true
        paid_api_used = $false
        no_bypass = $true
        no_blind_typing = $true
    }
}

function Emit-Result {
    param([object]$Payload, [string]$ArtifactName)
    if (-not [string]::IsNullOrWhiteSpace($ArtifactName)) {
        Write-JsonFile -Path (Join-Path $ArtifactPath $ArtifactName) -Payload $Payload
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload (New-Manifest -Status ([string]$Payload.status))
    $Payload | ConvertTo-Json -Depth 80
    exit 0
}

function Ensure-LocalPathsIgnored {
    New-Item -ItemType Directory -Force -Path $ArtifactPath, $ProfilePath, (Split-Path -Parent $StatePath) | Out-Null
    $excludePath = Join-Path $RepoRoot ".git\info\exclude"
    $excludeText = if (Test-Path -LiteralPath $excludePath -PathType Leaf) { Get-Content -LiteralPath $excludePath -Raw } else { "" }
    $needed = @("ops/autopilot/local/", "ops/autopilot/runtime/")
    foreach ($entry in $needed) {
        if ($excludeText -notmatch [regex]::Escape($entry)) {
            Add-Content -LiteralPath $excludePath -Value $entry
        }
    }
    [ordered]@{
        profile_path_exists = Test-Path -LiteralPath $ProfilePath -PathType Container
        profile_under_gitignored_local_path = $ProfilePath -like (Join-Path $PSScriptRoot "local*")
        runtime_state_gitignored = $StatePath -like (Join-Path $PSScriptRoot "runtime*")
        profile_path_redacted = $true
    }
}

function Normalize-Pool {
    param($Pool)
    $items = if ($Pool.pool) { @($Pool.pool) } elseif ($Pool.discussions) { @($Pool.discussions) } else { @() }
    $normalized = @()
    foreach ($item in $items) {
        $label = [string]$item.label
        if ([string]::IsNullOrWhiteSpace($label)) { continue }
        $normalized += [pscustomobject]@{
            label = $label
            url = [string]$item.url
            message_count_sent = if ($null -ne $item.message_count_sent) { [int]$item.message_count_sent } else { 0 }
            status = if ([string]::IsNullOrWhiteSpace([string]$item.status)) { "AVAILABLE" } else { [string]$item.status }
        }
    }
    $current = if ([string]::IsNullOrWhiteSpace([string]$Pool.current_label)) { "A" } else { [string]$Pool.current_label }
    [pscustomobject]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = $current
        rotation_threshold_messages = 50
        pool = @($normalized)
    }
}

function Load-Pool {
    if ($MockPoolMissing) { return $null }
    if (-not (Test-Path -LiteralPath $PoolConfigPath -PathType Leaf)) { return $null }
    return Normalize-Pool -Pool (Get-Content -LiteralPath $PoolConfigPath -Raw | ConvertFrom-Json)
}

function Get-RedactedPoolStatus {
    param($PoolOrState, [string]$Status = "AJ_POOL_READY")
    if (-not $PoolOrState) {
        return [ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; pool_loaded = $false; private_urls_redacted = $true }
    }
    [ordered]@{
        status = $Status
        pool_loaded = $true
        current_label = [string]$PoolOrState.current_label
        rotation_threshold_messages = 50
        labels = @($PoolOrState.pool | ForEach-Object { [ordered]@{ label = [string]$_.label; message_count_sent = [int]$_.message_count_sent; status = [string]$_.status; url_redacted = $true } })
        private_urls_redacted = $true
    }
}

function New-StateFromPool {
    param($Pool)
    [pscustomobject]@{
        schema_version = "chatgpt_manual_auth_state_v1"
        mission_id = $MissionId
        current_label = [string]$Pool.current_label
        rotation_threshold_messages = 50
        debug_port = $DebugPort
        browser_pid = 0
        browser_exe_name = ""
        browser_started_by_script = $false
        keep_open = $true
        last_launch_status = ""
        last_status = "INITIALIZED"
        last_counter_incremented = $false
        pool = @($Pool.pool | ForEach-Object { [pscustomobject]@{ label = [string]$_.label; message_count_sent = [int]$_.message_count_sent; status = [string]$_.status } })
        private_urls_redacted = $true
        profile_path_redacted = $true
    }
}

function Load-State {
    $state = Read-JsonFile -Path $StatePath
    if ($state) { return $state }
    $pool = Load-Pool
    if (-not $pool) { return $null }
    return New-StateFromPool -Pool $pool
}

function Save-State {
    param($State)
    Write-JsonFile -Path $StatePath -Payload $State
}

function Get-CurrentEntry {
    param($Pool, $State)
    $label = if ($State -and -not [string]::IsNullOrWhiteSpace([string]$State.current_label)) { [string]$State.current_label } elseif ($Pool) { [string]$Pool.current_label } else { "A" }
    $entry = @($Pool.pool | Where-Object { [string]$_.label -eq $label })[0]
    return $entry
}

function Increment-CurrentCounter {
    param($State)
    $label = [string]$State.current_label
    foreach ($entry in @($State.pool)) {
        if ([string]$entry.label -eq $label) {
            $entry.message_count_sent = [int]$entry.message_count_sent + 1
            $State.last_counter_incremented = $true
            return
        }
    }
}

function Find-BrowserExecutable {
    $candidates = @(
        (Join-Path $env:PROGRAMFILES "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:PROGRAMFILES(X86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:PROGRAMFILES "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path ${env:PROGRAMFILES(X86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return (Get-Item -LiteralPath $candidate).FullName }
    }
    return ""
}

function Get-SupervisorBrowserProcess {
    $profileNeedle = [regex]::Escape($ProfilePath)
    $portNeedle = "remote-debugging-port=$DebugPort"
    $matches = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine -match $profileNeedle -and $_.CommandLine -match [regex]::Escape($portNeedle)
    })
    if ($matches.Count -gt 0) { return $matches[0] }
    return $null
}

function Test-DebugEndpoint {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$DebugPort/json/version" -UseBasicParsing -TimeoutSec 2
        return [ordered]@{ reachable = $true; status = "DEBUG_ENDPOINT_READY"; http_status = [int]$response.StatusCode }
    } catch {
        return [ordered]@{ reachable = $false; status = "DEBUG_ENDPOINT_UNREACHABLE"; error_redacted = ($_.Exception.Message -replace "https://chatgpt\.com/[^\s]+", "[redacted-chatgpt-url]") }
    }
}

function Invoke-Alert {
    param([string]$Reason)
    $resultPath = Join-Path $ArtifactPath "ntfy_alert_events.json"
    $message = "A dedicated ChatGPT supervisor browser is open. Complete login/verification in that window and leave it open. Codex will resume using the same profile. No bypass is attempted."
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_autopilot_alert.ps1") `
        -Channel auto `
        -Title "NeuroChess ChatGPT auth needed" `
        -Message $message `
        -MissionId $MissionId `
        -ServiceName "ChatGPT" `
        -Reason $Reason `
        -ArtifactPath $ArtifactPath `
        -ResultPath $resultPath `
        -NoPrompt 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -ge 0) {
        try {
            $result = $text.Substring($start) | ConvertFrom-Json
            if ($null -ne $result.ntfy_topic_redacted) { $result.ntfy_topic_redacted = "[redacted]" }
            return $result
        } catch {}
    }
    return [ordered]@{ status = "ALERT_RESULT_UNAVAILABLE"; reason = $Reason; private_urls_redacted = $true; secrets_redacted = $true }
}

function Write-NodeProbe {
    $probePath = Join-Path $ArtifactPath "chatgpt_manual_auth_probe.mjs"
    @'
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[name] = true;
    else { args[name] = next; i += 1; }
  }
  return args;
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

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

function detectHumanAction(title, text) {
  const combined = `${title || ""}\n${text || ""}`;
  return /sign in|log in|login|connexion|se connecter|captcha|i am human|je suis humain|human verification|verification humaine|2fa|two-factor|two factor|password|mot de passe|consent|cloudflare/i.test(combined);
}

function detectLoading(title, text) {
  const combined = `${title || ""}\n${text || ""}`;
  return /loading|chargement|just a moment|un instant|checking your browser|patientez/i.test(combined);
}

async function findComposer(page) {
  const locator = page.locator('[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea, [placeholder*="Message" i]');
  const count = await locator.count().catch(() => 0);
  if (!count) return { locator, count: 0, visible: false, enabled: false };
  const first = locator.first();
  return {
    locator: first,
    count,
    visible: await first.isVisible().catch(() => false),
    enabled: await first.isEnabled().catch(() => false)
  };
}

async function classify(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
  const title = await page.title().catch(() => "");
  const text = await page.locator("body").textContent({ timeout: 3000 }).catch(() => "");
  const composer = await findComposer(page);
  const sendButton = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i]').first();
  const sendAvailable = await sendButton.count().catch(() => 0) > 0;
  const human = detectHumanAction(title, text);
  const loading = detectLoading(title, text);
  if (human) {
    return { status: "HUMAN_ACTION_REQUIRED", composer_detected: false, send_action_available: false, auth_or_human_wall_detected: true };
  }
  if (composer.visible && composer.enabled) {
    return { status: "SESSION_READY", composer_detected: true, send_action_available: sendAvailable, auth_or_human_wall_detected: false };
  }
  if (loading) {
    return { status: "SESSION_LOADING", composer_detected: false, send_action_available: false, auth_or_human_wall_detected: false };
  }
  return { status: "SESSION_UNCLASSIFIED", composer_detected: false, send_action_available: sendAvailable, auth_or_human_wall_detected: false };
}

async function main() {
  const args = parseArgs(process.argv);
  const out = args.out;
  const resultFile = path.join(out, "node_probe_result.json");
  const result = {
    schema_version: "chatgpt_manual_auth_node_probe_v1",
    mode: args.mode,
    private_urls_redacted: true,
    secrets_redacted: true,
    cookies_printed: false,
    tokens_printed: false,
    no_blind_typing: true
  };
  let browser;
  try {
    const playwright = await loadPlaywright();
    browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${args.debugPort}`, { timeout: 10000 });
    const context = browser.contexts()[0] || await browser.newContext();
    let page = context.pages()[0] || await context.newPage();
    if (args.url && ["OpenDiscussion", "ResumeE2E"].includes(args.mode)) {
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    }
    if (args.mode === "OpenDiscussion") {
      Object.assign(result, await classify(page), { discussion_opened: true });
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const pageState = await classify(page);
    Object.assign(result, pageState);
    if (args.mode === "ClassifyPage" || args.mode === "PollSessionReady") {
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.mode === "ResumeE2E") {
      if (pageState.status !== "SESSION_READY") {
        result.status = pageState.status;
        result.message_submitted = false;
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const message = fs.readFileSync(args.messageFile, "utf8");
      const composer = await findComposer(page);
      if (!composer.visible || !composer.enabled) {
        result.status = "CHATGPT_COMPOSER_NOT_FOUND_AFTER_AUTH";
        result.message_submitted = false;
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      await composer.locator.click({ timeout: 5000 });
      await composer.locator.fill(message, { timeout: 10000 });
      const sendButton = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i]').first();
      const sendVisible = await sendButton.isVisible().catch(() => false);
      const sendEnabled = await sendButton.isEnabled().catch(() => false);
      if (!sendVisible || !sendEnabled) {
        result.status = "MESSAGE_SEND_FAILED";
        result.message_submitted = false;
        result.send_button_visible = sendVisible;
        result.send_button_enabled = sendEnabled;
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      await sendButton.click({ timeout: 10000 });
      result.message_submitted = true;
      result.status = "MESSAGE_SUBMITTED_RESPONSE_UNREAD";
      const deadline = Date.now() + Number(args.maxWaitSeconds || 90) * 1000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(1500);
        const body = await page.locator("body").textContent({ timeout: 5000 }).catch(() => "");
        const match = body.match(/\{"transport"\s*:\s*"mcp_playwright_chatgpt_web"\s*,\s*"status"\s*:\s*"ok"\s*,\s*"mission"\s*:\s*"A20BD"\s*\}/);
        if (match) {
          result.status = "CHATGPT_A_READY";
          result.response_read = true;
          break;
        }
      }
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = "AUTH_BROWSER_CLOSED";
    result.error_redacted = String(error && error.message ? error.message : error).replace(/https:\/\/chatgpt\.com\/\S+/g, "[redacted-chatgpt-url]");
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser && typeof browser.disconnect === "function") browser.disconnect();
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
'@ | Set-Content -LiteralPath $probePath -Encoding UTF8
    return $probePath
}

function Invoke-NodeProbe {
    param([string]$NodeMode, [string]$Url = "", [string]$MessagePath = "")
    if ($MockBrowserClosed) { return [ordered]@{ status = "AUTH_BROWSER_CLOSED"; private_urls_redacted = $true; no_blind_typing = $true } }
    if ($MockHumanActionRequired) { return [ordered]@{ status = "HUMAN_ACTION_REQUIRED"; composer_detected = $false; auth_or_human_wall_detected = $true; private_urls_redacted = $true; no_blind_typing = $true } }
    if ($MockSessionReady) {
        $status = if ($NodeMode -eq "ResumeE2E" -and $MockSendSuccess -and $MockResponseJsonOk) { "CHATGPT_A_READY" } elseif ($NodeMode -eq "ResumeE2E" -and $MockSendSuccess) { "MESSAGE_SUBMITTED_RESPONSE_UNREAD" } else { "SESSION_READY" }
        return [ordered]@{
            status = $status
            composer_detected = $true
            send_action_available = $true
            auth_or_human_wall_detected = $false
            message_submitted = ($NodeMode -eq "ResumeE2E" -and $MockSendSuccess)
            response_read = ($NodeMode -eq "ResumeE2E" -and $MockSendSuccess -and $MockResponseJsonOk)
            private_urls_redacted = $true
            no_blind_typing = $true
        }
    }
    if ($MockTimeout) { return [ordered]@{ status = "AUTH_TIMEOUT"; private_urls_redacted = $true; no_blind_typing = $true } }
    $probe = Write-NodeProbe
    $nodeOut = Join-Path $ArtifactPath ("node_{0}" -f $NodeMode)
    New-Item -ItemType Directory -Force -Path $nodeOut | Out-Null
    $args = @(
        $probe,
        "--mode", $NodeMode,
        "--debugPort", ([string]$DebugPort),
        "--out", $nodeOut,
        "--maxWaitSeconds", "90"
    )
    if (-not [string]::IsNullOrWhiteSpace($Url)) { $args += @("--url", $Url) }
    if (-not [string]::IsNullOrWhiteSpace($MessagePath)) { $args += @("--messageFile", (Resolve-Path -LiteralPath $MessagePath).Path) }
    $output = & node @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { return [ordered]@{ status = "AUTH_BROWSER_CLOSED"; error_redacted = "node probe emitted no JSON"; private_urls_redacted = $true } }
    return $text.Substring($start) | ConvertFrom-Json
}

function Start-SupervisorBrowser {
    if ($MockLaunchSuccess -or $MockHumanActionRequired -or $MockSessionReady) {
        return [ordered]@{ status = "AUTH_BROWSER_LAUNCHED"; browser_process_running = $true; pid = 4242; browser_exe_name = "mock-browser"; keep_open = $true }
    }
    $existing = Get-SupervisorBrowserProcess
    if ($existing) {
        return [ordered]@{ status = "AUTH_BROWSER_ALREADY_RUNNING"; browser_process_running = $true; pid = [int]$existing.ProcessId; browser_exe_name = [string]$existing.Name; keep_open = $true }
    }
    $browser = Find-BrowserExecutable
    if ([string]::IsNullOrWhiteSpace($browser)) {
        return [ordered]@{ status = "AUTH_BOOTSTRAP_KEEP_OPEN_FAILED"; browser_process_running = $false; reason = "NO_SYSTEM_BROWSER_FOUND"; keep_open = $true }
    }
    $args = @(
        "--remote-debugging-port=$DebugPort",
        "--user-data-dir=$ProfilePath",
        "--no-first-run",
        "--new-window",
        "about:blank"
    )
    $process = Start-Process -FilePath $browser -ArgumentList $args -PassThru
    Start-Sleep -Seconds 2
    [ordered]@{ status = "AUTH_BROWSER_LAUNCHED"; browser_process_running = $true; pid = [int]$process.Id; browser_exe_name = (Split-Path -Leaf $browser); keep_open = $true }
}

function Stop-SupervisorBrowserExplicit {
    if ($MockLaunchSuccess -or $MockHumanActionRequired -or $MockSessionReady) {
        return [ordered]@{ status = "SUPERVISOR_BROWSER_STOPPED"; explicit_only = $true; mock = $true }
    }
    $process = Get-SupervisorBrowserProcess
    if (-not $process) { return [ordered]@{ status = "SUPERVISOR_BROWSER_NOT_RUNNING"; explicit_only = $true } }
    Stop-Process -Id ([int]$process.ProcessId) -Force
    [ordered]@{ status = "SUPERVISOR_BROWSER_STOPPED"; explicit_only = $true; pid = [int]$process.ProcessId }
}

function Get-StatusPayload {
    $profile = Ensure-LocalPathsIgnored
    $state = Load-State
    $process = if ($MockBrowserClosed) { $null } else { Get-SupervisorBrowserProcess }
    $debug = if ($MockBrowserClosed) { [ordered]@{ reachable = $false; status = "DEBUG_ENDPOINT_UNREACHABLE" } } elseif ($MockLaunchSuccess -or $MockHumanActionRequired -or $MockSessionReady) { [ordered]@{ reachable = $true; status = "DEBUG_ENDPOINT_READY"; mock = $true } } else { Test-DebugEndpoint }
    $page = if ($MockHumanActionRequired) {
        [ordered]@{ status = "HUMAN_ACTION_REQUIRED"; composer_detected = $false }
    } elseif ($MockSessionReady) {
        [ordered]@{ status = "SESSION_READY"; composer_detected = $true }
    } elseif (-not $process -and -not [bool]$debug.reachable) {
        [ordered]@{ status = "AUTH_BROWSER_CLOSED"; composer_detected = $false }
    } elseif ([bool]$debug.reachable) {
        Invoke-NodeProbe -NodeMode "ClassifyPage"
    } else {
        [ordered]@{ status = "SESSION_UNCLASSIFIED"; composer_detected = $false }
    }
    [ordered]@{
        schema_version = "chatgpt_manual_auth_status_v1"
        mission_id = $MissionId
        status = [string]$page.status
        profile = $profile
        browser_process_running = [bool]$process -or $MockLaunchSuccess -or $MockHumanActionRequired -or $MockSessionReady
        debug_endpoint = $debug
        page_state = $page
        current_label = if ($state) { [string]$state.current_label } else { "A" }
        rotation_threshold_messages = 50
        private_urls_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        local_omega_fallback_available = $true
    }
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

switch ($Mode) {
    "Status" {
        Emit-Result -Payload (Get-StatusPayload) -ArtifactName "auth_state_result.json"
    }
    "LaunchAuthWindow" {
        $profile = Ensure-LocalPathsIgnored
        $pool = Load-Pool
        if (-not $pool) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; profile = $profile; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "auth_window_launch_result.json" }
        Write-JsonFile -Path (Join-Path $ArtifactPath "rotation_status_result.json") -Payload (Get-RedactedPoolStatus -PoolOrState $pool)
        $state = Load-State
        if (-not $state) { $state = New-StateFromPool -Pool $pool }
        $launch = Start-SupervisorBrowser
        $state.debug_port = $DebugPort
        $state.browser_pid = if ($launch.pid) { [int]$launch.pid } else { 0 }
        $state.browser_exe_name = [string]$launch.browser_exe_name
        $state.browser_started_by_script = $true
        $state.keep_open = $true
        $state.last_launch_status = [string]$launch.status
        Save-State -State $state
        Write-JsonFile -Path (Join-Path $ArtifactPath "browser_lifecycle_result.json") -Payload ([ordered]@{
            status = [string]$launch.status
            keep_open = $true
            headed_visible_browser = $true
            browser_closed_by_script = $false
            context_closed_by_script = $false
            explicit_stop_required = $true
            profile_path_redacted = $true
        })
        if ([string]$launch.status -eq "AUTH_BOOTSTRAP_KEEP_OPEN_FAILED") {
            Emit-Result -Payload ([ordered]@{ status = "AUTH_BOOTSTRAP_KEEP_OPEN_FAILED"; launch = $launch; profile = $profile; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "auth_window_launch_result.json"
        }
        $entry = Get-CurrentEntry -Pool $pool -State $state
        $page = Invoke-NodeProbe -NodeMode "OpenDiscussion" -Url ([string]$entry.url)
        $finalStatus = if ([string]$page.status -eq "SESSION_READY") { "SESSION_READY" } elseif ([string]$page.status -eq "HUMAN_ACTION_REQUIRED") { "AUTH_BOOTSTRAP_READY_WAITING_FOR_MANUAL_AUTH" } else { [string]$page.status }
        $alert = $null
        if ([string]$page.status -eq "HUMAN_ACTION_REQUIRED") {
            $alert = Invoke-Alert -Reason "HUMAN_ACTION_REQUIRED"
            $alert = Remove-SensitiveAlertFields -Value $alert
            Write-Host "Complete ChatGPT login/verification in the opened browser window. Do not close it."
        }
        $state.last_status = $finalStatus
        Save-State -State $state
        $payload = [ordered]@{
            schema_version = "chatgpt_manual_auth_launch_v1"
            mission_id = $MissionId
            status = $finalStatus
            launch = $launch
            profile = $profile
            current_label = [string]$state.current_label
            discussion_opened = [string]$page.status -in @("SESSION_READY", "HUMAN_ACTION_REQUIRED", "SESSION_LOADING", "SESSION_UNCLASSIFIED")
            auth_state = [string]$page.status
            composer_detected = [bool]$page.composer_detected
            ntfy_alert = $alert
            keep_open = $true
            headed_visible_browser = $true
            browser_closed_by_script = $false
            context_closed_by_script = $false
            resume_command = "powershell -ExecutionPolicy Bypass -File ops/autopilot/chatgpt_manual_auth_bootstrap.ps1 -Mode ResumeE2E -MissionId A20BD -NoPrompt"
            private_urls_redacted = $true
            cookies_printed = $false
            tokens_printed = $false
            no_bypass = $true
            no_blind_typing = $true
            local_omega_fallback_available = $true
        }
        Emit-Result -Payload $payload -ArtifactName "auth_window_launch_result.json"
    }
    "PollSessionReady" {
        $deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
        $last = $null
        do {
            if ($MockTimeout) { $last = [ordered]@{ status = "AUTH_TIMEOUT"; composer_detected = $false }; break }
            $status = Get-StatusPayload
            $last = $status.page_state
            if ([string]$last.status -eq "SESSION_READY") { Emit-Result -Payload ([ordered]@{ status = "SESSION_READY"; composer_detected = $true; private_urls_redacted = $true; no_bypass = $true }) -ArtifactName "poll_session_result.json" }
            if ([string]$last.status -eq "AUTH_BROWSER_CLOSED") { Emit-Result -Payload ([ordered]@{ status = "AUTH_BROWSER_CLOSED"; composer_detected = $false; private_urls_redacted = $true; no_bypass = $true }) -ArtifactName "poll_session_result.json" }
            if ($MaxWaitMinutes -le 0) { break }
            Start-Sleep -Seconds 10
        } while ((Get-Date) -lt $deadline)
        $payload = [ordered]@{ status = "AUTH_TIMEOUT"; last_page_state = $last; composer_detected = $false; private_urls_redacted = $true; no_bypass = $true; local_omega_fallback_available = $true }
        Emit-Result -Payload $payload -ArtifactName "poll_session_result.json"
    }
    "ResumeE2E" {
        $profile = Ensure-LocalPathsIgnored
        $pool = Load-Pool
        if (-not $pool) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; profile = $profile; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "resume_e2e_result.json" }
        $state = Load-State
        if (-not $state) { $state = New-StateFromPool -Pool $pool }
        $debug = if ($MockSessionReady) { [ordered]@{ reachable = $true; status = "DEBUG_ENDPOINT_READY"; mock = $true } } else { Test-DebugEndpoint }
        if (-not [bool]$debug.reachable -and -not $MockSessionReady) {
            Emit-Result -Payload ([ordered]@{ status = "AUTH_BROWSER_CLOSED"; debug_endpoint = $debug; profile = $profile; message_sent = $false; counter_incremented = $false; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "resume_e2e_result.json"
        }
        $entry = Get-CurrentEntry -Pool $pool -State $state
        $messagePath = Join-Path $ArtifactPath "a20bd_transport_test_message.txt"
        "NeuroChess supervisor transport test after manual auth. Reply with JSON only:`n{`"transport`":`"mcp_playwright_chatgpt_web`",`"status`":`"ok`",`"mission`":`"A20BD`"}" | Set-Content -LiteralPath $messagePath -Encoding UTF8
        $node = Invoke-NodeProbe -NodeMode "ResumeE2E" -Url ([string]$entry.url) -MessagePath $messagePath
        $finalStatus = [string]$node.status
        if ($finalStatus -eq "HUMAN_ACTION_REQUIRED") { $finalStatus = "AUTH_BOOTSTRAP_READY_WAITING_FOR_MANUAL_AUTH" }
        if ([bool]$node.message_submitted) {
            Increment-CurrentCounter -State $state
            Save-State -State $state
        }
        $payload = [ordered]@{
            schema_version = "chatgpt_manual_auth_resume_e2e_v1"
            mission_id = $MissionId
            status = $finalStatus
            current_label = [string]$state.current_label
            composer_detected = [bool]$node.composer_detected
            message_sent = [bool]$node.message_submitted
            response_read = [bool]$node.response_read
            counter_incremented = [bool]$node.message_submitted
            resume_used_existing_browser = $true
            temporary_profile_launched = $false
            private_urls_redacted = $true
            cookies_printed = $false
            tokens_printed = $false
            no_bypass = $true
            no_blind_typing = $true
            local_omega_fallback_available = $true
        }
        Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
        Emit-Result -Payload $payload -ArtifactName "resume_e2e_result.json"
    }
    "StopSupervisorBrowser" {
        $stop = Stop-SupervisorBrowserExplicit
        Emit-Result -Payload ([ordered]@{ status = [string]$stop.status; stop = $stop; explicit_only = $true; private_urls_redacted = $true }) -ArtifactName "browser_lifecycle_result.json"
    }
    "BuildReport" {
        $launch = Read-JsonFile -Path (Join-Path $ArtifactPath "auth_window_launch_result.json")
        $resume = Read-JsonFile -Path (Join-Path $ArtifactPath "resume_e2e_result.json")
        $status = Read-JsonFile -Path (Join-Path $ArtifactPath "auth_state_result.json")
        $launch = Remove-SensitiveAlertFields -Value $launch
        $resume = Remove-SensitiveAlertFields -Value $resume
        $status = Remove-SensitiveAlertFields -Value $status
        $selected = if ($resume) { [string]$resume.status } elseif ($launch) { [string]$launch.status } elseif ($status) { [string]$status.status } else { "AUTH_BOOTSTRAP_NOT_RUN" }
        Emit-Result -Payload ([ordered]@{
            schema_version = "chatgpt_manual_auth_build_report_v1"
            mission_id = $MissionId
            status = $selected
            launch = $launch
            resume = $resume
            status_result = $status
            resume_command = "powershell -ExecutionPolicy Bypass -File ops/autopilot/chatgpt_manual_auth_bootstrap.ps1 -Mode ResumeE2E -MissionId A20BD -NoPrompt"
            private_urls_redacted = $true
            no_bypass = $true
            no_blind_typing = $true
            local_omega_fallback_available = $true
        }) -ArtifactName "transport_integration_result.json"
    }
}
