param(
    [ValidateSet("Status", "HealthCheck", "Open", "ClassifyPage", "SelectModel", "SendTextSmoke", "SendVisualPacket", "ParkLane", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BC",
    [string]$VisualEvidencePath = "",
    [string]$MessageFile = "",
    [string]$Endpoint = "",
    [int]$CDPPort = 9223,
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [ValidateSet("", "PAGE_USABLE", "HUMAN_ACTION_REQUIRED", "PAGE_LOADING", "UNCLASSIFIED_PAGE_STATE")]
    [string]$MockClassification = "",
    [switch]$MockComposerVisible,
    [switch]$MockUploadAvailable,
    [string]$MockModelLabelsJson = "",
    [string]$MockModelLabelsPath = "",
    [switch]$MockTextSmokePass,
    [switch]$MockVisualPacketPass,
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 90
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    if ($MissionId -eq "A20BD") {
        return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\dual_browser_profiles\A20BD_dual_profile_playwright_control_20260518")
    }
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BC_gemini_3_5_flash_extended_lane_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
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

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Get-LocalConfig {
    $path = Join-Path $PSScriptRoot "local\gemini_web_lane.local.json"
    $default = [ordered]@{
        enabled = $true
        start_url = "https://gemini.google.com/app"
        preferred_model = "Gemini 3.5 Flash"
        preferred_reasoning_mode = "Extended"
        message_threshold = 50
        local_config_present = $false
    }
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        try {
            $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
            foreach ($name in @("enabled", "start_url", "preferred_model", "preferred_reasoning_mode", "message_threshold")) {
                if ($config.PSObject.Properties.Name -contains $name) { $default[$name] = $config.$name }
            }
            $default.local_config_present = $true
        } catch {
            $default.local_config_present = $true
            $default.config_read_error = "LOCAL_CONFIG_INVALID_JSON"
        }
    }
    return [pscustomobject]$default
}

function Get-ReachableEndpoint {
    param([string]$Preferred)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($Preferred)) { $candidates += $Preferred }
    $candidates += @("http://127.0.0.1:$CDPPort")
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri ($candidate.TrimEnd("/") + "/json/version") -TimeoutSec 2
            if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) { return $candidate.TrimEnd("/") }
        } catch {}
    }
    return ""
}

function Invoke-VisualControl {
    param([string]$Classification = "")
    $args = @(
        "-Mode", "CaptureState",
        "-Service", "gemini",
        "-CDPPort", ([string]$CDPPort),
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt"
    )
    if ($DryRun) { $args += "-DryRun" }
    if (-not [string]::IsNullOrWhiteSpace($Classification)) { $args += @("-MockClassification", $Classification) }
    if ($MockComposerVisible) { $args += "-MockComposerVisible" }
    if ($MockUploadAvailable) { $args += "-MockUploadControlVisible" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "playwright_visual_control.ps1") @args 2>&1
    try { return Convert-JsonOutput -Output $output } catch { return $null }
}

