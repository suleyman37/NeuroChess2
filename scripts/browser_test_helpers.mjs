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

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const isWindows = process.platform === "win32";

export const FORBIDDEN_V1_LABELS = [
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

export function createEvidence(mission, outputFileName) {
  return {
    mission,
    strategy: "temp backend DB + fake engine + Vite + Edge CDP",
    started_at: new Date().toISOString(),
    stages: {},
    api: {},
    ui: {},
    browser_errors: {
      console: [],
      page: [],
      network_500: [],
    },
    forbidden_visible: [],
    temp_db_dir: null,
    screenshot_path: null,
    output_path: path.join(PROJECT_ROOT, ".tmp", outputFileName),
  };
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function fixturePgn() {
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

export async function pollReviewJobToTerminal(harness, jobPayload, timeoutMs = 120_000) {
  const jobId = jobPayload.job_id;
  if (!jobId || jobPayload.status === "completed") {
    return jobPayload;
  }
  const deadline = Date.now() + timeoutMs;
  let payload = jobPayload;
  while (Date.now() < deadline) {
    payload = await fetchJson(`${harness.backendBaseUrl}/review/jobs/${jobId}`);
    const status = payload.status ?? payload.review_status;
    if (status === "completed" || status === "done") {
      return payload;
    }
    if (["failed", "stalled", "cancelled", "incomplete"].includes(String(status))) {
      throw new Error(`Review job ended with ${status}: ${JSON.stringify(payload)}`);
    }
    await delay(750);
  }
  throw new Error(`Review job timeout: ${JSON.stringify(payload)}`);
}

export async function prepareReviewFixture(harness, options = {}) {
  const importPayload = await fetchJson(`${harness.backendBaseUrl}/games/import-pgn`, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: fixturePgn(),
      user_alias: "SindarovGM",
      platform: "lichess",
    }),
  });
  const imported =
    importPayload.games?.[0] ??
    importPayload.imported_games?.[0] ??
    importPayload[0];
  const gameId = imported?.game_id ?? imported?.id ?? importPayload.imported_game_ids?.[0];
  if (!gameId) {
    harness.fail("review_fixture_import", JSON.stringify(importPayload));
  }

  const reviewJob = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  const completedJob = await pollReviewJobToTerminal(harness, reviewJob);
  if (options.seedEligibleMoment !== false) {
    await seedEligibleReviewMoment(harness, gameId);
  }
  const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  return { gameId, review, reviewJob: completedJob };
}

export async function seedEligibleReviewMoment(harness, gameId) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
start_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
played_fen = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1"
top_moves = [
    {"uci": "e2e4", "san": "e4", "rank": 1, "eval_cp": 85, "mate_in": None, "pv": ["e2e4", "e7e5", "g1f3"]},
    {"uci": "d2d4", "san": "d4", "rank": 2, "eval_cp": -120, "mate_in": None, "pv": ["d2d4", "d7d5"]},
]
with sqlite3.connect(db_path) as connection:
    connection.row_factory = sqlite3.Row
    review = connection.execute(
        "SELECT id FROM game_reviews WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        (game_id,),
    ).fetchone()
    if review is None:
        raise SystemExit("missing game_review")
    review_id = int(review["id"])
    connection.execute("DELETE FROM review_moments WHERE game_id = ?", (game_id,))
    connection.execute("DELETE FROM training_items WHERE source_game_id = ?", (game_id,))
    connection.execute("DELETE FROM daily_plan_items")
    connection.execute(
        """
        INSERT INTO review_moments (
            review_id, game_id, move_id, ply, played_by, side_to_move_before,
            fen_before, fen_after, played_uci, played_san, best_move_uci,
            best_move_san, eval_before_cp, eval_after_cp, mate_before,
            mate_after, cp_loss, cp_loss_label, importance_score,
            reliability_score, reliability_label, top_moves_json, review_type,
            created_at
        )
        VALUES (?, ?, NULL, 1, 'white', 'white', ?, ?, 'd2d4', 'd4',
                'e2e4', 'e4', 85, -120, NULL, NULL, 205, 'large',
                99.0, 1.0, 'stable', ?, 'player_loss', datetime('now'))
        """,
        (review_id, game_id, start_fen, played_fen, json.dumps(top_moves)),
    )
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    harness.fail("eligible_review_moment_seed", `${result.stdout}\n${result.stderr}`);
  }
}

