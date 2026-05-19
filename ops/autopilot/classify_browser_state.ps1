param(
    [ValidateSet("Classify", "Live", "Fixture")]
    [string]$Mode = "Classify",
    [ValidateSet("chatgpt", "gemini", "unknown")]
    [string]$Service = "unknown",
    [string]$MissionId = "A20BA",
    [string]$FixturePath = "",
    [string]$FixtureJson = "",
    [string]$Endpoint = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
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

function Get-ObjectValue {
    param($Object, [string]$Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    if ($Object -is [hashtable] -and $Object.ContainsKey($Name)) { return $Object[$Name] }
    if ($Object.PSObject.Properties.Name -contains $Name) { return $Object.$Name }
    return $Default
}

function ConvertTo-TruthBool {
    param($Value)
    if ($null -eq $Value) { return $false }
    if ($Value -is [bool]) { return [bool]$Value }
    $text = [string]$Value
    return $text -match '^(?i:true|1|yes|y)$'
}

function Test-ContainsBlockerTerm {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return $Text -match '(?i)captcha|human\s+verification|v[ée]rification\s+humaine|i\s+am\s+human|je\s+suis\s+humain|bypass|consent|2fa|two-factor|auth\s+wall|login'
}

function New-ClassifierResult {
    param($Signals)

    $serviceValue = [string](Get-ObjectValue -Object $Signals -Name "service" -Default $Service)
    if ([string]::IsNullOrWhiteSpace($serviceValue)) { $serviceValue = "unknown" }

    $composerVisible = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "composer_visible" -Default $false)
    $composerEnabled = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "composer_enabled" -Default $false)
    $sendAvailableRaw = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "send_available" -Default $false)
    $promptSubmissionPossible = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "prompt_submission_possible" -Default $false)
    $sendAvailable = [bool]($sendAvailableRaw -or $promptSubmissionPossible)
    $foregroundBlocker = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "foreground_blocker_visible" -Default $false)
    $composerBlocked = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "composer_blocked" -Default $false)
    $pageLoading = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "page_loading" -Default $false)
    $directBlocker = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "direct_blocker_selector_visible" -Default $false)
    $screenshotPath = [string](Get-ObjectValue -Object $Signals -Name "screenshot_path" -Default "")

    $historyText = [string](Get-ObjectValue -Object $Signals -Name "history_text" -Default "")
    $bodyText = [string](Get-ObjectValue -Object $Signals -Name "body_text" -Default "")
    $historyTermPresent = ConvertTo-TruthBool (Get-ObjectValue -Object $Signals -Name "history_blocker_terms_present" -Default $false)
    if (-not $historyTermPresent) {
        $historyTermPresent = (Test-ContainsBlockerTerm -Text $historyText) -or (Test-ContainsBlockerTerm -Text $bodyText)
    }

    $evidence = @()
    if ($composerVisible) { $evidence += "composer_visible_current_ui" }
    if ($composerEnabled) { $evidence += "composer_enabled_current_ui" }
    if ($sendAvailable) { $evidence += "send_or_prompt_submission_available" }
    if ($historyTermPresent) { $evidence += "historical_blocker_terms_seen_and_ignored" }
    if ($foregroundBlocker -or $directBlocker) { $evidence += "foreground_blocker_evidence_present" }
    if (-not [string]::IsNullOrWhiteSpace($screenshotPath)) { $evidence += "screenshot_captured_external" }

    $usableComposer = [bool]($composerVisible -and $composerEnabled -and $sendAvailable -and -not $composerBlocked)
    if ($usableComposer -and -not ($foregroundBlocker -or $directBlocker)) {
        $classification = "PAGE_USABLE"
        $confidence = "high"
        $recommended = "CONTINUE"
    } elseif (($foregroundBlocker -or $directBlocker) -and -not $usableComposer) {
        $classification = "HUMAN_ACTION_REQUIRED"
        $confidence = if (-not [string]::IsNullOrWhiteSpace($screenshotPath)) { "high" } else { "medium" }
        $recommended = "SEND_ALERT"
    } elseif ($pageLoading -and -not $composerVisible) {
        $classification = "PAGE_LOADING"
        $confidence = "medium"
        $recommended = "WAIT_AND_RECHECK"
    } else {
        $classification = "UNCLASSIFIED_PAGE_STATE"
        $confidence = "medium"
        $recommended = "STOP_DIAGNOSTIC"
    }

    [ordered]@{
        classification = $classification
        confidence = $confidence
        service = $serviceValue
        composer_visible = $composerVisible
        composer_enabled = $composerEnabled
        send_available = $sendAvailable
        foreground_blocker_detected = [bool]($foregroundBlocker -or $directBlocker)
        history_text_ignored = $true
        evidence = @($evidence)
        screenshot_path = $screenshotPath
        recommended_action = $recommended
        mission_id = $MissionId
        private_urls_redacted = $true
        secrets_redacted = $true
        no_bypass = $true
        no_blind_typing = $true
    }
}

