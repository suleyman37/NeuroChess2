param(
    [ValidateSet("Discover", "Status", "OpenCurrentDiscussion", "ClassifyPage", "DetectComposer", "SendTestMessage", "ReadLastResponse", "RotateIfNeeded", "E2EProof", "DryRun", "BuildReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BC",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 90,
    [ValidateSet("auto", "mcp", "native", "legacy")]
    [string]$Transport = "auto",
    [string]$ArtifactPath = "",
    [string]$PoolConfigPath = "",
    [string]$StatePath = "",
    [string]$ProfilePath = "",
    [string]$MessageFile = "",
    [switch]$MockPoolMissing,
    [ValidateSet("", "SESSION_READY", "HUMAN_ACTION_REQUIRED", "SESSION_NOT_AUTHENTICATED", "SESSION_LOADING", "SESSION_UNCLASSIFIED", "CHATGPT_COMPOSER_NOT_FOUND", "CHATGPT_DISCUSSION_OPEN_FAILED")]
    [string]$MockSessionStatus = "",
    [switch]$MockMcpReady,
    [switch]$MockNativeUnavailable,
    [switch]$MockSendSuccess,
    [switch]$MockResponseJsonOk,
    [switch]$MockResponseTimeout
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BC_session_bootstrap_e2e_20260518"
}
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) {
    $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\playwright_chatgpt_supervisor_state.json"
}
if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $ProfilePath = Join-Path $PSScriptRoot "local\playwright_supervisor_profile"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    return $null
}

function New-Manifest {
    param([string]$Status)
    [ordered]@{
        schema_version = "playwright_chatgpt_supervisor_manifest_v1"
        mission_id = $MissionId
        status = $Status
        artifact_path = $ArtifactPath
        created_at = (Get-Date).ToString("o")
        private_urls_printed = $false
        secrets_printed = $false
        paid_api_used = $false
        no_blind_typing = $true
        local_omega_fallback_available = $true
    }
}

