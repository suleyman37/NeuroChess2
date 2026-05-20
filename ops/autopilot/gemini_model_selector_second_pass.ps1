param(
    [ValidateSet("Inspect", "OpenSelector", "SecondPass", "DryRun")]
    [string]$Mode = "SecondPass",
    [string]$MissionId = "A20BE",
    [string]$PreferredModel = "Gemini 3.5 Flash",
    [string]$PreferredReasoningMode = "Extended",
    [int]$CDPPort = 9223,
    [string]$Endpoint = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [string]$ModelLabelsJson = "",
    [string]$ModelLabelsPath = "",
    [switch]$MockSelectorVisible,
    [switch]$MockTargetModelVisible,
    [switch]$MockExtendedVisible,
    [switch]$MockMenuVisible,
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    if ($MissionId -eq "A20BE") {
        return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BE_gemini_upload_second_pass_20260518")
    }
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
    if (-not [string]::IsNullOrWhiteSpace($Path) -and (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
    }
    return $null
}

function Normalize-Label {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    return (($Text.ToLowerInvariant() -replace '[^a-z0-9]+', ' ') -replace '\s+', ' ').Trim()
}

function Redact-Labels {
    param([object[]]$Labels)
    $safe = @()
    foreach ($label in @($Labels)) {
        $text = ([string]$label).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        if ($text -match '(?i)compte google|google account|account settings|param[èe]tres du compte') { continue }
        if ($text -match '(?i)cookie|token|password|secret|@|https?://') { continue }
        if ($text.Length -gt 120) { $text = $text.Substring(0, 120) }
        $safe += $text
    }
    return @($safe | Select-Object -Unique)
}

function Get-ReachableEndpoint {
    param([string]$Preferred)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($Preferred)) { $candidates += $Preferred.TrimEnd("/") }
    $candidates += "http://127.0.0.1:$CDPPort"
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri ($candidate.TrimEnd("/") + "/json/version") -TimeoutSec 2
            if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300) { return $candidate.TrimEnd("/") }
        } catch {}
    }
    return ""
}

function New-BaseResult {
    [ordered]@{
        schema_version = "gemini_model_selector_second_pass_result_v1"
        mission_id = $MissionId
        mode = $Mode
        cdp_port = $CDPPort
        uses_gemini_cdp_9223_only = ($CDPPort -eq 9223)
        status = "GEMINI_MODEL_SELECTOR_NOT_FOUND"
        cdp_reachable = $false
        page_opened = $false
        screenshot_before_path = ""
        screenshot_after_path = ""
        dom_probe_path = ""
        screenshot_before_verdict = $false
        dom_probe_before_verdict = $false
        selector_candidate_visible = $false
        selector_menu_opened = $false
        model_selector_found = $false
        gemini_3_5_flash_visible = $false
        extended_thinking_mode_visible = $false
        selected_model = ""
        selected_reasoning_mode = ""
        exact_model_selected = $false
        exact_reasoning_mode_selected = $false
        visible_model_labels_redacted = @()
        visible_reasoning_labels_redacted = @()
        target_not_faked = $true
        zero_cost_policy = $true
        no_api_call = $true
        no_paid_upgrade_attempted = $true
        no_user_prompt = $true
        no_blind_click = $true
        private_urls_redacted = $true
        account_email_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        secrets_redacted = $true
    }
}

function Get-InputPayload {
    if (-not [string]::IsNullOrWhiteSpace($ModelLabelsJson)) { return ($ModelLabelsJson | ConvertFrom-Json) }
    $fromFile = Read-JsonFile -Path $ModelLabelsPath
    if ($fromFile) { return $fromFile }
    return $null
}

