param(
    [string]$MissionId = "A20BA",
    [string]$PoolConfigPath = "",
    [string]$Endpoint = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [ValidateSet("", "PAGE_USABLE", "HUMAN_ACTION_REQUIRED", "PAGE_LOADING", "UNCLASSIFIED_PAGE_STATE")]
    [string]$MockClassification = "",
    [switch]$MockComposerDetected,
    [switch]$MockSendSuccess,
    [ValidateSet("", "RESPONSE_JSON_OK", "RESPONSE_UNREAD", "RESPONSE_INVALID")]
    [string]$MockResponseStatus = "",
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    if ($MissionId -eq "A20BD") {
        return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\dual_browser_profiles\A20BD_dual_profile_playwright_control_20260518")
    }
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\browser_state_truth\A20BA_composer_first_classifier_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Script did not emit JSON: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

function Get-CurrentPoolEntry {
    param($Pool)
    $current = [string]$Pool.current_label
    if ([string]::IsNullOrWhiteSpace($current)) { $current = "A" }
    foreach ($entry in @($Pool.pool)) {
        if ([string]$entry.label -eq $current) { return $entry }
    }
    return $null
}

function Save-Pool {
    param($Pool)
    Write-JsonFile -Path $PoolConfigPath -Payload $Pool
}

function Increment-CurrentCounter {
    param($Pool)
    $entry = Get-CurrentPoolEntry -Pool $Pool
    if (-not $entry) { return $null }
    if ($entry.PSObject.Properties.Name -contains "message_count_sent") {
        $entry.message_count_sent = [int]$entry.message_count_sent + 1
    } else {
        $entry | Add-Member -NotePropertyName "message_count_sent" -NotePropertyValue 1 -Force
    }
    Save-Pool -Pool $Pool
    [ordered]@{
        label = [string]$entry.label
        message_count_sent = [int]$entry.message_count_sent
        incremented = $true
    }
}

function New-BaseResult {
    param([string]$Status)
    [ordered]@{
        schema_version = "chatgpt_manual_conversation_test_v1"
        status = $Status
        mission_id = $MissionId
        pool_loaded = $false
        current_label = ""
        rotation_threshold_messages = $null
        threshold_50 = $false
        cdp_status = "NOT_CHECKED"
        classifier_status = "NOT_RUN"
        composer_detected = $false
        page_usable = $false
        message_sent = $false
        response_read = $false
        counter_incremented = $false
        private_urls_redacted = $true
        secrets_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        no_bypass = $true
        no_blind_typing = $true
    }
}

function Emit {
    param([object]$Payload, [int]$ExitCode = 0)
    $resultPath = if ([string]::IsNullOrWhiteSpace($OutPath)) {
        Join-Path $ArtifactPath "manual_conversation_test\chatgpt_manual_conversation_test_result.json"
    } else {
        $OutPath
    }
    Write-JsonFile -Path $resultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 80
    exit $ExitCode
}

function Invoke-LiveSend {
    param([string]$ResolvedEndpoint)
    $testDir = Join-Path $ArtifactPath "manual_conversation_test"
    New-Item -ItemType Directory -Force -Path $testDir | Out-Null
    $scriptPath = Join-Path $testDir "chatgpt_manual_conversation_probe.mjs"
    $probeOut = Join-Path $testDir "chatgpt_manual_conversation_probe_result.json"
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
    else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
}

async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  try { return requireFromHere("playwright"); } catch {}
  const roots = [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules") : "",
    path.resolve(path.dirname(process.execPath), "..", "node_modules")
  ].filter(Boolean);
  for (const root of roots) {
    try { return requireFromHere(path.join(root, "playwright")); } catch {}
    const pnpmRoot = path.join(root, ".pnpm");
    if (fs.existsSync(pnpmRoot)) {
      for (const entry of fs.readdirSync(pnpmRoot).filter((item) => /^playwright@/.test(item)).sort().reverse()) {
        try { return requireFromHere(path.join(pnpmRoot, entry, "node_modules", "playwright")); } catch {}
      }
    }
  }
  throw new Error("PLAYWRIGHT_UNAVAILABLE");
}

async function findComposer(page) {
  const selectors = [
    "#prompt-textarea",
    '[data-testid="composer"] [contenteditable="true"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea',
    'div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const editable = await item.isEditable().catch(async () => {
        return await item.evaluate((element) => element.isContentEditable || element.getAttribute("contenteditable") === "true").catch(() => false);
      });
      if (visible && editable) return { locator: item, selector, index };
    }
  }
  return null;
}

