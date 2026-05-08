#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  mission: "P1.PROFILE-PRIVACY-V1",
  strategy: "temp backend DB + Vite + Edge CDP",
  started_at: new Date().toISOString(),
  stages: {},
  api: {},
  forbidden_visible: [],
  console_errors: [],
  temp_db_dir: null,
  output_path: path.join(
    PROJECT_ROOT,
    ".tmp",
    "browser_profile_privacy_smoke_latest.json",
  ),
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

function smokeFixturePgn() {
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
  child.stdout.on("data", chunk => rememberOutput(child, chunk));
  child.stderr.on("data", chunk => rememberOutput(child, chunk));
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
  return new Promise(resolve => {
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
  return new Promise(resolve => setTimeout(resolve, ms));
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
      this.ws.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.ws.addEventListener(
        "error",
        event => {
          clearTimeout(timeout);
          reject(new Error(`CDP WebSocket error: ${event.message ?? "unknown"}`));
        },
        { once: true },
      );
    });
    this.ws.addEventListener("message", event => this.onMessage(event.data));
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
        resolve: value => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: error => {
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
      const normalize = value =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const wanted = normalize(label);
      const candidates = [...document.querySelectorAll("button, a, summary")].filter(el => {
        const style = window.getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") {
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
            .map(el => el.textContent?.trim())
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

async function fillDeleteConfirmation(value) {
  const result = await evalPage(inputValue => {
    const input = [...document.querySelectorAll("input")].find(
      candidate => candidate.placeholder === "SUPPRIMER",
    );
    if (!input) {
      return { ok: false, reason: "missing confirmation input" };
    }
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setInput?.call(input, inputValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, value: input.value };
  }, value);
  if (!result?.ok) {
    throw new Error(`Unable to fill delete confirmation: ${JSON.stringify(result)}`);
  }
  return result;
}

async function assertPageContains(stage, labels) {
  const text = await visibleText();
  const normalized = normalizeText(text);
  const missing = labels.filter(label => !normalized.includes(normalizeText(label)));
  if (missing.length > 0) {
    fail(stage, `missing labels: ${missing.join(", ")}`);
  }
  mark(stage, "pass", labels.join(" / "));
}

async function assertForbiddenAbsent(stage) {
  const text = await visibleText();
  const normalized = normalizeText(text);
  const visible = forbiddenLabels.filter(label => normalized.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    fail(stage, `forbidden labels visible: ${visible.join(", ")}`);
  }
  mark(stage, "pass", "no forbidden V1 labels visible");
}

async function assertMainNavExactlyPlan2() {
  const result = await evalPage(() => {
    const normalize = value =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const labels = [...document.querySelectorAll(".app-shell-nav button")].map(button =>
      normalize(button.textContent),
    );
    return {
      ok:
        labels.length === 3 &&
        labels[0].includes("aujourd") &&
        labels[1].includes("mes parties") &&
        labels[2].includes("entrainement"),
      labels,
    };
  });
  if (!result?.ok) {
    fail("plan2_nav_exact", JSON.stringify(result));
  }
  mark("plan2_nav_exact", "pass", JSON.stringify(result.labels));
}

async function main() {
  mkdirSync(path.dirname(evidence.output_path), { recursive: true });
  writeEvidence();
  const frontendPort = await freePort([5179, 5178, 5177, 5176, 5175, 5174, 5173]);
  const backendPort = await freePort([8110, 8111, 8112, 8113, 8114, 8115]);
  const cdpPort = await freePort([9234, 9235, 9236, 9237, 9238]);
  const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
  const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
  const tempRoot = mkdtempSync(path.join(tmpdir(), "neurochess-profile-smoke-"));
  const dbDir = path.join(tempRoot, "backend-cwd");
  const edgeProfile = path.join(tempRoot, "edge-profile");
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(edgeProfile, { recursive: true });
  evidence.temp_db_dir = dbDir;

  const python = findPython();
  const manualDeps = path.join(PROJECT_ROOT, ".manual_pydeps", "site-packages");
  const pathSeparator = isWindows ? ";" : ":";
  const pythonPathParts = [
    existsSync(manualDeps) ? manualDeps : null,
    PROJECT_ROOT,
    path.join(PROJECT_ROOT, "backend"),
    process.env.PYTHONPATH,
  ].filter(Boolean);
  const backendEnv = {
    ...process.env,
    PYTHONPATH: pythonPathParts.join(pathSeparator),
    NEUROCHESS_ENGINE_MODE: "fake",
    FAKE_ENGINE_DELAY_MS: "1",
    TEMP: path.join(PROJECT_ROOT, ".tmp", "browser-profile-smoke"),
    TMP: path.join(PROJECT_ROOT, ".tmp", "browser-profile-smoke"),
    TMPDIR: path.join(PROJECT_ROOT, ".tmp", "browser-profile-smoke"),
  };
  mkdirSync(backendEnv.TEMP, { recursive: true });

  spawnLogged(
    python,
    [
      "-m",
      "uvicorn",
      "backend.app:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(backendPort),
      "--log-level",
      "warning",
    ],
    { cwd: dbDir, env: backendEnv },
    "backend",
  );
  await waitForHttp(`${backendBaseUrl}/health`, 30_000, "backend");
  mark("backend_accessible", "pass", backendBaseUrl);

  const importPayload = await fetchJson(`${backendBaseUrl}/games/import-pgn`, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: smokeFixturePgn(),
      user_alias: "ProfileSmoke",
      platform: "lichess",
    }),
  });
  const gameId = importPayload.imported_game_ids?.[0] ?? null;
  if (!gameId) {
    fail("seed_pgn_import", JSON.stringify(importPayload));
  }
  evidence.api.game_id = gameId;
  mark("seed_pgn_import", "pass", `game_id=${gameId}`);

  const frontendEnv = {
    ...process.env,
    VITE_API_BASE_URL: backendBaseUrl,
  };
  spawnLogged(
    "cmd.exe",
    [
      "/c",
      "npm.cmd",
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(frontendPort),
      "--strictPort",
    ],
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
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") };
  }, 30_000);
  mark("app_loads", "pass", `${frontendBaseUrl}/app`);

  await assertMainNavExactlyPlan2();
  await assertForbiddenAbsent("forbidden_labels_absent_initial");
  await clickByText("Profil / Param", { afterMs: 500 });
  await assertPageContains("profile_panel_visible", [
    "Profil local",
    "Preferences",
    "Moteur",
    "Confidentialite",
    "Exporter mes donnees",
    "Supprimer mes donnees",
  ]);

  await clickByText("Exporter mes donnees", { afterMs: 1000 });
  await waitForPagePredicate("export status", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Export JSON"), text };
  }, 15_000);
  const exportPayload = await fetchJson(`${backendBaseUrl}/api/export`);
  evidence.api.export_games_count = exportPayload.games?.length ?? 0;
  evidence.api.export_has_pgn_raw = Boolean(exportPayload.games?.[0]?.pgn_raw);
  if (evidence.api.export_games_count < 1 || !evidence.api.export_has_pgn_raw) {
    fail("export_payload_verified", JSON.stringify(exportPayload.games?.[0] ?? null));
  }
  mark("export_payload_verified", "pass", `games=${evidence.api.export_games_count}`);

  await clickByText("Supprimer mes donnees", { afterMs: 500 });
  await assertPageContains("delete_confirmation_visible", [
    "Confirmation obligatoire",
    "Tape SUPPRIMER",
    "Confirmer la suppression",
  ]);
  const historyBeforeConfirm = await fetchJson(
    `${backendBaseUrl}/games/history?scope=all&limit=20`,
  );
  evidence.api.history_count_before_confirm = historyBeforeConfirm.length;
  if (historyBeforeConfirm.length < 1) {
    fail("delete_first_click_preserves_data", "seeded game disappeared before confirmation");
  }
  mark("delete_first_click_preserves_data", "pass", `history=${historyBeforeConfirm.length}`);

  await fillDeleteConfirmation("SUPPRIMER");
  await clickByText("Confirmer la suppression", { afterMs: 1200 });
  await waitForPagePredicate("delete status", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Suppression termin"), text };
  }, 20_000);

  const historyAfterDelete = await fetchJson(
    `${backendBaseUrl}/games/history?scope=all&limit=20`,
  );
  const exportAfterDelete = await fetchJson(`${backendBaseUrl}/api/export`);
  evidence.api.history_count_after_delete = historyAfterDelete.length;
  evidence.api.export_games_after_delete = exportAfterDelete.games?.length ?? null;
  if (historyAfterDelete.length !== 0 || exportAfterDelete.games?.length !== 0) {
    fail(
      "delete_confirmed_clears_local_data",
      `history=${historyAfterDelete.length}, export_games=${exportAfterDelete.games?.length}`,
    );
  }
  mark("delete_confirmed_clears_local_data", "pass", "history=0 export.games=0");
  await assertMainNavExactlyPlan2();
  await assertForbiddenAbsent("forbidden_labels_absent_final");

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  console.log("BROWSER_PROFILE_PRIVACY_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(error => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    writeEvidence();
    console.error("BROWSER_PROFILE_PRIVACY_SMOKE FAIL");
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
        rmSync(tempRoot, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 250,
        });
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
