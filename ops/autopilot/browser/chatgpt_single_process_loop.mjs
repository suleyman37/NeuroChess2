import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function normalizeUrlForCompare(value) {
  return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

function conversationIdFromUrl(value) {
  const match = String(value || "").match(/\/c\/([^/?#]+)/);
  return match ? match[1] : "";
}

function isAcceptedActiveProjectSessionUrl(value) {
  const text = String(value || "");
  return /^https:\/\/chatgpt\.com\//.test(text) &&
    text.includes("g-p-6a07c20c139c8191a0d8972fc7b7019e-neurochess-supervisor") &&
    /\/c\/[^/?#]+/.test(text);
}

function ensureProjectConfig(config) {
  if (!config.chatgpt_project || typeof config.chatgpt_project !== "object") {
    config.chatgpt_project = {};
  }
  return config.chatgpt_project;
}

function applyProjectUrl(config, projectUrl, source) {
  if (!String(projectUrl || "").trim()) return source;
  ensureProjectConfig(config).project_url = String(projectUrl).trim();
  return source;
}

function applyActiveSessionUrl(config, sessionUrl, source) {
  if (!String(sessionUrl || "").trim()) return source;
  ensureProjectConfig(config).active_session_url = String(sessionUrl).trim();
  return source;
}

function loadEffectiveConfig(configPath) {
  const config = readJson(configPath);
  const projectConfig = ensureProjectConfig(config);
  let projectUrlSource = String(projectConfig.project_url || "").trim() ? "tracked" : "none";
  let activeSessionUrlSource = String(projectConfig.active_session_url || "").trim() ? "tracked" : "none";

  if (process.env.NEUROCHESS_CHATGPT_PROJECT_URL) {
    projectUrlSource = applyProjectUrl(config, process.env.NEUROCHESS_CHATGPT_PROJECT_URL, "environment");
  }

  const localConfigPath = path.join(path.dirname(configPath), "local", "chatgpt_project.local.json");
  if (fs.existsSync(localConfigPath)) {
    const localConfig = readJson(localConfigPath);
    const localUrl = localConfig?.chatgpt_project?.project_url;
    if (String(localUrl || "").trim()) {
      projectUrlSource = applyProjectUrl(config, localUrl, "local");
    }
  }

  const localSessionPath = path.join(path.dirname(configPath), "local", "chatgpt_sessions.local.json");
  if (fs.existsSync(localSessionPath)) {
    const localSession = readJson(localSessionPath);
    const localSessionUrl = localSession?.active_session_url;
    if (String(localSessionUrl || "").trim()) {
      activeSessionUrlSource = applyActiveSessionUrl(config, localSessionUrl, "local_session");
    }
  }

  config.__chatgpt_project_url_source = projectUrlSource;
  config.__chatgpt_active_session_url_source = activeSessionUrlSource;
  return config;
}

function loadLocalSession(configPath) {
  const sessionPath = path.join(path.dirname(configPath), "local", "chatgpt_sessions.local.json");
  if (!fs.existsSync(sessionPath)) return { sessionPath, session: null };
  return { sessionPath, session: readJson(sessionPath) };
}

function updateLocalSession(configPath, updates) {
  const { sessionPath, session } = loadLocalSession(configPath);
  if (!session) return { updated: false, sessionPath };
  write(sessionPath, JSON.stringify({ ...session, ...updates }, null, 2));
  return { updated: true, sessionPath };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Continue to the explicit runtime paths below.
  }

  try {
    return requireFromHere("playwright");
  } catch {
    // Continue to explicit runtime path probing.
  }

  const bundledRuntimeNodeModules = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules")
    : "";
  const nodeExecutableModuleRoot = path.resolve(path.dirname(process.execPath), "..", "node_modules");
  const searchPaths = [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    nodeExecutableModuleRoot,
    bundledRuntimeNodeModules
  ].filter(Boolean);

  for (const moduleRoot of searchPaths) {
    try {
      return requireFromHere(path.join(moduleRoot, "playwright"));
    } catch {
      // Try next.
    }

    const pnpmRoot = path.join(moduleRoot, ".pnpm");
    if (fs.existsSync(pnpmRoot)) {
      const playwrightDirs = fs.readdirSync(pnpmRoot).filter((entry) => /^playwright@/.test(entry)).sort().reverse();
      for (const entry of playwrightDirs) {
        try {
          return requireFromHere(path.join(pnpmRoot, entry, "node_modules", "playwright"));
        } catch {
          // Try next.
        }
      }
    }
  }

  throw new Error("Cannot load Playwright. Set NODE_PATH to a node_modules directory containing playwright.");
}

function detectLoadingOrInterstitial(title, pageText) {
  const text = `${title || ""}\n${pageText || ""}`;
  return /un instant|just a moment|one moment|checking your browser|v[\u00e9e]rification|chargement|loading|cloudflare|enable javascript|patientez/i.test(text);
}

function detectHumanVerification(title, pageText) {
  const text = `${title || ""}\n${pageText || ""}`;
  return /je\s+suis\s+humain|i\s+am\s+human|verify\s+you\s+are\s+human|human\s+verification|captcha|challenge|checking\s+your\s+browser|v[\u00e9e]rification\s+humaine|cloudflare/i.test(text);
}

async function countComposerLikeElements(page) {
  return await page.locator(
    '[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea'
  ).count().catch(() => 0);
}

async function stopIndicatorCount(page) {
  return await page.locator('button[aria-label*="Stop" i], button[aria-label*="Arr" i], button[data-testid*="stop" i]').count().catch(() => 0);
}

function classifyAvailability(diagnostics) {
  if (!diagnostics.projectContextVerified) {
    return { availability: "WRONG_PROJECT_OR_CONTEXT", ready: false, stopReason: "STOP_WRONG_CHATGPT_PROJECT_CONTEXT" };
  }
  if (diagnostics.humanVerificationDetected) {
    return { availability: "HUMAN_VERIFICATION_REQUIRED", ready: false, stopReason: "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" };
  }
  if (diagnostics.loadingOrInterstitialDetected && diagnostics.composerLikeElementCount <= 0) {
    return { availability: "LOADING_INTERSTITIAL", ready: false, stopReason: "STOP_PROJECT_LOADING_INTERSTITIAL" };
  }
  if (diagnostics.composerLikeElementCount <= 0) {
    return { availability: "COMPOSER_NOT_FOUND", ready: false, stopReason: "STOP_COMPOSER_NOT_FOUND" };
  }
  if (diagnostics.stopIndicatorCount > 0) {
    return { availability: "RESPONSE_IN_PROGRESS", ready: false, stopReason: "STOP_TRANSPORT_RESPONSE_NOT_STABLE" };
  }
  return { availability: "READY", ready: true, stopReason: "" };
}

async function collectPageDiagnostics(page, projectConfig, targetUrl) {
  const projectName = projectConfig.project_name || "NeuroChess Supervisor";
  const currentUrl = page.url();
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").textContent({ timeout: 5000 }).catch(() => "");
  const pageText = bodyText || "";
  const normalizedCurrent = normalizeUrlForCompare(currentUrl);
  const normalizedTarget = normalizeUrlForCompare(targetUrl);
  const projectNameVisible = pageText.includes(projectName) || title.includes(projectName);
  const projectUrlStable = Boolean(normalizedTarget && normalizedCurrent.startsWith(normalizedTarget));
  const diagnostics = {
    currentUrl,
    title,
    bodyTextLength: pageText.length,
    projectName,
    projectNameVisible,
    projectUrlStable,
    projectContextVerified: Boolean(projectNameVisible || projectUrlStable),
    humanVerificationDetected: detectHumanVerification(title, pageText),
    loadingOrInterstitialDetected: detectLoadingOrInterstitial(title, pageText),
    composerLikeElementCount: await countComposerLikeElements(page),
    stopIndicatorCount: await stopIndicatorCount(page)
  };
  return { ...diagnostics, ...classifyAvailability(diagnostics) };
}

async function saveSanitizedDomSummary(page, outDir, name) {
  const summary = await page.evaluate(() => Array.from(document.querySelectorAll("main, header, nav, [role], button, textarea, [contenteditable], input"))
    .slice(0, 100)
    .map((element) => ({
      tagName: element.tagName,
      idPresent: Boolean(element.id),
      classPresent: Boolean(String(element.className || "").trim()),
      role: element.getAttribute("role") || "",
      ariaLabelPresent: Boolean(element.getAttribute("aria-label")),
      dataTestId: element.getAttribute("data-testid") || "",
      contentEditable: element.getAttribute("contenteditable") || "",
      textLength: String(element.innerText || element.textContent || "").length
    }))).catch((error) => ({ error: error.message }));
  write(path.join(outDir, name), JSON.stringify(summary, null, 2));
  return summary;
}

async function requireAvailability(page, projectConfig, targetUrl, outDir, label, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 30000);
  const deadline = Date.now() + timeoutMs;
  let latest = await collectPageDiagnostics(page, projectConfig, targetUrl);
  while (Date.now() < deadline) {
    if (latest.availability === "READY") break;
    if (latest.availability === "HUMAN_VERIFICATION_REQUIRED" || latest.availability === "WRONG_PROJECT_OR_CONTEXT") break;
    await page.waitForTimeout(1000);
    latest = await collectPageDiagnostics(page, projectConfig, targetUrl);
  }
  write(path.join(outDir, `${label}_availability.json`), JSON.stringify(latest, null, 2));
  if (latest.availability !== "READY") {
    write(path.join(outDir, `${label}_current_url.txt`), latest.currentUrl || page.url());
    await saveSanitizedDomSummary(page, outDir, `${label}_sanitized_dom_summary.json`);
    await page.screenshot({ path: path.join(outDir, `${label}_blocked.png`), fullPage: true }).catch(() => {});
  }
  return latest;
}

async function describeLocator(locator, selector, index) {
  const dom = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName,
      role: element.getAttribute("role") || "",
      contentEditable: element.getAttribute("contenteditable") || "",
      isContentEditable: Boolean(element.isContentEditable),
      ariaHidden: element.getAttribute("aria-hidden") || "",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents
    };
  }).catch((error) => ({ error: error.message }));
  const visibleByPlaywright = await locator.isVisible().catch(() => false);
  const editableByPlaywright = await locator.isEditable().catch(() => false);
  const visibleByCss = Boolean(dom.rect && dom.rect.width > 20 && dom.rect.height > 20 && dom.display !== "none" && dom.visibility !== "hidden" && dom.opacity !== "0" && dom.ariaHidden !== "true");
  const isEditor = Boolean(dom.isContentEditable || dom.contentEditable === "true" || dom.role === "textbox" || dom.tagName === "TEXTAREA");
  const usable = Boolean(visibleByCss && visibleByPlaywright && isEditor && (editableByPlaywright || dom.isContentEditable));
  const score = (dom.isContentEditable ? 100 : 0) + (dom.role === "textbox" ? 20 : 0) + Math.min(20, Math.round(((dom.rect?.width || 0) * (dom.rect?.height || 0)) / 10000));
  return { selector, index, usable, visibleByPlaywright, editableByPlaywright, visibleByCss, score, ...dom };
}

