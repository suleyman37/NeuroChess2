param(
    [ValidateSet("Status", "InitProfile", "OpenCurrentDiscussion", "ClassifyPage", "SendTestMessage", "ReadLastResponse", "RotateIfNeeded", "DryRun", "BuildReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BB",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [string]$MessageFile = "",
    [int]$MaxWaitSeconds = 90,
    [string]$ArtifactPath = "",
    [string]$PoolConfigPath = "",
    [string]$StatePath = "",
    [string]$ProfilePath = "",
    [string]$Endpoint = "http://127.0.0.1:9231",
    [switch]$MockPoolMissing,
    [ValidateSet("", "PAGE_USABLE", "HUMAN_ACTION_REQUIRED", "PAGE_LOADING", "UNCLASSIFIED_PAGE_STATE", "CHATGPT_COMPOSER_NOT_FOUND")]
    [string]$MockPageClass = "",
    [switch]$MockBrowserLaunchFailure,
    [switch]$MockSendSuccess,
    [switch]$MockResponseTimeout,
    [switch]$MockResponseJsonOk
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_browser_harness\A20BB_chatgpt_aj_e2e_20260518"
}
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) {
    $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\supervisor_browser_harness_state.json"
}
if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $ProfilePath = Join-Path $PSScriptRoot "local\supervisor_browser_profile"
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

function Emit-Result {
    param([object]$Payload, [string]$ArtifactName = "", [int]$ExitCode = 0)
    if (-not [string]::IsNullOrWhiteSpace($ArtifactName)) {
        Write-JsonFile -Path (Join-Path $ArtifactPath $ArtifactName) -Payload $Payload
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload (New-Manifest -Status ([string]$Payload.status))
    $Payload | ConvertTo-Json -Depth 80
    exit $ExitCode
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        throw "Unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    }
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "No JSON emitted by $ScriptPath" }
    return $text.Substring($start) | ConvertFrom-Json
}

function New-Manifest {
    param([string]$Status)
    [ordered]@{
        schema_version = "supervisor_browser_harness_manifest_v1"
        mission_id = $MissionId
        status = $Status
        artifact_path = $ArtifactPath
        created_at = (Get-Date).ToString("o")
        private_urls_committed = $false
        private_urls_printed = $false
        secrets_committed = $false
        paid_api_used = $false
        no_blind_typing = $true
        local_omega_fallback_available = $true
    }
}

function Ensure-ProfileIgnored {
    New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null
    $resolvedProfile = (Resolve-Path -LiteralPath $ProfilePath).Path
    $repoPath = (Resolve-Path -LiteralPath $RepoRoot).Path
    $isRepoLocalProfile = $resolvedProfile.StartsWith((Join-Path $repoPath "ops\autopilot\local"), [StringComparison]::OrdinalIgnoreCase)
    $excludePath = Join-Path $repoPath ".git\info\exclude"
    $excludePattern = "ops/autopilot/local/supervisor_browser_profile/**"
    $excludeUpdated = $false
    if ($isRepoLocalProfile) {
        $excludeText = if (Test-Path -LiteralPath $excludePath -PathType Leaf) { Get-Content -LiteralPath $excludePath -Raw } else { "" }
        if ($excludeText -notmatch [regex]::Escape($excludePattern)) {
            Add-Content -LiteralPath $excludePath -Value $excludePattern -Encoding UTF8
            $excludeUpdated = $true
        }
    }
    return [ordered]@{
        schema_version = "supervisor_browser_profile_status_v1"
        mission_id = $MissionId
        status = "SUPERVISOR_BROWSER_PROFILE_READY"
        profile_path_redacted = $true
        profile_under_gitignored_local_path = [bool]$isRepoLocalProfile
        git_info_exclude_updated = [bool]$excludeUpdated
        profile_exists = (Test-Path -LiteralPath $ProfilePath -PathType Container)
        committed = $false
    }
}

function New-DefaultPool {
    $entries = @()
    foreach ($code in 65..74) {
        $label = [string]([char]$code)
        $entries += [ordered]@{
            label = $label
            url = ""
            message_count_sent = 0
            bootstrap_sent = $false
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 50
        pool = @($entries)
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
                bootstrap_sent = [bool]$entry.bootstrap_sent
                status = if ([string]::IsNullOrWhiteSpace([string]$entry.status)) { "AVAILABLE" } else { [string]$entry.status }
            }
        } else {
            $items += [ordered]@{ label = $label; url = ""; message_count_sent = 0; bootstrap_sent = $false; status = "AVAILABLE" }
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

function New-StateFromPool {
    param($Pool)
    $now = (Get-Date).ToString("o")
    [ordered]@{
        schema_version = "supervisor_browser_harness_state_v1"
        mission_id = $MissionId
        status = "INITIALIZED"
        created_at = $now
        updated_at = $now
        current_label = [string]$Pool.current_label
        rotation_threshold_messages = 50
        pool = @($Pool.pool)
        last_page_classification = ""
        last_send_status = ""
        last_response_status = ""
        test_message_sent = $false
        local_omega_fallback_available = $true
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
    $poolPayload = [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = [string]$State.current_label
        rotation_threshold_messages = 50
        pool = @($State.pool)
    }
    Write-JsonFile -Path $PoolConfigPath -Payload $poolPayload
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
    $currentLabel = "A"
    if ($PoolOrState -is [hashtable] -or $PoolOrState -is [System.Collections.Specialized.OrderedDictionary]) {
        if ($PoolOrState.Contains("pool")) { $items = @($PoolOrState["pool"]) }
        if ($PoolOrState.Contains("current_label")) { $currentLabel = [string]$PoolOrState["current_label"] }
    } elseif ($PoolOrState -and ($PoolOrState.PSObject.Properties.Name -contains "pool")) {
        $items = @($PoolOrState.pool)
        $currentLabel = [string]$PoolOrState.current_label
    }
    [ordered]@{
        schema_version = "supervisor_browser_pool_status_v1"
        mission_id = $MissionId
        status = $Status
        pool_loaded = $Status -ne "CHATGPT_AJ_POOL_MISSING"
        current_label = $currentLabel
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
    param([string]$Reason, [string]$Title = "NeuroChess ChatGPT supervisor browser parked")
    $eventsPath = Join-Path $ArtifactPath "ntfy_alert_events.json"
    $events = @()
    if (Test-Path -LiteralPath $eventsPath -PathType Leaf) {
        try { $events = @((Get-Content -LiteralPath $eventsPath -Raw | ConvertFrom-Json).events) } catch { $events = @() }
    }
    $now = Get-Date
    $recent = @($events | Where-Object {
        [string]$_.reason -eq $Reason -and ([datetime]$_.created_at) -gt $now.AddMinutes(-30)
    })
    if ($recent.Count -gt 0) {
        $event = [ordered]@{
            status = "ALERT_SUPPRESSED_COOLDOWN"
            reason = $Reason
            created_at = $now.ToString("o")
            private_urls_redacted = $true
        }
        $events += $event
        Write-JsonFile -Path $eventsPath -Payload ([ordered]@{ events = @($events) })
        return $event
    }
    $resultPath = Join-Path $ArtifactPath ("alert_{0}.json" -f ($Reason -replace '[^A-Za-z0-9_ -]', '_' -replace '\s+', '_'))
    $args = @(
        "-Channel", "auto",
        "-Title", $Title,
        "-MissionId", $MissionId,
        "-ServiceName", "ChatGPT",
        "-Reason", $Reason,
        "-ArtifactPath", $ArtifactPath,
        "-ResultPath", $resultPath,
        "-NoPrompt",
        "-Message", "Mission $MissionId transport=supervisor_browser_harness reason=$Reason. Codex will continue offline with OMEGA fallback. No private URL or secret is included."
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
    $event = [ordered]@{
        status = [string]$result.status
        reason = $Reason
        created_at = $now.ToString("o")
        private_urls_redacted = $true
        secrets_redacted = $true
    }
    $events += $event
    Write-JsonFile -Path $eventsPath -Payload ([ordered]@{ events = @($events) })
    return $event
}

function Write-NodeProbe {
    $probePath = Join-Path $ArtifactPath "supervisor_browser_probe.mjs"
    $nodeSource = @'
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

async function findChatGptPage(browser) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((context) => context.pages());
  return pages.find((page) => /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(page.url())) || pages[0] || null;
}

async function classify(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  const title = await page.title().catch(() => "");
  const text = await page.locator("body").textContent({ timeout: 6000 }).catch(() => "");
  const composer = page.locator('[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea');
  const composerCount = await composer.count().catch(() => 0);
  const visibleComposerCount = composerCount > 0 ? await composer.first().isVisible().catch(() => false) : false;
  const sendButton = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i], button[aria-label*="Envoyer" i], button:has(svg)').last();
  const sendAvailable = await sendButton.isVisible().catch(() => false);
  const humanAction = detectHumanAction(title, text);
  const loading = detectLoading(title, text);
  let pageClassification = "UNCLASSIFIED_PAGE_STATE";
  if (humanAction) pageClassification = "HUMAN_ACTION_REQUIRED";
  else if (loading && composerCount <= 0) pageClassification = "PAGE_LOADING";
  else if (composerCount > 0 && visibleComposerCount) pageClassification = "PAGE_USABLE";
  else if (composerCount <= 0) pageClassification = "CHATGPT_COMPOSER_NOT_FOUND";
  return {
    page_classification: pageClassification,
    composer_detected: composerCount > 0 && visibleComposerCount,
    composer_count: composerCount,
    send_action_available: sendAvailable,
    auth_or_human_wall_detected: humanAction,
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
    schema_version: "supervisor_browser_node_probe_v1",
    mode: args.mode || "ClassifyPage",
    live_chatgpt_called: false,
    private_urls_redacted: true,
    secrets_redacted: true,
    no_blind_typing: true
  };
  let browser = null;
  try {
    const playwright = await loadPlaywright();
    browser = await playwright.chromium.connectOverCDP(args.endpoint || "http://127.0.0.1:9231");
    result.cdp_attached = true;
    const page = await findChatGptPage(browser);
    if (!page) {
      result.status = "UNCLASSIFIED_PAGE_STATE";
      result.reason = "NO_PAGE_FOUND";
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.live_chatgpt_called = true;
    if (args.mode === "OpenCurrentDiscussion") {
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
      result.status = "CURRENT_DISCUSSION_OPENED_OR_ATTEMPTED";
      result.page_count = browser.contexts().flatMap((context) => context.pages()).length;
      result.current_url_redacted = true;
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const pageState = await classify(page);
    Object.assign(result, pageState);
    if (args.mode === "ClassifyPage") {
      result.status = pageState.page_classification;
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.mode === "SendTestMessage") {
      if (pageState.page_classification !== "PAGE_USABLE" || !pageState.composer_detected) {
        result.status = pageState.page_classification === "HUMAN_ACTION_REQUIRED" ? "HUMAN_ACTION_REQUIRED" : "CHATGPT_COMPOSER_NOT_FOUND";
        result.message_submitted = false;
        write(resultFile, result);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      const message = fs.existsSync(args.messageFile || "") ? fs.readFileSync(args.messageFile, "utf8") : 'NeuroChess supervisor transport test. Reply with JSON only:\n{"transport":"chatgpt_web_a_j_pool","status":"ok","mission":"A20BB"}';
      const composer = page.locator('[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea').first();
      await composer.fill(message, { timeout: 10000 });
      const textAfterFill = await composer.textContent().catch(() => "");
      if (!String(textAfterFill || "").includes("NeuroChess supervisor transport test")) {
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
      result.message_submitted = !String(composerAfterSend || "").includes("NeuroChess supervisor transport test");
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
        const match = String(text || "").match(/\{[^{}]*"transport"\s*:\s*"chatgpt_web_a_j_pool"[^{}]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
          if (parsed) break;
        }
        await page.waitForTimeout(1000);
      }
      if (parsed && parsed.status === "ok") {
        result.status = "RESPONSE_JSON_OK";
        result.response_read = true;
        result.expected_json_detected = true;
      } else {
        result.status = "RESPONSE_TIMEOUT";
        result.response_read = false;
        result.expected_json_detected = false;
      }
      write(resultFile, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.status = "UNCLASSIFIED_PAGE_STATE";
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = "SUPERVISOR_BROWSER_LAUNCH_FAILED";
    result.error_redacted = String(error && error.message ? error.message : error).replace(/https:\/\/chatgpt\.com\/\S+/g, "[redacted-chatgpt-url]");
    write(resultFile, result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main();
'@
    Set-Content -LiteralPath $probePath -Value $nodeSource -Encoding UTF8
    return $probePath
}

function Invoke-BrowserNode {
    param([string]$NodeMode, [string]$MessagePath = "")
    if ($MockBrowserLaunchFailure) {
        return [ordered]@{
            status = "SUPERVISOR_BROWSER_LAUNCH_FAILED"
            mode = $NodeMode
            cdp_attached = $false
            private_urls_redacted = $true
            no_blind_typing = $true
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($MockPageClass)) {
        $mockStatus = if ($NodeMode -eq "SendTestMessage" -and $MockSendSuccess) { "MESSAGE_SUBMITTED_RESPONSE_PENDING" } elseif ($NodeMode -eq "ReadLastResponse" -and $MockResponseJsonOk) { "RESPONSE_JSON_OK" } elseif ($NodeMode -eq "ReadLastResponse" -and $MockResponseTimeout) { "RESPONSE_TIMEOUT" } else { $MockPageClass }
        return [ordered]@{
            status = $mockStatus
            mode = $NodeMode
            page_classification = $MockPageClass
            composer_detected = ($MockPageClass -eq "PAGE_USABLE")
            send_action_available = ($MockPageClass -eq "PAGE_USABLE")
            auth_or_human_wall_detected = ($MockPageClass -eq "HUMAN_ACTION_REQUIRED")
            message_submitted = ($mockStatus -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING")
            response_read = ($mockStatus -eq "RESPONSE_JSON_OK")
            private_urls_redacted = $true
            no_blind_typing = $true
        }
    }
    $probe = Write-NodeProbe
    $nodeOut = Join-Path $ArtifactPath ("node_{0}" -f $NodeMode)
    New-Item -ItemType Directory -Force -Path $nodeOut | Out-Null
    $args = @(
        $probe,
        "--mode", $NodeMode,
        "--endpoint", $Endpoint,
        "--out", $nodeOut,
        "--maxWaitSeconds", ([string]$MaxWaitSeconds)
    )
    if (-not [string]::IsNullOrWhiteSpace($MessagePath)) {
        $args += @("--messageFile", (Resolve-Path -LiteralPath $MessagePath).Path)
    }
    $output = & node @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) {
        return [ordered]@{ status = "SUPERVISOR_BROWSER_LAUNCH_FAILED"; error_redacted = "Node probe emitted no JSON"; private_urls_redacted = $true }
    }
    return $text.Substring($start) | ConvertFrom-Json
}

function Ensure-BrowserOpen {
    param($State)
    $current = Get-CurrentEntry -State $State
    if (-not $current -or [string]::IsNullOrWhiteSpace([string]$current.url)) {
        return [ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; pool_loaded = $false; private_urls_redacted = $true }
    }
    $profile = Ensure-ProfileIgnored
    Write-JsonFile -Path (Join-Path $ArtifactPath "browser_profile_status.json") -Payload $profile
    if ($MockBrowserLaunchFailure -or -not [string]::IsNullOrWhiteSpace($MockPageClass)) {
        return [ordered]@{ status = if ($MockBrowserLaunchFailure) { "SUPERVISOR_BROWSER_LAUNCH_FAILED" } else { "SUPERVISOR_BROWSER_MOCK_READY" }; profile = $profile; private_urls_redacted = $true }
    }
    $resultPath = Join-Path $ArtifactPath "browser_launch_result.json"
    $launch = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "ensure_chatgpt_cdp_session.ps1") -Arguments @(
        "-Endpoint", $Endpoint,
        "-ProfilePath", $ProfilePath,
        "-ChatGptUrl", ([string]$current.url),
        "-ResultPath", $resultPath,
        "-WaitSeconds", ([string][Math]::Min($MaxWaitSeconds, 30))
    ) -AcceptExitCodes @(0, 3, 4)
    if ([string]$launch.status -notin @("CDP_ALREADY_AVAILABLE", "CDP_SESSION_BOOTSTRAPPED")) {
        return [ordered]@{ status = "SUPERVISOR_BROWSER_LAUNCH_FAILED"; launch_status = [string]$launch.status; private_urls_redacted = $true }
    }
    return [ordered]@{ status = "SUPERVISOR_BROWSER_OPENED"; launch_status = [string]$launch.status; profile = $profile; private_urls_redacted = $true }
}

function Invoke-Rotate {
    param($State)
    $threshold = 50
    $current = Get-CurrentEntry -State $State
    if ($current -and [int]$current.message_count_sent -lt $threshold) {
        return [ordered]@{ status = "ROTATION_NOT_REQUIRED"; current_label = [string]$State.current_label; threshold = 50; rotated = $false }
    }
    if ($current) { $current.status = "EXHAUSTED" }
    $labels = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    $start = [Array]::IndexOf($labels, [string]$State.current_label)
    if ($start -lt 0) { $start = 0 }
    for ($i = 1; $i -le $labels.Count; $i++) {
        $candidateLabel = $labels[($start + $i) % $labels.Count]
        $candidate = @($State.pool | Where-Object { [string]$_.label -eq $candidateLabel }) | Select-Object -First 1
        if ($candidate -and [int]$candidate.message_count_sent -lt $threshold -and [string]$candidate.status -notin @("EXHAUSTED", "BLOCKED")) {
            foreach ($entry in @($State.pool)) { if ([string]$entry.status -eq "ACTIVE") { $entry.status = "AVAILABLE" } }
            $candidate.status = "ACTIVE"
            $State.current_label = [string]$candidate.label
            return [ordered]@{ status = "ROTATED_TO_NEXT_DISCUSSION"; current_label = [string]$State.current_label; threshold = 50; rotated = $true }
        }
    }
    return [ordered]@{ status = "CHATGPT_POOL_EXHAUSTED"; current_label = [string]$State.current_label; threshold = 50; rotated = $false }
}

function Increment-CurrentCounter {
    param($State)
    $entry = Get-CurrentEntry -State $State
    if (-not $entry) { return $null }
    $entry.message_count_sent = [int]$entry.message_count_sent + 1
    [ordered]@{ label = [string]$entry.label; message_count_sent = [int]$entry.message_count_sent; incremented = $true }
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

New-Item -ItemType Directory -Force -Path $ArtifactPath, (Split-Path -Parent $PoolConfigPath), (Split-Path -Parent $StatePath) | Out-Null

switch ($Mode) {
    "InitProfile" {
        $profile = Ensure-ProfileIgnored
        Emit-Result -Payload $profile -ArtifactName "browser_profile_status.json"
    }
    "Status" {
        $profile = Ensure-ProfileIgnored
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            $poolStatus = Get-RedactedPoolStatus -PoolOrState (New-DefaultPool) -Status "CHATGPT_AJ_POOL_MISSING"
            $poolStatus = Set-ResultProperty -Target $poolStatus -Name "alert_status" -Value ([string]$alert.status)
            Write-JsonFile -Path (Join-Path $ArtifactPath "browser_profile_status.json") -Payload $profile
            Emit-Result -Payload $poolStatus -ArtifactName "aj_pool_status_redacted.json" -ExitCode 0
        }
        $poolStatus = Get-RedactedPoolStatus -PoolOrState $state
        $poolStatus = Set-ResultProperty -Target $poolStatus -Name "profile" -Value $profile
        Write-JsonFile -Path (Join-Path $ArtifactPath "browser_profile_status.json") -Payload $profile
        Emit-Result -Payload $poolStatus -ArtifactName "aj_pool_status_redacted.json"
    }
    "DryRun" {
        $profile = Ensure-ProfileIgnored
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; profile = $profile; alert_status = [string]$alert.status; local_omega_fallback_available = $true; private_urls_redacted = $true }) -ArtifactName "aj_pool_status_redacted.json"
        }
        $pool = Get-RedactedPoolStatus -PoolOrState $state
        Emit-Result -Payload ([ordered]@{
            schema_version = "supervisor_browser_harness_dry_run_v1"
            mission_id = $MissionId
            status = "SUPERVISOR_BROWSER_DRY_RUN_PASS"
            dedicated_profile = $true
            profile = $profile
            aj_pool = $pool
            threshold_50 = ([int]$state.rotation_threshold_messages -eq 50)
            current_label = [string]$state.current_label
            no_live_send = $true
            no_user_prompt = $true
            local_omega_fallback_available = $true
        }) -ArtifactName "dry_run_result.json"
    }
    "OpenCurrentDiscussion" {
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; alert_status = [string]$alert.status; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "page_classification_result.json"
        }
        $open = Ensure-BrowserOpen -State $state
        if ([string]$open.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") {
            $alert = Send-HarnessAlert -Reason "SUPERVISOR_BROWSER_LAUNCH_FAILED"
            $open = Set-ResultProperty -Target $open -Name "alert_status" -Value ([string]$alert.status)
            $open = Set-ResultProperty -Target $open -Name "local_omega_fallback_available" -Value $true
            Emit-Result -Payload $open -ArtifactName "page_classification_result.json"
        }
        $node = Invoke-BrowserNode -NodeMode "OpenCurrentDiscussion"
        $node = Set-ResultProperty -Target $node -Name "current_label" -Value ([string]$state.current_label)
        $openStatus = if ([string]$node.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") { "SUPERVISOR_BROWSER_LAUNCH_FAILED" } else { "CURRENT_DISCUSSION_OPENED_OR_ATTEMPTED" }
        $node = Set-ResultProperty -Target $node -Name "status" -Value $openStatus
        Emit-Result -Payload $node -ArtifactName "page_classification_result.json"
    }
    "ClassifyPage" {
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; alert_status = [string]$alert.status; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "page_classification_result.json"
        }
        $open = Ensure-BrowserOpen -State $state
        if ([string]$open.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") {
            $alert = Send-HarnessAlert -Reason "SUPERVISOR_BROWSER_LAUNCH_FAILED"
            $open = Set-ResultProperty -Target $open -Name "alert_status" -Value ([string]$alert.status)
            Emit-Result -Payload $open -ArtifactName "page_classification_result.json"
        }
        $node = Invoke-BrowserNode -NodeMode "ClassifyPage"
        $state.last_page_classification = [string]$node.status
        Save-State -State $state
        if ([string]$node.status -eq "HUMAN_ACTION_REQUIRED") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "HUMAN_ACTION_REQUIRED") }
        elseif ([string]$node.status -eq "CHATGPT_COMPOSER_NOT_FOUND") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "CHATGPT_COMPOSER_NOT_FOUND") }
        Write-JsonFile -Path (Join-Path $ArtifactPath "composer_detection_result.json") -Payload ([ordered]@{
            status = if ([bool]$node.composer_detected) { "COMPOSER_DETECTED" } else { "CHATGPT_COMPOSER_NOT_FOUND" }
            composer_detected = [bool]$node.composer_detected
            send_action_available = [bool]$node.send_action_available
            private_urls_redacted = $true
        })
        Emit-Result -Payload $node -ArtifactName "page_classification_result.json"
    }
    "SendTestMessage" {
        $state = Load-State
        if (-not $state) {
            $alert = Send-HarnessAlert -Reason "CHATGPT_AJ_POOL_MISSING"
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; sent = $false; alert_status = [string]$alert.status; private_urls_redacted = $true }) -ArtifactName "send_test_result.json"
        }
        if ([bool]$state.test_message_sent) {
            Emit-Result -Payload ([ordered]@{ status = "TEST_MESSAGE_ALREADY_SENT"; sent = $false; counter_incremented = $false; current_label = [string]$state.current_label; private_urls_redacted = $true }) -ArtifactName "send_test_result.json"
        }
        $open = Ensure-BrowserOpen -State $state
        if ([string]$open.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") {
            $alert = Send-HarnessAlert -Reason "SUPERVISOR_BROWSER_LAUNCH_FAILED"
            Emit-Result -Payload ([ordered]@{ status = "SUPERVISOR_BROWSER_LAUNCH_FAILED"; sent = $false; alert_status = [string]$alert.status; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "send_test_result.json"
        }
        $messagePath = $MessageFile
        if ([string]::IsNullOrWhiteSpace($messagePath)) {
            $messagePath = Join-Path $ArtifactPath "supervisor_test_message.md"
            @"
NeuroChess supervisor transport test. Reply with JSON only:
{"transport":"chatgpt_web_a_j_pool","status":"ok","mission":"A20BB"}
"@ | Set-Content -LiteralPath $messagePath -Encoding UTF8
        }
        $node = Invoke-BrowserNode -NodeMode "SendTestMessage" -MessagePath $messagePath
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
            elseif ([string]$node.status -eq "CHATGPT_COMPOSER_NOT_FOUND") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "CHATGPT_COMPOSER_NOT_FOUND") }
            elseif ([string]$node.status -eq "MESSAGE_SEND_FAILED") { $node = Set-ResultProperty -Target $node -Name "alert" -Value (Send-HarnessAlert -Reason "MESSAGE_SEND_FAILED") }
        }
        $node = Set-ResultProperty -Target $node -Name "sent" -Value $sent
        $node = Set-ResultProperty -Target $node -Name "current_label" -Value ([string]$state.current_label)
        Emit-Result -Payload $node -ArtifactName "send_test_result.json"
    }
    "ReadLastResponse" {
        $state = Load-State
        if (-not $state) {
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; response_read = $false; private_urls_redacted = $true }) -ArtifactName "response_read_result.json"
        }
        $open = Ensure-BrowserOpen -State $state
        if ([string]$open.status -eq "SUPERVISOR_BROWSER_LAUNCH_FAILED") {
            Emit-Result -Payload ([ordered]@{ status = "SUPERVISOR_BROWSER_LAUNCH_FAILED"; response_read = $false; private_urls_redacted = $true }) -ArtifactName "response_read_result.json"
        }
        $node = Invoke-BrowserNode -NodeMode "ReadLastResponse"
        $state.last_response_status = [string]$node.status
        Save-State -State $state
        Emit-Result -Payload $node -ArtifactName "response_read_result.json"
    }
    "RotateIfNeeded" {
        $state = Load-State
        if (-not $state) {
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_AJ_POOL_MISSING"; private_urls_redacted = $true }) -ArtifactName "rotation_status_result.json"
        }
        $rotation = Invoke-Rotate -State $state
        Save-State -State $state
        Emit-Result -Payload ([ordered]@{ status = [string]$rotation.status; rotation = $rotation; private_urls_redacted = $true }) -ArtifactName "rotation_status_result.json"
    }
    "BuildReport" {
        $state = Load-State
        $status = if ($state -and [string]$state.last_send_status -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING" -and [string]$state.last_response_status -eq "RESPONSE_JSON_OK") {
            "CHATGPT_WEB_SUPERVISOR_E2E_READY"
        } elseif ($state -and [string]$state.last_send_status -eq "MESSAGE_SUBMITTED_RESPONSE_PENDING") {
            "CHATGPT_WEB_MESSAGE_SUBMITTED_RESPONSE_UNREAD"
        } elseif ($state -and [string]$state.last_page_classification -eq "HUMAN_ACTION_REQUIRED") {
            "CHATGPT_WEB_HUMAN_ACTION_REQUIRED_PARKED"
        } elseif ($state -and [string]$state.last_page_classification -eq "CHATGPT_COMPOSER_NOT_FOUND") {
            "CHATGPT_COMPOSER_NOT_FOUND"
        } elseif (-not $state) {
            "CHATGPT_AJ_POOL_MISSING"
        } else {
            "SUPERVISOR_BROWSER_HARNESS_PARTIAL"
        }
        $sendPath = Join-Path $ArtifactPath "send_test_result.json"
        if (-not (Test-Path -LiteralPath $sendPath -PathType Leaf)) {
            Write-JsonFile -Path $sendPath -Payload ([ordered]@{
                schema_version = "supervisor_browser_send_test_v1"
                mission_id = $MissionId
                status = "SEND_NOT_ATTEMPTED"
                sent = $false
                reason = if ($state -and [string]$state.last_page_classification -eq "HUMAN_ACTION_REQUIRED") { "HUMAN_ACTION_REQUIRED" } else { "PAGE_NOT_USABLE" }
                counter_incremented = $false
                private_urls_redacted = $true
                no_blind_typing = $true
            })
        }
        $responsePath = Join-Path $ArtifactPath "response_read_result.json"
        if (-not (Test-Path -LiteralPath $responsePath -PathType Leaf)) {
            Write-JsonFile -Path $responsePath -Payload ([ordered]@{
                schema_version = "supervisor_browser_response_read_v1"
                mission_id = $MissionId
                status = "RESPONSE_NOT_ATTEMPTED"
                response_read = $false
                reason = "NO_MESSAGE_SUBMITTED"
                private_urls_redacted = $true
                secrets_redacted = $true
            })
        }
        $payload = [ordered]@{
            schema_version = "supervisor_browser_harness_report_v1"
            mission_id = $MissionId
            status = $status
            current_label = if ($state) { [string]$state.current_label } else { "A" }
            rotation_threshold_messages = 50
            counter_incremented = if ($state) { [bool]$state.test_message_sent } else { $false }
            local_omega_fallback_available = $true
            private_urls_redacted = $true
            no_paid_api_used = $true
            no_blind_typing = $true
        }
        Write-JsonFile -Path (Join-Path $ArtifactPath "transport_integration_result.json") -Payload $payload
        Emit-Result -Payload $payload -ArtifactName "transport_integration_result.json"
    }
}
