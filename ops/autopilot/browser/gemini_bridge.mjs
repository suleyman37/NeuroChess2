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

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Continue to CommonJS and NODE_PATH fallbacks.
  }

  try {
    return requireFromHere("playwright");
  } catch {
    // Continue to explicit NODE_PATH probing.
  }

  const searchPaths = (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean);
  for (const moduleRoot of searchPaths) {
    try {
      return requireFromHere(path.join(moduleRoot, "playwright"));
    } catch {
      // Try pnpm layout below.
    }
    const pnpmRoot = path.join(moduleRoot, ".pnpm");
    if (fs.existsSync(pnpmRoot)) {
      const playwrightDirs = fs.readdirSync(pnpmRoot)
        .filter((entry) => /^playwright@/.test(entry))
        .sort()
        .reverse();
      for (const entry of playwrightDirs) {
        try {
          return requireFromHere(path.join(pnpmRoot, entry, "node_modules", "playwright"));
        } catch {
          // Try next candidate.
        }
      }
    }
  }

  throw new Error("Cannot load Playwright. Set NODE_PATH to a node_modules directory containing playwright.");
}

function extractAuditBlock(text, nonce) {
  const pattern = new RegExp(`<NC_GEMINI_AUDIT\\s+nonce="${nonce.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">[\\s\\S]*?<NC_DONE\\s+nonce="${nonce.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">DONE<\\/NC_DONE>\\s*<\\/NC_GEMINI_AUDIT>`);
  const match = text.match(pattern);
  return match ? match[0].trim() : "";
}

async function getBodyText(page) {
  return (await page.locator("body").textContent({ timeout: 5000 }).catch(() => "")) || "";
}

async function detectLogin(page) {
  const text = await getBodyText(page);
  const composerCount = await page.locator('rich-textarea [contenteditable="true"], div[contenteditable="true"], textarea, [role="textbox"]').count().catch(() => 0);
  const loginLikely = /sign in|log in|connexion|se connecter|continue with google|use your google account/i.test(text);
  return {
    login_detected: composerCount > 0 && !loginLikely ? "yes" : (loginLikely ? "no" : "unknown"),
    composer_candidate_count: composerCount,
    login_likely: loginLikely,
    current_url: page.url(),
    title: await page.title().catch(() => ""),
    model_mode_verified: "unknown"
  };
}

async function findComposer(page, outDir) {
  const selectors = [
    'rich-textarea [contenteditable="true"]',
    '[data-testid="input"] [contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
    '[role="textbox"]'
  ];
  const candidates = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = locator.nth(index);
      const meta = await item.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tagName: element.tagName,
          role: element.getAttribute("role") || "",
          ariaLabel: element.getAttribute("aria-label") || "",
          contentEditable: element.getAttribute("contenteditable") || "",
          isContentEditable: Boolean(element.isContentEditable),
          textSample: (element.innerText || element.textContent || element.value || "").slice(0, 120),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity
        };
      }).catch((error) => ({ error: error.message }));
      const visible = await item.isVisible().catch(() => false);
      const editable = await item.isEditable().catch(() => false);
      const usable = Boolean(
        visible &&
        (editable || meta.isContentEditable) &&
        meta.rect &&
        meta.rect.width > 20 &&
        meta.rect.height > 20 &&
        meta.display !== "none" &&
        meta.visibility !== "hidden" &&
        meta.opacity !== "0"
      );
      candidates.push({ selector, index, visible, editable, usable, ...meta });
    }
  }
  write(path.join(outDir, "composer_candidates.json"), JSON.stringify(candidates, null, 2));
  const chosen = candidates.filter((candidate) => candidate.usable).sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
  if (!chosen) return null;
  write(path.join(outDir, "chosen_composer.json"), JSON.stringify(chosen, null, 2));
  return page.locator(chosen.selector).nth(chosen.index);
}

async function getComposerText(composer) {
  return await composer.evaluate((element) => {
    if ("value" in element) return element.value || "";
    return element.innerText || element.textContent || "";
  }).catch(() => "");
}

async function writeComposer(page, composer, request, nonce) {
  await composer.click({ timeout: 8000 }).catch(async () => {
    const box = await composer.boundingBox();
    if (!box) throw new Error("composer has no visible box");
    await page.mouse.click(box.x + Math.min(80, box.width / 2), box.y + Math.min(40, box.height / 2));
  });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await page.keyboard.insertText(request);
  const text = await getComposerText(composer);
  if (!text.includes(nonce)) {
    throw new Error("COMPOSER_NONCE_MISSING_AFTER_FILL");
  }
}