async function findComposer(page, outDir) {
  const selectors = [
    '[data-testid="composer"] [contenteditable="true"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '#prompt-textarea[contenteditable="true"]',
    '#prompt-textarea',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[name="prompt-textarea"]',
    'textarea'
  ];
  const candidates = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      candidates.push(await describeLocator(locator.nth(index), selector, index));
    }
  }
  write(path.join(outDir, "composer_candidates.json"), JSON.stringify(candidates, null, 2));
  const chosen = candidates.filter((candidate) => candidate.usable).sort((a, b) => b.score - a.score)[0];
  if (!chosen) return null;
  write(path.join(outDir, "chosen_composer.json"), JSON.stringify(chosen, null, 2));
  const selected = page.locator(chosen.selector).nth(chosen.index);
  selected.__box = chosen.rect;
  return selected;
}

async function getComposerText(composer) {
  return await composer.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function clickComposer(page, composer) {
  const box = composer.__box || await composer.boundingBox().catch(() => null);
  if (!box) throw new Error("No visible composer box available.");
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const x = Math.min(Math.max(box.x + Math.min(box.width / 2, 80), 16), Math.max(16, viewport.width - 16));
  const y = Math.min(Math.max(box.y + Math.min(box.height / 2, 40), 16), Math.max(16, viewport.height - 16));
  await page.mouse.click(x, y);
}

async function writeComposer(page, composer, text) {
  await clickComposer(page, composer);
  try {
    await composer.fill(text, { timeout: 8000 });
    const filled = await getComposerText(composer);
    if (filled.includes(text.slice(0, Math.min(40, text.length)))) return filled;
  } catch {
    // Fall through to keyboard replacement.
  }
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await page.keyboard.insertText(text);
  return await getComposerText(composer);
}

async function collectSendButtonCandidates(page, composer) {
  const selectors = ['button[aria-label*="Send" i]', 'button[aria-label*="Envoyer" i]', 'button[data-testid*="send" i]', 'form button[type="submit"]'];
  const candidates = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      candidates.push({
        selector,
        index,
        visible: await item.isVisible().catch(() => false),
        enabled: await item.isEnabled().catch(() => false),
        box: await item.boundingBox().catch(() => null),
        label: await item.getAttribute("aria-label").catch(() => ""),
        testId: await item.getAttribute("data-testid").catch(() => "")
      });
    }
  }

  const composerBox = composer.__box || await composer.boundingBox().catch(() => null);
  const buttons = page.locator("button");
  const count = await buttons.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = buttons.nth(index);
    const visible = await item.isVisible().catch(() => false);
    const enabled = await item.isEnabled().catch(() => false);
    const box = await item.boundingBox().catch(() => null);
    if (!visible || !enabled || !box || !composerBox) continue;
    const nearComposer = box.x >= composerBox.x - 120 && box.x <= composerBox.x + composerBox.width + 220 &&
      box.y >= composerBox.y - 160 && box.y <= composerBox.y + composerBox.height + 180;
    if (nearComposer) {
      candidates.push({ selector: "near_composer_button", index, visible, enabled, box, label: await item.getAttribute("aria-label").catch(() => ""), testId: await item.getAttribute("data-testid").catch(() => "") });
    }
  }
  return candidates;
}

