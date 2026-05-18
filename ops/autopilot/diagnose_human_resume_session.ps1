param(
  [string]$ServiceName = "ChatGPT",
  [string]$MissionId = "A20AD_HUMAN_RESUME_SESSION_DIAGNOSTIC",
  [string]$OutPath = "",
  [string]$ArtifactPath = "",
  [string]$CdpEndpoint = "http://127.0.0.1:9222",
  [string]$BrowserProfileName = "unknown",
  [string]$FixtureStatePath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $dir = Split-Path -Parent $Path
  if ($dir) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $Value | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding UTF8
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
  $fallbackDir = if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    Join-Path (Get-Location) "ops\autopilot\runtime"
  } else {
    $ArtifactPath
  }
  $OutPath = Join-Path $fallbackDir "human_resume_session_snapshot.json"
}

if (-not [string]::IsNullOrWhiteSpace($FixtureStatePath)) {
  $fixture = Get-Content -Raw -Path $FixtureStatePath | ConvertFrom-Json
  $fixture | Add-Member -NotePropertyName schema_version -NotePropertyValue "human_resume_session_diagnostic_v1" -Force
  $fixture | Add-Member -NotePropertyName fixture_mode -NotePropertyValue $true -Force
  $fixture | Add-Member -NotePropertyName generated_at -NotePropertyValue ([DateTime]::UtcNow.ToString("o")) -Force
  Write-JsonFile -Value $fixture -Path $OutPath
  Write-Output "HUMAN_RESUME_SESSION_SNAPSHOT_WRITTEN"
  exit 0
}

$logsDir = if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
  Join-Path (Split-Path -Parent $OutPath) "logs"
} else {
  Join-Path $ArtifactPath "logs"
}
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$probeScript = Join-Path $logsDir "human_resume_state_probe.mjs"

$probeSource = @'
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

const args = process.argv.slice(2);
function argValue(name, fallback = "") {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

const outPath = argValue("--out");
const endpoint = argValue("--endpoint", "http://127.0.0.1:9222");
const serviceName = argValue("--service", "ChatGPT");
const missionId = argValue("--mission", "A20AD_HUMAN_RESUME_SESSION_DIAGNOSTIC");
const browserProfileName = argValue("--profile", "unknown");

function hashSafe(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function classifyUrl(rawUrl) {
  if (!rawUrl) return "NO_URL";
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return "UNPARSEABLE_URL";
  }
  const host = url.hostname.toLowerCase();
  if (host.endsWith("chatgpt.com")) {
    if (url.pathname.includes("/g/") || url.pathname.includes("/project")) return "CHATGPT_PROJECT_CONVERSATION";
    if (url.pathname.includes("/c/")) return "CHATGPT_CONVERSATION";
    return "CHATGPT_PAGE";
  }
  if (host.endsWith("openai.com")) return "OPENAI_PAGE";
  return "NON_CHATGPT_PAGE";
}

function markerFlags(text) {
  const body = String(text || "").toLowerCase();
  const humanVerification =
    body.includes("verify you are human") ||
    body.includes("verification required") ||
    body.includes("checking your browser") ||
    body.includes("human verification") ||
    body.includes("i am human") ||
    body.includes("cloudflare") ||
    body.includes("captcha");
  const login =
    body.includes("log in") ||
    body.includes("login") ||
    body.includes("sign in") ||
    body.includes("sign up") ||
    body.includes("continue with google") ||
    body.includes("auth0") ||
    body.includes("authentication");
  const consent =
    body.includes("consent") ||
    body.includes("agree") ||
    body.includes("accept cookies") ||
    body.includes("privacy") ||
    body.includes("terms");
  return { humanVerification, login, consent };
}

async function visibleCount(locator) {
  const count = await locator.count().catch(() => 0);
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    if (await locator.nth(i).isVisible().catch(() => false)) visible += 1;
  }
  return { count, visible };
}

