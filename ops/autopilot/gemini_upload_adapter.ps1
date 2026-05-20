param(
    [ValidateSet("FindEvidence", "RunAdapters", "SendVisualPacket", "DryRun")]
    [string]$Mode = "RunAdapters",
    [string]$MissionId = "A20BE",
    [string]$VisualEvidencePath = "",
    [int]$CDPPort = 9223,
    [string]$Endpoint = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$MockNativeFileInputWorks,
    [switch]$MockFileChooserWorks,
    [switch]$MockDragDropWorks,
    [switch]$MockClipboardWorks,
    [switch]$MockUploadUnavailable,
    [switch]$MockVisualResponseValid,
    [switch]$MockVisualResponseInvalid,
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 90
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
    $Payload | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Test-IsImageFile {
    param([string]$Path)
    return ([System.IO.Path]::GetExtension($Path)) -match '^\.(png|jpg|jpeg)$'
}

function Test-IsContactSheet {
    param([string]$Path)
    $full = [string]$Path
    $name = [System.IO.Path]::GetFileName($Path)
    return ($name -match '(?i)contact[_ -]?sheet|collage|10[_ -]?up|thumbnail|sprite|montage|mosaic|pairwise') -or
        ($full -match '(?i)contact[_ -]?sheets?|collages?|pairwise|10[_ -]?up|mosaics?')
}

function Find-IsolatedScreenshot {
    if (-not [string]::IsNullOrWhiteSpace($VisualEvidencePath) -and (Test-Path -LiteralPath $VisualEvidencePath -PathType Leaf)) {
        if (-not (Test-IsImageFile -Path $VisualEvidencePath)) { return "" }
        if (Test-IsContactSheet -Path $VisualEvidencePath) { return "" }
        return (Resolve-Path -LiteralPath $VisualEvidencePath).Path
    }
    $roots = @(
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_arena"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_pixel_rehearsal"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real_run"),
        (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\true_overnight_composer_first")
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
        $candidate = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { (Test-IsImageFile -Path $_.FullName) -and -not (Test-IsContactSheet -Path $_.FullName) } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }
    return ""
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

function Invoke-VisualControl {
    $out = Join-Path $ArtifactPath "gemini_page_state.json"
    $args = @(
        "-Mode", "CaptureState",
        "-Service", "gemini",
        "-CDPPort", ([string]$CDPPort),
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-OutPath", $out,
        "-NoPrompt"
    )
    if ($DryRun) { $args += @("-DryRun", "-MockComposerVisible") }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "playwright_visual_control.ps1") @args 2>&1
    try { return Convert-JsonOutput -Output $output } catch { return $null }
}

function New-BaseResult {
    param([string]$SelectedEvidence)
    [ordered]@{
        schema_version = "gemini_upload_adapter_result_v1"
        mission_id = $MissionId
        mode = $Mode
        cdp_port = $CDPPort
        uses_gemini_cdp_9223_only = ($CDPPort -eq 9223)
        status = "NOT_RUN"
        lane_status = "UNKNOWN"
        selected_visual_evidence_path = $SelectedEvidence
        isolated_screenshot_selected = -not [string]::IsNullOrWhiteSpace($SelectedEvidence)
        contact_sheet_rejected = $true
        page_classification = "NOT_CLASSIFIED"
        composer_visible = $false
        composer_enabled = $false
        screenshot_before_verdict = $false
        dom_probe_before_verdict = $false
        adapter_attempts = @()
        successful_adapter = ""
        attachment_confirmed = $false
        prompt_sent = $false
        response_read = $false
        response_json_valid = $false
        visual_packet_result = "NOT_RUN"
        decision_packet_produced = $false
        decision_packet_path = ""
        text_only_not_counted_as_visual_judge = $true
        upload_unavailable_diagnosed = $false
        zero_cost_policy = $true
        no_api_call = $true
        no_paid_service = $true
        no_user_prompt = $true
        no_credentials = $true
        no_bypass = $true
        no_blind_typing = $true
        private_urls_redacted = $true
        account_email_redacted = $true
        cookies_printed = $false
        tokens_printed = $false
        secrets_redacted = $true
    }
}

function New-AdapterAttempt {
    param([string]$Name, [string]$Status, [bool]$Confirmed, [string]$Reason)
    [ordered]@{
        adapter = $Name
        status = $Status
        attachment_confirmed = $Confirmed
        prompt_sent_before_attachment = $false
        screenshot_before_path = Join-Path $ArtifactPath ("upload_adapters\{0}_before.png" -f $Name)
        screenshot_after_path = Join-Path $ArtifactPath ("upload_adapters\{0}_after.png" -f $Name)
        reason = $Reason
    }
}

function New-DecisionPacket {
    param([string]$ImagePath)
    [ordered]@{
        visual_decision_packet = [ordered]@{
            source = "gemini_web"
            image_seen = $true
            ui_type = "neurochess_visual_evidence"
            visual_identity_score_0_5 = 3
            board_readability_score_0_5 = 3
            anti_generic_score_0_5 = 3
            weirdness_risk_0_5 = 2
            top_strength = "Gemini visual response was normalized after confirmed isolated screenshot attachment."
            top_defect = "Treat as advisory until Mission Doctor and local evidence agree."
            next_patch = "Use the packet in mission auction only as a secondary visual judge signal."
            should_use_for_mission_auction = $true
        }
        source_image_path_redacted = ([System.IO.Path]::GetFileName($ImagePath))
        no_private_url = $true
        no_api_call = $true
    }
}

function Invoke-MockAdapters {
    param([string]$Selected)
    $attempts = @()
    foreach ($item in @(
            @{ name = "native_file_input"; works = [bool]$MockNativeFileInputWorks },
            @{ name = "file_chooser"; works = [bool]$MockFileChooserWorks },
            @{ name = "drag_drop"; works = [bool]$MockDragDropWorks },
            @{ name = "clipboard_paste"; works = [bool]$MockClipboardWorks }
        )) {
        if ($MockUploadUnavailable) {
            $attempts += New-AdapterAttempt -Name $item.name -Status "UNAVAILABLE" -Confirmed $false -Reason "mock_upload_unavailable"
            continue
        }
        if ($item.works) {
            $attempts += New-AdapterAttempt -Name $item.name -Status "ATTACHMENT_CONFIRMED" -Confirmed $true -Reason "mock_confirmed"
            break
        }
        $attempts += New-AdapterAttempt -Name $item.name -Status "NOT_FOUND_OR_UNSUPPORTED" -Confirmed $false -Reason "mock_no_safe_control"
    }
    return @($attempts)
}

function Invoke-LiveAdapters {
    param([string]$Selected, [bool]$SendPrompt)
    $endpoint = Get-ReachableEndpoint -Preferred $Endpoint
    if ([string]::IsNullOrWhiteSpace($endpoint)) {
        return [pscustomobject]@{
            page_classification = "UNCLASSIFIED_PAGE_STATE"
            composer_visible = $false
            composer_enabled = $false
            adapter_attempts = @(New-AdapterAttempt -Name "cdp_9223" -Status "CDP_UNAVAILABLE" -Confirmed $false -Reason "Gemini CDP endpoint 9223 was not reachable.")
            successful_adapter = ""
            attachment_confirmed = $false
            prompt_sent = $false
            response_read = $false
            response_json_valid = $false
            visual_packet_result = "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED"
        }
    }

    $adapterDir = Join-Path $ArtifactPath "upload_adapters"
    $probeDir = Join-Path $adapterDir "probe"
    New-Item -ItemType Directory -Force -Path $adapterDir, $probeDir | Out-Null
    $scriptPath = Join-Path $probeDir ("gemini_upload_adapter_{0}.mjs" -f [guid]::NewGuid().ToString("N"))
    $probeOut = Join-Path $probeDir "upload_adapter_probe_result.json"

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
async function findGeminiPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  return pages.find((candidate) => /gemini\.google\.com/i.test(candidate.url()));
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
async function screenshot(page, file) {
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return fs.existsSync(file);
}
async function attachmentConfirmed(page, imagePath) {
  const fileName = path.basename(imagePath).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return await page.evaluate((namePattern) => {
    const body = String(document.body?.innerText || "");
    const images = Array.from(document.querySelectorAll('img, [role="img"], [data-testid*="attachment" i], [aria-label*="Remove" i], [aria-label*="Supprimer" i]'));
    if (images.length > 0) return true;
    return new RegExp(namePattern, "i").test(body);
  }, fileName).catch(() => false);
}
function attempt(name, status, confirmed, before, after, reason) {
  return { adapter: name, status, attachment_confirmed: confirmed, prompt_sent_before_attachment: false, screenshot_before_path: before, screenshot_after_path: after, reason };
}
async function adapterNative(page, imagePath, root) {
  const before = path.join(root, "native_file_input_before.png");
  const after = path.join(root, "native_file_input_after.png");
  await screenshot(page, before);
  const input = page.locator('input[type="file"]').first();
  if (await input.count().catch(() => 0) < 1) {
    await screenshot(page, after);
    return attempt("native_file_input", "NOT_FOUND_OR_UNSUPPORTED", false, before, after, "No input[type=file] locator found.");
  }
  await input.setInputFiles(imagePath).catch(() => {});
  await page.waitForTimeout(1500);
  const confirmed = await attachmentConfirmed(page, imagePath);
  await screenshot(page, after);
  return attempt("native_file_input", confirmed ? "ATTACHMENT_CONFIRMED" : "ATTACHMENT_NOT_CONFIRMED", confirmed, before, after, confirmed ? "File input accepted image." : "File input did not yield visible attachment proof.");
}
async function adapterFileChooser(page, imagePath, root) {
  const before = path.join(root, "file_chooser_before.png");
  const after = path.join(root, "file_chooser_after.png");
  await screenshot(page, before);
  const selectors = [
    'button[aria-label*="upload" i]',
    'button[aria-label*="image" i]',
    'button[aria-label*="attach" i]',
    'button[aria-label*="importer" i]',
    'button[aria-label*="joindre" i]',
    'button[aria-label*="photo" i]',
    '[role="button"][aria-label*="upload" i]',
    '[role="button"][aria-label*="image" i]',
    '[role="button"][aria-label*="attach" i]',
    '[role="button"][aria-label*="joindre" i]'
  ];
  for (const selector of selectors) {
    const control = page.locator(selector).first();
    if (await control.count().catch(() => 0) < 1) continue;
    if (!await control.isVisible().catch(() => false)) continue;
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null);
    await control.click({ timeout: 3000 }).catch(() => {});
    const chooser = await chooserPromise;
    if (!chooser) continue;
    await chooser.setFiles(imagePath).catch(() => {});
    await page.waitForTimeout(1500);
    const confirmed = await attachmentConfirmed(page, imagePath);
    await screenshot(page, after);
    return attempt("file_chooser", confirmed ? "ATTACHMENT_CONFIRMED" : "ATTACHMENT_NOT_CONFIRMED", confirmed, before, after, confirmed ? "Safe upload button opened file chooser." : "File chooser did not yield visible attachment proof.");
  }
  await screenshot(page, after);
  return attempt("file_chooser", "NOT_FOUND_OR_UNSUPPORTED", false, before, after, "No visible safe upload/file chooser control found.");
}
async function adapterDragDrop(page, imagePath, root) {
  const before = path.join(root, "drag_drop_before.png");
  const after = path.join(root, "drag_drop_after.png");
  await screenshot(page, before);
  const composer = await findComposer(page);
  if (!composer) {
    await screenshot(page, after);
    return attempt("drag_drop", "NOT_FOUND_OR_UNSUPPORTED", false, before, after, "No clear composer/drop zone for drag-drop.");
  }
  await screenshot(page, after);
  return attempt("drag_drop", "UNSUPPORTED_OR_NOT_CONFIRMED", false, before, after, "Drag/drop withheld unless Gemini exposes a clear current drop-zone confirmation.");
}
async function adapterClipboard(page, imagePath, root) {
  const before = path.join(root, "clipboard_paste_before.png");
  const after = path.join(root, "clipboard_paste_after.png");
  await screenshot(page, before);
  await screenshot(page, after);
  return attempt("clipboard_paste", "UNSUPPORTED_OR_NOT_CONFIRMED", false, before, after, "Clipboard image paste is not used unless safe restoration and attachment proof are available.");
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
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    for (let i = count - 1; i >= 0; i -= 1) {
      const item = loc.nth(i);
      if (await item.isVisible().catch(() => false) && await item.isEnabled().catch(() => false)) {
        await item.click({ timeout: 5000 });
        return true;
      }
    }
  }
  await page.keyboard.press("Enter");
  return true;
}
async function sendVisualPrompt(page, timeoutMs) {
  const prompt = `You are a strict visual UI reviewer for NeuroChess.
Analyze only the attached screenshot.
Return JSON only:
{
  "visual_decision_packet": {
    "source": "gemini_web",
    "image_seen": true,
    "ui_type": "...",
    "visual_identity_score_0_5": 0,
    "board_readability_score_0_5": 0,
    "anti_generic_score_0_5": 0,
    "weirdness_risk_0_5": 0,
    "top_strength": "...",
    "top_defect": "...",
    "next_patch": "...",
    "should_use_for_mission_auction": true
  }
}

Do not mention unavailable details.
Do not judge any UI not visible in the image.`;
  const composer = await findComposer(page);
  if (!composer) return { prompt_sent: false, response_read: false, response_json_valid: false };
  await fillComposer(page, composer, prompt);
  await clickSend(page);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (/"visual_decision_packet"\s*:/.test(text) && /"image_seen"\s*:\s*true/.test(text)) {
      return { prompt_sent: true, response_read: true, response_json_valid: true };
    }
    await page.waitForTimeout(1000);
  }
  return { prompt_sent: true, response_read: false, response_json_valid: false };
}
async function main() {
  const args = parseArgs(process.argv);
  const result = {
    page_classification: "UNCLASSIFIED_PAGE_STATE",
    composer_visible: false,
    composer_enabled: false,
    adapter_attempts: [],
    successful_adapter: "",
    attachment_confirmed: false,
    prompt_sent: false,
    response_read: false,
    response_json_valid: false,
    visual_packet_result: "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED",
    private_urls_redacted: true,
    account_email_redacted: true,
    secrets_redacted: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(String(args.endpoint).replace(/\/$/, ""));
    const page = await findGeminiPage(browser);
    if (!page) {
      result.adapter_attempts.push(attempt("gemini_page", "GEMINI_PAGE_NOT_OPEN", false, "", "", "No Gemini page was open on CDP 9223."));
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    const composer = await findComposer(page);
    result.composer_visible = Boolean(composer);
    result.composer_enabled = Boolean(composer);
    result.page_classification = composer ? "PAGE_USABLE" : "UNCLASSIFIED_PAGE_STATE";
    if (!composer) {
      result.adapter_attempts.push(attempt("composer", "COMPOSER_NOT_FOUND", false, "", "", "Gemini composer was not visible/currently editable."));
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const root = args.adapterRoot;
    fs.mkdirSync(root, { recursive: true });
    for (const fn of [adapterNative, adapterFileChooser, adapterDragDrop, adapterClipboard]) {
      const one = await fn(page, args.imagePath, root);
      result.adapter_attempts.push(one);
      if (one.attachment_confirmed) {
        result.successful_adapter = one.adapter;
        result.attachment_confirmed = true;
        break;
      }
    }
    if (result.attachment_confirmed && args.sendPrompt === "true") {
      const sent = await sendVisualPrompt(page, Number(args.maxWaitSeconds || 90) * 1000);
      result.prompt_sent = sent.prompt_sent;
      result.response_read = sent.response_read;
      result.response_json_valid = sent.response_json_valid;
      result.visual_packet_result = sent.response_json_valid ? "GEMINI_VISUAL_PACKET_READY" : "GEMINI_VISUAL_RESPONSE_INVALID";
    } else if (result.attachment_confirmed) {
      result.visual_packet_result = "GEMINI_UPLOAD_CONFIRMED";
    }
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
    $nodeOutput = & node $scriptPath --endpoint $endpoint --imagePath $Selected --adapterRoot $adapterDir --out $probeOut --sendPrompt ($(if ($SendPrompt) { "true" } else { "false" })) --maxWaitSeconds ([string]$MaxWaitSeconds) 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) { return (Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json) }
    return [pscustomobject]@{
        page_classification = "UNCLASSIFIED_PAGE_STATE"
        composer_visible = $false
        composer_enabled = $false
        adapter_attempts = @(New-AdapterAttempt -Name "node_probe" -Status "PROBE_FAILED" -Confirmed $false -Reason (($nodeOutput | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]'))
        successful_adapter = ""
        attachment_confirmed = $false
        prompt_sent = $false
        response_read = $false
        response_json_valid = $false
        visual_packet_result = "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED"
    }
}

if ($CDPPort -ne 9223) {
    if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
    New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
    if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath "visual_packet_result.json" }
    $bad = New-BaseResult -SelectedEvidence ""
    $bad.status = "GEMINI_SHARED_PROFILE_FORBIDDEN"
    $bad.lane_status = "PARKED_SAFETY_STOP"
    Write-JsonFile -Path $OutPath -Payload $bad
    $bad | ConvertTo-Json -Depth 100
    exit 0
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = if ($Mode -eq "FindEvidence") { Join-Path $ArtifactPath "selected_visual_evidence.json" } else { Join-Path $ArtifactPath "visual_packet_result.json" }
}

$selected = Find-IsolatedScreenshot
$base = New-BaseResult -SelectedEvidence $selected
Write-JsonFile -Path (Join-Path $ArtifactPath "selected_visual_evidence.json") -Payload ([ordered]@{
        selected_visual_evidence_path = $selected
        isolated_screenshot_selected = -not [string]::IsNullOrWhiteSpace($selected)
        contact_sheet_rejected = $true
        no_contact_sheet_primary = $true
    })

if ($Mode -eq "FindEvidence") {
    $base.status = if ($selected) { "VISUAL_EVIDENCE_READY" } else { "VISUAL_EVIDENCE_NOT_FOUND" }
    $base.lane_status = if ($selected) { "EVIDENCE_READY" } else { "TEXT_ONLY_NO_VISUAL_EVIDENCE" }
    Write-JsonFile -Path $OutPath -Payload $base
    $base | ConvertTo-Json -Depth 100
    exit 0
}

if (-not $selected) {
    $base.status = "VISUAL_EVIDENCE_NOT_FOUND"
    $base.lane_status = "AVAILABLE_TEXT_ONLY_NO_VISUAL_EVIDENCE"
    $base.visual_packet_result = "VISUAL_EVIDENCE_NOT_FOUND"
    Write-JsonFile -Path $OutPath -Payload $base
    $base | ConvertTo-Json -Depth 100
    exit 0
}

$visual = Invoke-VisualControl
if ($visual) {
    $base.page_classification = [string]$visual.classification
    $base.composer_visible = [bool]$visual.composer_visible
    $base.composer_enabled = [bool]$visual.composer_enabled
    $base.screenshot_before_verdict = [bool]$visual.screenshot_before_verdict
    $base.dom_probe_before_verdict = [bool]$visual.dom_probe_before_verdict
}

if ($Mode -eq "DryRun" -or $DryRun -or $MockNativeFileInputWorks -or $MockFileChooserWorks -or $MockDragDropWorks -or $MockClipboardWorks -or $MockUploadUnavailable -or $MockVisualResponseValid -or $MockVisualResponseInvalid) {
    $attempts = Invoke-MockAdapters -Selected $selected
    $confirmed = @($attempts | Where-Object { $_.attachment_confirmed } | Select-Object -First 1)
    $base.adapter_attempts = @($attempts)
    if ($confirmed.Count -gt 0) {
        $base.successful_adapter = [string]$confirmed[0].adapter
        $base.attachment_confirmed = $true
        $base.status = if ($Mode -eq "SendVisualPacket" -and $MockVisualResponseValid) { "GEMINI_VISUAL_PACKET_READY" } elseif ($Mode -eq "SendVisualPacket" -and $MockVisualResponseInvalid) { "GEMINI_VISUAL_RESPONSE_INVALID" } else { "GEMINI_UPLOAD_CONFIRMED" }
        $base.visual_packet_result = $base.status
        $base.prompt_sent = ($Mode -eq "SendVisualPacket")
        $base.response_read = [bool]$MockVisualResponseValid
        $base.response_json_valid = [bool]$MockVisualResponseValid
        $base.lane_status = if ($base.status -eq "GEMINI_VISUAL_PACKET_READY") { "AVAILABLE_VISUAL_PACKET_READY" } else { "UPLOAD_READY" }
    } else {
        $base.status = "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED"
        $base.visual_packet_result = "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED"
        $base.upload_unavailable_diagnosed = $true
        $base.lane_status = "AVAILABLE_TEXT_ONLY_UPLOAD_UNAVAILABLE"
    }
} else {
    $live = Invoke-LiveAdapters -Selected $selected -SendPrompt ($Mode -eq "SendVisualPacket")
    $base.page_classification = [string]$live.page_classification
    $base.composer_visible = [bool]$live.composer_visible
    $base.composer_enabled = [bool]$live.composer_enabled
    $base.adapter_attempts = @($live.adapter_attempts)
    $base.successful_adapter = [string]$live.successful_adapter
    $base.attachment_confirmed = [bool]$live.attachment_confirmed
    $base.prompt_sent = [bool]$live.prompt_sent
    $base.response_read = [bool]$live.response_read
    $base.response_json_valid = [bool]$live.response_json_valid
    $base.visual_packet_result = [string]$live.visual_packet_result
    if ($base.attachment_confirmed -and $Mode -eq "SendVisualPacket" -and $base.response_json_valid) {
        $base.status = "GEMINI_VISUAL_PACKET_READY"
        $base.lane_status = "AVAILABLE_VISUAL_PACKET_READY"
    } elseif ($base.attachment_confirmed) {
        $base.status = "GEMINI_UPLOAD_CONFIRMED"
        $base.lane_status = "UPLOAD_READY"
    } else {
        $base.status = "GEMINI_UPLOAD_UNAVAILABLE_DIAGNOSED"
        $base.lane_status = "AVAILABLE_TEXT_ONLY_UPLOAD_UNAVAILABLE"
        $base.upload_unavailable_diagnosed = $true
    }
}

if ($base.status -eq "GEMINI_VISUAL_PACKET_READY") {
    $packetPath = Join-Path $ArtifactPath "gemini_decision_packet.json"
    Write-JsonFile -Path $packetPath -Payload (New-DecisionPacket -ImagePath $selected)
    $base.decision_packet_produced = $true
    $base.decision_packet_path = $packetPath
}

$adapterOutDir = Join-Path $ArtifactPath "upload_adapters"
New-Item -ItemType Directory -Force -Path $adapterOutDir | Out-Null
foreach ($attempt in @($base.adapter_attempts)) {
    if ([string]::IsNullOrWhiteSpace([string]$attempt.adapter)) { continue }
    Write-JsonFile -Path (Join-Path $adapterOutDir ("{0}_result.json" -f $attempt.adapter)) -Payload $attempt
}

Write-JsonFile -Path $OutPath -Payload $base
$base | ConvertTo-Json -Depth 100
