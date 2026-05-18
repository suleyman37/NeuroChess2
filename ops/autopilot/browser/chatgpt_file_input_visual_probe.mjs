import fs from "node:fs";
import path from "node:path";
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

function read(file) {
  return fs.readFileSync(file, "utf8");
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

function isProjectConversationUrl(value) {
  const text = String(value || "");
  return text.includes(PROJECT_SLUG) && /\/c\/[^/?#]+/.test(text);
}

function isChatGptUrl(value) {
  return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(String(value || ""));
}

function detectHumanVerification(title, bodyText) {
  const text = `${title || ""}\n${bodyText || ""}`;
  return /je\s+suis\s+humain|i\s+am\s+human|verify\s+you\s+are\s+human|human\s+verification|captcha|challenge|checking\s+your\s+browser|v[\u00e9e]rification\s+humaine|cloudflare/i.test(text);
}

function detectLogin(title, bodyText) {
  const text = `${title || ""}\n${bodyText || ""}`;
  return /log in|sign up|connexion|connectez|se connecter|login|email address|mot de passe/i.test(text);
}

function detectConsent(title, bodyText) {
  const text = `${title || ""}\n${bodyText || ""}`;
  return /cookie|consent|privacy|accept all|tout accepter|terms of use|modalit/i.test(text);
}

async function countComposerLikeElements(page) {
  return await page.locator(
    '[data-testid="composer"] [contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], #prompt-textarea, div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea'
  ).count().catch(() => 0);
}

async function collectSafePageDiagnostics(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").textContent({ timeout: 5000 }).catch(() => "");
  const composerLikeElementCount = await countComposerLikeElements(page);
  return {
    url_redacted: true,
    is_chatgpt_url: isChatGptUrl(page.url()),
    is_project_conversation: isProjectConversationUrl(page.url()),
    title,
    body_text_length: String(bodyText || "").length,
    composer_like_element_count: composerLikeElementCount,
    human_verification_detected: detectHumanVerification(title, bodyText),
    login_detected: detectLogin(title, bodyText),
    consent_detected: detectConsent(title, bodyText),
    sensitive_text_redacted: true
  };
}

async function findComposer(page, outDir) {
  const selectors = [
    '[data-testid="composer"] [contenteditable="true"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '#prompt-textarea',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea'
  ];
  const candidates = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => true);
      const box = await item.boundingBox().catch(() => null);
      candidates.push({ selector, index, visible, enabled, has_box: Boolean(box) });
    }
  }
  write(path.join(outDir, "composer_candidates.json"), JSON.stringify(candidates, null, 2));
  const chosen = candidates.find((candidate) => candidate.visible && candidate.enabled && candidate.has_box) ||
    candidates.find((candidate) => candidate.visible && candidate.enabled) ||
    null;
  if (!chosen) return null;
  write(path.join(outDir, "chosen_composer.json"), JSON.stringify(chosen, null, 2));
  return page.locator(chosen.selector).nth(chosen.index);
}

async function writeComposer(page, composer, text) {
  await composer.click({ timeout: 5000 }).catch(() => {});
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  try {
    await composer.fill(text, { timeout: 5000 });
  } catch {
    await page.keyboard.insertText(text);
  }
  return await composer.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function fileInputAudit(page) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count().catch(() => 0);
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const info = await input.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        accept: element.getAttribute("accept") || "",
        multiple: Boolean(element.multiple),
        disabled: Boolean(element.disabled),
        visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0,
        width: rect.width,
        height: rect.height
      };
    }).catch((error) => ({ error: error.message }));
    candidates.push({ index, ...info });
  }
  return {
    input_count: count,
    file_input_found: count > 0,
    candidates
  };
}

