#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const forbiddenLabels = [
  "NeuroMonitor",
  "brain",
  "cortex",
  "atlas",
  "Candidate Trainer",
  "Intent Layer",
  "LLM coach",
  "Transfer Gap",
  "SkillTrace score",
  "ETV",
  "FSRS",
];

const evidence = {
  mission: "P1.TRAINING-ITEMS-DAILY-PLAN-V1",
  strategy: "temp backend DB + API seed + fake engine + Vite + Edge CDP",
  started_at: new Date().toISOString(),
  stages: {},
  api: {},
  forbidden_visible: [],
  console_errors: [],
  temp_db_dir: null,
  output_path: path.join(PROJECT_ROOT, ".tmp", "browser_daily_plan_smoke_latest.json"),
};

const children = [];
let browserClient = null;
let shuttingDown = false;

function mark(name, status, detail = null) {
  evidence.stages[name] = { status, detail };
  console.log(`${status.toUpperCase()} ${name}${detail ? ` - ${detail}` : ""}`);
  writeEvidence();
}

function fail(name, detail) {
  mark(name, "fail", detail);
  throw new Error(`${name}: ${detail}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findPython() {
  const candidates = [
    path.join(PROJECT_ROOT, ".venv_repair_local", "Scripts", "python.exe"),
    path.join(PROJECT_ROOT, ".venv_repair", "Scripts", "python.exe"),
    path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe"),
    process.env.PYTHON,
    "python",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "python" || existsSync(candidate)) {
      return candidate;
    }
  }
  return "python";
}

function findEdge() {
  const candidates = [
    process.env.BROWSER_SMOKE_EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("No Edge/Chrome executable found. Set BROWSER_SMOKE_EDGE_PATH.");
}

function fixturePgn() {
  const fixture = path.join(
    PROJECT_ROOT,
    "backend",
    "tests",
    "fixtures",
    "fixture_lichess_from_position.pgn",
  );
  const text = readFileSync(fixture, "utf8");
  const nextGameMatch = text.slice(1).match(/\r?\n\r?\n\[Event /);
  const endIndex = nextGameMatch?.index === undefined ? text.length : nextGameMatch.index + 1;
  return text.slice(0, endIndex).trim() + "\n";
}

function spawnLogged(command, args, options, label) {
  const child = spawn(command, args, {
    ...options,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child._label = label;
  child._output = [];
  child.stdout.on("data", (chunk) => rememberOutput(child, chunk));
  child.stderr.on("data", (chunk) => rememberOutput(child, chunk));
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL") {
      console.error(`${label} exited with code=${code} signal=${signal}`);
      console.error(child._output.join(""));
    }
  });
  children.push(child);
  return child;
}

function rememberOutput(child, chunk) {
  child._output.push(chunk.toString("utf8"));
  if (child._output.length > 50) {
    child._output.shift();
  }
}

async function freePort(preferred) {
  for (const port of preferred) {
    if (await portIsFree(port)) {
      return port;
    }
  }
  throw new Error(`No free port in ${preferred.join(", ")}`);
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30_000),
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("CDP WebSocket timeout")), 10_000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(`CDP WebSocket error: ${event.message ?? "unknown"}`));
      }, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event.data));
  }

  onMessage(data) {
    const message = JSON.parse(data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      evidence.console_errors.push(message.params?.exceptionDetails?.text ?? "Runtime exception");
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      evidence.console_errors.push(message.params.entry.text);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout for ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.ws.send(payload);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // Best-effort cleanup only.
    }
  }
}

async function createBrowserPage(cdpPort, url) {
  const createResponse = await fetch(
    `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!createResponse.ok) {
    throw new Error(`Unable to create CDP page: HTTP ${createResponse.status}`);
  }
  const target = await createResponse.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Log.enable");
  return client;
}

async function evalPage(fn, ...args) {
  const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
  const result = await browserClient.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Page evaluation failed");
  }
  return result.result?.value;
}

async function waitForPagePredicate(name, fn, timeoutMs = 15_000, ...args) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evalPage(fn, ...args);
    if (lastValue?.ok) {
      return lastValue;
    }
    await delay(250);
  }
  throw new Error(`${name} timed out; last=${JSON.stringify(lastValue)}`);
}

