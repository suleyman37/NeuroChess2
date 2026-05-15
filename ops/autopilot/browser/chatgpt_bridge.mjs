import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const name = key.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[name] = true;
      } else {
        args[name] = next;
        i += 1;
      }
    }
  }
  return args;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function readMaybe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function profileLockFiles(profilePath) {
  return ["SingletonLock", "SingletonCookie", "SingletonSocket"]
    .map((name) => path.join(profilePath, name))
    .filter((file) => fs.existsSync(file));
}

function validateDone(text, nonce) {
  const trimmed = text.trim();
  const done = `<NC_DONE nonce="${nonce}">DONE</NC_DONE>`;
  const doneMatches = [...trimmed.matchAll(/<NC_DONE nonce="([^"]+)">DONE<\/NC_DONE>/g)];
  if (doneMatches.length !== 1) return { ok: false, reason: "DONE missing or duplicated" };
  if (doneMatches[0][1] !== nonce) return { ok: false, reason: "DONE wrong nonce" };
  if (!trimmed.endsWith("</NC_SUPERVISOR_RESPONSE>")) return { ok: false, reason: "response block is not final" };
  const afterDone = trimmed.slice(doneMatches[0].index + done.length).trim();
  if (afterDone !== "</NC_SUPERVISOR_RESPONSE>") return { ok: false, reason: "DONE is not final meaningful block" };
  if (!trimmed.startsWith(`<NC_SUPERVISOR_RESPONSE nonce="${nonce}">`)) {
    return { ok: false, reason: "root nonce missing or wrong" };
  }
  return { ok: true };
}

async function getLatestAssistantText(page) {
  const texts = await page.locator('[data-message-author-role="assistant"]').allTextContents().catch(() => []);
  if (texts.length > 0) return texts[texts.length - 1].trim();
  const fallback = await page.locator("main").textContent().catch(() => "");
  return (fallback || "").trim();
}

async function getComposerText(composer) {
  return await composer.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // ESM package resolution does not honor NODE_PATH reliably. Keep this
    // bridge repo-local-dependency-free by accepting an explicit runtime module
    // path through NODE_PATH for smoke tests and local automation.
  }

  try {
    return requireFromHere("playwright");
  } catch {
    // Continue to explicit NODE_PATH probing below.
  }

  const searchPaths = (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean);
  for (const moduleRoot of searchPaths) {
    try {
      return requireFromHere(path.join(moduleRoot, "playwright"));
    } catch {
      // Try the next NODE_PATH entry.
    }
  }

  throw new Error("Cannot load Playwright. Set NODE_PATH to a node_modules directory containing playwright.");
}

async function findComposer(page) {
  const selectors = [
    '[contenteditable="true"][data-lexical-editor="true"]',
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[name="prompt-textarea"]',
    'textarea'
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      const editable = await candidate.isEditable().catch(() => false);
      if (visible && editable) {
        return candidate;
      }
    }
  }
  return null;
}

async function writeComposer(page, composer, text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  await composer.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  const beforeFill = (await getComposerText(composer)).trim();
  if (beforeFill) {
    await composer.fill("", { timeout: 5000 }).catch(() => {});
  }
  try {
    await composer.fill(cleanText, { timeout: 10000 });
  } catch {
    await page.keyboard.insertText(cleanText);
  }
  return await getComposerText(composer);
}

async function collectSendButtonCandidates(page, composer) {
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
      candidates.push({ selector, index, visible, enabled, box });
    }
  }

  const composerBox = await composer.boundingBox().catch(() => null);
  const buttons = page.locator("button");
  const count = await buttons.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = buttons.nth(index);
    const visible = await item.isVisible().catch(() => false);
    const enabled = await item.isEnabled().catch(() => false);
    const box = await item.boundingBox().catch(() => null);
    if (!visible || !enabled || !box || !composerBox) continue;
    const nearComposer =
      box.x >= composerBox.x - 24 &&
      box.x <= composerBox.x + composerBox.width + 80 &&
      box.y >= composerBox.y - 24 &&
      box.y <= composerBox.y + composerBox.height + 80;
    if (nearComposer) {
      const label = await item.getAttribute("aria-label").catch(() => "");
      const testId = await item.getAttribute("data-testid").catch(() => "");
      candidates.push({ selector: "near_composer_button", index, visible, enabled, box, label, testId });
    }
  }
  return candidates;
}