async function attachmentSignals(page, attachmentPath) {
  const name = path.basename(attachmentPath);
  const bodyText = await page.locator("body").textContent().catch(() => "");
  const fileInputValues = await page.locator('input[type="file"]').evaluateAll((inputs) =>
    inputs.map((input) => ({
      value: input.value || "",
      fileCount: input.files ? input.files.length : 0,
      accept: input.getAttribute("accept") || ""
    }))
  ).catch(() => []);
  const thumbnailCount = await page.locator('img[src^="blob:"], img[alt*=".png" i], img[alt*=".jpg" i], img[alt*=".jpeg" i]').count().catch(() => 0);
  const attachmentLikeCount = await page.locator(
    '[data-testid*="attachment" i], [data-testid*="file" i], [aria-label*="Remove" i], [aria-label*="Supprimer" i], [aria-label*="Retirer" i]'
  ).count().catch(() => 0);
  const progressCount = await page.locator('[role="progressbar"], [data-testid*="progress" i], [aria-busy="true"]').count().catch(() => 0);
  return {
    file_name: name,
    fileInputValues,
    fileInputHasFiles: fileInputValues.some((entry) => entry.fileCount > 0 || entry.value),
    fileNameVisible: bodyText.includes(name),
    thumbnailCount,
    attachmentLikeCount,
    progressCount
  };
}

function uploadDetected(before, after) {
  return Boolean(
    after.fileInputHasFiles ||
    after.fileNameVisible ||
    after.thumbnailCount > before.thumbnailCount ||
    after.attachmentLikeCount > before.attachmentLikeCount
  );
}

async function waitForAttachment(page, attachmentPath, before, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latest = await attachmentSignals(page, attachmentPath);
  while (Date.now() < deadline) {
    if (uploadDetected(before, latest)) {
      const completionDeadline = Date.now() + Math.min(10000, Math.max(1000, deadline - Date.now()));
      let completed = latest.progressCount === 0;
      while (!completed && Date.now() < completionDeadline) {
        await page.waitForTimeout(500);
        latest = await attachmentSignals(page, attachmentPath);
        completed = latest.progressCount === 0;
      }
      return { detected: true, completed: completed ? "yes" : "unknown", signals: latest };
    }
    await page.waitForTimeout(500);
    latest = await attachmentSignals(page, attachmentPath);
  }
  return { detected: false, completed: "no", signals: latest };
}

async function attachViaFileInput(page, attachmentPath, outDir, timeoutMs) {
  const before = await attachmentSignals(page, attachmentPath);
  const audit = await fileInputAudit(page);
  write(path.join(outDir, "file_input_selector_audit.json"), JSON.stringify(audit, null, 2));
  if (!audit.file_input_found) {
    return { ok: false, status: "CHATGPT_FILE_INPUT_NOT_FOUND", before, audit };
  }

  const attempts = [];
  for (let index = audit.input_count - 1; index >= 0; index -= 1) {
    const input = page.locator('input[type="file"]').nth(index);
    const candidate = audit.candidates.find((item) => item.index === index) || {};
    try {
      await input.setInputFiles(attachmentPath, { timeout: 10000 });
      const visible = await waitForAttachment(page, attachmentPath, before, timeoutMs);
      const result = {
        ok: visible.detected,
        status: visible.detected ? "C7_CHATGPT_IMAGE_ATTACHMENT_CONFIRMED" : "CHATGPT_ATTACHMENT_NOT_CONFIRMED",
        strategy: "input_set_files",
        inputIndex: index,
        accept: candidate.accept || "",
        before,
        ...visible
      };
      write(path.join(outDir, "attachment_confirmation.json"), JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      attempts.push({ inputIndex: index, accept: candidate.accept || "", error: error.message });
    }
  }
  const failure = { ok: false, status: "CHATGPT_ATTACHMENT_NOT_CONFIRMED", strategy: "input_set_files", attempts, before };
  write(path.join(outDir, "attachment_confirmation.json"), JSON.stringify(failure, null, 2));
  return failure;
}

async function collectSendButtonCandidates(page) {
  const selectors = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Envoyer" i]',
    'button[data-testid*="send" i]',
    'form button[type="submit"]'
  ];
  const candidates = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => false);
      const box = await item.boundingBox().catch(() => null);
      const label = await item.getAttribute("aria-label").catch(() => "");
      const testId = await item.getAttribute("data-testid").catch(() => "");
      candidates.push({ selector, index, visible, enabled, has_box: Boolean(box), label, testId });
    }
  }
  return candidates;
}