async function visibleText() {
  return evalPage(() => document.body?.innerText ?? "");
}

async function clickByText(label, options = {}) {
  const result = await evalPage(
    ({ label, exact }) => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const wanted = normalize(label);
      const candidates = [...document.querySelectorAll("button, a, summary")].filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || el.closest("[hidden]")) {
          return false;
        }
        if ("disabled" in el && el.disabled) {
          return false;
        }
        const text = normalize(el.textContent);
        return exact ? text === wanted : text.includes(wanted);
      });
      const target = candidates[0];
      if (!target) {
        return {
          ok: false,
          available: [...document.querySelectorAll("button, a, summary")]
            .map((el) => el.textContent?.trim())
            .filter(Boolean)
            .slice(0, 30),
        };
      }
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return { ok: true, text: target.textContent?.trim() ?? "" };
    },
    { label, exact: options.exact === true },
  );
  if (!result?.ok) {
    throw new Error(`Unable to click "${label}": ${JSON.stringify(result)}`);
  }
  await delay(options.afterMs ?? 250);
  return result;
}

async function assertPageContains(stage, labels) {
  const text = await visibleText();
  const normalized = normalizeText(text);
  const missing = labels.filter((label) => !normalized.includes(normalizeText(label)));
  if (missing.length > 0) {
    fail(stage, `missing labels: ${missing.join(", ")}`);
  }
  mark(stage, "pass", labels.join(" / "));
}

async function assertForbiddenAbsent(stage) {
  const text = await visibleText();
  const normalized = normalizeText(text);
  const visible = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    fail(stage, `forbidden labels visible: ${visible.join(", ")}`);
  }
  mark(stage, "pass", "no forbidden V1 labels visible");
}

async function pollReviewJob(backendBaseUrl, jobPayload, timeoutMs = 120_000) {
  const jobId = jobPayload.job_id;
  if (!jobId || jobPayload.status === "completed") {
    return jobPayload;
  }
  const deadline = Date.now() + timeoutMs;
  let payload = jobPayload;
  while (Date.now() < deadline) {
    payload = await fetchJson(`${backendBaseUrl}/review/jobs/${jobId}`);
    const status = payload.status ?? payload.review_status;
    if (status === "completed" || status === "done") {
      return payload;
    }
    if (status === "failed" || status === "stalled") {
      throw new Error(`Review job ended with ${status}: ${JSON.stringify(payload)}`);
    }
    await delay(750);
  }
  throw new Error(`Review job timeout: ${JSON.stringify(payload)}`);
}

