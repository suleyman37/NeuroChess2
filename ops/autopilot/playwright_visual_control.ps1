param(
    [ValidateSet("CaptureState", "ClassifyPage", "FindComposer", "FindModelSelector", "FindUploadControl", "CompareScreenshotAndDom", "DryRun")]
    [string]$Mode = "CaptureState",
    [ValidateSet("chatgpt", "gemini")]
    [string]$Service = "chatgpt",
    [int]$CDPPort = 0,
    [string]$MissionId = "A20BD",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [ValidateSet("", "PAGE_USABLE", "HUMAN_ACTION_REQUIRED", "PAGE_LOADING", "UNCLASSIFIED_PAGE_STATE", "WRONG_ACCOUNT_OR_PLAN")]
    [string]$MockClassification = "",
    [switch]$MockComposerVisible,
    [switch]$MockModelSelectorVisible,
    [switch]$MockUploadControlVisible,
    [switch]$MockForegroundBlocker,
    [switch]$MockWrongAccount,
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ($CDPPort -eq 0) {
    $CDPPort = if ($Service -eq "chatgpt") { 9222 } else { 9223 }
}
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20BE") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BE_gemini_upload_second_pass_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\dual_browser_profiles\A20BD_dual_profile_playwright_control_20260518"
    }
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $ArtifactPath ("{0}_state_capture.json" -f $Service)
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function New-BaseResult {
    [ordered]@{
        schema_version = "playwright_visual_control_result_v1"
        mission_id = $MissionId
        mode = $Mode
        service = $Service
        cdp_port = $CDPPort
        classification = "UNCLASSIFIED_PAGE_STATE"
        screenshot_path = ""
        dom_probe_path = ""
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        prompt_submission_possible = $false
        model_selector_visible = $false
        upload_control_visible = $false
        foreground_blocker_detected = $false
        wrong_account_or_plan_suspected = $false
        history_text_ignored = $true
        screenshot_before_verdict = $false
        dom_probe_before_verdict = $false
        mcp_playwright_used = $false
        playwright_fallback_used = $true
        evidence = @()
        recommended_action = "STOP_DIAGNOSTIC"
        current_url_redacted = $true
        account_email_redacted = $true
        private_urls_redacted = $true
        secrets_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        no_credentials = $true
        no_verification_bypass = $true
        no_blind_typing = $true
        no_paid_api = $true
    }
}

function Set-Classification {
    param([hashtable]$Signals)
    $result = New-BaseResult
    foreach ($key in $Signals.Keys) { $result[$key] = $Signals[$key] }

    $usable = [bool]($result.composer_visible -and $result.composer_enabled -and ($result.send_available -or $result.prompt_submission_possible -or $Service -eq "gemini") -and -not $result.foreground_blocker_detected)
    if ($Mode -eq "FindModelSelector") {
        $result.classification = if ($result.model_selector_visible) { "MODEL_SELECTOR_AVAILABLE" } else { "UNCLASSIFIED_PAGE_STATE" }
        $result.recommended_action = if ($result.model_selector_visible) { "CONTINUE" } else { "STOP_DIAGNOSTIC" }
    } elseif ($Mode -eq "FindUploadControl") {
        $result.classification = if ($result.upload_control_visible) { "UPLOAD_AVAILABLE" } else { "UPLOAD_UNAVAILABLE" }
        $result.recommended_action = if ($result.upload_control_visible) { "CONTINUE" } else { "PARK_LANE" }
    } elseif ($result.wrong_account_or_plan_suspected) {
        $result.classification = "WRONG_ACCOUNT_OR_PLAN"
        $result.recommended_action = "PARK_LANE"
    } elseif ($usable) {
        $result.classification = "PAGE_USABLE"
        $result.recommended_action = "CONTINUE"
    } elseif ($result.foreground_blocker_detected) {
        $result.classification = "HUMAN_ACTION_REQUIRED"
        $result.recommended_action = "SEND_ALERT"
    } elseif ($Signals.ContainsKey("page_loading") -and [bool]$Signals.page_loading) {
        $result.classification = "PAGE_LOADING"
        $result.recommended_action = "WAIT_AND_RECHECK"
    } else {
        $result.classification = "UNCLASSIFIED_PAGE_STATE"
        $result.recommended_action = "STOP_DIAGNOSTIC"
    }

    $evidence = @()
    if ($result.composer_visible) { $evidence += "composer_visible_current_ui" }
    if ($result.composer_enabled) { $evidence += "composer_enabled_current_ui" }
    if ($result.send_available) { $evidence += "send_available_current_ui" }
    if ($result.prompt_submission_possible) { $evidence += "prompt_submission_possible_after_input" }
    if ($result.model_selector_visible) { $evidence += "model_selector_visible_current_ui" }
    if ($result.upload_control_visible) { $evidence += "upload_control_visible_current_ui" }
    if ($result.foreground_blocker_detected) { $evidence += "foreground_blocker_current_ui" }
    if ($result.wrong_account_or_plan_suspected) { $evidence += "wrong_account_or_plan_current_ui_marker" }
    if ($result.screenshot_before_verdict) { $evidence += "screenshot_captured_before_verdict" }
    if ($result.dom_probe_before_verdict) { $evidence += "dom_probe_captured_before_verdict" }
    $result.evidence = @($evidence)
    return $result
}