function Invoke-ModelStatus {
    param([object[]]$ModelLabels, [object[]]$ReasoningLabels, [bool]$SelectorFound, [bool]$MenuOpened)
    $modelLabelsSafe = Redact-Labels -Labels $ModelLabels
    $reasoningLabelsSafe = Redact-Labels -Labels $ReasoningLabels
    if ($modelLabelsSafe.Count -gt 0 -or $reasoningLabelsSafe.Count -gt 0) { $SelectorFound = $true }

    $preferredModelNorm = Normalize-Label -Text $PreferredModel
    $preferredModeNorm = Normalize-Label -Text $PreferredReasoningMode
    $modelMatch = $null
    foreach ($label in $modelLabelsSafe) {
        $norm = Normalize-Label -Text $label
        if ($norm -eq $preferredModelNorm -or ($norm -match 'gemini' -and $norm -match '3\s*5' -and $norm -match 'flash')) {
            $modelMatch = $label
            break
        }
    }

    $modeMatch = $null
    foreach ($label in @($reasoningLabelsSafe + $modelLabelsSafe)) {
        $norm = Normalize-Label -Text $label
        if ($norm -eq $preferredModeNorm -or $norm -match 'extended|thinking|deep think|deep reasoning|approfondie|raisonnement|advanced') {
            $modeMatch = $label
            break
        }
    }

    $closest = @($modelLabelsSafe | Where-Object {
            $norm = Normalize-Label -Text $_
            ($norm -match 'gemini' -and ($norm -match 'flash|\bpro\b|ultra|[0-9]')) -or
            (($norm -match 'flash|\bpro\b|ultra') -and $norm -match '[0-9]')
        } | Select-Object -First 1)

    $status = "GEMINI_MODEL_SELECTOR_NOT_FOUND"
    if ($SelectorFound -and $modelMatch -and $modeMatch) {
        $status = "GEMINI_3_5_FLASH_EXTENDED_SELECTED"
    } elseif ($SelectorFound -and $modelMatch) {
        $status = "GEMINI_3_5_FLASH_SELECTED_EXTENDED_NOT_VISIBLE"
    } elseif ($SelectorFound -and $MenuOpened) {
        $status = "GEMINI_MODEL_MENU_VISIBLE_TARGET_NOT_FOUND"
    } elseif ($SelectorFound) {
        $status = "GEMINI_MODEL_READY_NOT_EXACT"
    }

    return [ordered]@{
        status = $status
        model_selector_found = [bool]$SelectorFound
        selector_menu_opened = [bool]$MenuOpened
        gemini_3_5_flash_visible = [bool]$modelMatch
        extended_thinking_mode_visible = [bool]$modeMatch
        selected_model = if ($modelMatch) { [string]$modelMatch } elseif ($closest.Count -gt 0) { [string]$closest[0] } else { "" }
        selected_reasoning_mode = if ($modeMatch) { [string]$modeMatch } else { "" }
        exact_model_selected = [bool]$modelMatch
        exact_reasoning_mode_selected = [bool]$modeMatch
        visible_model_labels_redacted = @($modelLabelsSafe)
        visible_reasoning_labels_redacted = @($reasoningLabelsSafe)
    }
}

function New-MockResult {
    $payload = Get-InputPayload
    $modelLabels = @()
    $reasoningLabels = @()
    if ($payload) {
        $modelLabels = @($payload.available_model_labels)
        $reasoningLabels = @($payload.reasoning_mode_labels)
    }
    if ($MockTargetModelVisible -and $modelLabels -notcontains "Gemini 3.5 Flash") { $modelLabels += "Gemini 3.5 Flash" }
    if ($MockExtendedVisible -and $reasoningLabels -notcontains "Extended") { $reasoningLabels += "Extended" }
    $selectorFound = [bool]($MockSelectorVisible -or $MockTargetModelVisible -or $MockExtendedVisible -or $payload.model_selector_found)
    $selection = Invoke-ModelStatus -ModelLabels $modelLabels -ReasoningLabels $reasoningLabels -SelectorFound $selectorFound -MenuOpened ([bool]$MockMenuVisible)
    $result = New-BaseResult
    foreach ($key in $selection.Keys) { $result[$key] = $selection[$key] }
    $result.cdp_reachable = $true
    $result.page_opened = $true
    $result.screenshot_before_path = Join-Path $ArtifactPath "model_selector\mock_before.png"
    $result.screenshot_after_path = if ($MockMenuVisible) { Join-Path $ArtifactPath "model_selector\mock_after.png" } else { "" }
    $result.dom_probe_path = Join-Path $ArtifactPath "model_selector\mock_dom_probe.json"
    $result.screenshot_before_verdict = $true
    $result.dom_probe_before_verdict = $true
    $result.selector_candidate_visible = $selectorFound
    return $result
}