async function clickSendButton(page, candidates) {
  const chosen = candidates.filter((candidate) => candidate.visible && candidate.enabled && candidate.box && candidate.box.width > 0 && candidate.box.height > 0)
    .sort((a, b) => {
      const score = (candidate) => (candidate.selector.includes("aria-label") ? 30 : 0) + (candidate.selector.includes("data-testid") ? 20 : 0) + (candidate.selector === "near_composer_button" ? 10 : 0);
      return score(b) - score(a);
    })[0];
  if (!chosen) return null;
  const locator = chosen.selector === "near_composer_button" ? page.locator("button").nth(chosen.index) : page.locator(chosen.selector).nth(chosen.index);
  await locator.click({ timeout: 5000 });
  return chosen;
}

async function sendPrompt(page, composer, text, nonce, outDir) {
  const beforeAssistantCount = await page.locator('[data-message-author-role="assistant"]').count().catch(() => 0);
  const beforeUserCount = await page.locator('[data-message-author-role="user"]').count().catch(() => 0);
  const composerText = await writeComposer(page, composer, text);
  if (!composerText.includes(nonce)) {
    write(path.join(outDir, "send_error.md"), "COMPOSER_NONCE_MISSING_AFTER_FILL");
    return { ok: false, reason: "COMPOSER_NONCE_MISSING_AFTER_FILL", beforeAssistantCount, beforeUserCount };
  }
  const candidates = await collectSendButtonCandidates(page, composer);
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));
  let method = "button_click";
  let clicked = null;
  try {
    clicked = await clickSendButton(page, candidates);
  } catch {
    clicked = null;
  }
  if (!clicked) {
    method = "keyboard_enter";
    await page.keyboard.press("Enter");
  }

  const sentDeadline = Date.now() + 15000;
  let sent = false;
  while (Date.now() < sentDeadline) {
    const userTexts = await page.locator('[data-message-author-role="user"]').allTextContents().catch(() => []);
    const stopCount = await stopIndicatorCount(page);
    if (userTexts.some((entry) => entry.includes(nonce)) || stopCount > 0) {
      sent = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  const result = { ok: sent, reason: sent ? "" : "SEND_NOT_OBSERVED", method, clicked, beforeAssistantCount, beforeUserCount };
  write(path.join(outDir, "send_result.json"), JSON.stringify(result, null, 2));
  return result;
}

function extractJsonObjects(text) {
  const raw = String(text || "").trim();
  const candidates = [];
  for (const match of raw.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    candidates.push(match[1].trim());
  }
  candidates.push(raw);
  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < raw.length; end += 1) {
      const ch = raw[end];
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = !inString;
      } else if (!inString && ch === "{") {
        depth += 1;
      } else if (!inString && ch === "}") {
        depth -= 1;
        if (depth === 0) {
          candidates.push(raw.slice(start, end + 1));
          break;
        }
      }
    }
  }

  const parsed = [];
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed.push(obj);
    } catch {
      // Try next.
    }
  }
  return parsed;
}

