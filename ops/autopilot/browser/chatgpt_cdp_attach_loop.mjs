import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);
const PROJECT_SLUG = "g-p-6a07c20c139c8191a0d8972fc7b7019e-neurochess-supervisor";

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

function conversationIdFromUrl(value) {
  const match = String(value || "").match(/\/c\/([^/?#]+)/);
  return match ? match[1] : "";
}

function isProjectConversationUrl(value) {
  const text = String(value || "");
  return text.includes(PROJECT_SLUG) && /\/c\/[^/?#]+/.test(text);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Continue to explicit lookup.
  }
  try {
    return requireFromHere("playwright");
  } catch {
    // Continue to bundled runtime probing.
  }
  const bundledRuntimeNodeModules = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules")
    : "";
  const nodeExecutableModuleRoot = path.resolve(path.dirname(process.execPath), "..", "node_modules");
  for (const moduleRoot of [
    ...(process.env.NODE_PATH || "").split(path.delimiter),
    nodeExecutableModuleRoot,
    bundledRuntimeNodeModules
  ].filter(Boolean)) {
    try {
      return requireFromHere(path.join(moduleRoot, "playwright"));
    } catch {
      // Try next.
    }
    const pnpmRoot = path.join(moduleRoot, ".pnpm");
    if (fs.existsSync(pnpmRoot)) {
      for (const entry of fs.readdirSync(pnpmRoot).filter((item) => /^playwright@/.test(item)).sort().reverse()) {
        try {
          return requireFromHere(path.join(pnpmRoot, entry, "node_modules", "playwright"));
        } catch {
          // Try next.
        }
      }
    }
  }
  throw new Error("Cannot load Playwright.");
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

async function collectPageDiagnostics(page) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").textContent({ timeout: 5000 }).catch(() => "");
  const projectContextVerified = isProjectConversationUrl(currentUrl);
  const composerLikeElementCount = await countComposerLikeElements(page);
  const titleHasHumanVerification = detectHumanVerification(title, "");
  const titleHasLoadingInterstitial = detectLoadingOrInterstitial(title, "");
  const blockedTextIsAuthoritative = composerLikeElementCount <= 0;
  const humanVerificationDetected = titleHasHumanVerification || (blockedTextIsAuthoritative && detectHumanVerification(title, bodyText));
  const loadingOrInterstitialDetected = titleHasLoadingInterstitial || (blockedTextIsAuthoritative && detectLoadingOrInterstitial(title, bodyText));
  const stopCount = await stopIndicatorCount(page);
  let availability = "READY";
  let stopReason = "";
  if (!projectContextVerified) {
    availability = "WRONG_PROJECT_OR_CONTEXT";
    stopReason = "STOP_WRONG_CHATGPT_PROJECT_CONTEXT";
  } else if (humanVerificationDetected) {
    availability = "HUMAN_VERIFICATION_REQUIRED";
    stopReason = "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED";
  } else if (loadingOrInterstitialDetected && composerLikeElementCount <= 0) {
    availability = "LOADING_INTERSTITIAL";
    stopReason = "STOP_PROJECT_LOADING_INTERSTITIAL";
  } else if (composerLikeElementCount <= 0) {
    availability = "COMPOSER_NOT_FOUND";
    stopReason = "STOP_COMPOSER_NOT_FOUND";
  } else if (stopCount > 0 && composerLikeElementCount <= 0) {
    availability = "RESPONSE_IN_PROGRESS";
    stopReason = "STOP_TRANSPORT_RESPONSE_NOT_STABLE";
  }
  return {
    currentUrl,
    current_url_redacted: true,
    title,
    projectContextVerified,
    humanVerificationDetected,
    loadingOrInterstitialDetected,
    composerLikeElementCount,
    stopIndicatorCount: stopCount,
    availability,
    ready: availability === "READY",
    stopReason
  };
}

async function saveSanitizedDomSummary(page, outDir, name) {
  const summary = await page.evaluate(() => Array.from(document.querySelectorAll("main, header, nav, [role], button, textarea, [contenteditable], input"))
    .slice(0, 120)
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
}

async function requireReady(page, outDir, label) {
  const diagnostics = await collectPageDiagnostics(page);
  const availabilityPath = path.join(outDir, `${label}_availability.json`);
  const currentUrlPath = path.join(outDir, `${label}_current_url.txt`);
  const domSummaryPath = path.join(outDir, `${label}_sanitized_dom_summary.json`);
  const blockedScreenshotPath = path.join(outDir, `${label}_blocked.png`);
  write(availabilityPath, JSON.stringify(diagnostics, null, 2));
  diagnostics.diagnostic_paths = [availabilityPath];
  if (diagnostics.availability !== "READY") {
    write(currentUrlPath, diagnostics.currentUrl);
    await saveSanitizedDomSummary(page, outDir, `${label}_sanitized_dom_summary.json`);
    await page.screenshot({ path: blockedScreenshotPath, fullPage: true }).catch(() => {});
    diagnostics.diagnostic_paths.push(currentUrlPath, domSummaryPath, blockedScreenshotPath);
  }
  return diagnostics;
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
      opacity: style.opacity
    };
  }).catch((error) => ({ error: error.message }));
  const visibleByPlaywright = await locator.isVisible().catch(() => false);
  const editableByPlaywright = await locator.isEditable().catch(() => false);
  const visibleByCss = Boolean(dom.rect && dom.rect.width > 20 && dom.rect.height > 20 && dom.display !== "none" && dom.visibility !== "hidden" && dom.opacity !== "0" && dom.ariaHidden !== "true");
  const isEditor = Boolean(dom.isContentEditable || dom.contentEditable === "true" || dom.role === "textbox" || dom.tagName === "TEXTAREA");
  const usable = Boolean(visibleByCss && visibleByPlaywright && isEditor && (editableByPlaywright || dom.isContentEditable));
  const score = (dom.isContentEditable ? 100 : 0) + (dom.role === "textbox" ? 20 : 0) + Math.min(20, Math.round(((dom.rect?.width || 0) * (dom.rect?.height || 0)) / 10000));
  return { selector, index, usable, score, visibleByPlaywright, editableByPlaywright, visibleByCss, ...dom };
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
  return candidates;
}

async function clickSendButton(page, candidates) {
  const chosen = candidates.filter((candidate) => candidate.visible && candidate.enabled && candidate.box && candidate.box.width > 0 && candidate.box.height > 0)
    .sort((a, b) => {
      const score = (candidate) => (candidate.selector.includes("aria-label") ? 30 : 0) + (candidate.selector.includes("data-testid") ? 20 : 0);
      return score(b) - score(a);
    })[0];
  if (!chosen) return null;
  await page.locator(chosen.selector).nth(chosen.index).click({ timeout: 5000 });
  return chosen;
}

async function sendPrompt(page, composer, text, nonce, outDir) {
  const beforeAssistantCount = await page.locator('[data-message-author-role="assistant"]').count().catch(() => 0);
  const filled = await writeComposer(page, composer, text);
  if (!filled.includes(nonce)) {
    return { ok: false, reason: "COMPOSER_NONCE_MISSING_AFTER_FILL", beforeAssistantCount };
  }
  const candidates = await collectSendButtonCandidates(page, composer);
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));
  let method = "button_click";
  const clicked = await clickSendButton(page, candidates).catch(() => null);
  if (!clicked) {
    method = "keyboard_enter";
    await page.keyboard.press("Enter");
  }
  const deadline = Date.now() + 15000;
  let sent = false;
  while (Date.now() < deadline) {
    const userTexts = await page.locator('[data-message-author-role="user"]').allTextContents().catch(() => []);
    if (userTexts.some((entry) => entry.includes(nonce)) || await stopIndicatorCount(page) > 0) {
      sent = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  const result = { ok: sent, reason: sent ? "" : "SEND_NOT_OBSERVED", method, beforeAssistantCount };
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
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = !inString;
      else if (!inString && ch === "{") depth += 1;
      else if (!inString && ch === "}") {
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
  const ok = raw.includes(`<NC_SUPERVISOR_READY nonce="${nonce}">`) &&
    raw.includes("<PROJECT>NeuroChess Supervisor</PROJECT>") &&
    raw.includes("<READY>YES</READY>") &&
    raw.includes("nonce_protocol: PASS") &&
    raw.includes("micro_prompt_only: PASS") &&
    raw.includes("forbidden_paths_known: PASS") &&
    raw.includes("red_tier_known: PASS") &&
    raw.includes("git_add_A_forbidden: PASS") &&
    raw.includes(`<NC_DONE nonce="${nonce}">DONE</NC_DONE>`);
  return { ok, violations: ok ? [] : ["READY response missing required field"] };
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
      if (latestValidation.ok && Date.now() - lastChangedAt >= 2500) {
        write(path.join(outDir, `${label}_raw_response.txt`), raw);
        write(path.join(outDir, `${label}_validation.json`), JSON.stringify(latestValidation, null, 2));
        return { ok: true, raw, validation: latestValidation };
      }
    }
    await page.waitForTimeout(700);
  }
  const partialPath = path.join(outDir, `${label}_partial_response.txt`);
  const validationPath = path.join(outDir, `${label}_validation.json`);
  const currentUrlPath = path.join(outDir, `${label}_current_url.txt`);
  const domSummaryPath = path.join(outDir, `${label}_timeout_sanitized_dom_summary.json`);
  const screenshotPath = path.join(outDir, `${label}_timeout.png`);
  write(partialPath, lastRaw || "");
  write(validationPath, JSON.stringify(latestValidation, null, 2));
  write(currentUrlPath, page.url());
  await saveSanitizedDomSummary(page, outDir, `${label}_timeout_sanitized_dom_summary.json`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  return {
    ok: false,
    reason: "STOP_TRANSPORT_ECHO_TIMEOUT",
    raw: lastRaw,
    validation: latestValidation,
    diagnostic_paths: [partialPath, validationPath, currentUrlPath, domSummaryPath, screenshotPath]
  };
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
    schema: "NC_CDP_ATTACH_TRANSPORT/1",
    run_dir: outDir,
    cdp_attached: false,
    existing_chrome_reused: false,
    existing_page_reused: false,
    ready_result: "NOT_RUN",
    message_1_result: "NOT_RUN",
    message_2_result: "NOT_RUN",
    same_page_reuse: "unknown",
    same_browser_reuse: "unknown",
    same_conversation_id: "unknown",
    active_session_url_reuse: false,
    no_micro_prompt_requested: true,
    live_chatgpt_called: false,
    live_gemini_called: false,
    product_mission_executed: false,
    chrome_closed_by_codex: false,
    final_verdict: "FAIL_CDP_ATTACH_TRANSPORT",
    stop_reason: "",
    raw_response_paths: [],
    debug_paths: []
  };
}