export async function openReviewFromPersistedState(harness, gameId, options = {}) {
  await harness.startBrowser("/app");
  await harness.loadApp();
  await harness.evalPage(
    ({ gameId: nextGameId, jobId, reviewPov }) => {
      window.localStorage.setItem(
        "neurochess.appState.v5_3a4d",
        JSON.stringify({
          gameId: nextGameId,
          activeTab: "review",
          displayedPositionPly: 0,
          activeReviewJobId: jobId ?? null,
          reviewAnalysisProfile: "standard",
          updatedAt: Date.now(),
        }),
      );
      if (reviewPov) {
        window.localStorage.setItem("neurochess.reviewPov." + nextGameId, reviewPov);
      }
      return { ok: true };
    },
    { gameId, jobId: options.jobId ?? null, reviewPov: options.reviewPov ?? null },
  );
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app`,
  });
  await harness.waitForPagePredicate("review board restored", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-board"]')) ||
        text.includes("Review") ||
        text.includes("Analyse"),
      text,
    };
  }, options.timeoutMs ?? 30_000);
}

export function findPython() {
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

export function findEdge() {
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

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function freePort(preferred) {
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

export async function waitForHttp(url, timeoutMs, label) {
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

export async function fetchJson(url, options = {}) {
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

export class CdpClient {
  constructor(wsUrl, evidence) {
    this.ws = new WebSocket(wsUrl);
    this.evidence = evidence;
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
        (event) => {
          clearTimeout(timeout);
          reject(new Error(`CDP WebSocket error: ${event.message ?? "unknown"}`));
        },
        { once: true },
      );
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
      this.evidence.browser_errors.page.push(
        message.params?.exceptionDetails?.text ?? "Runtime exception",
      );
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      this.evidence.browser_errors.console.push(message.params.entry.text);
    }
    if (
      message.method === "Network.responseReceived" &&
      Number(message.params?.response?.status ?? 0) >= 500
    ) {
      this.evidence.browser_errors.network_500.push({
        status: message.params.response.status,
        url: message.params.response.url,
      });
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout for ${method}`));
      }, 12_000);
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

export class BrowserSmokeHarness {
  constructor(evidence) {
    this.evidence = evidence;
    this.children = [];
    this.browserClient = null;
    this.backendBaseUrl = null;
    this.frontendBaseUrl = null;
    this.shuttingDown = false;
  }

  writeEvidence() {
    mkdirSync(path.dirname(this.evidence.output_path), { recursive: true });
    writeFileSync(this.evidence.output_path, `${JSON.stringify(this.evidence, null, 2)}\n`);
  }

  mark(name, status, detail = null) {
    this.evidence.stages[name] = { status, detail };
    console.log(`${status.toUpperCase()} ${name}${detail ? ` - ${detail}` : ""}`);
    this.writeEvidence();
  }

  fail(name, detail) {
    this.mark(name, "fail", detail);
    throw new Error(`${name}: ${detail}`);
  }