function validateEchoResponse(text, nonce, messageIndex) {
  const violations = [];
  const raw = String(text || "");
  if (/<\s*MICRO_PROMPT\b|"\s*MICRO_PROMPT\s*"|^\s*MICRO_PROMPT\s*:/im.test(raw)) violations.push("MICRO_PROMPT appeared");
  if (/"\s*codex_prompt\s*"\s*:|^\s*codex_prompt\s*:/im.test(raw)) violations.push("codex_prompt appeared");
  const objects = extractJsonObjects(raw);
  const obj = objects.find((candidate) => candidate.nonce === nonce || candidate.done === nonce);
  if (!obj) violations.push("no JSON object with expected nonce");
  if (obj) {
    if (obj.schema !== "NC_TRANSPORT_ECHO/1") violations.push("schema mismatch");
    if (obj.nonce !== nonce) violations.push("nonce mismatch");
    if (Number(obj.message_index) !== Number(messageIndex)) violations.push("message_index mismatch");
    if (obj.role !== "transport_smoke_only") violations.push("role mismatch");
    if (obj.micro_prompt_requested !== false) violations.push("micro_prompt_requested must be false");
    if (obj.done !== nonce) violations.push("done mismatch");
  }
  return { ok: violations.length === 0, json: obj || null, violations, object_count: objects.length };
}