async function getLatestAssistantText(page) {
  const texts = await page.locator('[data-message-author-role="assistant"]').allTextContents().catch(() => []);
  if (texts.length > 0) return texts[texts.length - 1].trim();
  const fallback = await page.locator("main").textContent().catch(() => "");
  return (fallback || "").trim();
}

async function stopIndicatorCount(page) {
  return await page.locator('button[aria-label*="Stop" i], button[aria-label*="Arr" i], button[data-testid*="stop" i]').count().catch(() => 0);
}

async function sendPrompt(page, composer, outDir) {
  const candidates = await collectSendButtonCandidates(page);
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));
  await composer.click({ timeout: 5000 }).catch(() => {});
  await page.keyboard.press("Enter").catch(() => {});
  await page.waitForTimeout(2500);
  if ((await stopIndicatorCount(page)) > 0) return { ok: true, method: "keyboard_enter" };

  for (const candidate of candidates) {
    if (!candidate.visible || !candidate.enabled) continue;
    try {
      await page.locator(candidate.selector).nth(candidate.index).click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      if ((await stopIndicatorCount(page)) > 0) return { ok: true, method: "button_click", candidate };
    } catch {
      // Try next button.
    }
  }
  return { ok: false, reason: "SEND_FAILED" };
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  }
  return null;
}