function Get-ReachableEndpoint {
    param([string]$Preferred)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($Preferred)) { $candidates += $Preferred }
    $candidates += @("http://127.0.0.1:9229", "http://127.0.0.1:9222")
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

function Invoke-LiveBrowserProbe {
    param([string]$ResolvedEndpoint)
    $probeDir = Join-Path $ArtifactPath "dom_probe_summaries"
    New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
    $probeScript = Join-Path $ArtifactPath "classifier_results\browser_state_probe.mjs"
    $probeOut = Join-Path $ArtifactPath "classifier_results\browser_state_probe.json"
    $screenshotDir = Join-Path $ArtifactPath "screenshots"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $probeScript), $screenshotDir | Out-Null

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

function redactedPageSummary(page, index) {
  return {
    index,
    url_redacted: true,
    is_chatgpt: /chatgpt\.com/i.test(page.url()),
    is_gemini: /gemini\.google\.com/i.test(page.url())
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const outPath = args.out;
  const service = args.service || "unknown";
  const screenshotPath = args.screenshot;
  const domSummaryPath = args.domSummary;
  const endpoint = String(args.endpoint || "").replace(/\/$/, "");
  const result = {
    service,
    live_probe_attempted: true,
    cdp_endpoint_redacted: true,
    cdp_reachable: false,
    page_found: false,
    current_url_redacted: true,
    composer_visible: false,
    composer_enabled: false,
    send_available: false,
    prompt_submission_possible: false,
    foreground_blocker_visible: false,
    direct_blocker_selector_visible: false,
    page_loading: false,
    history_blocker_terms_present: false,
    screenshot_path: "",
    dom_summary_path: domSummaryPath
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(endpoint);
    result.cdp_reachable = true;
    const pages = browser.contexts().flatMap((context) => context.pages());
    result.page_candidates = pages.map(redactedPageSummary);
    let page = pages.find((candidate) => service === "chatgpt" && /chatgpt\.com/i.test(candidate.url()));
    if (!page) page = pages.find((candidate) => service === "gemini" && /gemini\.google\.com/i.test(candidate.url()));
    if (!page) page = pages.find((candidate) => /chatgpt\.com|gemini\.google\.com/i.test(candidate.url()));
    if (!page) {
      result.stop_reason = "NO_MATCHING_BROWSER_PAGE";
      writeJson(outPath, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_found = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    const selectors = [
      "#prompt-textarea",
      '[data-testid="composer"] [contenteditable="true"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea',
      'div[contenteditable="true"]'
    ];
    const probe = await page.evaluate((selectorsForComposer) => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8 &&
          rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth &&
          style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" &&
          element.getAttribute("aria-hidden") !== "true";
      };
      const isEnabled = (element) => {
        if (!element) return false;
        if (element.matches("textarea,input")) return !element.disabled && !element.readOnly;
        return element.isContentEditable || element.getAttribute("contenteditable") === "true" || element.getAttribute("role") === "textbox";
      };
      const composerCandidates = [];
      for (const selector of selectorsForComposer) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
          const rect = element.getBoundingClientRect();
          composerCandidates.push({
            selector,
            visible: isVisible(element),
            enabled: isEnabled(element),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            tag: element.tagName,
            role: element.getAttribute("role") || "",
            textLength: String(element.innerText || element.textContent || element.value || "").length
          });
        }
      }
      const usableComposer = composerCandidates.find((candidate) => candidate.visible && candidate.enabled);
      const sendCandidates = Array.from(document.querySelectorAll('button[aria-label*="Send" i], button[aria-label*="Envoyer" i], button[data-testid*="send" i], form button[type="submit"]'))
        .map((button) => ({
          visible: isVisible(button),
          enabled: !button.disabled && button.getAttribute("aria-disabled") !== "true",
          ariaLabelPresent: Boolean(button.getAttribute("aria-label")),
          dataTestId: button.getAttribute("data-testid") || ""
        }));
      const directBlockers = Array.from(document.querySelectorAll('input[type="password"], input[name*="otp" i], input[id*="otp" i], iframe[src*="captcha" i], [id*="captcha" i], [class*="captcha" i]'))
        .filter(isVisible)
        .map((element) => ({ tag: element.tagName, reason: "direct_blocker_selector" }));
      const overlayBlockers = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-state="open"]'))
        .filter(isVisible)
        .map((element) => String(element.innerText || element.textContent || ""))
        .filter((text) => /captcha|human verification|verify you are human|i am human|je suis humain|consent|login|log in|2fa|two-factor|auth/i.test(text));
      const bodyText = String(document.body?.innerText || "");
      const titleText = String(document.title || "");
      return {
        documentReadyState: document.readyState,
        title_has_loading_marker: /loading|chargement|just a moment|un instant|checking your browser|cloudflare/i.test(titleText),
        body_has_history_blocker_terms: /captcha|human verification|vérification humaine|verification humaine|bypass|consent|auth wall|2fa/i.test(bodyText),
        composer_candidates: composerCandidates.slice(0, 20),
        usable_composer: usableComposer || null,
        send_candidates: sendCandidates.slice(0, 20),
        direct_blockers: directBlockers.slice(0, 10),
        overlay_blocker_count: overlayBlockers.length
      };
    }, selectors);
    result.history_blocker_terms_present = Boolean(probe.body_has_history_blocker_terms);
    result.composer_visible = Boolean(probe.usable_composer?.visible);
    result.composer_enabled = Boolean(probe.usable_composer?.enabled);
    result.send_available = probe.send_candidates.some((item) => item.visible && item.enabled);
    result.prompt_submission_possible = result.composer_visible && result.composer_enabled;
    result.foreground_blocker_visible = probe.overlay_blocker_count > 0;
    result.direct_blocker_selector_visible = probe.direct_blockers.length > 0;
    result.page_loading = !result.composer_visible && (probe.documentReadyState !== "complete" || probe.title_has_loading_marker);
    const summary = {
      url_redacted: true,
      service,
      composer_candidates: probe.composer_candidates,
      send_candidates: probe.send_candidates,
      direct_blocker_count: probe.direct_blockers.length,
      overlay_blocker_count: probe.overlay_blocker_count,
      body_history_terms_present: Boolean(probe.body_has_history_blocker_terms),
      body_text_redacted: true
    };
    writeJson(domSummaryPath, summary);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    if (fs.existsSync(screenshotPath)) result.screenshot_path = screenshotPath;
    writeJson(outPath, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error_code = String(error.message || error);
    writeJson(outPath, result);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(JSON.stringify({ error_code: String(error.message || error), private_urls_redacted: true }, null, 2));
    process.exit(0);
  });