function validateReadyResponse(text, nonce) {
  const raw = String(text || "");
  const checks = [
    raw.includes(`<NC_SUPERVISOR_READY nonce="${nonce}">`),
    raw.includes("<PROJECT>NeuroChess Supervisor</PROJECT>"),
    raw.includes("<READY>YES</READY>"),
    raw.includes("nonce_protocol: PASS"),
    raw.includes("micro_prompt_only: PASS"),
    raw.includes("forbidden_paths_known: PASS"),
    raw.includes("red_tier_known: PASS"),
    raw.includes("git_add_A_forbidden: PASS"),
    raw.includes(`<NC_DONE nonce="${nonce}">DONE</NC_DONE>`)
  ];
  return { ok: checks.every(Boolean), violations: checks.every(Boolean) ? [] : ["READY response missing required field"] };
}

async function waitForAssistantResponse(page, nonce, outDir, label, validator, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastRaw = "";
  let lastChangedAt = Date.now();
  let latestValidation = { ok: false, violations: ["no response yet"] };

  while (Date.now() < deadline) {
    const assistantTexts = await page.locator('[data-message-author-role="assistant"]').allTextContents().catch(() => []);
    const matching = assistantTexts.filter((text) => text.includes(nonce));
    const raw = matching[matching.length - 1] || "";
    if (raw && raw !== lastRaw) {
      lastRaw = raw;
      lastChangedAt = Date.now();
    }
    if (raw) {
      latestValidation = validator(raw);
      const stopCount = await stopIndicatorCount(page);
      if (latestValidation.ok && Date.now() - lastChangedAt >= 2500 && stopCount === 0) {
        write(path.join(outDir, `${label}_raw_response.txt`), raw);
        write(path.join(outDir, `${label}_validation.json`), JSON.stringify(latestValidation, null, 2));
        return { ok: true, raw, validation: latestValidation };
      }
    }
    await page.waitForTimeout(700);
  }

  const bodyText = await page.locator("body").textContent({ timeout: 3000 }).catch(() => "");
  write(path.join(outDir, `${label}_partial_response.txt`), lastRaw || "");
  write(path.join(outDir, `${label}_validation.json`), JSON.stringify(latestValidation, null, 2));
  write(path.join(outDir, `${label}_body_contains_nonce.txt`), String((bodyText || "").includes(nonce)));
  write(path.join(outDir, `${label}_current_url.txt`), page.url());
  await saveSanitizedDomSummary(page, outDir, `${label}_timeout_sanitized_dom_summary.json`);
  await page.screenshot({ path: path.join(outDir, `${label}_timeout.png`), fullPage: true }).catch(() => {});
  return { ok: false, reason: "STOP_TRANSPORT_ECHO_TIMEOUT", raw: lastRaw, validation: latestValidation };
}