async function waitForResponse(page, beforeText, outDir, maxWaitSeconds) {
  const deadline = Date.now() + Number(maxWaitSeconds || 180) * 1000;
  let last = "";
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const text = await getLatestAssistantText(page);
    if (text !== last) {
      last = text;
      stableSince = Date.now();
    }
    const changed = text && text !== beforeText;
    const stable = Date.now() - stableSince >= 6000;
    const stopped = (await stopIndicatorCount(page)) === 0;
    if (changed && stable && stopped) {
      write(path.join(outDir, "raw_response.txt"), text);
      return { ok: true, raw: text, json_parseable: Boolean(extractJson(text)) };
    }
  }
  const partial = last || await getLatestAssistantText(page);
  write(path.join(outDir, "partial_response.txt"), partial || "");
  return { ok: false, status: "CHATGPT_RESPONSE_TIMEOUT", raw: partial || "" };
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "chatgpt_file_input_visual_probe");
  fs.mkdirSync(outDir, { recursive: true });
  const result = {
    schema_version: "A20Z_chatgpt_file_input_visual_probe_v1",
    status: "NOT_RUN",
    highest_capability: "C0_REPO_AND_CONFIG_FOUND",
    cdp_attached: false,
    existing_chrome_reused: false,
    existing_page_reused: false,
    composer_found: false,
    file_input_found: false,
    attachment_confirmed: false,
    prompt_sent: false,
    raw_response_captured: false,
    json_parseable: false,
    live_chatgpt_called: false,
    product_mission_executed: false,
    bypass_attempted: false,
    stop_reason: ""
  };

  const promptPath = args.prompt;
  const attachmentPath = args.attachment ? path.resolve(String(args.attachment)) : "";
  const resumeCheckOnly = Boolean(args.resumeCheckOnly);
  if (!resumeCheckOnly && (!promptPath || !fs.existsSync(promptPath))) {
    result.status = "PROMPT_FILE_MISSING";
    result.stop_reason = "PROMPT_FILE_MISSING";
    write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }
  if (!resumeCheckOnly && (!attachmentPath || !fs.existsSync(attachmentPath))) {
    result.status = "ATTACHMENT_FILE_MISSING";
    result.stop_reason = "ATTACHMENT_FILE_MISSING";
    write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  let browser = null;
  try {
    const playwright = await loadPlaywright();
    browser = await playwright.chromium.connectOverCDP(args.endpoint || "http://127.0.0.1:9222");
    result.cdp_attached = true;
    result.existing_chrome_reused = true;
    result.highest_capability = "C2_CDP_ATTACH";

    const pages = browser.contexts().flatMap((context) => context.pages());
    write(path.join(outDir, "cdp_pages.json"), JSON.stringify(pages.map((page, index) => ({
      index,
      url_redacted: true,
      is_chatgpt_url: isChatGptUrl(page.url()),
      is_project_conversation: isProjectConversationUrl(page.url())
    })), null, 2));
    const page = pages.find((candidate) => isProjectConversationUrl(candidate.url())) ||
      pages.find((candidate) => isChatGptUrl(candidate.url()));
    if (!page) {
      result.status = resumeCheckOnly ? "SESSION_CLOSED" : "CHATGPT_SAFE_SESSION_UNAVAILABLE";
      result.stop_reason = "CHATGPT_PAGE_NOT_FOUND";
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(4);
    }
    result.existing_page_reused = true;
    const diagnostics = await collectSafePageDiagnostics(page);
    write(path.join(outDir, "safe_session_diagnostics.json"), JSON.stringify(diagnostics, null, 2));
    if (diagnostics.human_verification_detected || diagnostics.login_detected || diagnostics.consent_detected) {
      result.status = resumeCheckOnly ? "STILL_WAITING_FOR_HUMAN" : (diagnostics.human_verification_detected ? "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" : "CHATGPT_SAFE_SESSION_UNAVAILABLE");
      result.stop_reason = diagnostics.human_verification_detected ? "STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED" : "LOGIN_OR_CONSENT_REQUIRED";
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(5);
    }

    const composer = await findComposer(page, outDir);
    if (!composer) {
      result.status = "CHATGPT_SAFE_SESSION_UNAVAILABLE";
      result.stop_reason = "CHATGPT_COMPOSER_NOT_FOUND";
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(4);
    }
    result.composer_found = true;
    result.highest_capability = "C3_CHATGPT_TEXT_INPUT_VISIBLE";

    if (resumeCheckOnly) {
      result.status = "RESUME_READY";
      result.stop_reason = "";
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    const promptText = read(promptPath);
    const composerText = await writeComposer(page, composer, promptText);
    write(path.join(outDir, "composer_write_status.json"), JSON.stringify({
      prompt_path_redacted: true,
      prompt_length: promptText.length,
      composer_text_length: composerText.length,
      prompt_written: composerText.length > 0
    }, null, 2));

    const attachment = await attachViaFileInput(page, attachmentPath, outDir, Number(args.uploadTimeoutMs || 90000));
    result.file_input_found = attachment.status !== "CHATGPT_FILE_INPUT_NOT_FOUND";
    if (result.file_input_found) result.highest_capability = "C6_CHATGPT_FILE_INPUT_FOUND";
    result.attachment_confirmed = Boolean(attachment.ok);
    if (!attachment.ok) {
      result.status = attachment.status || "CHATGPT_ATTACHMENT_NOT_CONFIRMED";
      result.stop_reason = result.status;
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(6);
    }
    result.highest_capability = "C7_CHATGPT_IMAGE_ATTACHMENT_CONFIRMED";

    const beforeText = await getLatestAssistantText(page);
    const send = await sendPrompt(page, composer, outDir);
    write(path.join(outDir, "send_result.json"), JSON.stringify(send, null, 2));
    if (!send.ok) {
      result.status = "CHATGPT_SEND_FAILED";
      result.stop_reason = send.reason || "SEND_FAILED";
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(7);
    }
    result.prompt_sent = true;
    result.live_chatgpt_called = true;
    result.highest_capability = "C8_CHATGPT_IMAGE_PROMPT_SENT";

    const response = await waitForResponse(page, beforeText, outDir, Number(args.maxWaitSeconds || 180));
    if (!response.ok) {
      result.status = response.status || "CHATGPT_RESPONSE_TIMEOUT";
      result.stop_reason = result.status;
      write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exit(8);
    }
    result.raw_response_captured = true;
    result.json_parseable = response.json_parseable;
    result.highest_capability = "C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED";
    result.status = "RAW_RESPONSE_CAPTURED";
    write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.status = result.cdp_attached ? "CHATGPT_CONTEXT_CLOSED" : "CHATGPT_SAFE_SESSION_UNAVAILABLE";
    result.stop_reason = error.message;
    write(path.join(outDir, "probe_error.txt"), error.stack || error.message);
    write(path.join(outDir, "probe_result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(9);
  } finally {
    // Do not close user-owned Chrome. The CDP browser object is intentionally
    // left unclosed so this probe cannot close the approved session.
  }
}

main();
