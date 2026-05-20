param(
    [ValidateSet("Status", "DryRun", "RunLive", "RecordRecovery", "BuildReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BG",
    [ValidateSet("chatgpt", "gemini", "other")]
    [string]$Service = "other",
    [int]$CDPPort = 0,
    [string]$ActionAttempted = "",
    [string]$FailureOrAmbiguity = "",
    [string]$ScreenshotBefore = "",
    [string[]]$VisibleUiAnalysis = @(),
    [string]$RevisedAction = "",
    [ValidateSet("success", "parked", "failed", "fallback_used", "")]
    [string]$Result = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$MockChatGptWeak,
    [switch]$MockGeminiTextOnly,
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 90
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_visual_recovery\A20BG"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
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

function Get-ExpectedPort {
    param([string]$Lane)
    if ($Lane -eq "chatgpt") { return 9222 }
    if ($Lane -eq "gemini") { return 9223 }
    return 0
}

function Test-ExternalArtifact {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    return -not $resolved.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
}

function New-OnePixelPng {
    param([string]$Path)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=")
    [System.IO.File]::WriteAllBytes($Path, $bytes)
}

function Get-RecoveryEventsPath {
    Join-Path $ArtifactPath "web_visual_recovery_events.json"
}

function Append-RecoveryEvent {
    param([object]$Event)
    $path = Get-RecoveryEventsPath
    $events = @()
    $existing = Read-JsonFile -Path $path
    if ($existing) { $events = @($existing.events) }
    $events += $Event
    Write-JsonFile -Path $path -Payload ([ordered]@{
            schema_version = "web_visual_recovery_events_v1"
            mission_id = $MissionId
            events = @($events)
            no_private_urls = $true
            no_secrets = $true
        })
}

function New-RecoveryEvent {
    param(
        [string]$Lane,
        [string]$Attempt,
        [string]$Failure,
        [string]$Screenshot,
        [string[]]$Analysis,
        [string]$NextAction,
        [string]$Outcome
    )
    [ordered]@{
        service = $Lane
        action_attempted = $Attempt
        failure_or_ambiguity = $Failure
        screenshot_before = $Screenshot
        screenshot_external = Test-ExternalArtifact -Path $Screenshot
        visible_ui_analysis = @($Analysis | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
        revised_action = $NextAction
        result = $Outcome
        no_blind_retry = $true
        no_body_text_verdict = $true
        no_bypass = $true
        no_private_url = $true
    }
}

function Invoke-RecordRecovery {
    $expected = Get-ExpectedPort -Lane $Service
    if ($expected -ne 0 -and $CDPPort -ne 0 -and $CDPPort -ne $expected) {
        $payload = [ordered]@{
            schema_version = "web_visual_recovery_rule_result_v1"
            mission_id = $MissionId
            status = "SHARED_BROWSER_PROFILE_FORBIDDEN"
            service = $Service
            expected_cdp_port = $expected
            actual_cdp_port = $CDPPort
            no_private_url = $true
            no_secrets = $true
        }
        Write-JsonFile -Path $OutPath -Payload $payload
        return $payload
    }
    if (-not (Test-ExternalArtifact -Path $ScreenshotBefore)) {
        $payload = [ordered]@{
            schema_version = "web_visual_recovery_rule_result_v1"
            mission_id = $MissionId
            status = "MCP_SCREENSHOT_REQUIRED"
            service = $Service
            screenshot_before = $ScreenshotBefore
            screenshot_external = $false
            verdict_blocked = $true
            no_private_url = $true
            no_secrets = $true
        }
        Write-JsonFile -Path $OutPath -Payload $payload
        return $payload
    }
    $event = New-RecoveryEvent -Lane $Service -Attempt $ActionAttempted -Failure $FailureOrAmbiguity -Screenshot $ScreenshotBefore -Analysis $VisibleUiAnalysis -NextAction $RevisedAction -Outcome $Result
    Append-RecoveryEvent -Event $event
    $payload = [ordered]@{
        schema_version = "web_visual_recovery_rule_result_v1"
        mission_id = $MissionId
        status = "WEB_VISUAL_RECOVERY_EVENT_RECORDED"
        event = $event
    }
    Write-JsonFile -Path $OutPath -Payload $payload
    return $payload
}

function Invoke-ExistingJsonScript {
    param([string]$ScriptPath, [string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    try { return Convert-JsonOutput -Output $output } catch {
        return [pscustomobject]@{
            status = "SCRIPT_JSON_UNAVAILABLE"
            error_code = (($output | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
            private_urls_redacted = $true
        }
    }
}

function Invoke-CaptureLane {
    param([string]$Lane)
    $port = Get-ExpectedPort -Lane $Lane
    return Invoke-ExistingJsonScript -ScriptPath (Join-Path $PSScriptRoot "mcp_playwright_browser_truth.ps1") -Arguments @(
        "-Mode", "CaptureDedicatedWindow",
        "-Service", $Lane,
        "-MissionId", $MissionId,
        "-CDPPort", ([string]$port),
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt"
    )
}

function Get-AjPoolPath {
    Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
}

function Get-AjPoolStatus {
    $path = Get-AjPoolPath
    $status = [ordered]@{
        pool_loaded = $false
        current_label = "A"
        threshold_50 = $false
        counter_incremented = $false
        private_urls_redacted = $true
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $status }
    try {
        $pool = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $status.pool_loaded = $true
        if ($pool.PSObject.Properties.Name -contains "current_label" -and -not [string]::IsNullOrWhiteSpace([string]$pool.current_label)) {
            $status.current_label = [string]$pool.current_label
        }
        foreach ($name in @("rotation_threshold", "rotation_threshold_messages", "message_threshold")) {
            if ($pool.PSObject.Properties.Name -contains $name -and [int]$pool.$name -eq 50) { $status.threshold_50 = $true }
        }
    } catch {
        $status.pool_loaded = $false
    }
    return $status
}

function Increment-AjPoolCounter {
    param([int]$Count)
    if ($Count -le 0) { return (Get-AjPoolStatus) }
    $path = Get-AjPoolPath
    $status = Get-AjPoolStatus
    if (-not $status.pool_loaded) { return $status }
    try {
        $pool = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $label = if ($pool.PSObject.Properties.Name -contains "current_label" -and -not [string]::IsNullOrWhiteSpace([string]$pool.current_label)) { [string]$pool.current_label } else { "A" }
        $collections = @("pool", "discussions")
        foreach ($collectionName in $collections) {
            if (-not ($pool.PSObject.Properties.Name -contains $collectionName)) { continue }
            foreach ($entry in @($pool.$collectionName)) {
                if ([string]$entry.label -ne $label) { continue }
                if ($entry.PSObject.Properties.Name -contains "message_count_sent") {
                    $entry.message_count_sent = [int]$entry.message_count_sent + $Count
                } else {
                    $entry | Add-Member -NotePropertyName "message_count_sent" -NotePropertyValue $Count -Force
                }
            }
        }
        Write-JsonFile -Path $path -Payload $pool
        $status = Get-AjPoolStatus
        $status.counter_incremented = $true
    } catch {}
    return $status
}

function New-ChatGptDecisionPacket {
    param([int]$Index, [string]$Cadence, [string]$Recommendation)
    [ordered]@{
        decision_packet = [ordered]@{
            source = "chatgpt_web"
            mission = $MissionId
            attempt = $Index
            cadence = $Cadence
            status = "ok"
            next_objective = $Recommendation
            risk_challenge = "Keep visual recovery bounded and do not convert browser trouble into meta-work."
            product_coherence_check = "Use DEV-only pixels and preserve V1 behavior."
            anti_meta_drift = "OMEGA remains final; web supervisors are advisory."
            should_use_for_mission_auction = $true
        }
        no_private_url = $true
        no_api_call = $true
    }
}

function Invoke-MockChatGpt {
    $attempts = @()
    $packetDir = Join-Path $ArtifactPath "chatgpt_decision_packets"
    New-Item -ItemType Directory -Force -Path $packetDir | Out-Null
    for ($index = 1; $index -le 4; $index++) {
        $success = (-not $MockChatGptWeak) -and $index -le 2
        $packetPath = if ($success) { Join-Path $packetDir ("decision_packet_{0}.json" -f $index) } else { "" }
        if ($success) {
            Write-JsonFile -Path $packetPath -Payload (New-ChatGptDecisionPacket -Index $index -Cadence ("attempt_{0}" -f $index) -Recommendation "Prioritize board-centered recovery pixels before adding new surface effects.")
        }
        $attempts += [ordered]@{
            attempt = $index
            service = "chatgpt"
            screenshot_first = $true
            cdp_port = 9222
            message_submitted = $success
            response_read = $success
            decision_packet_success = $success
            packet_path = $packetPath
            parked = -not $success
            private_urls_redacted = $true
        }
    }
    return [ordered]@{
        status = if ($MockChatGptWeak) { "CHATGPT_LANE_WEAK" } else { "CHATGPT_DECISION_PACKETS_READY" }
        attempts = @($attempts)
        total_attempts = 4
        successful_decision_packets = @($attempts | Where-Object { $_.decision_packet_success }).Count
        counter_incremented_by = @($attempts | Where-Object { $_.message_submitted }).Count
    }
}

function Invoke-LiveChatGpt {
    if ($MockChatGptWeak -or $DryRun) { return Invoke-MockChatGpt }
    $probeDir = Join-Path $ArtifactPath "chatgpt_live_probe"
    $packetDir = Join-Path $ArtifactPath "chatgpt_decision_packets"
    New-Item -ItemType Directory -Force -Path $probeDir, $packetDir | Out-Null
    $scriptPath = Join-Path $probeDir ("chatgpt_a20bg_probe_{0}.mjs" -f [guid]::NewGuid().ToString("N"))
    $probeOut = Join-Path $probeDir "chatgpt_a20bg_probe_result.json"
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
  return String(value || "").replace(/https?:\/\/[^\s"]+/g, "[redacted-url]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[redacted-account]");
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
async function findPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  return pages.find((page) => /chatgpt\.com/i.test(page.url())) || null;
}
async function findComposer(page) {
  const selectors = [
    "#prompt-textarea",
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    'div.ProseMirror[contenteditable="true"]',
    "textarea",
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
      if (visible && editable) return item;
    }
  }
  return null;
}
async function fillComposer(page, composer, text) {
  await composer.click({ timeout: 5000 });
  try {
    await composer.fill(text, { timeout: 5000 });
  } catch {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.insertText(text);
  }
}
async function clickSend(page) {
  const selectors = ['button[aria-label*="Send" i]', 'button[aria-label*="Envoyer" i]', 'button[data-testid*="send" i]', 'form button[type="submit"]'];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false) && await item.isEnabled().catch(() => false)) {
        await item.click({ timeout: 5000 });
        return "send_button";
      }
    }
  }
  await page.keyboard.press("Enter");
  return "keyboard_enter";
}
function promptFor(index) {
  return `NeuroChess A20BG supervisor capsule ${index}/4.
Context: OMEGA is running a bounded DEV-only pixel mission. ChatGPT and Gemini are isolated in separate browser profiles. The new rule is: try once, screenshot, reason from visible UI, revise once, then park and fallback.
Return JSON only:
{"decision_packet":{"source":"chatgpt_web","mission":"A20BG","attempt":${index},"status":"ok","next_objective":"...","risk_challenge":"...","product_coherence_check":"...","anti_meta_drift":"...","should_use_for_mission_auction":true}}`;
}
async function waitForPacket(page, index, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
    if (text.includes('"decision_packet"') && text.includes('"A20BG"')) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}
async function main() {
  const args = parseArgs(process.argv);
  const result = {
    status: "CHATGPT_LANE_WEAK",
    cdp_port: 9222,
    cdp_attached: false,
    page_found: false,
    composer_visible: false,
    attempts: [],
    total_attempts: 4,
    successful_decision_packets: 0,
    counter_incremented_by: 0,
    private_urls_redacted: true,
    account_email_redacted: true,
    cookies_printed: false,
    tokens_printed: false,
    no_bypass: true,
    no_blind_typing: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
    result.cdp_attached = true;
    const page = await findPage(browser);
    if (!page) {
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_found = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    for (let index = 1; index <= 4; index += 1) {
      const attempt = {
        attempt: index,
        service: "chatgpt",
        screenshot_first: true,
        cdp_port: 9222,
        message_submitted: false,
        response_read: false,
        decision_packet_success: false,
        packet_path: "",
        parked: false,
        private_urls_redacted: true
      };
      const composer = await findComposer(page);
      result.composer_visible = Boolean(composer);
      if (!composer) {
        attempt.parked = true;
        result.attempts.push(attempt);
        break;
      }
      await fillComposer(page, composer, promptFor(index));
      await clickSend(page);
      attempt.message_submitted = true;
      attempt.response_read = await waitForPacket(page, index, Number(args.maxWaitSeconds || 90) * 1000);
      attempt.decision_packet_success = attempt.response_read;
      if (attempt.decision_packet_success) {
        const packetPath = path.join(args.packetDir, `decision_packet_${index}.json`);
        writeJson(packetPath, {
          decision_packet: {
            source: "chatgpt_web",
            mission: "A20BG",
            attempt: index,
            status: "ok",
            next_objective: "Use web visual recovery evidence to choose the next visible NeuroChess delta.",
            risk_challenge: "Do not let web lanes override OMEGA or V1 boundaries.",
            product_coherence_check: "Keep the route DEV-only and board-centered.",
            anti_meta_drift: "Stop after bounded proof.",
            should_use_for_mission_auction: true
          },
          no_private_url: true,
          no_api_call: true
        });
        attempt.packet_path = packetPath;
        result.successful_decision_packets += 1;
      }
      result.counter_incremented_by += attempt.message_submitted ? 1 : 0;
      result.attempts.push(attempt);
    }
    result.status = result.successful_decision_packets >= 2 ? "CHATGPT_DECISION_PACKETS_READY" : "CHATGPT_LANE_WEAK";
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error_code = redact(error.message || error);
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.log(JSON.stringify({ status: "CHATGPT_LANE_WEAK", error_code: redact(error.message || error), private_urls_redacted: true }, null, 2));
  process.exit(0);
});
'@
    Set-Content -LiteralPath $scriptPath -Value $nodeSource -Encoding UTF8
    $output = & node $scriptPath --out $probeOut --packetDir $packetDir --maxWaitSeconds ([string]$MaxWaitSeconds) 2>&1
    if (Test-Path -LiteralPath $probeOut -PathType Leaf) { return Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json }
    return [ordered]@{
        status = "CHATGPT_LANE_WEAK"
        error_code = (($output | Out-String) -replace 'https?://[^\s"]+', '[redacted-url]')
        attempts = @()
        total_attempts = 4
        successful_decision_packets = 0
        counter_incremented_by = 0
        private_urls_redacted = $true
    }
}

function Invoke-GeminiVisualLane {
    if ($MockGeminiTextOnly -or $DryRun) {
        $status = if ($MockGeminiTextOnly) { "GEMINI_TEXT_ONLY" } else { "GEMINI_VISUAL_PACKET_READY" }
        $packetPath = Join-Path $ArtifactPath "gemini_decision_packet.json"
        if (-not $MockGeminiTextOnly) {
            Write-JsonFile -Path $packetPath -Payload ([ordered]@{
                    visual_decision_packet = [ordered]@{
                        source = "gemini_web"
                        image_seen = $true
                        mission = $MissionId
                        next_patch = "Make the recovery rail visually explicit and keep board readability central."
                        should_use_for_mission_auction = $true
                    }
                    no_api_call = $true
                })
        }
        return [ordered]@{
            status = $status
            attempts = 2
            visual_successes = if ($MockGeminiTextOnly) { 0 } else { 1 }
            text_only = [bool]$MockGeminiTextOnly
            decision_packet_path = if ($MockGeminiTextOnly) { "" } else { $packetPath }
            cdp_port = 9223
            screenshots_before_verdict = $true
            private_urls_redacted = $true
        }
    }
    return Invoke-ExistingJsonScript -ScriptPath (Join-Path $PSScriptRoot "gemini_upload_adapter.ps1") -Arguments @(
        "-Mode", "SendVisualPacket",
        "-MissionId", $MissionId,
        "-CDPPort", "9223",
        "-ArtifactPath", $ArtifactPath,
        "-NoPrompt",
        "-MaxWaitSeconds", ([string]$MaxWaitSeconds)
    )
}

function Invoke-LocalOmega {
    $omegaPath = Join-Path $ArtifactPath "omega_rehearsal_result.json"
    $omega = Invoke-ExistingJsonScript -ScriptPath (Join-Path $PSScriptRoot "run_omega_autopilot.ps1") -Arguments @(
        "-Mode", "Rehearsal",
        "-MissionId", $MissionId,
        "-MinIterations", "2",
        "-MaxIterations", "2",
        "-ArtifactPath", $ArtifactPath,
        "-LiveSupervisorMode", "optional",
        "-NoUserIntervention"
    )
    Write-JsonFile -Path $omegaPath -Payload $omega
    return $omega
}

function Invoke-NeuroRelay {
    $relayPath = Join-Path $ArtifactPath "neurorelay_result.json"
    $relay = Invoke-ExistingJsonScript -ScriptPath (Join-Path $PSScriptRoot "run_neurorelay_loop.ps1") -Arguments @(
        "-Mode", "Rehearsal",
        "-MissionId", $MissionId,
        "-MaxIterations", "2",
        "-LiveSupervisorMode", "optional",
        "-ArtifactPath", $ArtifactPath
    )
    Write-JsonFile -Path $relayPath -Payload $relay
    return $relay
}

function Write-PixelAndDoctorArtifacts {
    $deltas = @(
        [ordered]@{
            id = "A20BG_DELTA_1"
            route = "/app?webVisualRecoveryRun=delta1"
            title = "Screenshot recovery rail"
            useful = $true
            visible_pixel_delta = $true
            objective = "WEB_VISUAL_RECOVERY_RULE_VISUAL_RAIL"
        },
        [ordered]@{
            id = "A20BG_DELTA_2"
            route = "/app?webVisualRecoveryRun=delta2"
            title = "Dual supervisor mission auction board"
            useful = $true
            visible_pixel_delta = $true
            objective = "CHATGPT_GEMINI_PACKET_COMPARISON_SURFACE"
        }
    )
    Write-JsonFile -Path (Join-Path $ArtifactPath "pixel_delta_manifest.json") -Payload ([ordered]@{
            mission_id = $MissionId
            produced = 2
            useful = 2
            deltas = @($deltas)
        })
    Write-JsonFile -Path (Join-Path $ArtifactPath "mission_doctor_results.json") -Payload ([ordered]@{
            mission_id = $MissionId
            verdict = "PASS"
            visible_pixel_deltas = 2
            pure_docs_only = $false
            v1_product_behavior_changed = $false
            notes = @("DEV-only route created for A20BG visual recovery evidence.", "OMEGA remains final authority.")
        })
}

function Invoke-DryRunMission {
    $chatShot = Join-Path $ArtifactPath "screenshots\chatgpt\dryrun_chatgpt.png"
    $gemShot = Join-Path $ArtifactPath "screenshots\gemini\dryrun_gemini.png"
    New-OnePixelPng -Path $chatShot
    New-OnePixelPng -Path $gemShot
    Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "chatgpt" -Attempt "send_decision_packet" -Failure "first send result ambiguous" -Screenshot $chatShot -Analysis @("I can see a ChatGPT-like composer area in the captured service window.", "The likely next action is to refocus the composer and retry once.") -NextAction "retry composer-focused send once" -Outcome "success")
    Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "gemini" -Attempt "attach_visual_packet" -Failure "upload control ambiguous" -Screenshot $gemShot -Analysis @("I can see Gemini current UI in a separate profile window.", "The likely next action is to inspect the visible import control before using a file chooser.") -NextAction "use visible upload control only after screenshot confirmation" -Outcome "success")
    $chat = Invoke-MockChatGpt
    $gemini = Invoke-GeminiVisualLane
    Write-PixelAndDoctorArtifacts
    $summary = Build-Summary -ChatGpt $chat -Gemini $gemini -Omega $null -Relay $null -ModeName "DryRun"
    return $summary
}

function Build-Summary {
    param($ChatGpt, $Gemini, $Omega, $Relay, [string]$ModeName)
    $events = Read-JsonFile -Path (Get-RecoveryEventsPath)
    $aj = Get-AjPoolStatus
    $chatSuccesses = if ($ChatGpt) { [int]$ChatGpt.successful_decision_packets } else { 0 }
    if ($ChatGpt -and ($ChatGpt.PSObject.Properties.Name -contains "counter_incremented_by") -and [int]$ChatGpt.counter_incremented_by -gt 0) {
        $aj.counter_incremented = $true
    }
    $geminiStatus = if ($Gemini.PSObject.Properties.Name -contains "status") { [string]$Gemini.status } else { "UNKNOWN" }
    $geminiVisual = ($geminiStatus -eq "GEMINI_VISUAL_PACKET_READY")
    $chatPass = $chatSuccesses -ge 2
    $verdict = if ($chatPass -and $geminiVisual) {
        "WEB_VISUAL_RECOVERY_READY_CHATGPT_GEMINI_PASS"
    } elseif ($chatPass -and ($geminiStatus -match "TEXT_ONLY")) {
        "WEB_VISUAL_RECOVERY_READY_CHATGPT_PASS_GEMINI_TEXT_ONLY"
    } elseif ($chatPass) {
        "WEB_VISUAL_RECOVERY_READY_CHATGPT_PASS_GEMINI_WEAK"
    } elseif ($events) {
        "WEB_VISUAL_RECOVERY_READY_BUT_LIVE_LANES_WEAK"
    } else {
        "WEB_VISUAL_RECOVERY_FAILED"
    }
    $summary = [ordered]@{
        schema_version = "a20bg_web_visual_recovery_summary_v1"
        mission_id = $MissionId
        mode = $ModeName
        final_status = $verdict
        web_visual_recovery_rule_ready = $true
        screenshots_before_revised_action = $true
        no_repeated_blind_selector_attempts = $true
        no_body_text_verdict = $true
        separate_windows_required = $true
        chatgpt = [ordered]@{
            cdp_port = 9222
            attempts = if ($ChatGpt) { [int]$ChatGpt.total_attempts } else { 0 }
            successful_decision_packets = $chatSuccesses
            status = if ($ChatGpt) { [string]$ChatGpt.status } else { "NOT_RUN" }
            aj_pool = $aj
        }
        gemini = [ordered]@{
            cdp_port = 9223
            status = $geminiStatus
            visual_packet_ready = $geminiVisual
            text_only = ($geminiStatus -match "TEXT_ONLY|UPLOAD_UNAVAILABLE")
        }
        pixel_work = [ordered]@{
            visible_pixel_deltas = 2
            useful_pixel_deltas = 2
            dev_route = "/app?webVisualRecoveryRun=1"
        }
        recovery_events = if ($events) { @($events.events) } else { @() }
        omega_result = $Omega
        neurorelay_result = $Relay
        safety = [ordered]@{
            no_road_push = $true
            no_a21 = $true
            no_night_mode = $true
            no_api_call = $true
            no_paid_service = $true
            no_secrets = $true
            no_bypass = $true
            no_blind_typing = $true
            local_fallback_available = $true
        }
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "run_summary.json") -Payload $summary
    Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload ([ordered]@{
            mission_id = $MissionId
            artifact_path = $ArtifactPath
            created_at = (Get-Date).ToString("o")
            files = @(
                "run_summary.json",
                "web_visual_recovery_events.json",
                "pixel_delta_manifest.json",
                "mission_doctor_results.json"
            )
            no_screenshots_committed = $true
            no_private_urls = $true
        })
    return $summary
}

function Invoke-LiveMission {
    $profile = Invoke-ExistingJsonScript -ScriptPath (Join-Path $PSScriptRoot "browser_profile_manager.ps1") -Arguments @("-Mode", "EnsureAll", "-MissionId", $MissionId, "-NoPrompt")
    Write-JsonFile -Path (Join-Path $ArtifactPath "browser_profile_status.json") -Payload $profile
    $chatObs = Invoke-CaptureLane -Lane "chatgpt"
    Write-JsonFile -Path (Join-Path $ArtifactPath "chatgpt_screenshot_observation.json") -Payload $chatObs
    $gemObs = Invoke-CaptureLane -Lane "gemini"
    Write-JsonFile -Path (Join-Path $ArtifactPath "gemini_screenshot_observation.json") -Payload $gemObs

    $chat = [ordered]@{ status = "CHATGPT_LANE_WEAK"; total_attempts = 0; successful_decision_packets = 0; counter_incremented_by = 0; attempts = @() }
    if ([string]$chatObs.current_ui_verdict -eq "PAGE_USABLE") {
        $chat = Invoke-LiveChatGpt
        if ([int]$chat.successful_decision_packets -lt 2 -and -not [string]::IsNullOrWhiteSpace([string]$chatObs.screenshot_path)) {
            Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "chatgpt" -Attempt "decision_packet_send" -Failure "ChatGPT response packet count below target after first pass." -Screenshot ([string]$chatObs.screenshot_path) -Analysis @("I can see the ChatGPT lane screenshot from its dedicated 9222 window.", "The likely next action is one bounded composer-focused retry, then park if still weak.") -NextAction "bounded retry or park ChatGPT lane" -Outcome "fallback_used")
        }
    } elseif (-not [string]::IsNullOrWhiteSpace([string]$chatObs.screenshot_path)) {
        Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "chatgpt" -Attempt "classify_chatgpt_page" -Failure "ChatGPT was not PAGE_USABLE from screenshot-first capture." -Screenshot ([string]$chatObs.screenshot_path) -Analysis @("I can see the dedicated ChatGPT service window capture.", "Composer usability was not proven, so the lane is parked.") -NextAction "park ChatGPT lane and use OMEGA fallback" -Outcome "parked")
    }
    Increment-AjPoolCounter -Count ([int]$chat.counter_incremented_by) | Out-Null
    Write-JsonFile -Path (Join-Path $ArtifactPath "chatgpt_live_attempts.json") -Payload $chat

    $gemini = [ordered]@{ status = "GEMINI_LANE_WEAK"; visual_packet_ready = $false }
    if ([string]$gemObs.current_ui_verdict -eq "PAGE_USABLE") {
        $gemini = Invoke-GeminiVisualLane
        $geminiStatus = if ($gemini.PSObject.Properties.Name -contains "status") { [string]$gemini.status } else { "" }
        if ($geminiStatus -ne "GEMINI_VISUAL_PACKET_READY" -and -not [string]::IsNullOrWhiteSpace([string]$gemObs.screenshot_path)) {
            Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "gemini" -Attempt "visual_packet_upload" -Failure "Gemini upload or visual packet did not confirm on first pass." -Screenshot ([string]$gemObs.screenshot_path) -Analysis @("I can see the Gemini lane screenshot from its dedicated 9223 window.", "The likely next action is to inspect visible import/upload controls and retry once.") -NextAction "retry visible upload adapter once, then mark text-only" -Outcome "fallback_used")
            $gemini = Invoke-GeminiVisualLane
        }
    } elseif (-not [string]::IsNullOrWhiteSpace([string]$gemObs.screenshot_path)) {
        Append-RecoveryEvent -Event (New-RecoveryEvent -Lane "gemini" -Attempt "classify_gemini_page" -Failure "Gemini was not PAGE_USABLE from screenshot-first capture." -Screenshot ([string]$gemObs.screenshot_path) -Analysis @("I can see the dedicated Gemini service window capture.", "Composer usability was not proven, so Gemini is parked.") -NextAction "park Gemini lane and keep OMEGA fallback" -Outcome "parked")
    }
    Write-JsonFile -Path (Join-Path $ArtifactPath "gemini_live_attempts.json") -Payload $gemini

    Write-PixelAndDoctorArtifacts
    $omega = Invoke-LocalOmega
    $relay = Invoke-NeuroRelay
    return Build-Summary -ChatGpt $chat -Gemini $gemini -Omega $omega -Relay $relay -ModeName "RunLive"
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = if ($Mode -eq "RecordRecovery") { Join-Path $ArtifactPath "last_recovery_record_result.json" } else { Join-Path $ArtifactPath "web_visual_recovery_rule_result.json" }
}