function readyPrompt(nonce) {
  return `Confirm NeuroChess Supervisor readiness only. Do not provide a MICRO_PROMPT. Do not propose product work. Return exactly:
<NC_SUPERVISOR_READY nonce="${nonce}">
<PROJECT>NeuroChess Supervisor</PROJECT>
<READY>YES</READY>
<CANARY_CHECKS>
nonce_protocol: PASS
micro_prompt_only: PASS
forbidden_paths_known: PASS
red_tier_known: PASS
git_add_A_forbidden: PASS
</CANARY_CHECKS>
<NC_DONE nonce="${nonce}">DONE</NC_DONE>
</NC_SUPERVISOR_READY>`;
}

function echoPrompt(nonce, index) {
  return `Return only valid JSON: {"schema":"NC_TRANSPORT_ECHO/1","nonce":"${nonce}","message_index":${index},"role":"transport_smoke_only","micro_prompt_requested":false,"done":"${nonce}"}`;
}

function baseResult(outDir) {
  return {
    schema: "NC_SINGLE_PROCESS_TRANSPORT/1",
    run_dir: outDir,
    ready_result: "NOT_RUN",
    message_1_result: "NOT_RUN",
    message_2_result: "NOT_RUN",
    same_browser_reuse: "unknown",
    same_page_reuse: "unknown",
    same_conversation_id: "unknown",
    active_session_url_reuse: false,
    no_micro_prompt_requested: true,
    live_chatgpt_called: false,
    live_gemini_called: false,
    product_mission_executed: false,
    final_verdict: "FAIL_SINGLE_PROCESS_TRANSPORT",
    stop_reason: "",
    raw_response_paths: [],
    debug_paths: [],
    limitations: []
  };
}

async function runFixture(args, outDir) {
  const fixture = readJson(args.fixture);
  const result = { ...baseResult(outDir), fixture_mode: true };
  result.live_chatgpt_called = false;
  result.active_session_url_reuse = Boolean(fixture.active_session_url_reuse);
  if (fixture.availability && fixture.availability !== "READY") {
    result.stop_reason = fixture.stop_reason || `STOP_${fixture.availability}`;
    result.final_verdict = result.stop_reason;
    write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
    return result;
  }
  const readyValidation = validateReadyResponse(String(fixture.ready_response || ""), String(fixture.ready_nonce || "READY_NONCE"));
  if (!readyValidation.ok) {
    result.ready_result = "FAIL";
    result.stop_reason = "STOP_CHATGPT_READY_NOT_AVAILABLE";
    write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
    return result;
  }
  result.ready_result = "PASS";
  const messages = fixture.messages || [];
  for (let index = 1; index <= 2; index += 1) {
    const message = messages[index - 1] || {};
    if (message.timeout) {
      result[`message_${index}_result`] = "TIMEOUT";
      result.stop_reason = "STOP_TRANSPORT_ECHO_TIMEOUT";
      result.final_verdict = index === 1 ? "FAIL_TRANSPORT_RESPONSE_TIMEOUT" : "PARTIAL_SINGLE_PROCESS_TRANSPORT";
      write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
      return result;
    }
    const validation = validateEchoResponse(String(message.response || ""), String(message.nonce || `NONCE_${index}`), index);
    if (!validation.ok) {
      result[`message_${index}_result`] = "FAIL";
      result.stop_reason = validation.violations.includes("nonce mismatch") ? "STOP_TRANSPORT_NONCE_MISMATCH" : "STOP_TRANSPORT_JSON_INVALID";
      result.final_verdict = "FAIL_SINGLE_PROCESS_TRANSPORT";
      write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
      return result;
    }
    result[`message_${index}_result`] = "PASS";
  }
  result.same_browser_reuse = fixture.same_browser_reuse || "yes";
  result.same_page_reuse = fixture.same_page_reuse || "yes";
  result.same_conversation_id = fixture.same_conversation_id || "yes";
  result.final_verdict = result.same_page_reuse === "yes" ? "PASS_SINGLE_PROCESS_TRANSPORT" : "PASS_ACTIVE_SESSION_REUSE_ONLY";
  write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
  return result;
}