function New-MockResult {
    $classification = if ([string]::IsNullOrWhiteSpace($MockClassification)) { "PAGE_USABLE" } else { $MockClassification }
    $signals = @{
        composer_visible = [bool]$MockComposerVisible
        composer_enabled = [bool]$MockComposerVisible
        send_available = [bool]$MockComposerVisible
        prompt_submission_possible = [bool]$MockComposerVisible
        model_selector_visible = [bool]$MockModelSelectorVisible
        upload_control_visible = [bool]$MockUploadControlVisible
        foreground_blocker_detected = [bool]$MockForegroundBlocker
        wrong_account_or_plan_suspected = [bool]$MockWrongAccount
        screenshot_path = Join-Path $ArtifactPath "screenshots\mock_state.png"
        dom_probe_path = Join-Path $ArtifactPath "dom_probe_summaries\mock_state.json"
        screenshot_before_verdict = $true
        dom_probe_before_verdict = $true
        page_loading = $classification -eq "PAGE_LOADING"
    }
    if ($classification -eq "PAGE_USABLE") {
        $signals.composer_visible = $true
        $signals.composer_enabled = $true
        $signals.send_available = $true
    }
    if ($classification -eq "HUMAN_ACTION_REQUIRED") { $signals.foreground_blocker_detected = $true }
    if ($classification -eq "WRONG_ACCOUNT_OR_PLAN") { $signals.wrong_account_or_plan_suspected = $true }
    return Set-Classification -Signals $signals
}