async function runFixture(args, outDir) {
  const fixture = readJson(args.fixture);
  const result = { ...baseResult(outDir), fixture_mode: true };
  result.cdp_attached = Boolean(fixture.cdp_attached);
  result.existing_chrome_reused = Boolean(fixture.existing_chrome_reused);
  result.existing_page_reused = Boolean(fixture.existing_page_reused);
  result.active_session_url_reuse = Boolean(fixture.active_session_url_reuse);
  if (fixture.availability && fixture.availability !== "READY") {
    result.stop_reason = fixture.stop_reason || `STOP_${fixture.availability}`;
    result.final_verdict = result.stop_reason;
    write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
    return result;
  }
  const readyNonce = String(fixture.ready_nonce || "READY_NONCE");
  const readyValidation = validateReadyResponse(String(fixture.ready_response || ""), readyNonce);
  if (!readyValidation.ok) {
    result.stop_reason = "STOP_CHATGPT_READY_NOT_AVAILABLE";
    write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
    return result;
  }
  result.ready_result = "PASS";
  const messages = fixture.messages || [];
  for (let index = 1; index <= 2; index += 1) {
    const message = messages[index - 1] || {};
    if (message.timeout) {
      result[`message_${index}_result`] = "TIMEOUT";
      result.stop_reason = "STOP_TRANSPORT_ECHO_TIMEOUT";
      result.final_verdict = "FAIL_TRANSPORT_RESPONSE_TIMEOUT";
      write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
      return result;
    }
    const validation = validateEchoResponse(String(message.response || ""), String(message.nonce || `NONCE_${index}`), index);
    if (!validation.ok) {
      result[`message_${index}_result`] = "FAIL";
      result.stop_reason = validation.violations.includes("nonce mismatch") ? "STOP_TRANSPORT_NONCE_MISMATCH" : "STOP_TRANSPORT_JSON_INVALID";
      write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
      return result;
    }
    result[`message_${index}_result`] = "PASS";
  }
  result.same_page_reuse = fixture.same_page_reuse || "yes";
  result.same_browser_reuse = fixture.same_browser_reuse || "yes";
  result.same_conversation_id = fixture.same_conversation_id || "yes";
  result.final_verdict = "PASS_CDP_ATTACH_TRANSPORT";
  write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
  return result;
}