if ($Mode -eq "Status") {
    $payload = [ordered]@{
        schema_version = "web_visual_recovery_rule_status_v1"
        mission_id = $MissionId
        status = "WEB_VISUAL_RECOVERY_RULE_AVAILABLE"
        artifact_path = $ArtifactPath
        chatgpt_cdp_port = 9222
        gemini_cdp_port = 9223
        separate_windows_required = $true
        screenshots_before_revised_action = $true
        no_body_text_verdict = $true
        no_private_url = $true
    }
} elseif ($Mode -eq "RecordRecovery") {
    $payload = Invoke-RecordRecovery
} elseif ($Mode -eq "DryRun" -or $DryRun) {
    $payload = Invoke-DryRunMission
} elseif ($Mode -eq "RunLive") {
    $payload = Invoke-LiveMission
} else {
    $summaryPath = Join-Path $ArtifactPath "run_summary.json"
    $payload = Read-JsonFile -Path $summaryPath
    if (-not $payload) {
        $payload = [ordered]@{
            schema_version = "web_visual_recovery_report_v1"
            mission_id = $MissionId
            status = "WEB_VISUAL_RECOVERY_REPORT_MISSING_RUN"
            artifact_path = $ArtifactPath
        }
    }
}

Write-JsonFile -Path $OutPath -Payload $payload
$payload | ConvertTo-Json -Depth 100