async function runLive(args, outDir) {
  const configPath = args.config || path.join(process.cwd(), "ops", "autopilot", "config.json");
  const config = loadEffectiveConfig(configPath);
  const projectConfig = config.chatgpt_project || {};
  const bridgeConfig = config.chatgpt_web_bridge || {};
  const activeSessionUrl = String(projectConfig.active_session_url || "").trim();
  if (!activeSessionUrl || !isAcceptedActiveProjectSessionUrl(activeSessionUrl)) {
    throw new Error("ACTIVE_SESSION_URL_MISSING_OR_INVALID");
  }

  const result = baseResult(outDir);
  result.live_chatgpt_called = true;
  result.active_session_url_reuse = true;
  result.active_session_url_redacted = true;
  const conversationIdBefore = conversationIdFromUrl(activeSessionUrl);
  result.conversation_id_before = conversationIdBefore || "unknown";

  const playwright = await loadPlaywright();
  const profile = bridgeConfig.chrome_profile_path || path.join(process.env.USERPROFILE || process.cwd(), "Documents", "Dev", "ChatGPTSupervisorChromeProfile");
  let context;
  let page;
  const pageToken = crypto.randomBytes(8).toString("hex");
  const contextToken = crypto.randomBytes(8).toString("hex");

  try {
    context = await playwright.chromium.launchPersistentContext(profile, {
      headless: false,
      channel: bridgeConfig.chrome_channel || "chrome"
    });
    page = await context.newPage();
    page.__ncSingleProcessPageToken = pageToken;
    context.__ncSingleProcessContextToken = contextToken;
    result.page_count_after_launch = context.pages().length;
    await page.goto(activeSessionUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    result.current_url_after_open_redacted = true;

    const initialAvailability = await requireAvailability(page, projectConfig, activeSessionUrl, outDir, "initial", { timeoutMs: 45000 });
    if (initialAvailability.availability !== "READY") {
      result.stop_reason = initialAvailability.stopReason || "STOP_CHATGPT_READY_NOT_AVAILABLE";
      result.final_verdict = result.stop_reason;
      return result;
    }

    let composer = await findComposer(page, path.join(outDir, "ready_composer"));
    if (!composer) {
      result.stop_reason = "STOP_COMPOSER_NOT_FOUND";
      result.final_verdict = result.stop_reason;
      return result;
    }

    const readyNonce = `A18H_READY_${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    write(path.join(outDir, "ready_request.md"), readyPrompt(readyNonce));
    const readySend = await sendPrompt(page, composer, readyPrompt(readyNonce), readyNonce, path.join(outDir, "ready_send"));
    if (!readySend.ok) {
      result.stop_reason = readySend.reason;
      return result;
    }
    const readyResponse = await waitForAssistantResponse(page, readyNonce, outDir, "ready", (raw) => validateReadyResponse(raw, readyNonce), 180000);
    if (!readyResponse.ok) {
      result.ready_result = "TIMEOUT";
      result.stop_reason = "STOP_CHATGPT_READY_NOT_AVAILABLE";
      result.final_verdict = "FAIL_SINGLE_PROCESS_TRANSPORT";
      return result;
    }
    result.ready_result = "PASS";
    result.raw_response_paths.push(path.join(outDir, "ready_raw_response.txt"));

    const conversationIdAfterReady = conversationIdFromUrl(page.url());
    result.conversation_id_after_ready = conversationIdAfterReady || "unknown";

    for (let index = 1; index <= 2; index += 1) {
      const availability = await requireAvailability(page, projectConfig, activeSessionUrl, outDir, `before_message_${index}`, { timeoutMs: 30000 });
      if (availability.availability !== "READY") {
        result.stop_reason = availability.stopReason || "STOP_CHATGPT_READY_NOT_AVAILABLE";
        result.final_verdict = result.stop_reason;
        return result;
      }
      composer = await findComposer(page, path.join(outDir, `message_${index}_composer`));
      if (!composer) {
        result.stop_reason = "STOP_COMPOSER_NOT_FOUND";
        result.final_verdict = result.stop_reason;
        return result;
      }
      const nonce = `A18H_MSG${index}_${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const request = echoPrompt(nonce, index);
      write(path.join(outDir, `message_${index}_request.txt`), request);
      const send = await sendPrompt(page, composer, request, nonce, path.join(outDir, `message_${index}_send`));
      if (!send.ok) {
        result[`message_${index}_result`] = "SEND_FAIL";
        result.stop_reason = send.reason;
        result.final_verdict = "FAIL_SINGLE_PROCESS_TRANSPORT";
        return result;
      }
      const response = await waitForAssistantResponse(page, nonce, outDir, `message_${index}`, (raw) => validateEchoResponse(raw, nonce, index), 240000);
      if (!response.ok) {
        result[`message_${index}_result`] = "TIMEOUT";
        result.stop_reason = response.reason || "STOP_TRANSPORT_ECHO_TIMEOUT";
        result.final_verdict = index === 1 ? "FAIL_TRANSPORT_RESPONSE_TIMEOUT" : "PARTIAL_SINGLE_PROCESS_TRANSPORT";
        result.debug_paths.push(path.join(outDir, `message_${index}_timeout.png`));
        return result;
      }
      result[`message_${index}_result`] = "PASS";
      result.raw_response_paths.push(path.join(outDir, `message_${index}_raw_response.txt`));
    }

    const finalAvailability = await requireAvailability(page, projectConfig, activeSessionUrl, outDir, "after_message_2", { timeoutMs: 30000 });
    result.composer_available_after_message_2 = finalAvailability.availability === "READY";
    const conversationIdAfterMessage2 = conversationIdFromUrl(page.url());
    result.conversation_id_after_message_2 = conversationIdAfterMessage2 || "unknown";
    result.same_conversation_id = conversationIdBefore && conversationIdAfterMessage2 && conversationIdBefore === conversationIdAfterMessage2 ? "yes" : "unknown";
    result.same_browser_reuse = context.__ncSingleProcessContextToken === contextToken ? "yes" : "unknown";
    result.same_page_reuse = page.__ncSingleProcessPageToken === pageToken && !page.isClosed() ? "yes" : "unknown";
    result.final_verdict = result.same_page_reuse === "yes" && result.message_1_result === "PASS" && result.message_2_result === "PASS"
      ? "PASS_SINGLE_PROCESS_TRANSPORT"
      : "PASS_ACTIVE_SESSION_REUSE_ONLY";
    updateLocalSession(configPath, {
      active_conversation_id: conversationIdAfterMessage2 || conversationIdBefore,
      last_ready_check: new Date().toISOString(),
      last_availability_check: new Date().toISOString(),
      last_health_state: finalAvailability.availability,
      same_page_reuse_last_result: result.same_page_reuse === "yes",
      same_browser_pid_last_result: null
    });
    return result;
  } finally {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(outDir, "final_page.png"), fullPage: true }).catch(() => {});
    }
    if (context) await context.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "single_process_live_loop");
  fs.mkdirSync(outDir, { recursive: true });
  let result;
  try {
    if (args.fixture) {
      result = await runFixture(args, outDir);
    } else if (args.live) {
      result = await runLive(args, outDir);
    } else {
      result = { ...baseResult(outDir), fixture_mode: true, final_verdict: "DRY_RUN_NO_BROWSER", live_chatgpt_called: false };
    }
    write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    const passVerdicts = new Set(["PASS_SINGLE_PROCESS_TRANSPORT", "PASS_ACTIVE_SESSION_REUSE_ONLY"]);
    process.exit(passVerdicts.has(result.final_verdict) || result.final_verdict === "DRY_RUN_NO_BROWSER" ? 0 : 2);
  } catch (error) {
    result = { ...baseResult(outDir), final_verdict: "FAIL_SINGLE_PROCESS_TRANSPORT", stop_reason: error.message, error: error.stack || error.message };
    write(path.join(outDir, "single_process_result.json"), JSON.stringify(result, null, 2));
    write(path.join(outDir, "single_process_error.md"), error.stack || error.message);
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main();