'@

    Set-Content -LiteralPath $probeScript -Value $nodeSource -Encoding UTF8
    $screenshotPath = Join-Path $screenshotDir ("browser_state_{0}.png" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $domSummaryPath = Join-Path $probeDir ("dom_probe_{0}.json" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $nodeOutput = & node $probeScript --endpoint $ResolvedEndpoint --service $Service --out $probeOut --screenshot $screenshotPath --domSummary $domSummaryPath 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) {
        return Read-JsonFile -Path $probeOut
    }
    return [pscustomobject]@{
        service = $Service
        cdp_reachable = $false
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        foreground_blocker_visible = $false
        page_loading = $false
        history_blocker_terms_present = $false
        error_code = (($nodeOutput | Out-String) -replace 'https://chatgpt\.com/[^\s"]+', '[redacted-private-url]')
    }
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath, (Join-Path $ArtifactPath "classifier_results") | Out-Null

$signals = $null
if (-not [string]::IsNullOrWhiteSpace($FixtureJson)) {
    $signals = $FixtureJson | ConvertFrom-Json
} elseif (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
    $signals = Read-JsonFile -Path $FixturePath
} elseif ($DryRun -or $Mode -eq "Fixture") {
    $signals = [pscustomobject]@{
        service = $Service
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        foreground_blocker_visible = $false
        page_loading = $false
        history_blocker_terms_present = $false
    }
} else {
    $resolvedEndpoint = Get-ReachableEndpoint -Preferred $Endpoint
    if ([string]::IsNullOrWhiteSpace($resolvedEndpoint)) {
        $signals = [pscustomobject]@{
            service = $Service
            composer_visible = $false
            composer_enabled = $false
            send_available = $false
            foreground_blocker_visible = $false
            page_loading = $false
            history_blocker_terms_present = $false
            evidence = @("cdp_unavailable")
        }
    } else {
        $signals = Invoke-LiveBrowserProbe -ResolvedEndpoint $resolvedEndpoint
    }
}

$result = New-ClassifierResult -Signals $signals
$resultPath = if ([string]::IsNullOrWhiteSpace($OutPath)) {
    Join-Path $ArtifactPath "classifier_results\browser_state_classification_result.json"
} else {
    $OutPath
}
Write-JsonFile -Path $resultPath -Payload $result
$result | ConvertTo-Json -Depth 80