async function main() {
  mkdirSync(path.dirname(evidence.output_path), { recursive: true });
  writeEvidence();
  const frontendPort = await freePort([5179, 5178, 5177, 5176, 5175, 5174, 5173]);
  const backendPort = await freePort([8110, 8111, 8112, 8113, 8114, 8115]);
  const cdpPort = await freePort([9240, 9241, 9242, 9243, 9244]);
  const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
  const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
  const tempRoot = mkdtempSync(path.join(tmpdir(), "neurochess-daily-plan-smoke-"));
  const dbDir = path.join(tempRoot, "backend-cwd");
  const edgeProfile = path.join(tempRoot, "edge-profile");
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(edgeProfile, { recursive: true });
  evidence.temp_db_dir = dbDir;

  const python = findPython();
  const manualDeps = path.join(PROJECT_ROOT, ".manual_pydeps", "site-packages");
  const pythonPathParts = [
    existsSync(manualDeps) ? manualDeps : null,
    PROJECT_ROOT,
    path.join(PROJECT_ROOT, "backend"),
    process.env.PYTHONPATH,
  ].filter(Boolean);
  const pathSeparator = isWindows ? ";" : ":";
  const backendEnv = {
    ...process.env,
    PYTHONPATH: pythonPathParts.join(pathSeparator),
    NEUROCHESS_ENGINE_MODE: "fake",
    FAKE_ENGINE_DELAY_MS: "1",
    FAKE_ENGINE_HARD_TIMEOUT_MS: "1000",
    TEMP: path.join(PROJECT_ROOT, ".tmp", "browser-smoke"),
    TMP: path.join(PROJECT_ROOT, ".tmp", "browser-smoke"),
    TMPDIR: path.join(PROJECT_ROOT, ".tmp", "browser-smoke"),
  };
  mkdirSync(backendEnv.TEMP, { recursive: true });

  spawnLogged(
    python,
    ["-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", String(backendPort), "--log-level", "warning"],
    { cwd: dbDir, env: backendEnv },
    "backend",
  );
  await waitForHttp(`${backendBaseUrl}/health`, 30_000, "backend");
  mark("backend_accessible", "pass", backendBaseUrl);

  spawnLogged(
    "cmd.exe",
    ["/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
    { cwd: path.join(PROJECT_ROOT, "frontend"), env: { ...process.env, VITE_API_BASE_URL: backendBaseUrl } },
    "frontend",
  );
  await waitForHttp(`${frontendBaseUrl}/app`, 40_000, "frontend");
  mark("frontend_accessible", "pass", `${frontendBaseUrl}/app`);

  const importPayload = await fetchJson(`${backendBaseUrl}/games/import-pgn`, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: fixturePgn(),
      user_alias: "SindarovGM",
      platform: "lichess",
    }),
  });
  const imported = importPayload.games?.[0] ?? importPayload.imported_games?.[0] ?? importPayload[0];
  const gameId = imported?.game_id ?? imported?.id ?? importPayload.imported_game_ids?.[0];
  if (!gameId) {
    fail("pgn_import_api", JSON.stringify(importPayload));
  }
  evidence.api.game_id = gameId;
  mark("pgn_import_api_seed", "pass", `game_id=${gameId}`);

  const reviewJob = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = reviewJob.job_id ?? null;
  await pollReviewJob(backendBaseUrl, reviewJob);
  const review = await fetchJson(`${backendBaseUrl}/games/${gameId}/review?profile=standard`);
  evidence.api.review_status = review.status;
  evidence.api.training_items_available = review.training_items_available ?? 0;
  if (!["done", "completed"].includes(review.status) || !review.training_items_available) {
    fail("training_items_materialized", JSON.stringify({
      status: review.status,
      training_items_available: review.training_items_available,
    }));
  }
  mark("training_items_materialized", "pass", `${review.training_items_available} items`);

  const plan = await fetchJson(`${backendBaseUrl}/api/training/daily-plan`, {
    method: "POST",
    body: JSON.stringify({ max_items: 6 }),
  });
  evidence.api.daily_plan = {
    status: plan.status,
    item_count: plan.item_count,
    estimated_minutes: plan.estimated_minutes,
    item_ids: (plan.items ?? []).map((item) => item.item_id),
  };
  if (!plan.item_count || !Array.isArray(plan.items) || plan.items.length < 1) {
    fail("daily_plan_created", JSON.stringify(plan));
  }
  mark("daily_plan_created", "pass", `${plan.item_count} items`);

  const exportBeforeBrowser = await fetchJson(`${backendBaseUrl}/api/export`);
  if (!exportBeforeBrowser.training_items?.length || !exportBeforeBrowser.daily_plan_items?.length) {
    fail("export_includes_training_daily", JSON.stringify({
      training_items: exportBeforeBrowser.training_items?.length ?? 0,
      daily_plan_items: exportBeforeBrowser.daily_plan_items?.length ?? 0,
    }));
  }
  mark("export_includes_training_daily", "pass", `${exportBeforeBrowser.training_items.length}/${exportBeforeBrowser.daily_plan_items.length}`);

  const edgePath = findEdge();
  spawnLogged(
    edgePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${edgeProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-gpu",
      "--headless=new",
      `${frontendBaseUrl}/app`,
    ],
    { cwd: PROJECT_ROOT, env: process.env },
    "browser",
  );
  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`, 15_000, "browser CDP");
  browserClient = await createBrowserPage(cdpPort, `${frontendBaseUrl}/app`);
  await waitForPagePredicate("app load", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra") };
  }, 30_000);
  mark("app_loads", "pass", `${frontendBaseUrl}/app`);

  await assertPageContains("plan2_navigation_visible", ["Aujourd", "Mes parties", "Entra"]);
  await clickByText("Entra", { afterMs: 1200 });
  await assertPageContains("training_three_entries_visible", ["Plan du jour", "Mes positions", "Revisions"]);
  const trainingEntryCount = await evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const cards = [...document.querySelectorAll(".training-grid .plan2-card")].map((el) => normalize(el.textContent));
    return {
      ok:
        cards.length === 3 &&
        cards.some((text) => text.includes("plan du jour")) &&
        cards.some((text) => text.includes("mes positions ratees")) &&
        cards.some((text) => text.includes("revisions")),
      count: cards.length,
      cards,
    };
  });
  if (!trainingEntryCount.ok) {
    fail("training_exactly_three_entries", JSON.stringify(trainingEntryCount));
  }
  mark("training_exactly_three_entries", "pass", "3 cards");

  await waitForPagePredicate("daily plan cta enabled", () => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const buttons = [...document.querySelectorAll("button")].filter(
      (button) => normalize(button.textContent) === "commencer" && !button.disabled,
    );
    return { ok: buttons.length > 0, count: buttons.length };
  }, 20_000);
  const startClick = await evalPage(() => {
    const button = document.querySelector(".plan2-primary-action");
    if (!button || button.disabled) {
      return {
        ok: false,
        text: button?.textContent ?? null,
        disabled: button?.disabled ?? null,
      };
    }
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    return { ok: true, text: button.textContent?.trim() ?? "" };
  });
  if (!startClick.ok) {
    fail("daily_plan_cta_clicked", JSON.stringify(startClick));
  }
  mark("daily_plan_cta_clicked", "pass", startClick.text);
  await delay(1800);
  await waitForPagePredicate("daily plan practice opens", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Position 1 /") && text.includes("Voir la correction"), text };
  }, 30_000);
  mark("daily_plan_practice_opened", "pass", "Practice from daily plan");

  await clickByText("Voir la correction", { exact: true, afterMs: 1500 });
  await waitForPagePredicate("attempt visible after reveal", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok: (text.includes("Solution") && text.includes("Terminer")) || text.includes("Position suivante"),
      text,
    };
  }, 20_000);

  const exportAfterAttempt = await fetchJson(`${backendBaseUrl}/api/export`);
  const attempts = exportAfterAttempt.practice_attempts ?? [];
  const latestAttempt = attempts[attempts.length - 1] ?? null;
  evidence.api.attempt_id = latestAttempt?.id ?? null;
  evidence.api.attempt_item_id = latestAttempt?.item_id ?? null;
  evidence.api.attempt_result = latestAttempt?.result ?? null;
  evidence.api.due_at = latestAttempt?.due_at ?? null;
  if (
    !latestAttempt ||
    !String(latestAttempt.item_id ?? "").startsWith("training_item:") ||
    latestAttempt.result !== "revealed" ||
    !latestAttempt.due_at
  ) {
    fail("daily_plan_attempt_recorded", JSON.stringify(latestAttempt));
  }
  mark("daily_plan_attempt_recorded", "pass", `${latestAttempt.item_id}, due_at=${latestAttempt.due_at}`);

  await browserClient.send("Page.navigate", { url: `${frontendBaseUrl}/app` });
  await waitForPagePredicate("reload stable after plan attempt", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra") };
  }, 20_000);
  await assertForbiddenAbsent("forbidden_labels_absent_final");

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  console.log("BROWSER_DAILY_PLAN_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch((error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    writeEvidence();
    console.error("BROWSER_DAILY_PLAN_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    shuttingDown = true;
    if (browserClient) {
      try {
        await browserClient.send("Browser.close");
      } catch {
        browserClient.close();
      }
    }
    for (const child of [...children].reverse()) {
      if (!child.killed) {
        killTree(child.pid);
      }
    }
    await delay(500);
    if (process.env.BROWSER_SMOKE_KEEP_TMP !== "1" && evidence.temp_db_dir) {
      const tempRoot = path.dirname(evidence.temp_db_dir);
      try {
        rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      } catch {
        // Windows may keep Edge profile files locked for a moment.
      }
    }
    process.exit(process.exitCode ?? 0);
  });

function writeEvidence() {
  try {
    mkdirSync(path.dirname(evidence.output_path), { recursive: true });
    writeFileSync(evidence.output_path, JSON.stringify(evidence, null, 2), "utf8");
  } catch {
    // Evidence file is helpful but not required for the smoke result.
  }
}

function killTree(pid) {
  if (!pid) {
    return;
  }
  if (isWindows) {
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Best-effort cleanup.
  }
}