async function main() {
  const result = {
    schema_version: "human_resume_session_diagnostic_v1",
    generated_at: new Date().toISOString(),
    mission_id: missionId,
    service: serviceName,
    browser_profile_name: browserProfileName,
    cdp_endpoint_class: endpoint ? "LOCAL_CDP_ENDPOINT" : "NONE",
    url_redacted: true,
    secrets_read: false,
    cookies_read: false,
    local_storage_read: false,
    click_attempted: false,
    type_attempted: false,
    submit_attempted: false,
    upload_attempted: false,
    bypass_attempted: false,
    browser_reachable: false,
    cdp_attached: false,
    page_closed: true,
    page_count: 0,
    selected_page_index: null,
    selected_page_hash: null,
    selected_target_hash: null,
    page_title: null,
    url_class: "NO_PAGE",
    body_text_length: 0,
    composer_like_element_count: 0,
    composer_like_visible_count: 0,
    file_input_count: 0,
    image_accepting_file_input_count: 0,
    upload_button_candidate_count: 0,
    human_verification_detected: false,
    login_detected: false,
    consent_detected: false,
    auth_wall_detected: false,
    resume_ready: false,
    current_state: "UNKNOWN_STATE",
    error_class: null,
    error_message_redacted: null
  };

  let playwright;
  try {
    const candidates = ["playwright", "playwright-core", process.env.PLAYWRIGHT_NODE_MODULE].filter(Boolean);
    const bundledRuntimeNodeModules = process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules")
      : "";
    const nodeExecutableModuleRoot = path.resolve(path.dirname(process.execPath), "..", "node_modules");
    for (const candidate of candidates) {
      try {
        playwright = requireFromHere(candidate);
        break;
      } catch {
        // Try next lookup path.
      }
    }
    if (!playwright) {
      for (const moduleRoot of [
        ...(process.env.NODE_PATH || "").split(path.delimiter),
        nodeExecutableModuleRoot,
        bundledRuntimeNodeModules
      ].filter(Boolean)) {
        try {
          playwright = requireFromHere(path.join(moduleRoot, "playwright"));
          break;
        } catch {
          // Try pnpm layout below.
        }
        const pnpmRoot = path.join(moduleRoot, ".pnpm");
        if (fs.existsSync(pnpmRoot)) {
          for (const entry of fs.readdirSync(pnpmRoot).filter((item) => /^playwright@/.test(item)).sort().reverse()) {
            try {
              playwright = requireFromHere(path.join(pnpmRoot, entry, "node_modules", "playwright"));
              break;
            } catch {
              // Try next candidate.
            }
          }
        }
        if (playwright) break;
      }
    }
    if (!playwright) throw new Error("Cannot load Playwright.");
  } catch (error) {
    result.error_class = "PLAYWRIGHT_UNAVAILABLE";
    result.error_message_redacted = error?.name || "Error";
    result.current_state = "UNKNOWN_STATE";
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(2);
  }

  let browser = null;
  try {
    browser = await playwright.chromium.connectOverCDP(endpoint, { timeout: 7000 });
    result.browser_reachable = true;
    result.cdp_attached = true;
    const contexts = browser.contexts();
    const pages = contexts.flatMap((context) => context.pages());
    result.page_count = pages.length;

    let selected = null;
    let selectedIndex = -1;
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      const urlClass = classifyUrl(page.url());
      if (urlClass.startsWith("CHATGPT")) {
        selected = page;
        selectedIndex = i;
        if (urlClass === "CHATGPT_PROJECT_CONVERSATION" || urlClass === "CHATGPT_CONVERSATION") break;
      }
    }
    if (!selected && pages.length > 0) {
      selected = pages[0];
      selectedIndex = 0;
    }

    if (!selected) {
      result.page_closed = true;
      result.current_state = "SESSION_CLOSED";
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      return;
    }

    result.page_closed = selected.isClosed();
    result.selected_page_index = selectedIndex;
    result.selected_page_hash = hashSafe(selected.url());
    result.url_class = classifyUrl(selected.url());
    result.page_title = await selected.title().catch(() => null);
    result.selected_target_hash = hashSafe(`${result.page_title}|${selected.url()}|${selectedIndex}`);

    const bodyText = await selected.locator("body").textContent({ timeout: 2000 }).catch(() => "");
    result.body_text_length = String(bodyText || "").length;
    const flags = markerFlags(bodyText);
    result.human_verification_detected = flags.humanVerification;
    result.login_detected = flags.login;
    result.consent_detected = flags.consent;
    result.auth_wall_detected = flags.humanVerification || flags.login || flags.consent;

    const composer = selected.locator('textarea, div[contenteditable="true"], [data-testid*="composer"], [placeholder*="Message"], [aria-label*="Message"], [aria-label*="message"]');
    const composerCounts = await visibleCount(composer);
    result.composer_like_element_count = composerCounts.count;
    result.composer_like_visible_count = composerCounts.visible;

    const fileInputs = selected.locator('input[type="file"]');
    result.file_input_count = await fileInputs.count().catch(() => 0);
    let imageAccepting = 0;
    for (let i = 0; i < result.file_input_count; i += 1) {
      const accept = await fileInputs.nth(i).getAttribute("accept").catch(() => "");
      if (!accept || /image|\*\/\*/i.test(accept)) imageAccepting += 1;
    }
    result.image_accepting_file_input_count = imageAccepting;

    const uploadButtons = selected.locator('[aria-label*="attach" i], [aria-label*="upload" i], [title*="attach" i], [title*="upload" i], button:has-text("Attach"), button:has-text("Upload")');
    result.upload_button_candidate_count = await uploadButtons.count().catch(() => 0);

    result.resume_ready =
      result.url_class.startsWith("CHATGPT") &&
      !result.auth_wall_detected &&
      result.composer_like_visible_count > 0;

    if (result.resume_ready) {
      result.current_state = "RESUME_READY";
    } else if (result.auth_wall_detected) {
      result.current_state = "HUMAN_OR_AUTH_WALL";
    } else if (!result.url_class.startsWith("CHATGPT")) {
      result.current_state = "WRONG_PAGE_OR_PROFILE";
    } else {
      result.current_state = "UNKNOWN_STATE";
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  } catch (error) {
    result.error_class = error?.name || "CDP_PROBE_ERROR";
    result.error_message_redacted = String(error?.message || "probe failed").replace(/https?:\/\/\S+/g, "[redacted-url]");
    result.current_state = result.browser_reachable ? "UNKNOWN_STATE" : "SESSION_CLOSED";
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    // Do not close user-owned Chrome. Let the Node process exit and drop the
    // CDP client connection without sending any browser close instruction.
    process.exit(3);
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(3));
'@

Set-Content -Path $probeScript -Value $probeSource -Encoding UTF8

$node = "node"
$nodeArgs = @(
  $probeScript,
  "--out", $OutPath,
  "--endpoint", $CdpEndpoint,
  "--service", $ServiceName,
  "--mission", $MissionId,
  "--profile", $BrowserProfileName
)

& $node @nodeArgs | Out-Null
$exitCode = $LASTEXITCODE

if (-not (Test-Path -Path $OutPath)) {
  $fallback = [ordered]@{
    schema_version = "human_resume_session_diagnostic_v1"
    generated_at = [DateTime]::UtcNow.ToString("o")
    mission_id = $MissionId
    service = $ServiceName
    browser_profile_name = $BrowserProfileName
    browser_reachable = $false
    cdp_attached = $false
    page_closed = $true
    current_state = "SESSION_CLOSED"
    secrets_read = $false
    cookies_read = $false
    local_storage_read = $false
    click_attempted = $false
    type_attempted = $false
    submit_attempted = $false
    upload_attempted = $false
    bypass_attempted = $false
    error_class = "SNAPSHOT_NOT_WRITTEN"
  }
  Write-JsonFile -Value $fallback -Path $OutPath
}

if ($exitCode -ne 0) {
  Write-Output "HUMAN_RESUME_SESSION_SNAPSHOT_WRITTEN_WITH_ERRORS"
  exit $exitCode
}

Write-Output "HUMAN_RESUME_SESSION_SNAPSHOT_WRITTEN"
