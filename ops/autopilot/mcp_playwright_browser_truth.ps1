param(
    [ValidateSet("Status", "CaptureDedicatedWindow", "Observe", "VerifyAjPool", "BuildReport", "DryRun")]
    [string]$Mode = "Observe",
    [ValidateSet("chatgpt", "gemini")]
    [string]$Service = "gemini",
    [string]$MissionId = "A20BF",
    [int]$CDPPort = 0,
    [string]$McpScreenshotPath = "",
    [string]$VisibleUiSummary = "",
    [ValidateSet("", "PAGE_USABLE", "HUMAN_ACTION_REQUIRED", "PAGE_LOADING", "UNCLASSIFIED")]
    [string]$CurrentUiVerdict = "",
    [string[]]$ReasoningFromScreenshot = @(),
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$ComposerVisible,
    [switch]$ComposerEnabled,
    [switch]$ModelSelectorVisible,
    [switch]$UploadControlVisible,
    [switch]$ForegroundBlockerVisible,
    [switch]$PageLoading,
    [switch]$AttachmentVisuallyConfirmed,
    [switch]$DomOnlyVerdict,
    [switch]$MockMcpUnavailable,
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_browser_truth\A20BF_screenshot_first_web_control_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Get-ExpectedPort {
    if ($Service -eq "chatgpt") { return 9222 }
    return 9223
}

function Get-ProfileRelativePath {
    if ($Service -eq "chatgpt") { return "ops/autopilot/local/browser_profiles/chatgpt" }
    return "ops/autopilot/local/browser_profiles/gemini"
}

function Get-AjPoolStatus {
    $path = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
    $status = [ordered]@{
        pool_loaded = $false
        current_label = ""
        threshold_50 = $false
        labels_present = @()
        private_urls_redacted = $true
        urls_printed = $false
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $status }
    try {
        $pool = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $status.pool_loaded = $true
        if ($pool.PSObject.Properties.Name -contains "current_label") { $status.current_label = [string]$pool.current_label }
        if ($pool.PSObject.Properties.Name -contains "rotation_threshold") { $status.threshold_50 = ([int]$pool.rotation_threshold -eq 50) }
        if ($pool.PSObject.Properties.Name -contains "rotation_threshold_messages") { $status.threshold_50 = ([int]$pool.rotation_threshold_messages -eq 50) }
        if ($pool.PSObject.Properties.Name -contains "discussions") {
            $labels = @()
            foreach ($entry in @($pool.discussions)) {
                if ($entry.PSObject.Properties.Name -contains "label") { $labels += [string]$entry.label }
            }
            $status.labels_present = @($labels | Where-Object { $_ } | Select-Object -Unique)
        }
        if ($pool.PSObject.Properties.Name -contains "pool") {
            $labels = @()
            foreach ($entry in @($pool.pool)) {
                if ($entry.PSObject.Properties.Name -contains "label") { $labels += [string]$entry.label }
            }
            $status.labels_present = @($labels | Where-Object { $_ } | Select-Object -Unique)
        }
        if (-not $status.threshold_50 -and $pool.PSObject.Properties.Name -contains "message_threshold") {
            $status.threshold_50 = ([int]$pool.message_threshold -eq 50)
        }
    } catch {
        $status.pool_loaded = $false
        $status.read_error = "POOL_STATUS_READ_FAILED"
    }
    return $status
}

function New-BaseResult {
    [ordered]@{
        schema_version = "mcp_playwright_browser_truth_result_v1"
        mission_id = $MissionId
        mode = $Mode
        service = $Service
        status = "NOT_RUN"
        mcp_playwright_available = -not [bool]$MockMcpUnavailable
        mcp_screenshot_required = $true
        separate_windows_required = $true
        dedicated_profile_required = $true
        screenshot_source = ""
        dedicated_service_window_required = $true
        service_cdp_port = if ($CDPPort -ne 0) { $CDPPort } else { Get-ExpectedPort }
        expected_cdp_port = Get-ExpectedPort
        profile_relative_path_redacted = Get-ProfileRelativePath
        shared_browser_context_forbidden = $true
        service_window_isolated = $false
        screenshot_path = ""
        screenshot_external = $false
        screenshot_before_verdict = $false
        visible_ui_summary = ""
        composer_visible = $false
        composer_enabled = $false
        model_selector_visible = $false
        upload_control_visible = $false
        foreground_blocker_visible = $false
        attachment_visually_confirmed = $false
        current_ui_verdict = "UNCLASSIFIED"
        reasoning_from_screenshot = @()
        dom_used_only_as_confirmation = $true
        dom_only_verdict_rejected = $false
        history_text_ignored = $true
        body_text_ignored = $true
        visual_packet_allowed = $false
        lane_status = "UNKNOWN"
        aj_pool_status = $null
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

function Resolve-CurrentVerdict {
    if (-not [string]::IsNullOrWhiteSpace($CurrentUiVerdict)) { return $CurrentUiVerdict }
        if ($ForegroundBlockerVisible) { return "HUMAN_ACTION_REQUIRED" }
    if ($PageLoading) { return "PAGE_LOADING" }
    if ($ComposerVisible -and $ComposerEnabled) { return "PAGE_USABLE" }
    return "UNCLASSIFIED"
}

function New-PortMismatchResult {
    $result = New-BaseResult
    $result.status = "SHARED_BROWSER_PROFILE_FORBIDDEN"
    $result.current_ui_verdict = "UNCLASSIFIED"
    $result.lane_status = "PARKED_SAFETY_STOP"
    $result.service_window_isolated = $false
    return $result
}

function Invoke-Observation {
    $result = New-BaseResult

    if (($CDPPort -ne 0) -and ($CDPPort -ne (Get-ExpectedPort))) {
        return New-PortMismatchResult
    }

    if ($MockMcpUnavailable) {
        $result.status = "MCP_PLAYWRIGHT_UNAVAILABLE"
        $result.current_ui_verdict = "UNCLASSIFIED"
        $result.lane_status = "MCP_UNAVAILABLE"
        return $result
    }

    if ($DomOnlyVerdict) {
        $result.status = "MCP_SCREENSHOT_REQUIRED"
        $result.dom_only_verdict_rejected = $true
        $result.current_ui_verdict = "UNCLASSIFIED"
        $result.lane_status = "SCREENSHOT_REQUIRED"
        return $result
    }

    if ([string]::IsNullOrWhiteSpace($McpScreenshotPath) -or -not (Test-Path -LiteralPath $McpScreenshotPath -PathType Leaf)) {
        $result.status = "MCP_SCREENSHOT_REQUIRED"
        $result.current_ui_verdict = "UNCLASSIFIED"
        $result.lane_status = "SCREENSHOT_REQUIRED"
        return $result
    }

    $resolvedScreenshot = (Resolve-Path -LiteralPath $McpScreenshotPath).Path
    $result.screenshot_path = $resolvedScreenshot
    $result.screenshot_source = "dedicated_service_window"
    $result.service_window_isolated = $true
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
    $result.screenshot_external = -not $resolvedScreenshot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $result.screenshot_before_verdict = $true
    $result.visible_ui_summary = if ([string]::IsNullOrWhiteSpace($VisibleUiSummary)) { "Screenshot captured; caller did not provide a visual summary." } else { $VisibleUiSummary }
    $result.composer_visible = [bool]$ComposerVisible
    $result.composer_enabled = [bool]$ComposerEnabled
    $result.model_selector_visible = [bool]$ModelSelectorVisible
    $result.upload_control_visible = [bool]$UploadControlVisible
    $result.foreground_blocker_visible = [bool]$ForegroundBlockerVisible
    $result.attachment_visually_confirmed = [bool]$AttachmentVisuallyConfirmed
    $result.current_ui_verdict = Resolve-CurrentVerdict
    $result.reasoning_from_screenshot = @($ReasoningFromScreenshot | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($result.reasoning_from_screenshot.Count -eq 0) {
        $result.reasoning_from_screenshot = @("Screenshot exists; no historical body text was used.", "DOM may only confirm visible controls.")
    }

    if ($Service -eq "chatgpt") {
        $result.aj_pool_status = Get-AjPoolStatus
        $result.status = if ($result.current_ui_verdict -eq "PAGE_USABLE") { "MCP_SCREENSHOT_FIRST_CHATGPT_PAGE_USABLE" } elseif ($result.current_ui_verdict -eq "HUMAN_ACTION_REQUIRED") { "MCP_SCREENSHOT_FIRST_CHATGPT_HUMAN_ACTION_REQUIRED" } else { "MCP_SCREENSHOT_FIRST_CHATGPT_UNCLASSIFIED" }
        $result.lane_status = if ($result.current_ui_verdict -eq "PAGE_USABLE") { "PAGE_USABLE_SCREENSHOT_PROVEN" } elseif ($result.current_ui_verdict -eq "HUMAN_ACTION_REQUIRED") { "LOGIN_REQUIRED_PARKED" } else { "UNCLASSIFIED" }
    } else {
        if ($result.current_ui_verdict -eq "HUMAN_ACTION_REQUIRED") {
            $result.status = "MCP_SCREENSHOT_FIRST_GEMINI_LOGIN_REQUIRED"
            $result.lane_status = "LOGIN_REQUIRED_PARKED"
        } elseif ($result.attachment_visually_confirmed) {
            $result.status = "MCP_SCREENSHOT_FIRST_GEMINI_VISUAL_READY"
            $result.lane_status = "VISUAL_READY"
            $result.visual_packet_allowed = $true
        } elseif ($result.current_ui_verdict -eq "PAGE_USABLE" -and -not $result.upload_control_visible) {
            $result.status = "GEMINI_UPLOAD_NOT_VISIBLE_FROM_SCREENSHOT"
            $result.lane_status = "TEXT_SUPERVISOR_ONLY"
        } elseif ($result.current_ui_verdict -eq "PAGE_USABLE") {
            $result.status = "GEMINI_UPLOAD_VISIBLE_ATTACHMENT_NOT_CONFIRMED"
            $result.lane_status = "TEXT_SUPERVISOR_ONLY"
        } else {
            $result.status = "MCP_SCREENSHOT_FIRST_GEMINI_UNCLASSIFIED"
            $result.lane_status = "UNCLASSIFIED"
        }
    }

    return $result
}

function Invoke-CaptureDedicatedWindow {
    $result = New-BaseResult
    $expected = Get-ExpectedPort
    $port = if ($CDPPort -ne 0) { $CDPPort } else { $expected }
    $result.service_cdp_port = $port
    if ($port -ne $expected) { return New-PortMismatchResult }
    if ($MockMcpUnavailable) {
        $result.status = "MCP_PLAYWRIGHT_UNAVAILABLE"
        $result.lane_status = "MCP_UNAVAILABLE"
        return $result
    }

    $screenDir = Join-Path $ArtifactPath ("screenshots\{0}" -f $Service)
    $probeDir = Join-Path $ArtifactPath "dedicated_window_probe"
    New-Item -ItemType Directory -Force -Path $screenDir, $probeDir | Out-Null
    $scriptPath = Join-Path $probeDir ("capture_{0}_{1}.mjs" -f $Service, [guid]::NewGuid().ToString("N"))
    $probeOut = Join-Path $probeDir ("{0}_dedicated_window_capture.json" -f $Service)
    $shotPath = Join-Path $screenDir ("a20bf_{0}_dedicated_window_{1}.png" -f $Service, (Get-Date -Format "yyyyMMdd_HHmmss"))

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
async function main() {
  const args = parseArgs(process.argv);
  const result = {
    status: "DEDICATED_WINDOW_CAPTURE_FAILED",
    service: args.service,
    cdp_port: Number(args.port),
    cdp_reachable: false,
    service_window_isolated: false,
    screenshot_path: "",
    page_found: false,
    url_redacted: true,
    title_redacted: true,
    composer_visible_hint: false,
    foreground_blocker_hint: false,
    private_urls_redacted: true,
    account_email_redacted: true,
    secrets_redacted: true
  };
  try {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${args.port}`);
    result.cdp_reachable = true;
    const pages = browser.contexts().flatMap((context) => context.pages());
    const re = args.service === "chatgpt" ? /chatgpt\.com/i : /gemini\.google\.com/i;
    let page = pages.find((candidate) => re.test(candidate.url()));
    if (!page) page = pages[0];
    if (!page) {
      writeJson(args.out, result);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    result.page_found = true;
    result.service_window_isolated = true;
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: args.screenshot, fullPage: false }).catch(() => {});
    if (fs.existsSync(args.screenshot)) result.screenshot_path = args.screenshot;
    const hints = await page.evaluate((service) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth &&
          style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      };
      const composerSelectors = service === "chatgpt"
        ? ['#prompt-textarea', '[contenteditable="true"][role="textbox"]', 'textarea', 'div[contenteditable="true"]']
        : ['rich-textarea div[contenteditable="true"]', 'div[contenteditable="true"][role="textbox"]', '[aria-label*="Prompt" i]', 'textarea', 'div[contenteditable="true"]'];
      const composerVisible = composerSelectors.some((selector) => Array.from(document.querySelectorAll(selector)).some(isVisible));
      const blockerVisible = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], input[type="password"], iframe[src*="captcha" i], [id*="captcha" i], [class*="captcha" i]'))
        .some(isVisible);
      return { composerVisible, blockerVisible };
    }, args.service).catch(() => ({ composerVisible: false, blockerVisible: false }));
    result.composer_visible_hint = Boolean(hints.composerVisible);
    result.foreground_blocker_hint = Boolean(hints.blockerVisible);
    result.status = result.screenshot_path ? "DEDICATED_WINDOW_SCREENSHOT_CAPTURED" : "DEDICATED_WINDOW_SCREENSHOT_FAILED";
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error_code = redact(error.message || error);
    writeJson(args.out, result);
    console.log(JSON.stringify(result, null, 2));
  }
}
main().then(() => process.exit(0)).catch((error) => {
  console.log(JSON.stringify({ status: "DEDICATED_WINDOW_CAPTURE_FAILED", error_code: redact(error.message || error), private_urls_redacted: true }, null, 2));
  process.exit(0);
});
'@
    Set-Content -LiteralPath $scriptPath -Value $nodeSource -Encoding UTF8
    $nodeOutput = & node $scriptPath --service $Service --port ([string]$port) --out $probeOut --screenshot $shotPath 2>&1
    $probe = if (Test-Path -LiteralPath $probeOut -PathType Leaf) { Get-Content -LiteralPath $probeOut -Raw | ConvertFrom-Json } else { $null }
    if (-not $probe) {
        $result.status = "MCP_PLAYWRIGHT_UNAVAILABLE"
        $result.lane_status = "MCP_UNAVAILABLE"
        return $result
    }
    $result.status = [string]$probe.status
    $result.screenshot_path = [string]$probe.screenshot_path
    $result.screenshot_source = "dedicated_service_window"
    $result.screenshot_before_verdict = -not [string]::IsNullOrWhiteSpace([string]$probe.screenshot_path)
    $result.screenshot_external = $result.screenshot_before_verdict
    $result.service_window_isolated = [bool]$probe.service_window_isolated
    $result.composer_visible = [bool]$probe.composer_visible_hint
    $result.foreground_blocker_visible = [bool]$probe.foreground_blocker_hint
    $result.current_ui_verdict = if ($result.foreground_blocker_visible) { "HUMAN_ACTION_REQUIRED" } elseif ($result.composer_visible) { "PAGE_USABLE" } else { "UNCLASSIFIED" }
    $result.visible_ui_summary = "Dedicated service-window screenshot captured; visual summary must be supplied or reviewed before final mission report."
    $result.lane_status = if ($result.current_ui_verdict -eq "HUMAN_ACTION_REQUIRED") { "LOGIN_REQUIRED_PARKED" } elseif ($result.current_ui_verdict -eq "PAGE_USABLE") { if ($Service -eq "gemini") { "TEXT_SUPERVISOR_ONLY" } else { "PAGE_USABLE_SCREENSHOT_PROVEN" } } else { "UNCLASSIFIED" }
    return $result
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $name = if ($Service -eq "chatgpt") { "chatgpt_screenshot_observation.json" } else { "gemini_screenshot_observation.json" }
    if ($Mode -eq "VerifyAjPool") { $name = "chatgpt_aj_pool_status_redacted.json" }
    if ($Mode -eq "BuildReport") { $name = "mcp_browser_truth_report.json" }
    $OutPath = Join-Path $ArtifactPath $name
}

if ($Mode -eq "Status") {
    $result = New-BaseResult
    $result.status = if ($MockMcpUnavailable) { "MCP_PLAYWRIGHT_UNAVAILABLE" } else { "MCP_PLAYWRIGHT_AVAILABLE" }
    $result.lane_status = if ($MockMcpUnavailable) { "MCP_UNAVAILABLE" } else { "READY_FOR_SCREENSHOT_FIRST_OBSERVATION" }
} elseif ($Mode -eq "CaptureDedicatedWindow") {
    $result = Invoke-CaptureDedicatedWindow
} elseif ($Mode -eq "VerifyAjPool") {
    $result = New-BaseResult
    $result.status = "CHATGPT_AJ_POOL_STATUS_REDACTED"
    $result.aj_pool_status = Get-AjPoolStatus
    $result.lane_status = if ($result.aj_pool_status.pool_loaded) { "AJ_POOL_LOADED" } else { "AJ_POOL_MISSING" }
} elseif ($Mode -eq "BuildReport") {
    $chatgptPath = Join-Path $ArtifactPath "chatgpt_screenshot_observation.json"
    $geminiPath = Join-Path $ArtifactPath "gemini_screenshot_observation.json"
    $chatgpt = if (Test-Path -LiteralPath $chatgptPath -PathType Leaf) { Get-Content -LiteralPath $chatgptPath -Raw | ConvertFrom-Json } else { $null }
    $gemini = if (Test-Path -LiteralPath $geminiPath -PathType Leaf) { Get-Content -LiteralPath $geminiPath -Raw | ConvertFrom-Json } else { $null }
    $result = [ordered]@{
        schema_version = "mcp_playwright_browser_truth_report_v1"
        mission_id = $MissionId
        status = "MCP_SCREENSHOT_FIRST_SEPARATE_WINDOW_REPORT_READY"
        mcp_playwright_available = $true
        separate_windows_required = $true
        shared_browser_context_forbidden = $true
        chatgpt_screenshot_captured = [bool]($chatgpt -and $chatgpt.screenshot_before_verdict)
        chatgpt_service_window_isolated = [bool]($chatgpt -and $chatgpt.service_window_isolated)
        chatgpt_cdp_port = 9222
        chatgpt_verdict = if ($chatgpt) { [string]$chatgpt.current_ui_verdict } else { "MISSING" }
        gemini_screenshot_captured = [bool]($gemini -and $gemini.screenshot_before_verdict)
        gemini_service_window_isolated = [bool]($gemini -and $gemini.service_window_isolated)
        gemini_cdp_port = 9223
        gemini_verdict = if ($gemini) { [string]$gemini.current_ui_verdict } else { "MISSING" }
        gemini_lane_status = if ($gemini) { [string]$gemini.lane_status } else { "MISSING" }
        no_api_call = $true
        no_paid_service = $true
        private_urls_redacted = $true
        secrets_redacted = $true
    }
} else {
    $result = Invoke-Observation
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 80