async function getText(locator) {
  return await locator.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function fillComposer(page, composer, text) {
  await composer.locator.click({ timeout: 5000 });
  try {
    await composer.locator.fill(text, { timeout: 5000 });
  } catch {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.insertText(text);
  }
  const filled = await getText(composer.locator);
  return filled.includes(text.slice(0, 30));
}

async function clickSend(page) {
  const selectors = ['button[aria-label*="Send" i]', 'button[aria-label*="Envoyer" i]', 'button[data-testid*="send" i]', 'form button[type="submit"]'];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => false);
      if (visible && enabled) {
        await item.click({ timeout: 5000 });
        return "send_button";
      }
    }
  }
  await page.keyboard.press("Enter");
  return "keyboard_enter";
}

async function main() {
  const args = parseArgs(process.argv);
  const endpoint = String(args.endpoint || "").replace(/\/$/, "");
  const outPath = args.out;
  const prompt = 'Return exactly JSON: {"neurochess_live_test":"ok"}';
  const result = {
    status: "CHATGPT_SEND_FAILED",
    cdp_attached: false,
    page_found: false,
    current_url_redacted: true,
    composer_detected: false,
    composer_selector_used: "",
    message_sent: false,
    send_method: "",
    response_read: false,
    response_status: "NOT_READ",
    private_urls_redacted: true,
    cookies_printed: false,
    tokens_printed: false,
    no_bypass: true,
    no_blind_typing: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(endpoint);
    result.cdp_attached = true;
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page = pages.find((candidate) => /chatgpt\.com/i.test(candidate.url()));
    if (!page) {
      result.status = "CDP_UNAVAILABLE";
      writeJson(outPath, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_found = true;
    const composer = await findComposer(page);
    if (!composer) {
      result.status = "CHATGPT_COMPOSER_NOT_FOUND";
      writeJson(outPath, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.composer_detected = true;
    result.composer_selector_used = composer.selector;
    const assistantCountBefore = await page.locator('[data-message-author-role="assistant"]').count().catch(() => 0);
    const responseHitCountBefore = await page.locator('[data-message-author-role="assistant"], article, main').allTextContents()
      .then((texts) => texts.filter((text) => text.includes("neurochess_live_test")).length)
      .catch(() => 0);
    const filled = await fillComposer(page, composer, prompt);
    if (!filled) {
      result.status = "CHATGPT_SEND_FAILED";
      writeJson(outPath, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.send_method = await clickSend(page);
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const userTexts = await page.locator('[data-message-author-role="user"]').allTextContents().catch(() => []);
      if (userTexts.some((text) => text.includes('"neurochess_live_test":"ok"'))) {
        result.message_sent = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!result.message_sent) {
      result.status = "CHATGPT_SEND_FAILED";
      writeJson(outPath, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const responseDeadline = Date.now() + 90000;
    while (Date.now() < responseDeadline) {
      const assistantTexts = await page.locator('[data-message-author-role="assistant"], article, main').allTextContents().catch(() => []);
      const hits = assistantTexts.filter((text) => text.includes("neurochess_live_test"));
      const latest = hits.length > responseHitCountBefore
        ? hits[hits.length - 1]
        : assistantTexts.slice(assistantCountBefore).reverse().find((text) => text.includes("neurochess_live_test"));
      if (latest) {
        result.response_read = true;
        result.response_status = latest.includes('"ok"') ? "RESPONSE_JSON_SEEN" : "RESPONSE_TEXT_READ";
        result.status = latest.includes('"ok"') ? "CHATGPT_MANUAL_CONVERSATION_TEST_PASS" : "CHATGPT_RESPONSE_NOT_READ";
        break;
      }
      await page.waitForTimeout(750);
    }
    if (!result.response_read) {
      result.status = "CHATGPT_RESPONSE_NOT_READ";
    }
    writeJson(outPath, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = result.cdp_attached ? "CHATGPT_SEND_FAILED" : "CDP_UNAVAILABLE";
    result.error_code = String(error.message || error);
    writeJson(outPath, result);
    console.log(JSON.stringify(result, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(JSON.stringify({ status: "CHATGPT_SEND_FAILED", error_code: String(error.message || error), private_urls_redacted: true }, null, 2));
    process.exit(0);
  });
'@
    Set-Content -LiteralPath $scriptPath -Value $nodeSource -Encoding UTF8
    $nodeOutput = & node $scriptPath --endpoint $ResolvedEndpoint --out $probeOut 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) {
        return Read-JsonFile -Path $probeOut
    }
    return [pscustomobject]@{
        status = "CDP_UNAVAILABLE"
        error_code = (($nodeOutput | Out-String) -replace 'https://chatgpt\.com/[^\s"]+', '[redacted-private-url]')
    }
}

function Get-ReachableEndpoint {
    param([string]$Preferred)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($Preferred)) { $candidates += $Preferred }
    $candidates += @("http://127.0.0.1:9222", "http://127.0.0.1:9229")
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri ($candidate.TrimEnd("/") + "/json/version") -TimeoutSec 2
            if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) {
                return $candidate.TrimEnd("/")
            }
        } catch {
            continue
        }
    }
    return ""
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) { $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json" }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$result = New-BaseResult -Status "NOT_RUN"
if (-not (Test-Path -LiteralPath $PoolConfigPath -PathType Leaf)) {
    $result.status = "POOL_MISSING"
    Emit -Payload $result -ExitCode 2
}

$pool = Read-JsonFile -Path $PoolConfigPath
$entry = Get-CurrentPoolEntry -Pool $pool
if (-not $entry) {
    $result.status = "POOL_MISSING"
    Emit -Payload $result -ExitCode 2
}
$result.pool_loaded = $true
$result.current_label = [string]$entry.label
$threshold = if ($pool.PSObject.Properties.Name -contains "rotation_threshold_messages") { [int]$pool.rotation_threshold_messages } else { 0 }
$result.rotation_threshold_messages = $threshold
$result.threshold_50 = $threshold -eq 50

if (-not [string]::IsNullOrWhiteSpace($MockClassification)) {
    $result.classifier_status = $MockClassification
    $result.page_usable = $MockClassification -eq "PAGE_USABLE"
    $result.composer_detected = [bool]$MockComposerDetected
    if (-not $result.page_usable) {
        $result.status = "CHATGPT_PAGE_NOT_USABLE"
        Emit -Payload $result
    }
    if (-not $MockComposerDetected) {
        $result.status = "CHATGPT_COMPOSER_NOT_FOUND"
        Emit -Payload $result
    }
    if (-not $MockSendSuccess) {
        $result.status = "CHATGPT_SEND_FAILED"
        Emit -Payload $result
    }
    $result.message_sent = $true
    $increment = Increment-CurrentCounter -Pool $pool
    $result.counter_incremented = $null -ne $increment
    if ($MockResponseStatus -eq "RESPONSE_UNREAD") {
        $result.status = "CHATGPT_RESPONSE_NOT_READ"
        Emit -Payload $result
    }
    $result.response_read = $true
    $result.status = "CHATGPT_MANUAL_CONVERSATION_TEST_PASS"
    Emit -Payload $result
}

$classifyArgs = @(
    "-Mode", "Classify",
    "-Service", "chatgpt",
    "-MissionId", $MissionId,
    "-ArtifactPath", $ArtifactPath,
    "-NoPrompt"
)
if (-not [string]::IsNullOrWhiteSpace($Endpoint)) { $classifyArgs += @("-Endpoint", $Endpoint) }
$classifyOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_web_judge_page_state.ps1") @classifyArgs 2>&1
$classifier = Convert-JsonOutput -Output $classifyOutput
$result.classifier_status = [string]$classifier.classification
$result.page_usable = [string]$classifier.classification -eq "PAGE_USABLE"
$result.composer_detected = [bool]$classifier.composer_visible
if (-not $result.page_usable) {
    $result.status = "CHATGPT_PAGE_NOT_USABLE"
    Emit -Payload $result -ExitCode 3
}

$resolvedEndpoint = Get-ReachableEndpoint -Preferred $Endpoint
if ([string]::IsNullOrWhiteSpace($resolvedEndpoint)) {
    $result.cdp_status = "CDP_UNAVAILABLE"
    $result.status = "CDP_UNAVAILABLE"
    Emit -Payload $result -ExitCode 4
}
$result.cdp_status = "CDP_READY"
$send = Invoke-LiveSend -ResolvedEndpoint $resolvedEndpoint
$result.composer_detected = [bool]$send.composer_detected
$result.message_sent = [bool]$send.message_sent
$result.response_read = [bool]$send.response_read
$result.send_method = [string]$send.send_method
$result.response_status = [string]$send.response_status
if ($result.message_sent) {
    $increment = Increment-CurrentCounter -Pool $pool
    $result.counter_incremented = $null -ne $increment
    if ($increment) { $result.message_count_sent = [int]$increment.message_count_sent }
}
$result.status = [string]$send.status
$exitCode = if ($result.status -eq "CHATGPT_MANUAL_CONVERSATION_TEST_PASS") { 0 } elseif ($result.status -eq "CHATGPT_RESPONSE_NOT_READ") { 5 } else { 4 }
Emit -Payload $result -ExitCode $exitCode
