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
  mission: "P0.BROWSER-SMOKE-FLOW",
  strategy: "temp backend DB + fake engine + Vite + Edge CDP",
  started_at: new Date().toISOString(),
  stages: {},
  api: {},
  forbidden_visible: [],
  console_errors: [],
  temp_db_dir: null,
  output_path: path.join(PROJECT_ROOT, ".tmp", "browser_v1_flow_smoke_latest.json"),
};

const children = [];
let browserClient = null;
let shuttingDown = false;

function mark(name, status, detail = null) {
  evidence.stages[name] = { status, detail };
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status.toUpperCase()} ${name}${suffix}`);
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

function browserSmokeFixturePgn() {
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
  const firstGame = text.slice(0, endIndex).trim();
  if (!firstGame.startsWith("[Event")) {
    throw new Error(`Unable to extract first PGN game from ${fixture}`);
  }
  return firstGame + "\n";
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
  const text = chunk.toString("utf8");
  child._output.push(text);
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
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    this.events = [];
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
    this.events.push(message);
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
      this.pending.set(id, { resolve, reject });
      const pending = this.pending.get(id);
      pending.resolve = (value) => {
        clearTimeout(timeout);
        resolve(value);
      };
      pending.reject = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
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
        if (style.visibility === "hidden" || style.display === "none") {
          return false;
        }
        if (el.closest("[hidden]")) {
          return false;
        }
        const text = normalize(el.textContent);
        return exact ? text === wanted : text.includes(wanted);
      });
      const target = candidates[0];
      if (!target) {
        return { ok: false, clicked: false, available: [...document.querySelectorAll("button, a, summary")].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 30) };
      }
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return { ok: true, clicked: true, text: target.textContent?.trim() ?? "" };
    },
    { label, exact: options.exact === true },
  );
  if (!result?.ok) {
    throw new Error(`Unable to click "${label}": ${JSON.stringify(result)}`);
  }
  await delay(options.afterMs ?? 250);
  return result;
}

async function setImportForm(pgnText) {
  const result = await evalPage((pgn) => {
    const textarea = document.querySelector("textarea");
    if (!textarea) {
      return { ok: false, reason: "missing textarea" };
    }
    const setTextarea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setTextarea?.call(textarea, pgn);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const inputs = [...document.querySelectorAll("input")].filter((input) => input.type === "text" || input.type === "");
    if (inputs[0]) {
      const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setInput?.call(inputs[0], "SindarovGM");
      inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    }
    return { ok: true, textLength: textarea.value.length, userAlias: inputs[0]?.value ?? null };
  }, pgnText);
  if (!result?.ok) {
    throw new Error(`Unable to fill import form: ${JSON.stringify(result)}`);
  }
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

async function pollHistoryForGame(backendBaseUrl, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fetchJson(`${backendBaseUrl}/games/history?scope=all&limit=20`);
    if (Array.isArray(last) && last.length > 0) {
      return last[0];
    }
    await delay(300);
  }
  throw new Error(`No imported game found in history; last=${JSON.stringify(last)}`);
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
  const backendPort = await freePort([8100, 8101, 8102, 8103, 8104, 8105]);
  const cdpPort = await freePort([9229, 9230, 9231, 9232, 9233]);
  const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
  const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
  const tempRoot = mkdtempSync(path.join(tmpdir(), "neurochess-browser-smoke-"));
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

  const frontendEnv = {
    ...process.env,
    VITE_API_BASE_URL: backendBaseUrl,
  };
  spawnLogged(
    "cmd.exe",
    ["/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
    { cwd: path.join(PROJECT_ROOT, "frontend"), env: frontendEnv },
    "frontend",
  );
  await waitForHttp(`${frontendBaseUrl}/app`, 40_000, "frontend");
  mark("frontend_accessible", "pass", `${frontendBaseUrl}/app`);

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
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Review") };
  }, 30_000);
  mark("app_loads", "pass", `${frontendBaseUrl}/app`);

  await assertPageContains("plan2_navigation_visible", ["Aujourd", "Mes parties", "Entra"]);
  await assertForbiddenAbsent("forbidden_labels_absent_initial");

  await clickByText("Entra", { afterMs: 500 });
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
      ok: cards.length === 3 &&
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

  await clickByText("Mes parties", { afterMs: 500 });
  await clickByText("Importer PGN", { afterMs: 500 });
  await assertPageContains("games_import_surface_visible", ["Import PGN", "Coller PGN", "Previsualiser", "Importer"]);
  const pgn = browserSmokeFixturePgn();
  await setImportForm(pgn);
  await clickByText("Importer", { exact: true, afterMs: 500 });
  const importedCard = await pollHistoryForGame(backendBaseUrl);
  const gameId = importedCard.game_id;
  evidence.api.game_id = gameId;
  evidence.api.imported_card = {
    game_id: gameId,
    title: importedCard.display_title,
    review_summary_status: importedCard.review_summary_status,
    source_platform: importedCard.source_platform,
  };
  mark("pgn_import_via_ui", "pass", `game_id=${gameId}`);

  const reviewJob = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = reviewJob.job_id ?? null;
  const completedJob = await pollReviewJob(backendBaseUrl, reviewJob);
  evidence.api.review_job_status = completedJob.status ?? completedJob.review_status ?? null;
  const review = await fetchJson(`${backendBaseUrl}/games/${gameId}/review?profile=standard`);
  evidence.api.review_status = review.status;
  evidence.api.review_moment_count = Array.isArray(review.moments) ? review.moments.length : 0;
  if (!["done", "completed"].includes(review.status) || evidence.api.review_moment_count < 1) {
    fail("review_ready_api", `review status=${review.status}, moments=${evidence.api.review_moment_count}`);
  }
  mark("review_ready_api", "pass", `job=${evidence.api.review_job_id}, moments=${evidence.api.review_moment_count}`);

  await browserClient.send("Page.navigate", { url: `${frontendBaseUrl}/app` });
  await waitForPagePredicate("app reload after review", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") };
  }, 20_000);
  await clickByText("Mes parties", { afterMs: 500 });
  await clickByText("Voir historique", { afterMs: 500 });
  await waitForPagePredicate("history shows review", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Voir review") || text.includes("Review disponible"), text };
  }, 20_000);
  await clickByText("Voir review", { exact: true, afterMs: 1200 });
  try {
    await waitForReviewSummaryVisible(8_000);
  } catch {
    const text = await visibleText();
    if (normalizeText(text).includes("lancer l'analyse")) {
      await clickByText("Lancer l'analyse", { afterMs: 1200 });
    }
    await waitForReviewSummaryVisible(45_000);
  }
  mark("review_summary_visible", "pass", "Review contextuelle + summary");

  const practiceLaunch = await evalPage(() => {
    const text = document.body?.innerText ?? "";
    return {
      available: Boolean(document.querySelector('[data-testid="review-practice-button"]')),
      text,
    };
  });
  if (!practiceLaunch.available) {
    const normalized = normalizeText(practiceLaunch.text);
    if (
      !normalized.includes("aucune position fiable") &&
      !normalized.includes("aucun moment prioritaire")
    ) {
      fail("review_no_forced_practice_state", practiceLaunch.text);
    }
    mark(
      "review_no_forced_practice_state",
      "pass",
      "No priority training item for user POV; Review shows honest empty state.",
    );
    await assertForbiddenAbsent("forbidden_labels_absent_final");
    evidence.finished_at = new Date().toISOString();
    evidence.result = "pass";
    console.log("BROWSER_V1_FLOW_SMOKE PASS");
    console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    return;
  }

  await clickByText("Commencer", { exact: true, afterMs: 1500 });
  await waitForPagePredicate("practice opens", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Position 1 /") && text.includes("Voir la correction"), text };
  }, 25_000);
  const sessionPayload = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const sessions = Array.isArray(sessionPayload.sessions) ? sessionPayload.sessions : [];
  const latestSession = sessions[0] ?? null;
  if (!latestSession?.session_id) {
    fail("practice_session_created", JSON.stringify(sessionPayload));
  }
  evidence.api.session_id = latestSession.session_id;
  mark("practice_opened", "pass", `session_id=${latestSession.session_id}`);

  await clickByText("Voir la correction", { exact: true, afterMs: 1200 });
  await waitForPagePredicate("attempt visible after reveal", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Solution") && text.includes("Terminer") || text.includes("Position suivante"), text };
  }, 20_000);
  const sessionAfterAttempt = await fetchJson(`${backendBaseUrl}/review/practice/sessions/${latestSession.session_id}`);
  const attempts = Array.isArray(sessionAfterAttempt.attempts) ? sessionAfterAttempt.attempts : [];
  const latestAttempt = attempts[attempts.length - 1] ?? sessionAfterAttempt.summary?.latest_attempt ?? null;
  if (!latestAttempt) {
    fail("practice_attempt_recorded", JSON.stringify(sessionAfterAttempt));
  }
  evidence.api.attempt_id = latestAttempt.id ?? latestAttempt.attempt_id ?? null;
  evidence.api.attempt_result = latestAttempt.result ?? null;
  evidence.api.attempt_reveal_used = latestAttempt.reveal_used ?? null;
  evidence.api.due_at = latestAttempt.due_at ?? null;
  const sessionsAfterAttempt = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  evidence.api.learning_summary = sessionsAfterAttempt.learning_summary ?? null;
  if ((latestAttempt.result ?? "") !== "revealed" || !latestAttempt.due_at) {
    fail("practice_attempt_recorded", `latest_attempt=${JSON.stringify(latestAttempt)}`);
  }
  mark("practice_attempt_recorded", `pass`, `attempt_id=${evidence.api.attempt_id ?? "n/a"}, due_at=${latestAttempt.due_at}`);

  await clickByText("Aujourd", { afterMs: 800 });
  await waitForPagePredicate("learning signal visible", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        text.includes("reviendra au bon moment") ||
        text.includes("reviendront au bon moment") ||
        text.includes("Session Practice en cours") ||
        text.includes("À revoir") ||
        text.includes("A revoir"),
      text,
    };
  }, 20_000);
  mark("learning_loop_signal_visible", "pass", `due_at=${latestAttempt.due_at}`);
  await assertForbiddenAbsent("forbidden_labels_absent_final");

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  console.log("BROWSER_V1_FLOW_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch((error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    writeEvidence();
    console.error("BROWSER_V1_FLOW_SMOKE FAIL");
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
        // Windows may keep Edge profile files locked for a moment; the temp dir is harmless.
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

async function waitForReviewSummaryVisible(timeoutMs) {
  return waitForPagePredicate("review summary visible", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return {
      ok:
        normalized.includes("review contextuelle") &&
        (normalized.includes("neuroscore") || normalized.includes("score indisponible")) &&
        normalized.includes("moments") &&
        (normalized.includes("commencer") ||
          normalized.includes("aucune position fiable") ||
          normalized.includes("aucun moment prioritaire")),
      text,
    };
  }, timeoutMs);
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