  spawnLogged(command, args, options, label) {
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
      if (this.shuttingDown) {
        return;
      }
      if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL") {
        console.error(`${label} exited with code=${code} signal=${signal}`);
        console.error(child._output.join(""));
      }
    });
    this.children.push(child);
    return child;
  }

  async startBackendWithTempDb(extraEnv = {}) {
    const backendPort = await freePort([8120, 8121, 8122, 8123, 8124, 8125]);
    const tempRoot = mkdtempSync(path.join(tmpdir(), "neurochess-browser-smoke-"));
    const dbDir = path.join(tempRoot, "backend-cwd");
    mkdirSync(dbDir, { recursive: true });
    this.evidence.temp_db_dir = dbDir;
    this.backendBaseUrl = `http://127.0.0.1:${backendPort}`;

    const manualDeps = path.join(PROJECT_ROOT, ".manual_pydeps", "site-packages");
    const pythonPathParts = [
      existsSync(manualDeps) ? manualDeps : null,
      PROJECT_ROOT,
      path.join(PROJECT_ROOT, "backend"),
      process.env.PYTHONPATH,
    ].filter(Boolean);
    const pathSeparator = isWindows ? ";" : ":";
    const tmpPath = path.join(PROJECT_ROOT, ".tmp", "browser-smoke");
    mkdirSync(tmpPath, { recursive: true });
    const backendEnv = {
      ...process.env,
      PYTHONPATH: pythonPathParts.join(pathSeparator),
      NEUROCHESS_ENGINE_MODE: "fake",
      FAKE_ENGINE_DELAY_MS: "1",
      FAKE_ENGINE_HARD_TIMEOUT_MS: "1000",
      TEMP: tmpPath,
      TMP: tmpPath,
      TMPDIR: tmpPath,
      ...extraEnv,
    };
    this.spawnLogged(
      findPython(),
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
    await waitForHttp(`${this.backendBaseUrl}/health`, 30_000, "backend");
    this.mark("backend_accessible", "pass", this.backendBaseUrl);
    return this.backendBaseUrl;
  }

  async startFrontendVite() {
    const frontendPort = await freePort([5179, 5178, 5177, 5176, 5175, 5174, 5173, 5180, 5181]);
    this.frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
    this.spawnLogged(
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
      {
        cwd: path.join(PROJECT_ROOT, "frontend"),
        env: { ...process.env, VITE_API_BASE_URL: this.backendBaseUrl },
      },
      "frontend",
    );
    await waitForHttp(`${this.frontendBaseUrl}/app`, 40_000, "frontend");
    this.mark("frontend_accessible", "pass", `${this.frontendBaseUrl}/app`);
    return this.frontendBaseUrl;
  }

  async startBrowser(pathname = "/app") {
    const cdpPort = await freePort([9250, 9251, 9252, 9253, 9254]);
    const edgeProfile = mkdtempSync(path.join(tmpdir(), "neurochess-edge-profile-"));
    this.spawnLogged(
      findEdge(),
      [
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${edgeProfile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-gpu",
        "--headless=new",
        `${this.frontendBaseUrl}${pathname}`,
      ],
      { cwd: PROJECT_ROOT, env: process.env },
      "browser",
    );
    await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`, 15_000, "browser CDP");
    this.browserClient = await createBrowserPage(cdpPort, `${this.frontendBaseUrl}${pathname}`, this.evidence);
    return this.browserClient;
  }

  async evalPage(fn, ...args) {
    const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
    const result = await this.browserClient.send("Runtime.evaluate", {
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

  async waitForPagePredicate(name, fn, timeoutMs = 15_000, ...args) {
    const deadline = Date.now() + timeoutMs;
    let lastValue = null;
    while (Date.now() < deadline) {
      lastValue = await this.evalPage(fn, ...args);
      if (lastValue?.ok) {
        return lastValue;
      }
      await delay(250);
    }
    throw new Error(`${name} timed out; last=${JSON.stringify(lastValue)}`);
  }

  async loadApp() {
    await this.browserClient.send("Page.navigate", { url: `${this.frontendBaseUrl}/app` });
    await this.waitForPagePredicate("app load", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra"),
      };
    }, 30_000);
    this.mark("app_loads", "pass", `${this.frontendBaseUrl}/app`);
  }

  async setViewport({ width, height, deviceScaleFactor = 1, mobile = false }) {
    await this.browserClient.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
    await this.browserClient.send("Emulation.setTouchEmulationEnabled", {
      enabled: mobile,
      maxTouchPoints: mobile ? 5 : 1,
    });
    this.evidence.viewport = { width, height, deviceScaleFactor, mobile };
    this.mark("viewport_configured", "pass", `${width}x${height} dpr=${deviceScaleFactor}`);
  }

  async assertNoHorizontalOverflow(stage, selectors = null) {
    const result = await this.evalPage((configuredSelectors) => {
      const viewportWidth = window.innerWidth;
      const selectorList = configuredSelectors ?? [
        "html",
        "body",
        '[data-testid="app-root"]',
        ".topbar.app-header",
        ".app-shell-nav",
        ".analysis-layout",
        ".board-column",
        ".right-panel",
        ".plan2-page",
        ".profile-privacy-panel",
        ".state-notice",
        '[data-testid="review-board"]',
        '[data-testid="practice-board"]',
      ];
      const documentOverflow = Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth ?? 0,
      ) - viewportWidth;
      const offenders = [];
      for (const selector of selectorList) {
        for (const element of document.querySelectorAll(selector)) {
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            continue;
          }
          const overflowLeft = Math.max(0, -rect.left);
          const overflowRight = Math.max(0, rect.right - viewportWidth);
          if (overflowLeft > 2 || overflowRight > 2) {
            offenders.push({
              selector,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              overflowLeft: Math.round(overflowLeft),
              overflowRight: Math.round(overflowRight),
            });
          }
        }
      }
      return {
        ok: documentOverflow <= 2 && offenders.length === 0,
        viewportWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body?.scrollWidth ?? 0,
        documentOverflow: Math.round(documentOverflow),
        offenders,
      };
    }, selectors);
    if (!result.ok) {
      this.fail(stage, JSON.stringify(result));
    }
    this.mark(stage, "pass", `viewport=${result.viewportWidth}, scroll=${result.documentScrollWidth}`);
    return result;
  }

  async pressKey(key, options = {}) {
    const modifiers = options.shift ? 8 : 0;
    const keyCode = key === "Tab" ? 9 : key === "Enter" ? 13 : key === "Escape" ? 27 : key === " " ? 32 : 0;
    const code = key === " " ? "Space" : key;
    const dispatchTypes = key === "Enter" || key === " " ? ["rawKeyDown", "keyUp"] : ["keyDown", "keyUp"];
    for (const type of dispatchTypes) {
      await this.browserClient.send("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
        modifiers,
        text: type === "rawKeyDown" ? (key === "Enter" ? "\r" : key === " " ? " " : undefined) : undefined,
        unmodifiedText: type === "rawKeyDown" ? (key === "Enter" ? "\r" : key === " " ? " " : undefined) : undefined,
      });
    }
    await delay(options.afterMs ?? 100);
  }

  async activeElementSnapshot() {
    return this.evalPage(() => {
      const element = document.activeElement;
      if (!element) {
        return { ok: false };
      }
      return {
        ok: true,
        tag: element.tagName,
        testId: element.getAttribute("data-testid"),
        text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "",
        ariaLabel: element.getAttribute("aria-label"),
        className: typeof element.className === "string" ? element.className : "",
        outlineStyle: window.getComputedStyle(element).outlineStyle,
        outlineWidth: window.getComputedStyle(element).outlineWidth,
      };
    });
  }

  async visibleText() {
    return this.evalPage(() => document.body?.innerText ?? "");
  }

  async clickByText(label, options = {}) {
    const result = await this.evalPage(
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
              .slice(0, 40),
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

  async clickByTestId(testId, options = {}) {
    const result = await this.evalPage((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) {
        return { ok: false, reason: "missing" };
      }
      if ("disabled" in el && el.disabled) {
        return { ok: false, reason: "disabled" };
      }
      el.scrollIntoView({ block: "center", inline: "center" });
      el.click();
      return { ok: true, text: el.textContent?.trim() ?? "" };
    }, testId);
    if (!result?.ok) {
      throw new Error(`Unable to click data-testid="${testId}": ${JSON.stringify(result)}`);
    }
    await delay(options.afterMs ?? 250);
    return result;
  }

  async assertPageContains(stage, labels) {
    const text = await this.visibleText();
    const normalized = normalizeText(text);
    const missing = labels.filter((label) => !normalized.includes(normalizeText(label)));
    if (missing.length > 0) {
      this.fail(stage, `missing labels: ${missing.join(", ")}`);
    }
    this.mark(stage, "pass", labels.join(" / "));
  }

  async assertForbiddenV1LabelsAbsent(stage = "forbidden_labels_absent") {
    const text = await this.visibleText();
    const normalized = normalizeText(text);
    const visible = FORBIDDEN_V1_LABELS.filter((label) =>
      normalized.includes(normalizeText(label)),
    );
    this.evidence.forbidden_visible = visible;
    if (visible.length > 0) {
      this.fail(stage, `forbidden labels visible: ${visible.join(", ")}`);
    }
    this.mark(stage, "pass", "no forbidden V1 labels visible");
  }

  async assertMainNavExactly3() {
    const result = await this.evalPage(() => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const nav = document.querySelector('[data-testid="main-nav"]');
      const labels = [...(nav?.querySelectorAll("button") ?? [])].map((button) =>
        normalize(button.textContent),
      );
      const comparable = labels.map((label) => normalize(label).toLowerCase());
      return {
        ok: comparable.join("|") === "aujourd'hui|mes parties|entrainement",
        labels,
      };
    });
    if (!result.ok) {
      this.fail("main_nav_exactly_three", JSON.stringify(result));
    }
    this.mark("main_nav_exactly_three", "pass", result.labels.join(" / "));
  }

  async assertTrainingExactly3() {
    await this.clickByTestId("nav-training", { afterMs: 600 });
    const result = await this.evalPage(() => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const cards = [...document.querySelectorAll(".training-grid .plan2-card")].map((el) =>
        normalize(el.textContent),
      );
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
    if (!result.ok) {
      this.fail("training_exactly_three_entries", JSON.stringify(result));
    }
    this.mark("training_exactly_three_entries", "pass", "3 cards");
  }

  async getBoardBox(testId) {
    const box = await this.evalPage((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) {
        return { ok: false, reason: "missing board" };
      }
      el.scrollIntoView({ block: "center", inline: "center" });
      const rect = el.getBoundingClientRect();
      return {
        ok: rect.width > 100 && rect.height > 100,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        orientation: el.getAttribute("data-board-orientation") ?? "white",
      };
    }, testId);
    if (!box.ok) {
      this.fail("board_box", JSON.stringify({ testId, box }));
    }
    return box;
  }

  getSquareCenter(board, square, orientation = board.orientation ?? "white") {
    const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0);
    const rank = Number(square[1]);
    const xIndex = orientation === "black" ? 7 - fileIndex : fileIndex;
    const yIndex = orientation === "black" ? rank - 1 : 8 - rank;
    const cell = Math.min(board.width, board.height) / 8;
    return {
      x: board.left + cell * xIndex + cell / 2,
      y: board.top + cell * yIndex + cell / 2,
    };
  }

  async clickSquare(square, testId = "practice-board") {
    const board = await this.getBoardBox(testId);
    const point = this.getSquareCenter(board, square);
    await this.dispatchMouseClick(point.x, point.y);
    return { square, point, orientation: board.orientation };
  }

  async dispatchMouseClick(x, y) {
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "none",
    });
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await delay(120);
  }

  async tryMoveByClickClick(uci, testId = "practice-board") {
    const source = uci.slice(0, 2);
    const target = uci.slice(2, 4);
    const board = await this.getBoardBox(testId);
    const sourcePoint = this.getSquareCenter(board, source);
    const targetPoint = this.getSquareCenter(board, target);
    await this.dispatchMouseClick(sourcePoint.x, sourcePoint.y);
    await this.dispatchMouseClick(targetPoint.x, targetPoint.y);
    return { uci, source, target, orientation: board.orientation };
  }

  async tryMoveByDragDrop(uci, testId = "practice-board") {
    const source = uci.slice(0, 2);
    const target = uci.slice(2, 4);
    const board = await this.getBoardBox(testId);
    const sourcePoint = this.getSquareCenter(board, source);
    const targetPoint = this.getSquareCenter(board, target);
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: sourcePoint.x,
      y: sourcePoint.y,
      button: "none",
    });
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: sourcePoint.x,
      y: sourcePoint.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: targetPoint.x,
      y: targetPoint.y,
      button: "left",
      buttons: 1,
    });
    await this.browserClient.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: targetPoint.x,
      y: targetPoint.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await delay(250);
    return { uci, source, target, orientation: board.orientation };
  }

  async captureScreenshot(name) {
    try {
      const result = await this.browserClient.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      const screenshotPath = path.join(PROJECT_ROOT, ".tmp", `${name}.png`);
      writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
      this.evidence.screenshot_path = screenshotPath;
      this.writeEvidence();
      return screenshotPath;
    } catch {
      return null;
    }
  }

  async cleanupProcesses() {
    this.shuttingDown = true;
    if (this.browserClient) {
      try {
        await this.browserClient.send("Browser.close");
      } catch {
        this.browserClient.close();
      }
    }
    for (const child of [...this.children].reverse()) {
      if (!child.killed) {
        killTree(child.pid);
      }
    }
    if (process.env.BROWSER_SMOKE_KEEP_TMP !== "1" && this.evidence.temp_db_dir) {
      try {
        rmSync(path.dirname(this.evidence.temp_db_dir), { recursive: true, force: true });
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

function rememberOutput(child, chunk) {
  child._output.push(chunk.toString("utf8"));
  if (child._output.length > 50) {
    child._output.shift();
  }
}

async function createBrowserPage(cdpPort, url, evidence) {
  const createResponse = await fetch(
    `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!createResponse.ok) {
    throw new Error(`Unable to create CDP page: HTTP ${createResponse.status}`);
  }
  const target = await createResponse.json();
  const client = new CdpClient(target.webSocketDebuggerUrl, evidence);
  await client.open();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");
  return client;
}

function killTree(pid) {
  if (!pid) {
    return;
  }
  if (isWindows) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Best-effort cleanup only.
    }
  }
}
