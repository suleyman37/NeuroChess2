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
  try {
    await composer.fill(cleanText, { timeout: 10000 });
  } catch {
    await page.keyboard.insertText(cleanText);
  }
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

  await writeComposer(page, composer, request);
  await page.keyboard.press("Enter");

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