function Invoke-LiveCapture {
    $screensDir = Join-Path $ArtifactPath ("screenshots\{0}" -f $Service)
    $domDir = Join-Path $ArtifactPath "dom_probe_summaries"
    $probeDir = Join-Path $ArtifactPath "visual_control_probe"
    New-Item -ItemType Directory -Force -Path $screensDir, $domDir, $probeDir | Out-Null
    $scriptPath = Join-Path $probeDir ("playwright_visual_control_{0}.mjs" -f $Service)
    $probeOut = Join-Path $probeDir ("{0}_probe_result.json" -f $Service)
    $screenshotPath = Join-Path $screensDir ("{0}_state_{1}.png" -f $Service, (Get-Date -Format "yyyyMMdd_HHmmss"))
    $domPath = Join-Path $domDir ("{0}_dom_probe_{1}.json" -f $Service, (Get-Date -Format "yyyyMMdd_HHmmss"))

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
function redact(value) {
  return String(value || "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[redacted-account]").replace(/https?:\/\/[^\s"]+/g, "[redacted-url]");
}
function visiblePredicate(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0 &&
    rect.top < window.innerHeight && rect.left < window.innerWidth &&
    style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" &&
    element.getAttribute("aria-hidden") !== "true";
}
async function main() {
  const args = parseArgs(process.argv);
  const service = args.service || "chatgpt";
  const result = {
    cdp_reachable: false,
    page_found: false,
    screenshot_path: "",
    dom_probe_path: args.dom,
    composer_visible: false,
    composer_enabled: false,
    send_available: false,
    prompt_submission_possible: false,
    model_selector_visible: false,
    upload_control_visible: false,
    foreground_blocker_detected: false,
    wrong_account_or_plan_suspected: false,
    page_loading: false,
    history_text_ignored: true,
    current_url_redacted: true,
    account_email_redacted: true,
    private_urls_redacted: true,
    secrets_redacted: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${args.port}`);
    result.cdp_reachable = true;
    const pages = browser.contexts().flatMap((context) => context.pages());
    let page = pages.find((candidate) => service === "chatgpt" && /chatgpt\.com/i.test(candidate.url()));
    if (!page) page = pages.find((candidate) => service === "gemini" && /gemini\.google\.com/i.test(candidate.url()));
    if (!page) page = pages.find((candidate) => /chatgpt\.com|gemini\.google\.com/i.test(candidate.url()));
    if (!page) {
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_found = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    const probe = await page.evaluate((svc) => {
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
      const chatgptSelectors = ["#prompt-textarea", '[data-testid="composer"] [contenteditable="true"]', '[contenteditable="true"][data-lexical-editor="true"]', 'div.ProseMirror[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', "textarea", 'div[contenteditable="true"]'];
      const geminiSelectors = ['rich-textarea div[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]', '[aria-label*="Enter a prompt" i]', '[aria-label*="Prompt" i]', 'div.ql-editor[contenteditable="true"]', "textarea", 'div[contenteditable="true"]'];
      const selectors = svc === "gemini" ? geminiSelectors : chatgptSelectors;
      const composerCandidates = [];
      for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const rect = element.getBoundingClientRect();
          composerCandidates.push({ selector, visible: isVisible(element), enabled: isEnabled(element), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
        }
      }
      const usableComposer = composerCandidates.find((item) => item.visible && item.enabled);
      const sendButtons = Array.from(document.querySelectorAll('button[aria-label*="Send" i], button[aria-label*="Envoyer" i], button[data-testid*="send" i], form button[type="submit"]'))
        .map((button) => ({ visible: isVisible(button), enabled: !button.disabled && button.getAttribute("aria-disabled") !== "true" }));
      const modelLabels = [];
      const visibleControls = Array.from(document.querySelectorAll('button,[role="button"],[aria-label]')).filter(isVisible);
      for (const element of visibleControls) {
        const label = String(element.getAttribute("aria-label") || element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
        if (!label || label.length > 120) continue;
        if (/gemini/i.test(label) && /flash|\bpro\b|ultra|[0-9]/i.test(label)) modelLabels.push(label);
        if (/thinking|extended|deep|approfondie|raisonnement/i.test(label)) modelLabels.push(label);
      }
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const uploadButtons = visibleControls.filter((element) => /upload|image|attach|importer|joindre|photo/i.test(String(element.getAttribute("aria-label") || element.innerText || element.textContent || "")));
      const directBlockers = Array.from(document.querySelectorAll('input[type="password"], input[name*="otp" i], input[id*="otp" i], iframe[src*="captcha" i], [id*="captcha" i], [class*="captcha" i]')).filter(isVisible);
      const overlayText = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-state="open"]')).filter(isVisible).map((element) => String(element.innerText || element.textContent || ""));
      const overlayBlockers = overlayText.filter((text) => /captcha|human verification|verify you are human|i am human|je suis humain|consent|login|log in|2fa|two-factor|auth|verification/i.test(text));
      const accountPlanMarkers = svc === "gemini" && visibleControls.some((element) => /upgrade|advanced|switch account|wrong account|plan|abonnement|changer de compte/i.test(String(element.getAttribute("aria-label") || element.innerText || element.textContent || "")));
      return {
        document_ready_state: document.readyState,
        title_loading: /loading|chargement|just a moment|un instant|checking your browser|cloudflare/i.test(String(document.title || "")),
        composer_candidates: composerCandidates.slice(0, 20),
        usable_composer: usableComposer || null,
        send_available: sendButtons.some((button) => button.visible && button.enabled),
        model_labels: Array.from(new Set(modelLabels.map((label) => label.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[redacted-account]")))).slice(0, 30),
        upload_available: fileInputs.length > 0 || uploadButtons.length > 0,
        direct_blocker_count: directBlockers.length,
        overlay_blocker_count: overlayBlockers.length,
        wrong_account_or_plan_suspected: accountPlanMarkers
      };
    }, service);
    result.composer_visible = Boolean(probe.usable_composer?.visible);
    result.composer_enabled = Boolean(probe.usable_composer?.enabled);
    result.send_available = Boolean(probe.send_available || (service === "gemini" && result.composer_visible));
    result.prompt_submission_possible = result.composer_visible && result.composer_enabled;
    result.model_selector_visible = probe.model_labels.length > 0;
    result.upload_control_visible = Boolean(probe.upload_available);
    result.foreground_blocker_detected = probe.direct_blocker_count > 0 || probe.overlay_blocker_count > 0;
    result.wrong_account_or_plan_suspected = Boolean(probe.wrong_account_or_plan_suspected);
    result.page_loading = !result.composer_visible && (probe.document_ready_state !== "complete" || probe.title_loading);
    const summary = {
      service,
      url_redacted: true,
      account_email_redacted: true,
      composer_candidates: probe.composer_candidates,
      model_labels: probe.model_labels,
      upload_available: Boolean(probe.upload_available),
      direct_blocker_count: probe.direct_blocker_count,
      overlay_blocker_count: probe.overlay_blocker_count,
      body_text_redacted: true,
      history_text_ignored: true
    };
    writeJson(args.dom, summary);
    await page.screenshot({ path: args.screenshot, fullPage: false }).catch(() => {});
    if (fs.existsSync(args.screenshot)) result.screenshot_path = args.screenshot;
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error_code = redact(error.message || error);
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.log(JSON.stringify({ error_code: redact(error.message || error), private_urls_redacted: true }, null, 2));
  process.exit(0);
});
'@
    Set-Content -LiteralPath $scriptPath -Value $nodeSource -Encoding UTF8
    $nodeOutput = & node $scriptPath --service $Service --port ([string]$CDPPort) --out $probeOut --screenshot $screenshotPath --dom $domPath 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) {
        $probe = Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json
        $signals = @{
            composer_visible = [bool]$probe.composer_visible
            composer_enabled = [bool]$probe.composer_enabled
            send_available = [bool]$probe.send_available
            prompt_submission_possible = [bool]$probe.prompt_submission_possible
            model_selector_visible = [bool]$probe.model_selector_visible
            upload_control_visible = [bool]$probe.upload_control_visible
            foreground_blocker_detected = [bool]$probe.foreground_blocker_detected
            wrong_account_or_plan_suspected = [bool]$probe.wrong_account_or_plan_suspected
            page_loading = [bool]$probe.page_loading
            screenshot_path = [string]$probe.screenshot_path
            dom_probe_path = [string]$probe.dom_probe_path
            screenshot_before_verdict = -not [string]::IsNullOrWhiteSpace([string]$probe.screenshot_path)
            dom_probe_before_verdict = -not [string]::IsNullOrWhiteSpace([string]$probe.dom_probe_path)
        }
        return Set-Classification -Signals $signals
    }
    $failure = New-BaseResult
    $failure.classification = "UNCLASSIFIED_PAGE_STATE"
    $failure.error_code = (($nodeOutput | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
    return $failure
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ($Mode -eq "DryRun" -or $DryRun -or -not [string]::IsNullOrWhiteSpace($MockClassification) -or $MockComposerVisible -or $MockModelSelectorVisible -or $MockUploadControlVisible -or $MockForegroundBlocker -or $MockWrongAccount) {
    $result = New-MockResult
} else {
    $result = Invoke-LiveCapture
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 80
