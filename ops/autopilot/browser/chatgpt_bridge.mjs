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
        if (Object.hasOwn(args, name)) {
          args[name] = Array.isArray(args[name]) ? [...args[name], true] : [args[name], true];
        } else {
          args[name] = true;
        }
      } else {
        if (Object.hasOwn(args, name)) {
          args[name] = Array.isArray(args[name]) ? [...args[name], next] : [args[name], next];
        } else {
          args[name] = next;
        }
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

function valuesFromArg(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry).split(";"))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isAcceptedChatGptUrl(value) {
  return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(String(value || ""));
}

function normalizeUrlForCompare(value) {
  return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
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

function extractBlock(text, blockName) {
  const pattern = new RegExp(`<${blockName}>\\s*([\\s\\S]*?)\\s*</${blockName}>`);
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

async function getLatestAssistantText(page) {
  const texts = await page.locator('[data-message-author-role="assistant"]').allTextContents().catch(() => []);
  if (texts.length > 0) return texts[texts.length - 1].trim();
  const fallback = await page.locator("main").textContent().catch(() => "");
  return (fallback || "").trim();
}

async function verifyProjectContext(page, projectConfig, targetUrl, outDir) {
  const projectName = projectConfig.project_name || "NeuroChess Supervisor";
  await page.waitForTimeout(2500).catch(() => {});
  const currentUrl = page.url();
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").textContent({ timeout: 5000 }).catch(() => "");
  const textSample = (bodyText || "").slice(0, 4000);
  const normalizedCurrent = normalizeUrlForCompare(currentUrl);
  const normalizedTarget = normalizeUrlForCompare(targetUrl);
  const projectNameVisible = textSample.includes(projectName) || title.includes(projectName);
  const projectUrlStable = Boolean(normalizedTarget && normalizedCurrent.startsWith(normalizedTarget));
  const loginLikely = /log in|sign up|connexion|connectez|se connecter/i.test(textSample);
  const ok = Boolean(projectNameVisible || projectUrlStable);
  const result = {
    ok,
    projectName,
    targetUrl,
    currentUrl,
    title,
    projectNameVisible,
    projectUrlStable,
    loginLikely,
    verificationMode: "explicit_project_url",
    textSample
  };
  write(path.join(outDir, "project_context_verification.json"), JSON.stringify(result, null, 2));
  return result;
}

async function getComposerText(composer) {
  return await composer.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function getDomBox(locator) {
  return await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null;
    }
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }).catch(() => null);
}

async function describeLocator(locator, selector, index) {
  const dom = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const text = "value" in element ? element.value || "" : element.innerText || element.textContent || "";
    return {
      tagName: element.tagName,
      id: element.id || "",
      className: typeof element.className === "string" ? element.className : "",
      role: element.getAttribute("role") || "",
      ariaHidden: element.getAttribute("aria-hidden") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      dataTestId: element.getAttribute("data-testid") || "",
      contentEditable: element.getAttribute("contenteditable") || "",
      isContentEditable: Boolean(element.isContentEditable),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      computedStyle: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents
      },
      textSample: text.slice(0, 240)
    };
  }).catch((error) => ({ error: error.message }));

  const visibleByPlaywright = await locator.isVisible().catch(() => false);
  const editableByPlaywright = await locator.isEditable().catch(() => false);
  const visibleByCss = Boolean(
    dom.rect &&
    dom.rect.width > 20 &&
    dom.rect.height > 20 &&
    dom.computedStyle?.display !== "none" &&
    dom.computedStyle?.visibility !== "hidden" &&
    dom.computedStyle?.opacity !== "0" &&
    dom.ariaHidden !== "true"
  );
  const hiddenFallbackTextarea =
    dom.tagName === "TEXTAREA" &&
    /fallbackTextarea/i.test(dom.className || "") &&
    !visibleByCss;
  const isEditor =
    dom.isContentEditable ||
    dom.contentEditable === "true" ||
    dom.role === "textbox" ||
    dom.tagName === "TEXTAREA";
  const usable = Boolean(visibleByCss && visibleByPlaywright && isEditor && (editableByPlaywright || dom.isContentEditable) && !hiddenFallbackTextarea);
  const rejectionReason = usable
    ? ""
    : [
        visibleByCss ? "" : "not_visible_by_css",
        visibleByPlaywright ? "" : "not_visible_by_playwright",
        isEditor ? "" : "not_editor",
        (editableByPlaywright || dom.isContentEditable) ? "" : "not_editable",
        hiddenFallbackTextarea ? "hidden_fallback_textarea" : ""
      ].filter(Boolean).join(",");
  const score =
    (dom.isContentEditable ? 100 : 0) +
    (dom.contentEditable === "true" ? 40 : 0) +
    (dom.role === "textbox" ? 20 : 0) +
    (dom.tagName === "TEXTAREA" ? 5 : 0) +
    ((selector || "").includes("data-testid") ? 5 : 0) +
    Math.min(20, Math.round(((dom.rect?.width || 0) * (dom.rect?.height || 0)) / 10000));
  return {
    selector,
    index,
    visibleByPlaywright,
    editableByPlaywright,
    visibleByCss,
    hiddenFallbackTextarea,
    usable,
    rejectionReason,
    score,
    ...dom
  };
}