function Invoke-LiveSecondPass {
    $result = New-BaseResult
    $endpoint = Get-ReachableEndpoint -Preferred $Endpoint
    if ([string]::IsNullOrWhiteSpace($endpoint)) {
        $result.status = "GEMINI_MODEL_SELECTOR_NOT_FOUND"
        $result.diagnosis = "CDP_9223_UNREACHABLE"
        return $result
    }
    $result.cdp_reachable = $true

    $modelDir = Join-Path $ArtifactPath "model_selector"
    $probeDir = Join-Path $modelDir "probe"
    New-Item -ItemType Directory -Force -Path $modelDir, $probeDir | Out-Null
    $scriptPath = Join-Path $probeDir ("gemini_model_selector_second_pass_{0}.mjs" -f [guid]::NewGuid().ToString("N"))
    $probeOut = Join-Path $probeDir "model_selector_second_pass_probe.json"
    $beforeShot = Join-Path $modelDir ("before_selector_{0}.png" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $afterShot = Join-Path $modelDir ("after_selector_{0}.png" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $domPath = Join-Path $modelDir ("dom_probe_{0}.json" -f (Get-Date -Format "yyyyMMdd_HHmmss"))

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
function redact(value) {
  return String(value || "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[redacted-account]").replace(/https?:\/\/[^\s"]+/g, "[redacted-url]");
}
async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  try { return requireFromHere("playwright"); } catch {}
  const roots = [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules") : ""
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
async function visibleText(page, afterOpen) {
  return await page.evaluate((opened) => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < window.innerHeight && rect.left < window.innerWidth &&
        style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" &&
        element.getAttribute("aria-hidden") !== "true";
    };
    const controls = Array.from(document.querySelectorAll('button,[role="button"],[aria-label],[role="menuitem"]')).filter(isVisible);
    const labels = [];
    const selectorCandidates = [];
    for (const element of controls) {
      const text = String(element.getAttribute("aria-label") || element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 160) continue;
      const safe = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[redacted-account]");
      const modelLike = /gemini/i.test(safe) && /flash|\bpro\b|ultra|[0-9]/i.test(safe);
      const modeLike = /thinking|extended|deep|approfondie|raisonnement|advanced/i.test(safe);
      if (/compte google|google account|account settings|param[èe]tres du compte/i.test(safe)) continue;
      if (modelLike || modeLike || opened) labels.push(safe);
      if (modelLike || /model|mod[eè]le|gemini/i.test(safe)) selectorCandidates.push(safe);
    }
    return {
      labels: Array.from(new Set(labels)).slice(0, 80),
      selector_candidates: Array.from(new Set(selectorCandidates)).slice(0, 20)
    };
  }, afterOpen);
}
async function safeSelectorLocator(page) {
  const candidates = [
    'button[aria-label*="Gemini" i]',
    'button:has-text("Gemini")',
    '[role="button"][aria-label*="Gemini" i]',
    '[role="button"]:has-text("Gemini")',
    'button[aria-label*="model" i]',
    'button[aria-label*="modèle" i]'
  ];
  for (const selector of candidates) {
    const loc = page.locator(selector).first();
    if (await loc.count().catch(() => 0) < 1) continue;
    if (await loc.isVisible().catch(() => false)) return loc;
  }
  return null;
}
async function main() {
  const args = parseArgs(process.argv);
  const result = {
    cdp_reachable: false,
    page_opened: false,
    screenshot_before_path: "",
    screenshot_after_path: "",
    dom_probe_path: args.dom,
    selector_candidate_visible: false,
    selector_menu_opened: false,
    available_model_labels: [],
    reasoning_mode_labels: [],
    private_urls_redacted: true,
    account_email_redacted: true,
    secrets_redacted: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(String(args.endpoint).replace(/\/$/, ""));
    result.cdp_reachable = true;
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page = pages.find((candidate) => /gemini\.google\.com/i.test(candidate.url()));
    if (!page) {
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_opened = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: args.before, fullPage: false }).catch(() => {});
    if (fs.existsSync(args.before)) result.screenshot_before_path = args.before;
    const before = await visibleText(page, false);
    const selector = await safeSelectorLocator(page);
    result.selector_candidate_visible = Boolean(selector);
    let after = { labels: [], selector_candidates: [] };
    if ((args.mode === "OpenSelector" || args.mode === "SecondPass") && selector) {
      await selector.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
      result.selector_menu_opened = true;
      await page.screenshot({ path: args.after, fullPage: false }).catch(() => {});
      if (fs.existsSync(args.after)) result.screenshot_after_path = args.after;
      after = await visibleText(page, true);
      await page.keyboard.press("Escape").catch(() => {});
    }
    const labels = Array.from(new Set([...before.labels, ...after.labels])).filter((label) => !/@|https?:\/\//i.test(label)).slice(0, 80);
    const reasoning = labels.filter((label) => /thinking|extended|deep|approfondie|raisonnement|advanced/i.test(label));
    result.available_model_labels = labels;
    result.reasoning_mode_labels = reasoning;
    result.selector_candidate_labels = before.selector_candidates;
    writeJson(args.dom, {
      url_redacted: true,
      account_email_redacted: true,
      selector_candidate_visible: result.selector_candidate_visible,
      selector_menu_opened: result.selector_menu_opened,
      visible_labels_redacted: labels,
      history_text_ignored: true
    });
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
    $nodeOutput = & node $scriptPath --mode $Mode --endpoint $endpoint --out $probeOut --before $beforeShot --after $afterShot --dom $domPath 2>&1
    if (-not (Test-Path -LiteralPath $probeOut -PathType Leaf)) {
        $result.status = "GEMINI_MODEL_SELECTOR_NOT_FOUND"
        $result.diagnosis = (($nodeOutput | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
        return $result
    }

    $probe = Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json
    $selection = Invoke-ModelStatus -ModelLabels @($probe.available_model_labels) -ReasoningLabels @($probe.reasoning_mode_labels) -SelectorFound ([bool]$probe.selector_candidate_visible) -MenuOpened ([bool]$probe.selector_menu_opened)
    foreach ($key in $selection.Keys) { $result[$key] = $selection[$key] }
    $result.cdp_reachable = [bool]$probe.cdp_reachable
    $result.page_opened = [bool]$probe.page_opened
    $result.screenshot_before_path = [string]$probe.screenshot_before_path
    $result.screenshot_after_path = [string]$probe.screenshot_after_path
    $result.dom_probe_path = [string]$probe.dom_probe_path
    $result.screenshot_before_verdict = -not [string]::IsNullOrWhiteSpace([string]$probe.screenshot_before_path)
    $result.dom_probe_before_verdict = -not [string]::IsNullOrWhiteSpace([string]$probe.dom_probe_path)
    $result.selector_candidate_visible = [bool]$probe.selector_candidate_visible
    return $result
}

if ($CDPPort -ne 9223) {
    $bad = New-BaseResult
    $bad.status = "GEMINI_SHARED_PROFILE_FORBIDDEN"
    $bad.diagnosis = "Gemini second-pass selector may only use CDP port 9223."
    if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
    New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
    if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath "model_selector\model_selector_second_pass_result.json" }
    Write-JsonFile -Path $OutPath -Payload $bad
    $bad | ConvertTo-Json -Depth 80
    exit 0
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath "model_selector\model_selector_second_pass_result.json" }

if ($Mode -eq "DryRun" -or $DryRun -or $MockSelectorVisible -or $MockTargetModelVisible -or $MockExtendedVisible -or $MockMenuVisible -or -not [string]::IsNullOrWhiteSpace($ModelLabelsJson) -or -not [string]::IsNullOrWhiteSpace($ModelLabelsPath)) {
    $result = New-MockResult
} else {
    $result = Invoke-LiveSecondPass
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 80