function Invoke-Classifier {
    param([object]$Signals)
    $fixturePath = Join-Path $ArtifactPath "gemini_classifier_fixture.json"
    Write-JsonFile -Path $fixturePath -Payload $Signals
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_browser_state.ps1") `
        -Mode Fixture `
        -Service gemini `
        -MissionId $MissionId `
        -FixturePath $fixturePath `
        -ArtifactPath $ArtifactPath `
        -NoPrompt 2>&1
    return Convert-JsonOutput -Output $output
}

function New-MockProbe {
    $classification = if ([string]::IsNullOrWhiteSpace($MockClassification)) { "UNCLASSIFIED_PAGE_STATE" } else { $MockClassification }
    $composer = [bool]$MockComposerVisible
    if ($classification -eq "PAGE_USABLE") { $composer = $true }
    $mockModelPayload = Get-MockModelPayload
    [pscustomobject]@{
        status = "MOCK_GEMINI_PROBE"
        page_opened = $true
        cdp_reachable = $true
        composer_visible = $composer
        composer_enabled = $composer
        send_available = $composer
        prompt_submission_possible = $composer
        foreground_blocker_visible = $classification -eq "HUMAN_ACTION_REQUIRED"
        direct_blocker_selector_visible = $classification -eq "HUMAN_ACTION_REQUIRED"
        page_loading = $classification -eq "PAGE_LOADING"
        history_blocker_terms_present = $true
        upload_available = [bool]$MockUploadAvailable
        model_selector_found = $null -ne $mockModelPayload
        available_model_labels = if ($mockModelPayload) { @($mockModelPayload.available_model_labels) } else { @() }
        reasoning_mode_labels = if ($mockModelPayload) { @($mockModelPayload.reasoning_mode_labels) } else { @() }
        screenshot_path = ""
        private_urls_redacted = $true
    }
}

function Get-MockModelPayload {
    if (-not [string]::IsNullOrWhiteSpace($MockModelLabelsPath) -and (Test-Path -LiteralPath $MockModelLabelsPath -PathType Leaf)) {
        return Get-Content -LiteralPath $MockModelLabelsPath -Raw | ConvertFrom-Json
    }
    if (-not [string]::IsNullOrWhiteSpace($MockModelLabelsJson)) {
        return $MockModelLabelsJson | ConvertFrom-Json
    }
    return $null
}

function Invoke-GeminiBrowserProbe {
    param([string]$Action, [string]$ResolvedEndpoint, [string]$StartUrl, [string]$Prompt, [string]$ImagePath)
    $probeDir = Join-Path $ArtifactPath "browser_probe"
    New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
    $scriptPath = Join-Path $probeDir ("gemini_web_lane_probe_{0}_{1}.mjs" -f $Action, [guid]::NewGuid().ToString("N"))
    $probeOut = Join-Path $probeDir ("{0}_result.json" -f $Action)
    $screenshotPath = Join-Path $ArtifactPath ("screenshots\gemini_{0}_{1}.png" -f $Action, (Get-Date -Format "yyyyMMdd_HHmmss"))
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $screenshotPath) | Out-Null

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
function baseResult(action) {
  return {
    schema_version: "gemini_web_lane_probe_v1",
    action,
    status: "GEMINI_PROBE_NOT_RUN",
    cdp_reachable: false,
    page_opened: false,
    current_url_redacted: true,
    composer_visible: false,
    composer_enabled: false,
    send_available: false,
    prompt_submission_possible: false,
    foreground_blocker_visible: false,
    direct_blocker_selector_visible: false,
    page_loading: false,
    history_blocker_terms_present: false,
    upload_available: false,
    model_selector_found: false,
    available_model_labels: [],
    reasoning_mode_labels: [],
    text_smoke_result: "NOT_RUN",
    visual_packet_result: "NOT_RUN",
    response_read: false,
    message_sent: false,
    screenshot_path: "",
    private_urls_redacted: true,
    secrets_redacted: true,
    no_bypass: true,
    no_blind_typing: true
  };
}
async function getGeminiPage(browser, startUrl, shouldOpen) {
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();
  let page = pages.find((candidate) => /gemini\.google\.com/i.test(candidate.url()));
  if (!page && shouldOpen) {
    page = await context.newPage();
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  }
  return page;
}
async function inspectPage(page) {
  return await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < window.innerHeight && rect.left < window.innerWidth &&
        style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" &&
        element.getAttribute("aria-hidden") !== "true";
    };
    const isEnabled = (element) => {
      if (!element) return false;
      if (element.matches("textarea,input")) return !element.disabled && !element.readOnly;
      return element.isContentEditable || element.getAttribute("contenteditable") === "true" || element.getAttribute("role") === "textbox";
    };
    const composerSelectors = [
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      '[aria-label*="Enter a prompt" i]',
      '[aria-label*="Prompt" i]',
      'div.ql-editor[contenteditable="true"]',
      'textarea',
      'div[contenteditable="true"]'
    ];
    const composers = [];
    for (const selector of composerSelectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const rect = element.getBoundingClientRect();
        composers.push({ selector, visible: isVisible(element), enabled: isEnabled(element), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
      }
    }
    const usableComposer = composers.find((item) => item.visible && item.enabled);
    const sendButtons = Array.from(document.querySelectorAll('button[aria-label*="Send" i], button[aria-label*="Envoyer" i], button[data-testid*="send" i], button[type="submit"]'))
      .map((button) => ({ visible: isVisible(button), enabled: !button.disabled && button.getAttribute("aria-disabled") !== "true" }));
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const uploadButtons = Array.from(document.querySelectorAll('button[aria-label*="upload" i], button[aria-label*="image" i], button[aria-label*="attach" i], button[aria-label*="importer" i], button[aria-label*="joindre" i]'))
      .filter(isVisible);
    const labelNodes = Array.from(document.querySelectorAll('button,[role="button"],[aria-label]'));
    const labels = [];
    for (const element of labelNodes) {
      if (!isVisible(element)) continue;
      const text = String(element.getAttribute("aria-label") || element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 120) continue;
      const modelLike = /gemini/i.test(text) && /flash|\bpro\b|ultra|[0-9]/i.test(text);
      const reasoningLike = /thinking|extended|deep|approfondie|raisonnement/i.test(text);
      if (modelLike || reasoningLike) labels.push(text);
    }
    const directBlockers = Array.from(document.querySelectorAll('input[type="password"], input[name*="otp" i], input[id*="otp" i], iframe[src*="captcha" i], [id*="captcha" i], [class*="captcha" i]')).filter(isVisible);
    const overlayBlockers = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-state="open"]'))
      .filter(isVisible)
      .map((element) => String(element.innerText || element.textContent || ""))
      .filter((text) => /captcha|human verification|verify you are human|i am human|je suis humain|consent|login|log in|2fa|two-factor|auth/i.test(text));
    const bodyText = String(document.body?.innerText || "");
    return {
      documentReadyState: document.readyState,
      titleText: String(document.title || ""),
      body_has_history_blocker_terms: /captcha|human verification|verification humaine|bypass|consent|auth wall|2fa/i.test(bodyText),
      composer_candidates: composers.slice(0, 20),
      usable_composer: usableComposer || null,
      send_available: sendButtons.some((button) => button.visible && button.enabled),
      upload_available: fileInputs.length > 0 || uploadButtons.length > 0,
      model_labels: Array.from(new Set(labels)).slice(0, 30),
      reasoning_labels: Array.from(new Set(labels.filter((label) => /thinking|extended|deep|approfondie|raisonnement/i.test(label)))).slice(0, 15),
      direct_blocker_count: directBlockers.length,
      overlay_blocker_count: overlayBlockers.length
    };
  });
}
async function findComposer(page) {
  const selectors = [
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    '[aria-label*="Enter a prompt" i]',
    '[aria-label*="Prompt" i]',
    'div.ql-editor[contenteditable="true"]',
    'textarea',
    'div[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const editable = await item.isEditable().catch(async () => item.evaluate((el) => el.isContentEditable || el.getAttribute("contenteditable") === "true").catch(() => false));
      if (visible && editable) return item;
    }
  }
  return null;
}
async function fillComposer(page, composer, text) {
  await composer.click({ timeout: 5000 });
  try { await composer.fill(text, { timeout: 5000 }); }
  catch {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.insertText(text);
  }
}
async function clickSend(page) {
  const selectors = ['button[aria-label*="Send" i]', 'button[aria-label*="Envoyer" i]', 'button[data-testid*="send" i]', 'button[type="submit"]'];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => false);
      if (visible && enabled) { await item.click({ timeout: 5000 }); return "send_button"; }
    }
  }
  await page.keyboard.press("Enter");
  return "keyboard_enter";
}
async function attachImageIfPossible(page, imagePath) {
  if (!imagePath) return false;
  const input = page.locator('input[type="file"]').first();
  const count = await input.count().catch(() => 0);
  if (count < 1) return false;
  await input.setInputFiles(imagePath);
  return true;
}
async function sendPrompt(page, prompt, marker, timeoutMs) {
  const composer = await findComposer(page);
  if (!composer) return { status: "COMPOSER_NOT_FOUND", message_sent: false, response_read: false };
  await fillComposer(page, composer, prompt);
  const method = await clickSend(page);
  const deadline = Date.now() + timeoutMs;
  let messageSent = false;
  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (text.includes(marker)) { messageSent = true; break; }
    await page.waitForTimeout(500);
  }
  const responseDeadline = Date.now() + timeoutMs;
  let responseRead = false;
  while (Date.now() < responseDeadline) {
    const text = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (text.includes(marker) && /"ok"|candidate_mission|recommended_action|visual/i.test(text)) { responseRead = true; break; }
    await page.waitForTimeout(750);
  }
  return { status: responseRead ? "RESPONSE_TEXT_READ" : "RESPONSE_READ_UNAVAILABLE", message_sent: messageSent, response_read: responseRead, send_method: method };
}
async function main() {
  const args = parseArgs(process.argv);
  const action = args.action || "health";
  const result = baseResult(action);
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(String(args.endpoint || "").replace(/\/$/, ""));
    result.cdp_reachable = true;
    const shouldOpen = ["open", "health", "sendText", "sendVisual"].includes(action);
    const page = await getGeminiPage(browser, args.startUrl || "https://gemini.google.com/app", shouldOpen);
    if (!page) {
      result.status = "GEMINI_PAGE_NOT_OPEN";
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_opened = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    const probe = await inspectPage(page);
    result.composer_visible = Boolean(probe.usable_composer?.visible);
    result.composer_enabled = Boolean(probe.usable_composer?.enabled);
    result.send_available = Boolean(probe.send_available);
    result.prompt_submission_possible = result.composer_visible && result.composer_enabled;
    result.foreground_blocker_visible = probe.overlay_blocker_count > 0;
    result.direct_blocker_selector_visible = probe.direct_blocker_count > 0;
    result.page_loading = !result.composer_visible && (probe.documentReadyState !== "complete" || /loading|chargement|just a moment|un instant/i.test(probe.titleText));
    result.history_blocker_terms_present = Boolean(probe.body_has_history_blocker_terms);
    result.upload_available = Boolean(probe.upload_available);
    result.model_selector_found = probe.model_labels.length > 0;
    result.available_model_labels = probe.model_labels;
    result.reasoning_mode_labels = probe.reasoning_labels;
    await page.screenshot({ path: args.screenshot, fullPage: false }).catch(() => {});
    if (args.screenshot && fs.existsSync(args.screenshot)) result.screenshot_path = args.screenshot;
    if (action === "sendText") {
      const prompt = args.prompt || 'Return exactly JSON: {"neurochess_gemini_live_test":"ok"}';
      const sent = await sendPrompt(page, prompt, "neurochess_gemini_live_test", Number(args.maxWaitSeconds || 90) * 1000);
      result.text_smoke_result = sent.response_read ? "GEMINI_TEXT_SMOKE_PASS" : (sent.message_sent ? "GEMINI_TEXT_SMOKE_RESPONSE_UNREAD" : "GEMINI_TEXT_SMOKE_SEND_FAILED");
      result.message_sent = sent.message_sent;
      result.response_read = sent.response_read;
      result.send_method = sent.send_method || "";
    }
    if (action === "sendVisual") {
      const attached = await attachImageIfPossible(page, args.imagePath || "");
      result.visual_upload_attached = attached;
      if (!attached) {
        result.visual_packet_result = "GEMINI_UPLOAD_UNAVAILABLE";
      } else {
        const prompt = args.prompt || 'Return JSON with source, packet_type, recommended_action, and candidate_mission for a NeuroChess visual review.';
        const sent = await sendPrompt(page, prompt, "candidate_mission", Number(args.maxWaitSeconds || 90) * 1000);
        result.visual_packet_result = sent.response_read ? "GEMINI_VISUAL_PACKET_SMOKE_PASS" : (sent.message_sent ? "GEMINI_VISUAL_PACKET_RESPONSE_UNREAD" : "GEMINI_VISUAL_PACKET_SEND_FAILED");
        result.message_sent = sent.message_sent;
        result.response_read = sent.response_read;
        result.send_method = sent.send_method || "";
      }
    }
    result.status = "GEMINI_BROWSER_PROBE_COMPLETE";
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = "GEMINI_BROWSER_PROBE_FAILED";
    result.error_code = String(error.message || error).replace(/https:\/\/gemini\.google\.com\/[^\s"]+/g, "[REDACTED_GEMINI_URL]");
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.log(JSON.stringify({ status: "GEMINI_BROWSER_PROBE_FAILED", error_code: String(error.message || error), private_urls_redacted: true }, null, 2));
  process.exit(0);
});
'@
    Set-Content -LiteralPath $scriptPath -Value $nodeSource -Encoding UTF8
    $nodeArgs = @(
        $scriptPath,
        "--action", $Action,
        "--endpoint", $ResolvedEndpoint,
        "--startUrl", $StartUrl,
        "--out", $probeOut,
        "--screenshot", $screenshotPath,
        "--maxWaitSeconds", ([string]$MaxWaitSeconds)
    )
    if (-not [string]::IsNullOrWhiteSpace($Prompt)) { $nodeArgs += @("--prompt", $Prompt) }
    if (-not [string]::IsNullOrWhiteSpace($ImagePath)) { $nodeArgs += @("--imagePath", $ImagePath) }
    $nodeOutput = & node @nodeArgs 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) { return Read-JsonFile -Path $probeOut }
    return [pscustomobject]@{ status = "GEMINI_BROWSER_PROBE_FAILED"; error_code = ($nodeOutput | Out-String); private_urls_redacted = $true }
}

function Invoke-ParkGeminiLane {
    param([string]$Reason)
    $args = @(
        "-Mode", "AlertFailure",
        "-Lane", "gemini",
        "-Reason", $Reason,
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt"
    )
    if ($DryRun) { $args += "-DryRun" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "external_judge_sre.ps1") @args 2>&1
    try { return Convert-JsonOutput -Output $output } catch { return [pscustomobject]@{ status = "PARK_ALERT_FAILED_LOCAL_CONTINUES"; raw_redacted = ($output | Out-String) } }
}

function New-DecisionPacket {
    param([string]$Evidence)
    [ordered]@{
        source = "gemini"
        packet_type = "visual_review"
        confidence = "medium"
        recommended_action = "Use Gemini visual lane feedback as advisory evidence only; keep local OMEGA and Mission Doctor authoritative."
        candidate_mission = [ordered]@{
            id = "A20BD_TRUE_OVERNIGHT_WITH_CHATGPT_AND_GEMINI"
            objective = "Run the next bounded live-supervised night only after Gemini Web lane status is recorded and local fallback remains available."
            expected_value = "medium"
            risk = "low"
            allowed_paths = @("docs/autopilot/**", "docs/design/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("gemini_attempts_recorded", "chatgpt_fallback_preserved", "no_paid_api")
        }
        do_not_do = @("do_not_use_paid_api", "do_not_treat_gemini_as_sole_authority", "do_not_block_omega")
        evidence_used = @($Evidence)
        open_risks = @("Exact Gemini model availability depends on visible Web UI and current account plan.")
        token_saving_notes = @("Gemini packet is normalized into compact mission-auction format.")
    }
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath ("gemini_{0}_result.json" -f $Mode.ToLowerInvariant()) }

$config = Get-LocalConfig
$resolvedEndpoint = Get-ReachableEndpoint -Preferred $Endpoint
$statusBase = [ordered]@{
    schema_version = "gemini_web_lane_adapter_result_v1"
    mission_id = $MissionId
    mode = $Mode
    local_config_present = [bool]$config.local_config_present
    default_start_url_used = -not [bool]$config.local_config_present
    enabled = [bool]$config.enabled
    cdp_reachable = -not [string]::IsNullOrWhiteSpace($resolvedEndpoint)
    page_opened = $false
    classification = "NOT_CLASSIFIED"
    composer_usable = $false
    model_selector_found = $false
    gemini_3_5_flash_visible = $false
    extended_thinking_mode_visible = $false
    selected_model = ""
    selected_reasoning_mode = ""
    upload_available = $false
    text_smoke_result = "NOT_RUN"
    visual_packet_result = "NOT_RUN"
    decision_packet_produced = $false
    ntfy_alert = "NOT_SENT"
    zero_cost_policy = $true
    no_api_call = $true
    no_paid_service = $true
    no_user_prompt = $true
    private_urls_redacted = $true
    secrets_redacted = $true
}

if ($Mode -eq "Status") {
    $statusBase.status = if ($statusBase.cdp_reachable) { "GEMINI_WEB_LANE_STATUS_CDP_READY" } else { "GEMINI_WEB_LANE_STATUS_CDP_UNAVAILABLE" }
    Write-JsonFile -Path $OutPath -Payload $statusBase
    $statusBase | ConvertTo-Json -Depth 80
    exit 0
}

if ($Mode -eq "DryRun" -or $DryRun) {
    $probe = New-MockProbe
} elseif ([string]::IsNullOrWhiteSpace($resolvedEndpoint)) {
    $statusBase.status = "GEMINI_NOT_CONFIGURED"
    $statusBase.parked_reason = "CDP_UNAVAILABLE"
    Write-JsonFile -Path $OutPath -Payload $statusBase
    $statusBase | ConvertTo-Json -Depth 80
    exit 0
} else {
    $action = switch ($Mode) {
        "Open" { "open" }
        "HealthCheck" { "health" }
        "ClassifyPage" { "health" }
        "SelectModel" { "health" }
        "SendTextSmoke" { "sendText" }
        "SendVisualPacket" { "sendVisual" }
        default { "health" }
    }
    $prompt = ""
    if ($Mode -eq "SendTextSmoke") {
        $prompt = if (-not [string]::IsNullOrWhiteSpace($MessageFile) -and (Test-Path -LiteralPath $MessageFile -PathType Leaf)) {
            Get-Content -LiteralPath $MessageFile -Raw
        } else {
            'Return exactly JSON: {"neurochess_gemini_live_test":"ok"}'
        }
    } elseif ($Mode -eq "SendVisualPacket") {
        $prompt = @"
You are the Gemini visual supervisor for NeuroChess. Inspect the attached isolated screenshot only.
Return strict JSON with source "gemini", packet_type "visual_review", recommended_action, and candidate_mission.
Do not include implementation instructions, private URLs, or credentials.
"@
    }
    $probe = Invoke-GeminiBrowserProbe -Action $action -ResolvedEndpoint $resolvedEndpoint -StartUrl ([string]$config.start_url) -Prompt $prompt -ImagePath $VisualEvidencePath
}

$visualClassification = ""
if (-not [string]::IsNullOrWhiteSpace($MockClassification)) { $visualClassification = $MockClassification }
$visual = Invoke-VisualControl -Classification $visualClassification
if ($visual) {
    $probe.composer_visible = [bool]$visual.composer_visible
    $probe.composer_enabled = [bool]$visual.composer_enabled
    $probe.send_available = [bool]$visual.send_available
    $probe.upload_available = [bool]$visual.upload_control_visible
    $probe.model_selector_found = [bool]$visual.model_selector_visible
    $probe.foreground_blocker_visible = [bool]$visual.foreground_blocker_detected
    $probe.direct_blocker_selector_visible = [bool]$visual.foreground_blocker_detected
    if (-not [string]::IsNullOrWhiteSpace([string]$visual.screenshot_path)) { $probe.screenshot_path = [string]$visual.screenshot_path }
    $statusBase.visual_control_classification = [string]$visual.classification
    $statusBase.screenshot_before_verdict = [bool]$visual.screenshot_before_verdict
    $statusBase.playwright_visual_control = "PLAYWRIGHT_FALLBACK"
}

$classifier = Invoke-Classifier -Signals $probe
$statusBase.page_opened = [bool]$probe.page_opened
$statusBase.classification = [string]$classifier.classification
$statusBase.composer_usable = [string]$classifier.classification -eq "PAGE_USABLE"
$statusBase.upload_available = [bool]$probe.upload_available
$statusBase.model_selector_found = [bool]$probe.model_selector_found

$modelPayload = [ordered]@{
    model_selector_found = [bool]$probe.model_selector_found
    available_model_labels = @($probe.available_model_labels)
    reasoning_mode_labels = @($probe.reasoning_mode_labels)
}
$mockModelPayload = Get-MockModelPayload
if ($mockModelPayload) { $modelPayload = $mockModelPayload }
$modelInput = Join-Path $ArtifactPath "model_selector_input_redacted.json"
Write-JsonFile -Path $modelInput -Payload $modelPayload
$modelOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "gemini_model_selector.ps1") `
    -Mode Select `
    -MissionId $MissionId `
    -ModelLabelsPath $modelInput `
    -ArtifactPath $ArtifactPath `
    -NoPrompt 2>&1
$model = Convert-JsonOutput -Output $modelOutput
$statusBase.model_selector_found = [bool]$model.model_selector_found
$statusBase.gemini_3_5_flash_visible = [bool]$model.gemini_3_5_flash_visible
$statusBase.extended_thinking_mode_visible = [bool]$model.extended_thinking_mode_visible
$statusBase.selected_model = [string]$model.selected_model
$statusBase.selected_reasoning_mode = [string]$model.selected_reasoning_mode

if ($Mode -eq "ParkLane") {
    $alert = Invoke-ParkGeminiLane -Reason "GEMINI_AUTH_OR_CONSENT_WALL"
    $statusBase.status = "GEMINI_WEB_LANE_AUTH_REQUIRED_PARKED"
    $statusBase.ntfy_alert = [string]$alert.status
} elseif ([string]$classifier.classification -eq "HUMAN_ACTION_REQUIRED") {
    $alert = Invoke-ParkGeminiLane -Reason "GEMINI_AUTH_OR_CONSENT_WALL"
    $statusBase.status = "GEMINI_WEB_LANE_AUTH_REQUIRED_PARKED"
    $statusBase.ntfy_alert = [string]$alert.status
} elseif ([string]$classifier.classification -ne "PAGE_USABLE") {
    $statusBase.status = "GEMINI_WEB_LANE_PAGE_NOT_USABLE"
} elseif ($Mode -eq "SendTextSmoke") {
    $statusBase.text_smoke_result = if ($MockTextSmokePass) { "GEMINI_TEXT_SMOKE_PASS" } else { [string]$probe.text_smoke_result }
    $statusBase.status = if ($statusBase.text_smoke_result -eq "GEMINI_TEXT_SMOKE_PASS") { "GEMINI_WEB_LANE_READY" } else { "GEMINI_WEB_LANE_PARTIAL_NEEDS_SECOND_PASS" }
    if ($statusBase.text_smoke_result -eq "GEMINI_TEXT_SMOKE_PASS") {
        $packetPath = Join-Path $ArtifactPath "gemini_decision_packet.json"
        Write-JsonFile -Path $packetPath -Payload (New-DecisionPacket -Evidence "Gemini text smoke")
        $statusBase.decision_packet_produced = $true
    }
} elseif ($Mode -eq "SendVisualPacket") {
    $statusBase.visual_packet_result = if ($MockVisualPacketPass) { "GEMINI_VISUAL_PACKET_SMOKE_PASS" } else { [string]$probe.visual_packet_result }
    $statusBase.status = if ($statusBase.visual_packet_result -eq "GEMINI_VISUAL_PACKET_SMOKE_PASS") { "GEMINI_WEB_LANE_READY" } else { "GEMINI_WEB_LANE_PARTIAL_NEEDS_SECOND_PASS" }
    if ($statusBase.visual_packet_result -eq "GEMINI_VISUAL_PACKET_SMOKE_PASS") {
        $packetPath = Join-Path $ArtifactPath "gemini_decision_packet.json"
        Write-JsonFile -Path $packetPath -Payload (New-DecisionPacket -Evidence $VisualEvidencePath)
        $statusBase.decision_packet_produced = $true
    }
} elseif ([bool]$model.gemini_3_5_flash_visible -and [bool]$model.extended_thinking_mode_visible) {
    $statusBase.status = "GEMINI_3_5_FLASH_EXTENDED_WEB_LANE_READY"
} elseif ([bool]$model.model_selector_found) {
    $statusBase.status = "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT"
} else {
    $statusBase.status = "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT"
}

Write-JsonFile -Path $OutPath -Payload $statusBase
$statusBase | ConvertTo-Json -Depth 80