async function pageContainsNonce(page, nonce) {
  if (!nonce) return false;
  const text = await page.locator("body").textContent().catch(() => "");
  return (text || "").includes(nonce);
}

async function getPromptAnchorBox(page, composer, nonce) {
  const composerBox = await getDomBox(composer) || composer.__chatgptBridgeBox || await composer.boundingBox().catch(() => null);
  if (composerBox && composerBox.width > 20 && composerBox.height > 20) {
    return composerBox;
  }

  const nonceBox = await page.getByText(nonce).first().boundingBox().catch(() => null);
  if (nonceBox && nonceBox.width > 0 && nonceBox.height > 0) {
    return nonceBox;
  }

  const markerBox = await page.getByText("LIVE_BRIDGE_SMOKE_TEST_OK").first().boundingBox().catch(() => null);
  if (markerBox && markerBox.width > 0 && markerBox.height > 0) {
    return markerBox;
  }

  return null;
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
      const candidate = locator.nth(index);
      candidates.push(await describeLocator(candidate, selector, index));
    }
  }
  if (outDir) {
    write(path.join(outDir, "composer_candidates.json"), JSON.stringify(candidates, null, 2));
  }
  const chosen = candidates
    .filter((candidate) => candidate.usable)
    .sort((a, b) => b.score - a.score)[0];
  if (chosen && outDir) {
    write(path.join(outDir, "chosen_composer.json"), JSON.stringify(chosen, null, 2));
  }
  if (chosen) {
    const selected = page.locator(chosen.selector).nth(chosen.index);
    selected.__chatgptBridgeBox = chosen.rect;
    selected.__chatgptBridgeComposer = chosen;
    return selected;
  }
  return null;
}

async function clickVisibleComposer(page, composer) {
  const box = await getDomBox(composer) || composer.__chatgptBridgeBox || await composer.boundingBox().catch(() => null);
  if (box && box.width > 20 && box.height > 20) {
    await page.mouse.click(box.x + Math.min(box.width / 2, 80), box.y + Math.min(box.height / 2, 40));
    return true;
  }
  throw new Error("No visible composer box available for coordinate focus.");
}

async function writeComposer(page, composer, text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  await clickVisibleComposer(page, composer);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await page.waitForTimeout(150).catch(() => {});
  const beforeFill = (await getComposerText(composer)).trim();
  if (beforeFill) {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
  }
  await page.keyboard.insertText(cleanText);
  return await getComposerText(composer);
}

async function focusComposerForSubmit(page, composer, nonce) {
  const anchorBox = await getPromptAnchorBox(page, composer, nonce);
  if (anchorBox) {
    await page.mouse.click(anchorBox.x + Math.min(40, Math.max(4, anchorBox.width / 2)), anchorBox.y + Math.max(4, anchorBox.height / 2));
    return;
  }
  await clickVisibleComposer(page, composer).catch(() => {});
}