async function sendMessage(page, outDir) {
  const selectors = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Envoyer" i]',
    'button[data-testid*="send" i]',
    'button[type="submit"]'
  ];
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
        ariaLabel: await item.getAttribute("aria-label").catch(() => ""),
        box: await item.boundingBox().catch(() => null)
      });
    }
  }
  write(path.join(outDir, "send_button_candidates.json"), JSON.stringify(candidates, null, 2));
  const chosen = candidates.find((candidate) => candidate.visible && candidate.enabled && candidate.box);
  if (chosen) {
    const button = page.locator(chosen.selector).nth(chosen.index);
    await button.click({ timeout: 5000 });
    return { ok: true, method: "button", chosen };
  }
  await page.keyboard.press("Enter");
  return { ok: true, method: "keyboard_enter" };
}

async function waitForAudit(page, nonce, timeoutMs, stabilityMs) {
  const deadline = Date.now() + timeoutMs;
  let lastBlock = "";
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    const text = await getBodyText(page);
    const block = extractAuditBlock(text, nonce);
    if (block && block !== lastBlock) {
      lastBlock = block;
      stableSince = Date.now();
    }
    if (lastBlock && Date.now() - stableSince >= stabilityMs) {
      return { ok: true, block: lastBlock, bodyTextLength: text.length };
    }
  }
  const finalText = await getBodyText(page);
  return { ok: false, block: extractAuditBlock(finalText, nonce), partial: finalText.slice(-12000), bodyTextLength: finalText.length };
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "gemini_bridge");
  fs.mkdirSync(outDir, { recursive: true });

  const nonce = args.nonce || `A16H_${crypto.randomBytes(8).toString("hex")}`;
  const requestPath = args.request;
  if (!requestPath || !fs.existsSync(requestPath)) {
    throw new Error("REQUEST_FILE_MISSING");
  }
  const request = read(requestPath);
  if (!request.includes(nonce)) {
    throw new Error("REQUEST_NONCE_MISSING");
  }
  if (/(?:^|\n)\s*(codex_prompt\s*:|<MICRO_PROMPT\b)/i.test(request)) {
    throw new Error("REQUEST_CONTAINS_FORBIDDEN_PROMPT_TOKEN");
  }

  const playwright = await loadPlaywright();
  const profile = args.profile || "C:\\Users\\suley\\Documents\\Dev\\GeminiAuditorChromeProfile";
  const url = args.url || "https://gemini.google.com/app";
  const timeoutMs = Number(args.timeout || 180) * 1000;
  const stabilityMs = Number(args.stability || 8) * 1000;

  const context = await playwright.chromium.launchPersistentContext(profile, {
    headless: false,
    channel: args.channel || "chrome"
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, "gemini_loaded.png"), fullPage: true }).catch(() => {});
    const login = await detectLogin(page);
    write(path.join(outDir, "gemini_navigation.json"), JSON.stringify(login, null, 2));
    if (login.login_detected === "no") {
      write(path.join(outDir, "bridge_error.md"), "STOP_MANUAL_GEMINI_LOGIN_REQUIRED");
      process.exitCode = 10;
      return;
    }

    const composer = await findComposer(page, outDir);
    if (!composer) {
      write(path.join(outDir, "bridge_error.md"), login.login_likely ? "STOP_MANUAL_GEMINI_LOGIN_REQUIRED" : "GEMINI_COMPOSER_NOT_FOUND");
      process.exitCode = login.login_likely ? 10 : 1;
      return;
    }

    await writeComposer(page, composer, request, nonce);
    await page.screenshot({ path: path.join(outDir, "gemini_before_send.png"), fullPage: true }).catch(() => {});
    const sendResult = await sendMessage(page, outDir);
    write(path.join(outDir, "send_result.json"), JSON.stringify(sendResult, null, 2));

    const audit = await waitForAudit(page, nonce, timeoutMs, stabilityMs);
    if (!audit.ok) {
      write(path.join(outDir, "partial_response.txt"), audit.block || audit.partial || "");
      write(path.join(outDir, "bridge_error.md"), "GEMINI_RESPONSE_TIMEOUT_OR_DONE_MISSING");
      process.exitCode = 1;
      return;
    }

    write(path.join(outDir, "raw_response.txt"), audit.block);
    write(path.join(outDir, "extracted_response.txt"), audit.block);
    write(path.join(outDir, "bridge_result.json"), JSON.stringify({
      status: "pass",
      nonce,
      current_url: page.url(),
      raw_response_path: path.join(outDir, "raw_response.txt"),
      extracted_response_path: path.join(outDir, "extracted_response.txt"),
      body_text_length: audit.bodyTextLength,
      live_gemini_called: true,
      live_chatgpt_called: false,
      product_mission_executed: false,
      codex_execution: false,
      commit: false,
      push: false
    }, null, 2));
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  const args = parseArgs(process.argv);
  const outDir = args.out || path.join(process.cwd(), "ops", "autopilot", "reports", "generated", "gemini_bridge");
  write(path.join(outDir, "bridge_error.md"), error.stack || error.message);
  process.exit(1);
});