function Emit-Result {
    param([object]$Payload, [string]$ArtifactName = "")
    if (-not [string]::IsNullOrWhiteSpace($ArtifactName)) {
        Write-JsonFile -Path (Join-Path $ArtifactPath $ArtifactName) -Payload $Payload
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload (New-Manifest -Status ([string]$Payload.status))
    $Payload | ConvertTo-Json -Depth 80
    exit 0
}

function Set-ResultProperty {
    param([object]$Target, [string]$Name, [object]$Value)
    if ($Target -is [hashtable] -or $Target -is [System.Collections.Specialized.OrderedDictionary]) {
        $Target[$Name] = $Value
    } elseif ($Target.PSObject.Properties.Name -contains $Name) {
        $Target.$Name = $Value
    } else {
        $Target | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
    }
    return $Target
}

function Ensure-ProfileIgnored {
    New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
    $resolvedProfile = (Resolve-Path -LiteralPath $ProfilePath).Path
    $repoPath = (Resolve-Path -LiteralPath $RepoRoot).Path
    $isRepoLocalProfile = $resolvedProfile.StartsWith((Join-Path $repoPath "ops\autopilot\local"), [StringComparison]::OrdinalIgnoreCase)
    $excludePath = Join-Path $repoPath ".git\info\exclude"
    $excludePattern = "ops/autopilot/local/playwright_supervisor_profile/**"
    $excludeUpdated = $false
    if ($isRepoLocalProfile) {
        $excludeText = if (Test-Path -LiteralPath $excludePath -PathType Leaf) { Get-Content -LiteralPath $excludePath -Raw } else { "" }
        if ($excludeText -notmatch [regex]::Escape($excludePattern)) {
            Add-Content -LiteralPath $excludePath -Value $excludePattern -Encoding UTF8
            $excludeUpdated = $true
        }
    }
    [ordered]@{
        schema_version = "chatgpt_supervisor_profile_status_v1"
        mission_id = $MissionId
        status = "PROFILE_READY"
        profile_path_redacted = $true
        profile_under_gitignored_local_path = [bool]$isRepoLocalProfile
        git_info_exclude_updated = [bool]$excludeUpdated
        profile_exists = (Test-Path -LiteralPath $ProfilePath -PathType Container)
        cookies_printed = $false
        tokens_printed = $false
        committed = $false
    }
}

function Normalize-Pool {
    param($Pool)
    if (-not $Pool) { return $null }
    $labels = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    $existing = @{}
    foreach ($entry in @($Pool.pool)) { $existing[[string]$entry.label] = $entry }
    $items = @()
    foreach ($label in $labels) {
        if ($existing.ContainsKey($label)) {
            $entry = $existing[$label]
            $items += [ordered]@{
                label = $label
                url = [string]$entry.url
                message_count_sent = [int]$entry.message_count_sent
                status = if ([string]::IsNullOrWhiteSpace([string]$entry.status)) { "AVAILABLE" } else { [string]$entry.status }
            }
        } else {
            $items += [ordered]@{ label = $label; url = ""; message_count_sent = 0; status = "AVAILABLE" }
        }
    }
    $current = [string]$Pool.current_label
    if ([string]::IsNullOrWhiteSpace($current)) { $current = "A" }
    foreach ($entry in $items) {
        if ($entry.label -eq $current -and $entry.status -notin @("EXHAUSTED", "BLOCKED")) { $entry.status = "ACTIVE" }
        elseif ($entry.status -eq "ACTIVE") { $entry.status = "AVAILABLE" }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = $current
        rotation_threshold_messages = 50
        pool = @($items)
    }
}

function Load-Pool {
    if ($MockPoolMissing) { return $null }
    $pool = Normalize-Pool -Pool (Read-JsonFile -Path $PoolConfigPath)
    if ($pool) { Write-JsonFile -Path $PoolConfigPath -Payload $pool }
    return $pool
}

function New-DefaultPool {
    $items = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $items += [ordered]@{ label = $label; url = ""; message_count_sent = 0; status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" } }
    }
    [ordered]@{ current_label = "A"; rotation_threshold_messages = 50; pool = @($items) }
}

function New-StateFromPool {
    param($Pool)
    [ordered]@{
        schema_version = "playwright_chatgpt_supervisor_state_v1"
        mission_id = $MissionId
        created_at = (Get-Date).ToString("o")
        updated_at = (Get-Date).ToString("o")
        current_label = [string]$Pool.current_label
        rotation_threshold_messages = 50
        pool = @($Pool.pool)
        last_page_classification = ""
        last_composer_status = ""
        last_send_status = ""
        last_response_status = ""
        test_message_sent = $false
        selected_transport = "local_omega_fallback"
    }
}

function Load-State {
    $state = Read-JsonFile -Path $StatePath
    if ($state) { return $state }
    $pool = Load-Pool
    if (-not $pool) { return $null }
    $state = New-StateFromPool -Pool $pool
    Save-State -State $state
    return $state
}

function Save-State {
    param($State)
    $State.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $State
    Write-JsonFile -Path $PoolConfigPath -Payload ([ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = [string]$State.current_label
        rotation_threshold_messages = 50
        pool = @($State.pool)
    })
}

function Get-CurrentEntry {
    param($State)
    foreach ($entry in @($State.pool)) {
        if ([string]$entry.label -eq [string]$State.current_label) { return $entry }
    }
    return $null
}

function Get-RedactedPoolStatus {
    param($PoolOrState, [string]$Status = "AJ_POOL_READY")
    $items = @()
    $current = "A"
    if ($PoolOrState -and ($PoolOrState.PSObject.Properties.Name -contains "pool")) {
        $items = @($PoolOrState.pool)
        $current = [string]$PoolOrState.current_label
    } elseif ($PoolOrState -is [hashtable] -or $PoolOrState -is [System.Collections.Specialized.OrderedDictionary]) {
        $items = @($PoolOrState["pool"])
        $current = [string]$PoolOrState["current_label"]
    }
    [ordered]@{
        schema_version = "playwright_chatgpt_pool_status_v1"
        mission_id = $MissionId
        status = $Status
        pool_loaded = $Status -ne "CHATGPT_AJ_POOL_MISSING"
        current_label = if ([string]::IsNullOrWhiteSpace($current)) { "A" } else { $current }
        rotation_threshold_messages = 50
        private_urls_redacted = $true
        labels = @($items | ForEach-Object {
            [ordered]@{
                label = [string]$_.label
                url_configured = -not [string]::IsNullOrWhiteSpace([string]$_.url)
                url_redacted = $true
                message_count_sent = [int]$_.message_count_sent
                status = [string]$_.status
            }
        })
    }
}

function Send-HarnessAlert {
    param([string]$Reason)
    $eventsPath = Join-Path $ArtifactPath "ntfy_alert_events.json"
    $events = @()
    if (Test-Path -LiteralPath $eventsPath -PathType Leaf) {
        try { $events = @((Get-Content -LiteralPath $eventsPath -Raw | ConvertFrom-Json).events) } catch { $events = @() }
    }
    $now = Get-Date
    $recent = @($events | Where-Object { [string]$_.reason -eq $Reason -and ([datetime]$_.created_at) -gt $now.AddMinutes(-30) })
    if ($recent.Count -gt 0) {
        $event = [ordered]@{ status = "ALERT_SUPPRESSED_COOLDOWN"; reason = $Reason; created_at = $now.ToString("o"); private_urls_redacted = $true }
        $events += $event
        Write-JsonFile -Path $eventsPath -Payload ([ordered]@{ events = @($events) })
        return $event
    }
    $resultPath = Join-Path $ArtifactPath ("alert_{0}.json" -f ($Reason -replace '[^A-Za-z0-9_ -]', '_' -replace '\s+', '_'))
    $message = if ($Reason -eq "HUMAN_ACTION_REQUIRED") {
        "Mission $MissionId transport=playwright_chatgpt_supervisor reason=$Reason. Open the browser window opened by Codex, complete ChatGPT login or verification manually, then leave it open. Codex will continue offline with OMEGA fallback. No private URL or secret is included."
    } else {
        "Mission $MissionId transport=playwright_chatgpt_supervisor reason=$Reason. Codex will continue offline with OMEGA fallback. No private URL or secret is included."
    }
    $args = @(
        "-Channel", "auto",
        "-Title", "NeuroChess ChatGPT Playwright supervisor parked",
        "-MissionId", $MissionId,
        "-ServiceName", "ChatGPT",
        "-Reason", $Reason,
        "-ArtifactPath", $ArtifactPath,
        "-ResultPath", $resultPath,
        "-NoPrompt",
        "-Message", $message
    )
    if ($DryRun) { $args += "-DryRun" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_autopilot_alert.ps1") @args 2>&1
    $result = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    } else {
        $text = ($output | Out-String).Trim()
        $start = $text.IndexOf("{")
        if ($start -ge 0) { $text.Substring($start) | ConvertFrom-Json } else { [pscustomobject]@{ status = "ALERT_RESULT_UNAVAILABLE" } }
    }
    $event = [ordered]@{ status = [string]$result.status; reason = $Reason; created_at = $now.ToString("o"); private_urls_redacted = $true; secrets_redacted = $true }
    $events += $event
    Write-JsonFile -Path $eventsPath -Payload ([ordered]@{ events = @($events) })
    return $event
}

function Invoke-SetupCheck {
    $args = @("-MissionId", $MissionId, "-ArtifactPath", $ArtifactPath, "-NoPrompt")
    if ($DryRun) { $args += "-DryRun" }
    if ($MockMcpReady) { $args += "-MockMcpReady" }
    if ($MockNativeUnavailable) { $args += "-MockNativeUnavailable" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "mcp_playwright_setup_check.ps1") @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { return [pscustomobject]@{ status = "MCP_PLAYWRIGHT_SETUP_BLOCKED"; native_playwright_fallback = @{ status = "NATIVE_PLAYWRIGHT_UNAVAILABLE" } } }
    return $text.Substring($start) | ConvertFrom-Json
}

function Resolve-Transport {
    param($Setup)
    if ($Transport -eq "mcp" -and [string]$Setup.status -in @("MCP_PLAYWRIGHT_READY", "MCP_PLAYWRIGHT_CONFIGURED_NOW_READY") -and [string]$Setup.native_playwright_fallback.status -eq "NATIVE_PLAYWRIGHT_READY") { return "native_playwright_chatgpt_supervisor" }
    if ($Transport -eq "mcp") { return "local_omega_fallback" }
    if ($Transport -eq "native" -and [string]$Setup.native_playwright_fallback.status -eq "NATIVE_PLAYWRIGHT_READY") { return "native_playwright_chatgpt_supervisor" }
    if ($Transport -eq "legacy") { return "legacy_cdp_chatgpt_supervisor" }
    if ([string]$Setup.native_playwright_fallback.status -eq "NATIVE_PLAYWRIGHT_READY") { return "native_playwright_chatgpt_supervisor" }
    return "local_omega_fallback"
}

function Write-NodeProbe {
    $probePath = Join-Path $ArtifactPath "playwright_chatgpt_supervisor_probe.mjs"
    $source = @'
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

async function launchSupervisorContext(playwright, profile) {
  const base = {
    headless: false,
    viewport: { width: 1440, height: 1000 }
  };
  const attempts = [
    { name: "bundled_chromium", options: {} },
    { name: "system_chrome", options: { channel: "chrome" } },
    { name: "system_msedge", options: { channel: "msedge" } }
  ];
  const errors = [];
  for (const attempt of attempts) {
    try {
      const context = await playwright.chromium.launchPersistentContext(profile, { ...base, ...attempt.options });
      return { context, launch_strategy: attempt.name };
    } catch (error) {
      errors.push(`${attempt.name}: ${String(error && error.message ? error.message : error).split("\n")[0]}`);
    }
  }
  throw new Error(`PLAYWRIGHT_BROWSER_LAUNCH_FAILED: ${errors.join(" | ")}`);
}

function detectHumanAction(title, text) {
  const combined = `${title || ""}\n${text || ""}`;
  return /sign in|log in|login|connexion|se connecter|captcha|i am human|je suis humain|human verification|verification humaine|2fa|two-factor|two factor|password|mot de passe|consent|cloudflare/i.test(combined);
}

function detectLoading(title, text) {
  const combined = `${title || ""}\n${text || ""}`;
  return /loading|chargement|just a moment|un instant|checking your browser|patientez/i.test(combined);
}

async function classify(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  const title = await page.title().catch(() => "");
  const text = await page.locator("body").textContent({ timeout: 6000 }).catch(() => "");
  const composer = page.locator('[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea, [placeholder*="Message" i]');
  const composerCount = await composer.count().catch(() => 0);
  const composerVisible = composerCount > 0 ? await composer.first().isVisible().catch(() => false) : false;
  const composerEnabled = composerCount > 0 ? await composer.first().isEnabled().catch(() => false) : false;
  const sendButton = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i]').first();
  const sendAvailable = await sendButton.isVisible().catch(() => false);
  const human = detectHumanAction(title, text);
  const loading = detectLoading(title, text);
  let status = "SESSION_UNCLASSIFIED";
  if (human) status = "HUMAN_ACTION_REQUIRED";
  else if (loading && composerCount <= 0) status = "SESSION_LOADING";
  else if (composerCount > 0 && composerVisible && composerEnabled && sendAvailable) status = "SESSION_READY";
  else if (composerCount <= 0) status = "CHATGPT_COMPOSER_NOT_FOUND";
  return {
    status,
    page_classification: status,
    composer_detected: composerCount > 0 && composerVisible && composerEnabled,
    composer_count: composerCount,
    send_action_available: sendAvailable,
    auth_or_human_wall_detected: human,
    page_loading_detected: loading,
    title_redacted: true,
    body_text_length: String(text || "").length,
    current_url_redacted: true
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const out = args.out || process.cwd();
  const resultFile = path.join(out, "node_probe_result.json");
  let result = {
    schema_version: "playwright_chatgpt_supervisor_node_probe_v1",
    mode: args.mode || "ClassifyPage",
    transport: args.transport || "native",
    private_urls_redacted: true,
    secrets_redacted: true,
    cookies_printed: false,
    tokens_printed: false,
    no_blind_typing: true
  };
  let context = null;
  try {
    const playwright = await loadPlaywright();
    const profile = args.profilePath;
    const url = args.url;
    if (!url) {
      result.status = "CHATGPT_DISCUSSION_OPEN_FAILED";
      result.reason = "NO_URL_CONFIGURED";
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const launched = await launchSupervisorContext(playwright, profile);
    context = launched.context;
    result.launch_strategy = launched.launch_strategy;
    const page = context.pages()[0] || await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    if (args.mode === "OpenCurrentDiscussion") {
      result.status = "DISCUSSION_OPENED";
      result.current_url_redacted = true;
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const pageState = await classify(page);
    Object.assign(result, pageState);
    if (args.mode === "ClassifyPage" || args.mode === "DetectComposer") {
      if (args.mode === "DetectComposer") {
        result.status = pageState.composer_detected && pageState.status === "SESSION_READY" ? "COMPOSER_DETECTED" : "CHATGPT_COMPOSER_NOT_FOUND";
      }
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.mode === "SendTestMessage") {
      if (pageState.status !== "SESSION_READY" || !pageState.composer_detected) {
        result.status = pageState.status === "HUMAN_ACTION_REQUIRED" ? "HUMAN_ACTION_REQUIRED" : "CHATGPT_COMPOSER_NOT_FOUND";
        result.message_submitted = false;
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const message = fs.existsSync(args.messageFile || "") ? fs.readFileSync(args.messageFile, "utf8") : 'NeuroChess supervisor transport test. Reply with JSON only:\n{"transport":"mcp_playwright_chatgpt_web","status":"ok","mission":"A20BC"}';
      const composer = page.locator('[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea, [placeholder*="Message" i]').first();
      await composer.fill(message, { timeout: 10000 });
      const textAfterFill = await composer.textContent().catch(() => "");
      const valueAfterFill = await composer.inputValue().catch(() => "");
      if (!String(`${textAfterFill}\n${valueAfterFill}`).includes("NeuroChess supervisor transport test")) {
        result.status = "MESSAGE_SEND_FAILED";
        result.message_submitted = false;
        result.reason = "COMPOSER_FILL_NOT_VERIFIED";
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const button = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i]').first();
      if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled().catch(() => false))) {
        result.status = "MESSAGE_SEND_FAILED";
        result.message_submitted = false;
        result.reason = "SEND_BUTTON_NOT_AVAILABLE";
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      await button.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
      const composerAfterSend = await composer.textContent().catch(() => "");
      const valueAfterSend = await composer.inputValue().catch(() => "");
      result.message_submitted = !String(`${composerAfterSend}\n${valueAfterSend}`).includes("NeuroChess supervisor transport test");
      result.status = result.message_submitted ? "MESSAGE_SUBMITTED_RESPONSE_PENDING" : "MESSAGE_SEND_FAILED";
      result.response_pending = result.message_submitted;
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.mode === "ReadLastResponse") {
      const deadline = Date.now() + Math.max(1000, Number(args.maxWaitSeconds || 90) * 1000);
      let parsed = null;
      while (Date.now() < deadline) {
        const text = await page.locator("body").textContent({ timeout: 3000 }).catch(() => "");
        const match = String(text || "").match(/\{[^{}]*"transport"\s*:\s*"mcp_playwright_chatgpt_web"[^{}]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
          if (parsed) break;
        }
        await page.waitForTimeout(1000);
      }
      if (parsed && parsed.status === "ok") {
        result.status = "RESPONSE_JSON_OK";
        result.response_read = true;
      } else {
        result.status = "RESPONSE_TIMEOUT";
        result.response_read = false;
      }
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.status = pageState.status;
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = "PLAYWRIGHT_SUPERVISOR_UNAVAILABLE";
    result.error_redacted = String(error && error.message ? error.message : error).replace(/https:\/\/chatgpt\.com\/\S+/g, "[redacted-chatgpt-url]");
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

main();
'@
    Set-Content -LiteralPath $probePath -Value $source -Encoding UTF8
    return $probePath
}

function Invoke-NodeProbe {
    param([string]$NodeMode, $State, [string]$SelectedTransport, [string]$MessagePath = "")
    if (-not [string]::IsNullOrWhiteSpace($MockSessionStatus)) {
        $mockStatus = if ($NodeMode -eq "SendTestMessage" -and $MockSendSuccess) { "MESSAGE_SUBMITTED_RESPONSE_PENDING" } elseif ($NodeMode -eq "ReadLastResponse" -and $MockResponseJsonOk) { "RESPONSE_JSON_OK" } elseif ($NodeMode -eq "ReadLastResponse" -and $MockResponseTimeout) { "RESPONSE_TIMEOUT" } elseif ($NodeMode -eq "DetectComposer" -and $MockSessionStatus -eq "SESSION_READY") { "COMPOSER_DETECTED" } else { $MockSessionStatus }
        return ([ordered]@{
            status = $mockStatus
            page_classification = $MockSessionStatus
            composer_detected = $MockSessionStatus -eq "SESSION_READY"
            send_action_available = $MockSessionStatus -eq "SESSION_READY"
            auth_or_human_wall_detected = $MockSessionStatus -eq "HUMAN_ACTION_REQUIRED"
            message_submitted = $mockStatus -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING"
            response_read = $mockStatus -eq "RESPONSE_JSON_OK"
            private_urls_redacted = $true
            no_blind_typing = $true
        })
    }
    if ($SelectedTransport -eq "local_omega_fallback") {
        return ([ordered]@{ status = "PLAYWRIGHT_SUPERVISOR_UNAVAILABLE"; private_urls_redacted = $true; no_blind_typing = $true })
    }
    $current = Get-CurrentEntry -State $State
    if (-not $current -or [string]::IsNullOrWhiteSpace([string]$current.url)) {
        return ([ordered]@{ status = "CHATGPT_DISCUSSION_OPEN_FAILED"; reason = "NO_URL_CONFIGURED"; private_urls_redacted = $true })
    }
    $probe = Write-NodeProbe
    $nodeOut = Join-Path $ArtifactPath ("node_{0}" -f $NodeMode)
    New-Item -ItemType Directory -Force -Path $nodeOut | Out-Null
    $args = @(
        $probe,
        "--mode", $NodeMode,
        "--transport", $SelectedTransport,
        "--profilePath", (Resolve-Path -LiteralPath $ProfilePath).Path,
        "--url", ([string]$current.url),
        "--out", $nodeOut,
        "--maxWaitSeconds", ([string]$MaxWaitSeconds)
    )
    if (-not [string]::IsNullOrWhiteSpace($MessagePath)) { $args += @("--messageFile", (Resolve-Path -LiteralPath $MessagePath).Path) }
    $output = & node @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { return ([ordered]@{ status = "PLAYWRIGHT_SUPERVISOR_UNAVAILABLE"; error_redacted = "node probe emitted no JSON"; private_urls_redacted = $true }) }
    return $text.Substring($start) | ConvertFrom-Json
}

function Invoke-Rotate {
    param($State)
    $current = Get-CurrentEntry -State $State
    if ($current -and [int]$current.message_count_sent -lt 50) {
        return ([ordered]@{ status = "ROTATION_NOT_REQUIRED"; current_label = [string]$State.current_label; threshold = 50; rotated = $false })
    }
    if ($current) { $current.status = "EXHAUSTED" }
    $labels = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    $start = [Array]::IndexOf($labels, [string]$State.current_label)
    if ($start -lt 0) { $start = 0 }
    for ($i = 1; $i -le $labels.Count; $i++) {
        $label = $labels[($start + $i) % $labels.Count]
        $candidate = @($State.pool | Where-Object { [string]$_.label -eq $label }) | Select-Object -First 1
        if ($candidate -and [int]$candidate.message_count_sent -lt 50 -and [string]$candidate.status -notin @("EXHAUSTED", "BLOCKED")) {
            foreach ($entry in @($State.pool)) { if ([string]$entry.status -eq "ACTIVE") { $entry.status = "AVAILABLE" } }
            $candidate.status = "ACTIVE"
            $State.current_label = [string]$candidate.label
            return ([ordered]@{ status = "ROTATED_TO_NEXT_DISCUSSION"; current_label = [string]$State.current_label; threshold = 50; rotated = $true })
        }
    }
    return ([ordered]@{ status = "CHATGPT_POOL_EXHAUSTED"; current_label = [string]$State.current_label; threshold = 50; rotated = $false })
}

function Increment-CurrentCounter {
    param($State)
    $entry = Get-CurrentEntry -State $State
    if (-not $entry) { return $null }
    $entry.message_count_sent = [int]$entry.message_count_sent + 1
    [ordered]@{ label = [string]$entry.label; message_count_sent = [int]$entry.message_count_sent; incremented = $true }
}

function Write-ResumeInstructions {
    $path = Join-Path $ArtifactPath "resume_instructions.md"
    $resumeCommand = "powershell -ExecutionPolicy Bypass -File ops/autopilot/playwright_chatgpt_supervisor_harness.ps1 -Mode E2EProof -MissionId A20BC -NoPrompt"
    $lines = @(
        "# Resume ChatGPT A-J E2E Proof",
        "",
        "Codex parked the ChatGPT Playwright supervisor lane because the page requires",
        "manual authentication or verification. No bypass was attempted.",
        "",
        "After completing the manual ChatGPT login or verification in the dedicated",
        "browser profile, rerun:",
        "",
        '```powershell',
        $resumeCommand,
        '```'
    )
    $content = $lines -join [Environment]::NewLine
    $content | Set-Content -LiteralPath $path -Encoding UTF8
    $resumeResult = @{
        status = "RESUME_INSTRUCTIONS_READY"
        path_redacted = $true
        command = $resumeCommand
    }
    return $resumeResult
}

New-Item -ItemType Directory -Force -Path $ArtifactPath, (Split-Path -Parent $PoolConfigPath), (Split-Path -Parent $StatePath) | Out-Null

switch ($Mode) {
    "Discover" {
        $setup = Invoke-SetupCheck
        Emit-Result -Payload ([ordered]@{ status = [string]$setup.status; setup = $setup; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "mcp_setup_check.json"
    }
    "Status" {
        $profile = Ensure-ProfileIgnored
        Write-JsonFile -Path (Join-Path $ArtifactPath "profile_status.json") -Payload $profile
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            $poolStatus = Get-RedactedPoolStatus -PoolOrState (New-DefaultPool) -Status "CHATGPT_AJ_POOL_MISSING"
            $poolStatus = Set-ResultProperty -Target $poolStatus -Name "alert_status" -Value ([string]$alert.status)
            Emit-Result -Payload $poolStatus -ArtifactName "aj_pool_status_redacted.json"
        }
        $pool = Get-RedactedPoolStatus -PoolOrState $state
        $pool = Set-ResultProperty -Target $pool -Name "profile" -Value $profile
        Emit-Result -Payload $pool -ArtifactName "aj_pool_status_redacted.json"
    }
    "DryRun" {
        $profile = Ensure-ProfileIgnored
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) {
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; profile = $profile; setup = $setup; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "aj_pool_status_redacted.json"
        }
        Emit-Result -Payload ([ordered]@{
            schema_version = "playwright_chatgpt_supervisor_dry_run_v1"
            mission_id = $MissionId
            status = "PLAYWRIGHT_SUPERVISOR_DRY_RUN_PASS"
            setup_status = [string]$setup.status
            selected_transport = (Resolve-Transport -Setup $setup)
            profile = $profile
            aj_pool = (Get-RedactedPoolStatus -PoolOrState $state)
            threshold_50 = [int]$state.rotation_threshold_messages -eq 50
            no_live_send = $true
            no_user_prompt = $true
            local_omega_fallback_available = $true
        }) -ArtifactName "dry_run_result.json"
    }
    "OpenCurrentDiscussion" {
        $profile = Ensure-ProfileIgnored
        Write-JsonFile -Path (Join-Path $ArtifactPath "profile_status.json") -Payload $profile
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; private_urls_redacted = $true }) -ArtifactName "discussion_open_result.json" }
        $selected = Resolve-Transport -Setup $setup
        $node = Invoke-NodeProbe -NodeMode "OpenCurrentDiscussion" -State $state -SelectedTransport $selected
        $node = Set-ResultProperty -Target $node -Name "selected_transport" -Value $selected
        Emit-Result -Payload $node -ArtifactName "discussion_open_result.json"
    }
    "ClassifyPage" {
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; private_urls_redacted = $true }) -ArtifactName "page_classification_result.json" }
        $selected = Resolve-Transport -Setup $setup
        $node = Invoke-NodeProbe -NodeMode "ClassifyPage" -State $state -SelectedTransport $selected
        $state.last_page_classification = [string]$node.status
        $state.selected_transport = $selected
        Save-State -State $state
        if ([string]$node.status -eq "HUMAN_ACTION_REQUIRED") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "HUMAN_ACTION_REQUIRED") }
        Emit-Result -Payload $node -ArtifactName "page_classification_result.json"
    }
    "DetectComposer" {
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; private_urls_redacted = $true }) -ArtifactName "composer_detection_result.json" }
        $selected = Resolve-Transport -Setup $setup
        $node = Invoke-NodeProbe -NodeMode "DetectComposer" -State $state -SelectedTransport $selected
        $state.last_composer_status = [string]$node.status
        Save-State -State $state
        Emit-Result -Payload $node -ArtifactName "composer_detection_result.json"
    }
    "SendTestMessage" {
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; sent = $false; private_urls_redacted = $true }) -ArtifactName "send_test_result.json" }
        if ([bool]$state.test_message_sent) { Emit-Result -Payload ([ordered]@{ status = "TEST_MESSAGE_ALREADY_SENT"; sent = $false; counter_incremented = $false; current_label = [string]$state.current_label; private_urls_redacted = $true }) -ArtifactName "send_test_result.json" }
        $selected = Resolve-Transport -Setup $setup
        $messagePath = $MessageFile
        if ([string]::IsNullOrWhiteSpace($messagePath)) {
            $messagePath = Join-Path $ArtifactPath "playwright_supervisor_test_message.md"
            $messageLines = @(
                "NeuroChess supervisor transport test. Reply with JSON only:",
                '{"transport":"mcp_playwright_chatgpt_web","status":"ok","mission":"A20BC"}'
            )
            $messageContent = $messageLines -join [Environment]::NewLine
            $messageContent | Set-Content -LiteralPath $messagePath -Encoding UTF8
        }
        $node = Invoke-NodeProbe -NodeMode "SendTestMessage" -State $state -SelectedTransport $selected -MessagePath $messagePath
        $sent = [string]$node.status -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING"
        if ($sent) {
            $increment = Increment-CurrentCounter -State $state
            $state.test_message_sent = $true
            $state.last_send_status = [string]$node.status
            Save-State -State $state
            $node = Set-ResultProperty -Target $node -Name "increment" -Value $increment
            $node = Set-ResultProperty -Target $node -Name "counter_incremented" -Value $true
        } else {
            $node = Set-ResultProperty -Target $node -Name "counter_incremented" -Value $false
            if ([string]$node.status -eq "HUMAN_ACTION_REQUIRED") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "HUMAN_ACTION_REQUIRED") }
        }
        $node = Set-ResultProperty -Target $node -Name "sent" -Value $sent
        Emit-Result -Payload $node -ArtifactName "send_test_result.json"
    }
    "ReadLastResponse" {
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; response_read = $false; private_urls_redacted = $true }) -ArtifactName "response_read_result.json" }
        $selected = Resolve-Transport -Setup $setup
        $node = Invoke-NodeProbe -NodeMode "ReadLastResponse" -State $state -SelectedTransport $selected
        $state.last_response_status = [string]$node.status
        Save-State -State $state
        Emit-Result -Payload $node -ArtifactName "response_read_result.json"
    }
    "RotateIfNeeded" {
        $state = Load-State
        if (-not $state) { Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; private_urls_redacted = $true }) -ArtifactName "rotation_status_result.json" }
        $rotation = Invoke-Rotate -State $state
        Save-State -State $state
        Emit-Result -Payload ([ordered]@{ status = [string]$rotation.status; rotation = $rotation; private_urls_redacted = $true }) -ArtifactName "rotation_status_result.json"
    }
    "E2EProof" {
        $profile = Ensure-ProfileIgnored
        Write-JsonFile -Path (Join-Path $ArtifactPath "profile_status.json") -Payload $profile
        $setup = Invoke-SetupCheck
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; alert_status = [string]$alert.status; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "transport_integration_result.json"
        }
        Write-JsonFile -Path (Join-Path $ArtifactPath "aj_pool_status_redacted.json") -Payload (Get-RedactedPoolStatus -PoolOrState $state)
        $selected = Resolve-Transport -Setup $setup
        $open = Invoke-NodeProbe -NodeMode "OpenCurrentDiscussion" -State $state -SelectedTransport $selected
        Write-JsonFile -Path (Join-Path $ArtifactPath "discussion_open_result.json") -Payload $open
        if ([string]$open.status -in @("PLAYWRIGHT_SUPERVISOR_UNAVAILABLE", "CHATGPT_DISCUSSION_OPEN_FAILED")) {
            $payload = [ordered]@{
                schema_version = "playwright_chatgpt_supervisor_e2e_v1"
                mission_id = $MissionId
                status = [string]$open.status
                selected_transport = $selected
                mcp_status = [string]$setup.status
                mcp_direct_execution = $false
                native_fallback_status = [string]$setup.native_playwright_fallback.status
                current_label = [string]$state.current_label
                threshold_50 = $true
                discussion_opened = $false
                page_classification = [string]$open.status
                composer_detected = $false
                message_sent = $false
                response_read = $false
                counter_incremented = $false
                local_omega_fallback_available = $true
                private_urls_redacted = $true
                no_paid_api_used = $true
                no_blind_typing = $true
            }
            Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
            Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
        }
        $class = Invoke-NodeProbe -NodeMode "ClassifyPage" -State $state -SelectedTransport $selected
        Write-JsonFile -Path (Join-Path $ArtifactPath "page_classification_result.json") -Payload $class
        $state.last_page_classification = [string]$class.status
        $state.selected_transport = $selected
        if ([string]$class.status -eq "HUMAN_ACTION_REQUIRED") {
            $alert = Send-HarnessAlert -Reason "HUMAN_ACTION_REQUIRED"
            $resume = Write-ResumeInstructions
            $state.last_composer_status = "CHATGPT_COMPOSER_NOT_FOUND"
            Save-State -State $state
            Write-JsonFile -Path (Join-Path $ArtifactPath "composer_detection_result.json") -Payload ([ordered]@{ status = "CHATGPT_COMPOSER_NOT_FOUND"; composer_detected = $false; reason = "HUMAN_ACTION_REQUIRED"; private_urls_redacted = $true })
            Write-JsonFile -Path (Join-Path $ArtifactPath "send_test_result.json") -Payload ([ordered]@{ status = "SEND_NOT_ATTEMPTED"; sent = $false; reason = "HUMAN_ACTION_REQUIRED"; counter_incremented = $false; private_urls_redacted = $true })
            Write-JsonFile -Path (Join-Path $ArtifactPath "response_read_result.json") -Payload ([ordered]@{ status = "RESPONSE_NOT_ATTEMPTED"; response_read = $false; reason = "NO_MESSAGE_SUBMITTED"; private_urls_redacted = $true })
            $payload = [ordered]@{
                schema_version = "playwright_chatgpt_supervisor_e2e_v1"
                mission_id = $MissionId
                status = "CHATGPT_SESSION_BOOTSTRAP_NEEDS_MANUAL_AUTH"
                selected_transport = $selected
                mcp_status = [string]$setup.status
                native_fallback_status = [string]$setup.native_playwright_fallback.status
                current_label = [string]$state.current_label
                threshold_50 = $true
                discussion_opened = [string]$open.status -in @("DISCUSSION_OPENED")
                page_classification = [string]$class.status
                composer_detected = $false
                message_sent = $false
                response_read = $false
                counter_incremented = $false
                alert = $alert
                resume = $resume
                local_omega_fallback_available = $true
                private_urls_redacted = $true
                no_paid_api_used = $true
                no_blind_typing = $true
            }
            Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
            Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
        }
        $composer = Invoke-NodeProbe -NodeMode "DetectComposer" -State $state -SelectedTransport $selected
        Write-JsonFile -Path (Join-Path $ArtifactPath "composer_detection_result.json") -Payload $composer
        if ([string]$composer.status -ne "COMPOSER_DETECTED") {
            $state.last_composer_status = [string]$composer.status
            Save-State -State $state
            $payload = [ordered]@{ status = "CHATGPT_COMPOSER_NOT_FOUND"; selected_transport = $selected; page_classification = [string]$class.status; composer_detected = $false; message_sent = $false; counter_incremented = $false; private_urls_redacted = $true; local_omega_fallback_available = $true }
            Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
            Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
        }
        $send = & powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode SendTestMessage -MissionId $MissionId -ArtifactPath $ArtifactPath -PoolConfigPath $PoolConfigPath -StatePath $StatePath -ProfilePath $ProfilePath -Transport $Transport -MaxWaitSeconds $MaxWaitSeconds -NoPrompt 2>&1
        $sendObj = ($send | Out-String).Trim()
        $sendObj = $sendObj.Substring($sendObj.IndexOf('{')) | ConvertFrom-Json
        if (-not [bool]$sendObj.sent) {
            $payload = [ordered]@{ status = "MCP_PLAYWRIGHT_BOOTSTRAP_PARTIAL"; selected_transport = $selected; message_sent = $false; response_read = $false; counter_incremented = $false; private_urls_redacted = $true; local_omega_fallback_available = $true }
            Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
            Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
        }
        $response = & powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode ReadLastResponse -MissionId $MissionId -ArtifactPath $ArtifactPath -PoolConfigPath $PoolConfigPath -StatePath $StatePath -ProfilePath $ProfilePath -Transport $Transport -MaxWaitSeconds $MaxWaitSeconds -NoPrompt 2>&1
        $responseObj = ($response | Out-String).Trim()
        $responseObj = $responseObj.Substring($responseObj.IndexOf('{')) | ConvertFrom-Json
        $finalStatus = if ([string]$responseObj.status -eq "RESPONSE_JSON_OK") { "CHATGPT_A_READY" } else { "CHATGPT_A_MESSAGE_SUBMITTED_RESPONSE_UNREAD" }
        $state = Load-State
        $payload = [ordered]@{
            schema_version = "playwright_chatgpt_supervisor_e2e_v1"
            mission_id = $MissionId
            status = $finalStatus
            selected_transport = $selected
            mcp_status = [string]$setup.status
            native_fallback_status = [string]$setup.native_playwright_fallback.status
            current_label = [string]$state.current_label
            threshold_50 = $true
            discussion_opened = $true
            page_classification = [string]$class.status
            composer_detected = $true
            message_sent = $true
            response_read = [string]$responseObj.status -eq "RESPONSE_JSON_OK"
            counter_incremented = $true
            local_omega_fallback_available = $true
            private_urls_redacted = $true
            no_paid_api_used = $true
            no_blind_typing = $true
        }
        Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
        Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
    }
    "BuildReport" {
        $state = Load-State
        $integrationPath = Join-Path $ArtifactPath "transport_integration_result.json"
        if (Test-Path -LiteralPath $integrationPath -PathType Leaf) {
            $existing = Get-Content -LiteralPath $integrationPath -Raw | ConvertFrom-Json
            Emit-Result -Payload $existing -ArtifactName "transport_integration_result.json"
        }
        $status = if (-not $state) { "CHATGPT_AJ_POOL_MISSING" } elseif ([string]$state.last_send_status -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING" -and [string]$state.last_response_status -eq "RESPONSE_JSON_OK") { "CHATGPT_A_READY" } elseif ([string]$state.last_send_status -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING") { "CHATGPT_A_MESSAGE_SUBMITTED_RESPONSE_UNREAD" } elseif ([string]$state.last_page_classification -eq "HUMAN_ACTION_REQUIRED") { "CHATGPT_SESSION_BOOTSTRAP_NEEDS_MANUAL_AUTH" } elseif ([string]$state.last_composer_status -eq "CHATGPT_COMPOSER_NOT_FOUND") { "CHATGPT_COMPOSER_NOT_FOUND" } else { "MCP_PLAYWRIGHT_BOOTSTRAP_PARTIAL" }
        Emit-Result -Payload ([ordered]@{ status = $status; current_label = if ($state) { [string]$state.current_label } else { "A" }; threshold_50 = $true; counter_incremented = if ($state) { [bool]$state.test_message_sent } else { $false }; local_omega_fallback_available = $true; private_urls_redacted = $true; no_paid_api_used = $true; no_blind_typing = $true }) -ArtifactName "transport_integration_result.json"
    }
}