async function collectSendButtonCandidates(page, composer, nonce) {
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
      const disabled = await item.getAttribute("disabled").catch(() => "");
      candidates.push({ selector, index, visible, enabled, disabled: Boolean(disabled), box, label, testId });
    }
  }

  const anchorBox = await getPromptAnchorBox(page, composer, nonce);
  const buttons = page.locator("button");
  const count = await buttons.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const item = buttons.nth(index);
    const visible = await item.isVisible().catch(() => false);
    const enabled = await item.isEnabled().catch(() => false);
    const box = await item.boundingBox().catch(() => null);
    if (!visible || !enabled || !box || !anchorBox) continue;
    const nearComposer =
      box.x >= anchorBox.x - 80 &&
      box.x <= anchorBox.x + anchorBox.width + 220 &&
      box.y >= anchorBox.y - 120 &&
      box.y <= anchorBox.y + anchorBox.height + 180;
    if (nearComposer) {
      const label = await item.getAttribute("aria-label").catch(() => "");
      const testId = await item.getAttribute("data-testid").catch(() => "");
      candidates.push({ selector: "near_composer_button", index, visible, enabled, box, label, testId });
    }
  }
  return candidates;
}

async function attachmentSignals(page, attachmentPaths) {
  const names = attachmentPaths.map((file) => path.basename(file));
  const bodyText = await page.locator("body").textContent().catch(() => "");
  const fileInputValues = await page.locator('input[type="file"]').evaluateAll((inputs) =>
    inputs.map((input) => ({
      value: input.value || "",
      fileCount: input.files ? input.files.length : 0
    }))
  ).catch(() => []);
  const thumbnailCount = await page.locator('img[src^="blob:"], img[alt*=".png" i], img[alt*=".jpg" i], img[alt*=".jpeg" i]').count().catch(() => 0);
  const attachmentLikeCount = await page.locator(
    '[data-testid*="attachment" i], [data-testid*="file" i], [aria-label*="Remove" i], [aria-label*="Supprimer" i], [aria-label*="Retirer" i]'
  ).count().catch(() => 0);
  const progressCount = await page.locator(
    '[role="progressbar"], [data-testid*="progress" i], [aria-busy="true"]'
  ).count().catch(() => 0);
  return {
    names,
    fileInputValues,
    fileInputHasFiles: fileInputValues.some((entry) => entry.fileCount > 0 || entry.value),
    fileNameVisible: names.some((name) => bodyText.includes(name)),
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

async function waitForAttachmentVisible(page, attachmentPaths, before, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latest = await attachmentSignals(page, attachmentPaths);
  while (Date.now() < deadline) {
    if (uploadDetected(before, latest)) {
      const completionDeadline = Date.now() + Math.min(10000, Math.max(1000, deadline - Date.now()));
      let completed = latest.progressCount === 0;
      while (!completed && Date.now() < completionDeadline) {
        await page.waitForTimeout(500);
        latest = await attachmentSignals(page, attachmentPaths);
        completed = latest.progressCount === 0;
      }
      return {
        detected: true,
        completed: completed ? "yes" : "unknown",
        signals: latest
      };
    }
    await page.waitForTimeout(500);
    latest = await attachmentSignals(page, attachmentPaths);
  }
  return {
    detected: false,
    completed: "no",
    signals: latest
  };
}

async function collectAttachButtonCandidates(page, composer) {
  const anchorBox = await getPromptAnchorBox(page, composer, "");
  const buttons = page.locator("button");
  const count = await buttons.count().catch(() => 0);
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const item = buttons.nth(index);
    const visible = await item.isVisible().catch(() => false);
    const enabled = await item.isEnabled().catch(() => false);
    const box = await item.boundingBox().catch(() => null);
    const label = await item.getAttribute("aria-label").catch(() => "");
    const title = await item.getAttribute("title").catch(() => "");
    const testId = await item.getAttribute("data-testid").catch(() => "");
    const text = (await item.innerText().catch(() => "")).trim();
    const metadata = `${label} ${title} ${testId} ${text}`;
    const nameLooksLikeAttach = /attach|upload|file|image|plus|add|joindre|ajouter|télévers|televers|\+|pièce/i.test(metadata);
    const nearComposer = Boolean(anchorBox && box &&
      box.x >= anchorBox.x - 160 &&
      box.x <= anchorBox.x + anchorBox.width + 160 &&
      box.y >= anchorBox.y - 180 &&
      box.y <= anchorBox.y + anchorBox.height + 180);
    candidates.push({ selector: "button", index, visible, enabled, box, label, title, testId, text, nearComposer, nameLooksLikeAttach });
  }
  return candidates.filter((candidate) => candidate.visible && candidate.enabled && candidate.nearComposer && candidate.nameLooksLikeAttach);
}

async function uploadViaExistingInput(page, attachmentPaths) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const input = inputs.nth(index);
    const accept = await input.getAttribute("accept").catch(() => "");
    try {
      await input.setInputFiles(attachmentPaths, { timeout: 8000 });
      return { ok: true, strategy: "input_set_files", inputIndex: index, accept };
    } catch (error) {
      if (index === 0) {
        return { ok: false, strategy: "input_set_files", inputIndex: index, accept, error: error.message };
      }
    }
  }
  return { ok: false, strategy: "input_set_files", error: "No input[type=file] found." };
}