async function runLive(args, outDir) {
  const endpoint = args.endpoint || "http://127.0.0.1:9222";
  const result = baseResult(outDir);
  result.live_chatgpt_called = true;
  let browser = null;
  let page = null;
  const pageToken = crypto.randomBytes(8).toString("hex");
  try {
    const playwright = await loadPlaywright();
    browser = await playwright.chromium.connectOverCDP(endpoint);
    result.cdp_attached = true;
    result.existing_chrome_reused = true;
    const contexts = browser.contexts();
    const pages = contexts.flatMap((context) => context.pages());
    write(path.join(outDir, "cdp_pages.json"), JSON.stringify(pages.map((candidate, index) => ({
      index,
      url_redacted: true,
      is_project_conversation: isProjectConversationUrl(candidate.url()),
      conversation_id: conversationIdFromUrl(candidate.url()) || ""
    })), null, 2));
    page = pages.find((candidate) => isProjectConversationUrl(candidate.url()));
    if (!page) {
      result.stop_reason = "STOP_ACTIVE_SESSION_TAB_NOT_FOUND";
      result.final_verdict = result.stop_reason;
      return result;
    }
    page.__ncCdpAttachPageToken = pageToken;
    result.existing_page_reused = true;
    result.active_session_url_reuse = true;
    const conversationIdBefore = conversationIdFromUrl(page.url());
    result.conversation_id_before = conversationIdBefore || "unknown";
    const initial = await requireReady(page, outDir, "initial");
    if (initial.availability !== "READY") {
      result.stop_reason = initial.stopReason || "STOP_CHATGPT_READY_NOT_AVAILABLE";
      result.final_verdict = result.stop_reason;
      result.debug_paths.push(...(initial.diagnostic_paths || []));
      return result;
    }

    let composer = await findComposer(page, path.join(outDir, "ready_composer"));
    if (!composer) {
      result.stop_reason = "STOP_COMPOSER_NOT_FOUND";
      result.final_verdict = result.stop_reason;
      return result;
    }
    const readyNonce = `A18I_READY_${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    write(path.join(outDir, "ready_request.txt"), readyPrompt(readyNonce));
    const readySend = await sendPrompt(page, composer, readyPrompt(readyNonce), readyNonce, path.join(outDir, "ready_send"));
    if (!readySend.ok) {
      result.stop_reason = readySend.reason;
      return result;
    }
    const readyResponse = await waitForAssistantResponse(page, readyNonce, outDir, "ready", (raw) => validateReadyResponse(raw, readyNonce), 180000);
    if (!readyResponse.ok) {
      result.ready_result = "TIMEOUT";
      result.stop_reason = "STOP_CHATGPT_READY_NOT_AVAILABLE";
      result.final_verdict = "FAIL_CDP_ATTACH_TRANSPORT";
      result.debug_paths.push(...(readyResponse.diagnostic_paths || []));
      return result;
    }
    result.ready_result = "PASS";
    result.raw_response_paths.push(path.join(outDir, "ready_raw_response.txt"));

    for (let index = 1; index <= 2; index += 1) {
      const availability = await requireReady(page, outDir, `before_message_${index}`);
      if (availability.availability !== "READY") {
        result.stop_reason = availability.stopReason || "STOP_CHATGPT_READY_NOT_AVAILABLE";
        result.final_verdict = result.stop_reason;
        result.debug_paths.push(...(availability.diagnostic_paths || []));
        return result;
      }
      composer = await findComposer(page, path.join(outDir, `message_${index}_composer`));
      if (!composer) {
        result.stop_reason = "STOP_COMPOSER_NOT_FOUND";
        result.final_verdict = result.stop_reason;
        return result;
      }
      const nonce = `A18I_MSG${index}_${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const request = echoPrompt(nonce, index);
      write(path.join(outDir, `message_${index}_request.txt`), request);
      const send = await sendPrompt(page, composer, request, nonce, path.join(outDir, `message_${index}_send`));
      if (!send.ok) {
        result[`message_${index}_result`] = "SEND_FAIL";
        result.stop_reason = send.reason;
        return result;
      }
      const response = await waitForAssistantResponse(page, nonce, outDir, `message_${index}`, (raw) => validateEchoResponse(raw, nonce, index), 240000);
      if (!response.ok) {
        result[`message_${index}_result`] = "TIMEOUT";
        result.stop_reason = response.reason || "STOP_TRANSPORT_ECHO_TIMEOUT";
        result.final_verdict = "FAIL_TRANSPORT_RESPONSE_TIMEOUT";
        result.debug_paths.push(...(response.diagnostic_paths || []));
        return result;
      }
      result[`message_${index}_result`] = "PASS";
      result.raw_response_paths.push(path.join(outDir, `message_${index}_raw_response.txt`));
    }

    const final = await requireReady(page, outDir, "after_message_2");
    const conversationIdAfter = conversationIdFromUrl(page.url());
    result.same_conversation_id = conversationIdBefore && conversationIdAfter && conversationIdBefore === conversationIdAfter ? "yes" : "unknown";
    result.same_page_reuse = page.__ncCdpAttachPageToken === pageToken && !page.isClosed() ? "yes" : "unknown";
    result.same_browser_reuse = browser.isConnected() ? "yes" : "unknown";
    result.composer_available_after_message_2 = final.availability === "READY";
    result.final_verdict = result.message_1_result === "PASS" && result.message_2_result === "PASS"
      ? "PASS_CDP_ATTACH_TRANSPORT"
      : "FAIL_CDP_ATTACH_TRANSPORT";
    return result;
  } catch (error) {
    result.stop_reason = result.cdp_attached ? error.message : "STOP_CDP_ATTACH_FAILED";
    result.error = error.stack || error.message;
    result.final_verdict = result.stop_reason === "STOP_CDP_ATTACH_FAILED" ? "STOP_CDP_ATTACH_FAILED" : "FAIL_CDP_ATTACH_TRANSPORT";
    return result;
  } finally {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(outDir, "final_page.png"), fullPage: true }).catch(() => {});
    }
    // The user-owned Chrome stays open after the smoke finishes.
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "chatgpt_cdp_attach");
  fs.mkdirSync(outDir, { recursive: true });
  let result;
  try {
    if (args.fixture) {
      result = await runFixture(args, outDir);
    } else if (args.live) {
      result = await runLive(args, outDir);
    } else {
      result = { ...baseResult(outDir), fixture_mode: true, final_verdict: "DRY_RUN_NO_BROWSER" };
    }
    write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.final_verdict === "PASS_CDP_ATTACH_TRANSPORT" || result.final_verdict === "DRY_RUN_NO_BROWSER" ? 0 : 2);
  } catch (error) {
    result = { ...baseResult(outDir), final_verdict: "FAIL_CDP_ATTACH_TRANSPORT", stop_reason: error.message, error: error.stack || error.message };
    write(path.join(outDir, "cdp_attach_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main();