async function sendState(page, composer, nonce) {
  const composerText = await getComposerText(composer);
  const userTexts = await page.locator('[data-message-author-role="user"]').allTextContents().catch(() => []);
  const nonceInUserMessage = userTexts.some((text) => text.includes(nonce));
  const assistantStarted = Boolean(await getLatestAssistantText(page));
  const stopIndicatorCount = await page.locator(
    'button[aria-label*="Stop" i], button[aria-label*="Arrêter" i], button[data-testid*="stop" i]'
  ).count().catch(() => 0);
  const composerStillHasNonce = composerText.includes(nonce);
  return {
    sent: nonceInUserMessage || (!composerStillHasNonce && (assistantStarted || stopIndicatorCount > 0)),
    composerText,
    nonceInUserMessage,
    assistantStarted,
    stopIndicatorCount,
    composerStillHasNonce
  };
}

async function waitForSendSuccess(page, composer, nonce, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  let state = await sendState(page, composer, nonce);
  while (Date.now() < deadline) {
    if (state.sent) return state;
    await page.waitForTimeout(500);
    state = await sendState(page, composer, nonce);
  }
  return state;
}

async function clickAccessibleSendButton(page, candidates, jsClick = false) {
  for (const candidate of candidates) {
    if (!candidate.visible || !candidate.enabled) continue;
    const locator = candidate.selector === "near_composer_button"
      ? page.locator("button").nth(candidate.index)
      : page.locator(candidate.selector).nth(candidate.index);
    try {
      if (jsClick) {
        await locator.evaluate((element) => element.click());
      } else {
        await locator.click({ timeout: 5000 });
      }
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function saveSendFailureDebug(page, composer, outDir, candidates, reason) {
  await page.screenshot({ path: path.join(outDir, "send_failed_after.png"), fullPage: true }).catch(() => {});
  const composerText = await getComposerText(composer);
  const composerHtml = await composer.evaluate((element) => element.outerHTML || "").catch(() => "");
  const debug = {
    reason,
    currentUrl: page.url(),
    composerText,
    candidateSendButtons: candidates,
    composerHtmlSnippet: composerHtml.slice(0, 4000)
  };
  write(path.join(outDir, "send_failed_debug.json"), JSON.stringify(debug, null, 2));
  write(path.join(outDir, "composer_text_snapshot.txt"), composerText);
}

async function submitMessage(page, composer, request, nonce, outDir, timeoutMs) {
  await page.screenshot({ path: path.join(outDir, "send_before.png"), fullPage: true }).catch(() => {});
  const composerText = await writeComposer(page, composer, request);
  if (!composerText.includes(nonce)) {
    await saveSendFailureDebug(page, composer, outDir, [], "COMPOSER_NONCE_MISSING_AFTER_FILL");
    return { ok: false, reason: "COMPOSER_NONCE_MISSING_AFTER_FILL" };
  }

  const deadline = Date.now() + timeoutMs;
  const attempts = [];
  const candidates = await collectSendButtonCandidates(page, composer);
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));

  const recordAttempt = async (name, action) => {
    if (Date.now() > deadline) return false;
    try {
      await action();
      const state = await waitForSendSuccess(page, composer, nonce, Math.min(5000, Math.max(1000, deadline - Date.now())));
      attempts.push({ name, ok: state.sent, state });
      return state.sent;
    } catch (error) {
      attempts.push({ name, ok: false, error: error.message });
      return false;
    }
  };

  if (await recordAttempt("keyboard_enter", async () => {
    await composer.click();
    await page.keyboard.press("Enter");
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "keyboard_enter" };
  }

  if (await recordAttempt("keyboard_ctrl_enter", async () => {
    await composer.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "keyboard_ctrl_enter" };
  }

  if (await recordAttempt("accessible_button_click", async () => {
    const clicked = await clickAccessibleSendButton(page, candidates, false);
    if (!clicked) throw new Error("No enabled visible send button candidate clicked.");
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "accessible_button_click" };
  }

  if (await recordAttempt("js_button_click", async () => {
    const clicked = await clickAccessibleSendButton(page, candidates, true);
    if (!clicked) throw new Error("No enabled visible send button candidate JS-clicked.");
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "js_button_click" };
  }

  if (await recordAttempt("coordinate_fallback", async () => {
    const box = await composer.boundingBox();
    if (!box) throw new Error("No composer bounding box for coordinate fallback.");
    await page.mouse.click(box.x + box.width - 18, box.y + box.height - 18);
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "coordinate_fallback" };
  }

  write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
  await saveSendFailureDebug(page, composer, outDir, candidates, "SEND_FAILED");
  return { ok: false, reason: "SEND_FAILED" };
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "chatgpt_bridge");
  fs.mkdirSync(outDir, { recursive: true });

  const live = Boolean(args.live);
  const nonce = args.nonce || `NC_${crypto.randomBytes(12).toString("hex")}`;
  const configPath = args.config || path.join(process.cwd(), "ops", "autopilot", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const bridgeConfig = config.chatgpt_web_bridge || {};

  if (!live) {
    write(path.join(outDir, "bridge_error.md"), "Dry-run mode: browser bridge did not send a message.");
    process.exit(0);
  }

  let playwright;
  try {
    playwright = await loadPlaywright();
  } catch (error) {
    write(path.join(outDir, "bridge_error.md"), `Playwright unavailable: ${error.message}`);
    process.exit(1);
  }

  const evidencePath = args.evidence;
  let request = "";
  if (args.request) {
    request = readMaybe(args.request);
  } else {
    const systemPrompt = readMaybe(path.join(process.cwd(), "ops", "autopilot", "prompts", "chatgpt_supervisor_system_prompt.md")).replaceAll("{{NONCE}}", nonce);
    const question = evidencePath ? readMaybe(path.join(evidencePath, "question_for_chatgpt.md")) : "";
    const projectState = evidencePath ? readMaybe(path.join(evidencePath, "project_state.md")) : "";
    const checks = evidencePath ? readMaybe(path.join(evidencePath, "checks_summary.md")) : "";
    const changedFiles = evidencePath ? readMaybe(path.join(evidencePath, "changed_files.txt")) : "";
    const diffStat = evidencePath ? readMaybe(path.join(evidencePath, "diff_stat.txt")) : "";

    request = [
      systemPrompt,
      "\n<EVIDENCE_PACK>",
      question,
      projectState,
      "Changed files:\n" + changedFiles,
      "Diff stat:\n" + diffStat,
      checks,
      "</EVIDENCE_PACK>"
    ].join("\n\n");
  }
  write(path.join(outDir, "supervisor_request.md"), request);

  const profile = bridgeConfig.chrome_profile_path || path.join(process.env.USERPROFILE || process.cwd(), "Documents", "Dev", "ChatGPTSupervisorChromeProfile");
  const lockFiles = profileLockFiles(profile);
  if (lockFiles.length > 0) {
    write(path.join(outDir, "chrome_profile_lock_files.json"), JSON.stringify({
      profile,
      lockFiles,
      note: "Lock files are reported only. Process-level lock checks are done by ask_chatgpt_web.ps1 before this bridge launches."
    }, null, 2));
  }

  const launchOptions = {
    headless: false,
    channel: bridgeConfig.chrome_channel || "chrome"
  };
  const browser = await playwright.chromium.launchPersistentContext(profile, launchOptions);
  const page = await browser.newPage();
  await page.goto(bridgeConfig.chatgpt_url || "https://chatgpt.com/", { waitUntil: "domcontentloaded" });

  const composer = await findComposer(page);
  if (!composer) {
    write(path.join(outDir, "bridge_error.md"), "ChatGPT composer not found. Log in manually with the dedicated Chrome profile, select the required model/mode, and retry.");
    await browser.close();
    process.exit(1);
  }

  const sendTimeoutMs = Number(bridgeConfig.send_phase_timeout_seconds || 60) * 1000;
  const sendResult = await submitMessage(page, composer, request, nonce, outDir, sendTimeoutMs);
  if (!sendResult.ok) {
    write(path.join(outDir, "bridge_error.md"), sendResult.reason);
    await browser.close();
    process.exit(1);
  }
  write(path.join(outDir, "send_result.json"), JSON.stringify(sendResult, null, 2));

  const maxWaitMs = Number(bridgeConfig.max_wait_seconds || 900) * 1000;
  const stableMs = Number(bridgeConfig.response_stability_seconds || 15) * 1000;
  const deadline = Date.now() + maxWaitMs;
  let last = "";
  let stableSince = Date.now();
  let completed = "";

  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const text = await getLatestAssistantText(page);
    if (text !== last) {
      last = text;
      stableSince = Date.now();
    }
    const doneCheck = validateDone(text, nonce);
    if (doneCheck.ok && Date.now() - stableSince >= stableMs) {
      completed = text;
      break;
    }
  }

  if (!completed) {
    const partial = last || await getLatestAssistantText(page);
    write(path.join(outDir, "partial_response.txt"), partial);
    write(path.join(outDir, "bridge_error.md"), "Timed out before stable nonce-bound DONE sentinel.");
    await browser.close();
    process.exit(1);
  }

  const doneCheck = validateDone(completed, nonce);
  if (!doneCheck.ok) {
    write(path.join(outDir, "raw_response.txt"), completed);
    write(path.join(outDir, "bridge_error.md"), doneCheck.reason);
    await browser.close();
    process.exit(1);
  }

  write(path.join(outDir, "raw_response.txt"), completed);
  write(path.join(outDir, "extracted_response.txt"), completed);
  await browser.close();
}

main().catch((error) => {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "chatgpt_bridge");
  write(path.join(outDir, "bridge_error.md"), error.stack || error.message);
  process.exit(1);
});