async function uploadViaFileChooser(page, composer, attachmentPaths, outDir) {
  const candidates = await collectAttachButtonCandidates(page, composer);
  write(path.join(outDir, "attach_button_candidates.json"), JSON.stringify(candidates, null, 2));
  for (const candidate of candidates.slice(0, 6)) {
    const button = page.locator("button").nth(candidate.index);
    try {
      const chooserPromise = page.waitForEvent("filechooser", { timeout: 8000 });
      await button.click({ timeout: 3000 });
      const chooser = await chooserPromise;
      await chooser.setFiles(attachmentPaths);
      return { ok: true, strategy: "filechooser_button", candidate };
    } catch {
      // Try the next candidate.
    }
  }
  return { ok: false, strategy: "filechooser_button", error: "No attach button opened a file chooser." };
}

async function uploadAttachments(page, composer, attachmentPaths, outDir, timeoutMs) {
  if (attachmentPaths.length === 0) {
    return { ok: true, skipped: true };
  }
  for (const file of attachmentPaths) {
    if (!fs.existsSync(file)) {
      return { ok: false, reason: "ATTACHMENT_FILE_MISSING", file };
    }
  }

  await page.screenshot({ path: path.join(outDir, "upload_before.png"), fullPage: true }).catch(() => {});
  const before = await attachmentSignals(page, attachmentPaths);
  const attempts = [];

  const strategies = [
    () => uploadViaExistingInput(page, attachmentPaths),
    () => uploadViaFileChooser(page, composer, attachmentPaths, outDir),
    async () => {
      const retry = await uploadViaExistingInput(page, attachmentPaths);
      return { ...retry, strategy: "input_set_files_after_attach_probe" };
    }
  ];

  for (const strategy of strategies) {
    const attempt = await strategy();
    attempts.push(attempt);
    if (!attempt.ok) continue;
    const visible = await waitForAttachmentVisible(page, attachmentPaths, before, timeoutMs);
    const result = { ...attempt, ...visible, before };
    write(path.join(outDir, "upload_result.json"), JSON.stringify(result, null, 2));
    if (visible.detected) {
      await page.screenshot({ path: path.join(outDir, "upload_after.png"), fullPage: true }).catch(() => {});
      return { ok: true, ...result };
    }
  }

  const after = await attachmentSignals(page, attachmentPaths);
  const failure = { ok: false, reason: "UPLOAD_FAILED", attempts, before, after };
  write(path.join(outDir, "upload_result.json"), JSON.stringify(failure, null, 2));
  await page.screenshot({ path: path.join(outDir, "upload_failed.png"), fullPage: true }).catch(() => {});
  return failure;
}

function bestVisibleSendCandidate(candidates) {
  return candidates
    .filter((candidate) => candidate.visible && candidate.enabled && candidate.box && candidate.box.width > 0 && candidate.box.height > 0)
    .sort((a, b) => {
      const score = (candidate) =>
        (candidate.selector.includes("aria-label") ? 30 : 0) +
        (candidate.selector.includes("data-testid") ? 20 : 0) +
        (candidate.selector === "near_composer_button" ? 10 : 0) +
        Math.min(10, Math.round((candidate.box.width * candidate.box.height) / 500));
      return score(b) - score(a);
    })[0] || null;
}

async function sendState(page, composer, nonce) {
  const composerText = await getComposerText(composer);
  const userTexts = await page.locator('[data-message-author-role="user"]').allTextContents().catch(() => []);
  const nonceInUserMessage = userTexts.some((text) => text.includes(nonce));
  const assistantText = await getLatestAssistantText(page);
  const assistantHasNonce = assistantText.includes(`<NC_SUPERVISOR_RESPONSE nonce="${nonce}">`) ||
    assistantText.includes(`<NC_DONE nonce="${nonce}">DONE</NC_DONE>`);
  const stopIndicatorCount = await page.locator(
    'button[aria-label*="Stop" i], button[aria-label*="Arrêter" i], button[data-testid*="stop" i]'
  ).count().catch(() => 0);
  const composerStillHasNonce = composerText.includes(nonce);
  return {
    sent: nonceInUserMessage || assistantHasNonce || stopIndicatorCount > 0,
    composerText,
    nonceInUserMessage,
    assistantHasNonce,
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

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
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

async function saveSendFailureDebug(page, composer, outDir, candidates, reason, nonce = "") {
  await page.screenshot({ path: path.join(outDir, "send_failed_after.png"), fullPage: true }).catch(() => {});
  const composerText = await getComposerText(composer);
  const composerHtml = await composer.evaluate((element) => element.outerHTML || "").catch(() => "");
  const chosenButton = bestVisibleSendCandidate(candidates || []);
  const debug = {
    reason,
    currentUrl: page.url(),
    composerText,
    pageContainsRequestNonce: await pageContainsNonce(page, nonce),
    candidateSendButtons: candidates,
    chosenSendButton: chosenButton,
    composerHtmlSnippet: composerHtml.slice(0, 4000)
  };
  write(path.join(outDir, "send_failed_debug.json"), JSON.stringify(debug, null, 2));
  write(path.join(outDir, "composer_text_snapshot.txt"), composerText);
  if (chosenButton) {
    write(path.join(outDir, "chosen_send_button.json"), JSON.stringify(chosenButton, null, 2));
  }
}

async function submitMessage(page, composer, request, nonce, outDir, timeoutMs, options = {}) {
  await page.screenshot({ path: path.join(outDir, "send_before.png"), fullPage: true }).catch(() => {});
  const composerText = options.requestAlreadyWritten ? await getComposerText(composer) : await writeComposer(page, composer, request);
  const nonceVisible = composerText.includes(nonce) || await pageContainsNonce(page, nonce);
  if (!nonceVisible) {
    await saveSendFailureDebug(page, composer, outDir, [], "COMPOSER_NONCE_MISSING_AFTER_FILL", nonce);
    return { ok: false, reason: "COMPOSER_NONCE_MISSING_AFTER_FILL" };
  }

  const deadline = Date.now() + timeoutMs;
  const attempts = [];
  const candidates = await collectSendButtonCandidates(page, composer, nonce);
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));
  const chosenButton = bestVisibleSendCandidate(candidates);
  if (chosenButton) {
    write(path.join(outDir, "chosen_send_button.json"), JSON.stringify(chosenButton, null, 2));
  }

  const recordAttempt = async (name, action) => {
    if (Date.now() > deadline) return false;
    try {
      const remaining = Math.max(1000, deadline - Date.now());
      await withTimeout(action(), Math.min(8000, remaining), name);
      const state = await waitForSendSuccess(page, composer, nonce, Math.min(5000, Math.max(1000, deadline - Date.now())));
      attempts.push({ name, ok: state.sent, state });
      return state.sent;
    } catch (error) {
      attempts.push({ name, ok: false, error: error.message });
      return false;
    }
  };

  if (await recordAttempt("keyboard_enter", async () => {
    await focusComposerForSubmit(page, composer, nonce);
    await page.keyboard.press("Enter");
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "keyboard_enter" };
  }

  if (await recordAttempt("keyboard_ctrl_enter", async () => {
    await focusComposerForSubmit(page, composer, nonce);
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
    const target = bestVisibleSendCandidate(candidates);
    if (!target?.box) throw new Error("No visible send button bounding box for coordinate fallback.");
    await page.mouse.click(target.box.x + target.box.width / 2, target.box.y + target.box.height / 2);
  })) {
    write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
    return { ok: true, method: "coordinate_fallback" };
  }

  write(path.join(outDir, "send_attempts.json"), JSON.stringify(attempts, null, 2));
  await saveSendFailureDebug(page, composer, outDir, candidates, "SEND_FAILED", nonce);
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
  const projectConfig = config.chatgpt_project || {};

  if (!live) {
    write(path.join(outDir, "bridge_error.md"), "Dry-run mode: browser bridge did not send a message.");
    process.exit(0);
  }

  const projectMode = Boolean(projectConfig.enabled);
  let targetUrl = bridgeConfig.chatgpt_url || "https://chatgpt.com/";
  if (projectMode) {
    const projectUrl = String(projectConfig.project_url || "").trim();
    const requireProjectUrl = projectConfig.require_project_url !== false;
    const allowGenericFallback = Boolean(projectConfig.allow_generic_chat_fallback);
    if (!projectUrl && requireProjectUrl && !allowGenericFallback) {
      write(path.join(outDir, "bridge_error.md"), "PROJECT_URL_MISSING");
      write(path.join(outDir, "project_navigation.json"), JSON.stringify({
        status: "fail",
        reason: "PROJECT_URL_MISSING",
        project_name: projectConfig.project_name || "NeuroChess Supervisor",
        project_url_configured: false,
        allow_generic_chat_fallback: allowGenericFallback
      }, null, 2));
      process.exit(1);
    }
    if (projectUrl) {
      if (!isAcceptedChatGptUrl(projectUrl)) {
        write(path.join(outDir, "bridge_error.md"), "PROJECT_URL_INVALID");
        write(path.join(outDir, "project_navigation.json"), JSON.stringify({
          status: "fail",
          reason: "PROJECT_URL_INVALID",
          project_url: projectUrl
        }, null, 2));
        process.exit(1);
      }
      targetUrl = projectUrl;
    }
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
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  if (projectMode) {
    const projectVerification = await verifyProjectContext(page, projectConfig, targetUrl, outDir);
    if (!projectVerification.ok) {
      write(path.join(outDir, "bridge_error.md"), "PROJECT_CONTEXT_UNVERIFIED");
      await browser.close();
      process.exit(1);
    }
  }

  const composer = await findComposer(page, outDir);
  if (!composer) {
    write(path.join(outDir, "bridge_error.md"), "ChatGPT composer not found. Log in manually with the dedicated Chrome profile, select the required model/mode, and retry.");
    await browser.close();
    process.exit(1);
  }

  const attachmentPaths = valuesFromArg(args.attachment || args.attachments).map((file) => path.resolve(file));
  const uploadTimeoutMs = Number(bridgeConfig.upload_phase_timeout_seconds || 90) * 1000;
  let requestAlreadyWritten = false;
  if (attachmentPaths.length > 0) {
    const composerText = await writeComposer(page, composer, request);
    const nonceVisible = composerText.includes(nonce) || await pageContainsNonce(page, nonce);
    if (!nonceVisible) {
      await saveSendFailureDebug(page, composer, outDir, [], "COMPOSER_NONCE_MISSING_BEFORE_UPLOAD", nonce);
      write(path.join(outDir, "bridge_error.md"), "COMPOSER_NONCE_MISSING_BEFORE_UPLOAD");
      await browser.close();
      process.exit(1);
    }
    requestAlreadyWritten = true;
    const uploadResult = await uploadAttachments(page, composer, attachmentPaths, outDir, uploadTimeoutMs);
    if (!uploadResult.ok) {
      write(path.join(outDir, "bridge_error.md"), uploadResult.reason || "UPLOAD_FAILED");
      await browser.close();
      process.exit(1);
    }
  }

  const sendTimeoutMs = Number(bridgeConfig.send_phase_timeout_seconds || 60) * 1000;
  const sendResult = await submitMessage(page, composer, request, nonce, outDir, sendTimeoutMs, { requestAlreadyWritten });
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
  const stopReason = extractBlock(completed, "STOP_REASON");
  if (stopReason) {
    write(path.join(outDir, "stop_reason.md"), stopReason);
  }
  await browser.close();
}

main().catch((error) => {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "chatgpt_bridge");
  write(path.join(outDir, "bridge_error.md"), error.stack || error.message);
  process.exit(1);
});
