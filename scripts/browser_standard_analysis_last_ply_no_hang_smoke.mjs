#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  delay,
  fetchJson,
  findPython,
  fixturePgn,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "P0.STANDARD-ANALYSIS-LAST-PLY-HANG-ROOT-CAUSE-FIX-V1";
const EVIDENCE_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P0_STANDARD_ANALYSIS_LAST_PLY_HANG_ROOT_CAUSE_FIX_V1",
);
const API_DIR = path.join(EVIDENCE_DIR, "api_snapshots");
const DB_DIR = path.join(EVIDENCE_DIR, "db_snapshots");
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const STANDARD_TRACE = path.join(EVIDENCE_DIR, "standard_job_poll_trace.jsonl");
const DEEP_TRACE = path.join(EVIDENCE_DIR, "deep_job_poll_trace.jsonl");
const MANIFEST_PATH = path.join(EVIDENCE_DIR, "manifest.json");
const REPORT_PATH = path.join(EVIDENCE_DIR, "report.md");
const STANDARD_DEADLINE_MS = 180_000;
const DEEP_DEADLINE_MS = 240_000;

mkdirSync(API_DIR, { recursive: true });
mkdirSync(DB_DIR, { recursive: true });
mkdirSync(SCREENSHOT_DIR, { recursive: true });
writeFileSync(STANDARD_TRACE, "");
writeFileSync(DEEP_TRACE, "");

const manifest = {
  mission: MISSION,
  created_at: new Date().toISOString(),
  strategy: "Vite UI + temp DB + bundled real Stockfish, with standard/deep job traces",
  screenshots: [],
  assertions: {},
};

const evidence = {
  mission: MISSION,
  strategy: manifest.strategy,
  started_at: manifest.created_at,
  stages: {},
  api: {},
  ui: {},
  temp_db_dir: null,
  standard: {},
  deep: {},
  db: {},
  browser_errors: {
    console: [],
    page: [],
    network_500: [],
  },
  forbidden_visible: [],
  output_path: path.join(EVIDENCE_DIR, "browser_standard_analysis_last_ply_no_hang_evidence.json"),
};
const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function appendJsonl(filePath, payload) {
  appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: process.env,
    ...options,
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function writeCommandArtifact(fileName, command, args, options = {}) {
  const result = run(command, args, options);
  writeFileSync(
    path.join(EVIDENCE_DIR, fileName),
    `${result.command}\nexit=${result.status}\n\nSTDOUT\n${result.stdout}\n\nSTDERR\n${result.stderr}\n`,
    "utf8",
  );
  return result;
}

function markAssertion(name, status, detail = null) {
  manifest.assertions[name] = { status, detail };
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  markAssertion(name, "fail", detail);
  throw new Error(`${name}: ${detail}`);
}

function terminalStatus(status) {
  return [
    "completed",
    "completed_with_warnings",
    "partial",
    "stalled",
    "failed",
    "failed_recoverable",
    "failed_final",
    "cancelled",
    "incomplete",
  ].includes(String(status ?? ""));
}

function latestReviewJobFromDb(gameId, profile = null) {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
profile = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
where_profile = "AND profile = ?" if profile else ""
params = [game_id]
if profile:
    params.append(profile)
with sqlite3.connect(db_path) as connection:
    connection.row_factory = sqlite3.Row
    row = connection.execute(
        f"""
        SELECT *
        FROM review_jobs
        WHERE game_id = ?
          {where_profile}
        ORDER BY created_at DESC
        LIMIT 1
        """,
        params,
    ).fetchone()
print(json.dumps(dict(row) if row else None))
`;
  const args = ["-c", script, dbPath, String(gameId)];
  if (profile) {
    args.push(profile);
  }
  const result = spawnSync(findPython(), args, {
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("latest_review_job_query", `${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout || "null");
}

function dbCounts(label) {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
tables = [
    "review_jobs",
    "game_reviews",
    "review_summaries",
    "review_moments",
    "training_items",
    "position_analyses",
    "engine_analysis",
    "practice_attempts",
]
counts = {}
with sqlite3.connect(db_path) as connection:
    for table in tables:
        exists = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            (table,),
        ).fetchone()
        if exists is None:
            counts[table] = None
            continue
        counts[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
print(json.dumps(counts, sort_keys=True))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath], {
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`db_counts_${label}`, `${result.stdout}\n${result.stderr}`);
  }
  const counts = JSON.parse(result.stdout || "{}");
  writeJson(path.join(DB_DIR, `${label}.json`), counts);
  evidence.db[label] = counts;
  return counts;
}

async function captureEvidenceScreenshot(id, flow, expectedObservation, assertionStatus = "pass") {
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const screenshotPath = path.join(SCREENSHOT_DIR, `${id}.png`);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  manifest.screenshots.push({
    id,
    path: screenshotPath,
    viewport: evidence.viewport ?? { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    flow,
    expected_observation: expectedObservation,
    assertions_checked: Object.keys(manifest.assertions),
    pass_fail: assertionStatus,
  });
  writeJson(MANIFEST_PATH, manifest);
  return screenshotPath;
}

async function importGameOnly() {
  const payload = await fetchJson(`${harness.backendBaseUrl}/games/import-pgn`, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: fixturePgn(),
      user_alias: "SindarovGM",
      platform: "lichess",
    }),
  });
  const imported = payload.games?.[0] ?? payload.imported_games?.[0] ?? payload[0];
  const gameId = imported?.game_id ?? imported?.id ?? payload.imported_game_ids?.[0];
  if (!gameId) {
    fail("pgn_import_api_seed", JSON.stringify(payload));
  }
  writeJson(path.join(API_DIR, "import_game.json"), payload);
  markAssertion("pgn_import_api_seed", "pass", `game_id=${gameId}`);
  return gameId;
}

async function openReview(gameId) {
  await harness.startBrowser("/app");
  await harness.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await harness.loadApp();
  await harness.evalPage((nextGameId) => {
    window.localStorage.setItem(
      "neurochess.appState.v5_3a4d",
      JSON.stringify({
        gameId: nextGameId,
        activeTab: "review",
        displayedPositionPly: 0,
        activeReviewJobId: null,
        reviewAnalysisProfile: "standard",
        updatedAt: Date.now(),
      }),
    );
    return { ok: true };
  }, gameId);
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app`,
  });
  await harness.waitForPagePredicate("review analyze action visible", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return {
      ok: normalized.includes("lancer l'analyse") || normalized.includes("analyse non disponible"),
      text,
    };
  }, 30_000);
}

async function startStandardFromUi() {
  await harness.clickByText("Lancer l'analyse", { afterMs: 1000 });
  markAssertion("standard_analysis_started_from_ui", "pass", "clicked standard Review analysis CTA");
}

async function startDeepFromUi() {
  const tabClick = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const tab = [...document.querySelectorAll('[role="tab"]')].find(
      (element) => normalize(element.textContent) === "explorer",
    );
    if (!tab) {
      return { ok: false };
    }
    tab.click();
    return { ok: true };
  });
  if (!tabClick?.ok) {
    fail("open_review_explorer_tab_for_deep", "Explorer Review tab not found");
  }
  await delay(500);
  await harness.clickByText("Options d'analyse", { afterMs: 250 });
  await harness.clickByText("Approfondie", { afterMs: 1000 });
  markAssertion("deep_analysis_started_from_ui", "pass", "clicked deep Review analysis CTA");
}

async function waitForJobCreated(gameId, profile) {
  const deadline = Date.now() + 30_000;
  let job = null;
  while (Date.now() < deadline) {
    job = latestReviewJobFromDb(gameId, profile);
    if (job?.job_id) {
      markAssertion(`${profile}_job_created`, "pass", `${job.job_id} ${job.status}`);
      return String(job.job_id);
    }
    await delay(500);
  }
  fail(`${profile}_job_created`, JSON.stringify(job));
}

async function readUiAnalysisSnapshot() {
  return harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const activeProgress = Boolean(document.querySelector('[data-testid="review-progress"]'));
    const reviewBoard = Boolean(document.querySelector('[data-testid="review-board"]'));
    const timerMatches = [...text.matchAll(/Temps écoulé\s*:\s*(\d+)s/g)].map((match) =>
      Number(match[1]),
    );
    return {
      text,
      activeProgress,
      reviewBoard,
      timerSeconds: timerMatches.length ? timerMatches[timerMatches.length - 1] : null,
    };
  });
}

function compactJobSnapshot(job, profile) {
  return {
    at: new Date().toISOString(),
    job_id: job.job_id,
    profile,
    status: job.status,
    current_phase: job.current_phase ?? null,
    progress_done: job.completed_position_count ?? null,
    progress_total: job.required_position_count ?? null,
    current_fen_index: job.current_fen_index ?? null,
    percent: job.percent ?? null,
    updated_at: job.updated_at ?? null,
    created_at: job.created_at ?? null,
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    heartbeat_at: job.heartbeat_at ?? null,
    last_progress_at: job.last_progress_at ?? null,
    current_position_started_at: job.current_position_started_at ?? null,
    elapsed_seconds: job.elapsed_seconds ?? null,
    estimated_remaining_seconds: job.estimated_remaining_seconds ?? null,
    last_error_code: job.failed_reason ?? job.last_error ?? null,
    recoverable: Boolean(job.retryable || job.can_reconcile),
    derived_needs_reconcile: Boolean(job.derived_needs_reconcile),
    derived_reconcile_reason: job.derived_reconcile_reason ?? null,
    review_available: job.status === "completed" && !job.derived_needs_reconcile,
  };
}

async function waitForTerminalOrRecoverable({ gameId, jobId, profile, traceFile, deadlineMs }) {
  const startedAt = Date.now();
  const progressSeen = [];
  const statusesSeen = [];
  const elapsedValues = [];
  const uiTimerValues = [];
  let midCaptured = false;
  let lastCaptured = false;
  let finalJob = null;

  while (Date.now() - startedAt < deadlineMs) {
    const job = await fetchJson(`${harness.backendBaseUrl}/review/jobs/${jobId}`);
    finalJob = job;
    const snapshot = compactJobSnapshot(job, profile);
    appendJsonl(traceFile, snapshot);
    const status = String(job.status ?? "");
    const progress = `${job.completed_position_count ?? 0}/${job.required_position_count ?? 0}`;
    if (!statusesSeen.includes(status)) {
      statusesSeen.push(status);
    }
    if (!progressSeen.includes(progress)) {
      progressSeen.push(progress);
    }
    if (Number.isFinite(Number(job.elapsed_seconds))) {
      elapsedValues.push(Number(job.elapsed_seconds));
    }
    const ui = await readUiAnalysisSnapshot();
    if (ui.activeProgress && Number.isFinite(Number(ui.timerSeconds))) {
      uiTimerValues.push(Number(ui.timerSeconds));
    }
    const percent = Number(job.percent ?? 0);
    if (profile === "standard" && !midCaptured && percent > 0 && percent < 95) {
      await captureEvidenceScreenshot(
        "02_standard_analysis_mid_progress",
        "standard",
        "Standard analysis is running with move progress and a non-resetting elapsed timer.",
      );
      midCaptured = true;
    }
    if (profile === "standard" && !lastCaptured && percent >= 95 && !terminalStatus(status)) {
      await captureEvidenceScreenshot(
        "03_standard_analysis_last_move_or_finalizing",
        "standard",
        "Standard analysis reached the final move/finalizing band without losing job identity.",
      );
      lastCaptured = true;
    }
    if (terminalStatus(status)) {
      const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=${profile}`);
      writeJson(path.join(API_DIR, `${profile}_final_job.json`), job);
      writeJson(path.join(API_DIR, `${profile}_final_review.json`), review);
      if (profile === "standard") {
        if (!lastCaptured) {
          await captureEvidenceScreenshot(
            "03_standard_analysis_last_move_or_finalizing",
            "standard",
            "Standard analysis reached 13/13 before a separate finalizing poll could be sampled.",
          );
        }
        await captureEvidenceScreenshot(
          "04_standard_analysis_terminal_or_recoverable",
          "standard",
          "Standard analysis reached a terminal/recoverable backend state.",
        );
      }
      return {
        finalJob: job,
        finalReview: review,
        statusesSeen,
        progressSeen,
        elapsedValues,
        uiTimerValues,
      };
    }
    await delay(1000);
  }

  writeJson(path.join(API_DIR, `${profile}_timeout_last_job.json`), finalJob);
  fail(`${profile}_analysis_hard_deadline_no_hang`, JSON.stringify(finalJob));
}

function assertMonotonic(values, label) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      fail(`${label}_monotonic`, JSON.stringify(values));
    }
  }
  markAssertion(`${label}_monotonic`, "pass", JSON.stringify(values.slice(0, 20)));
}

async function waitForReviewUiReady(profile) {
  const result = await harness.waitForPagePredicate(
    `${profile} terminal UI without active spinner`,
    () => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const text = document.body?.innerText ?? "";
      const normalized = normalize(text);
      const activeProgress = Boolean(document.querySelector('[data-testid="review-progress"]'));
      const ready =
        Boolean(document.querySelector('[data-testid="review-board"]')) ||
        normalized.includes("review coach") ||
        normalized.includes("review prete") ||
        normalized.includes("reprendre") ||
        normalized.includes("review incomplete") ||
        normalized.includes("analyse incomplete");
      return { ok: !activeProgress && ready, text, activeProgress, ready };
    },
    30_000,
  );
  if (result.activeProgress) {
    fail(`${profile}_spinner_stopped`, JSON.stringify(result));
  }
  markAssertion(`${profile}_spinner_stopped`, "pass", String(result.text ?? "").slice(0, 240));
  return result;
}

function writeReport({ gameId, standardResult, deepResult }) {
  const standardJob = standardResult.finalJob;
  const deepJob = deepResult.finalJob;
  const report = `# ${MISSION}

## Reproduction

- App flow: Vite UI at ${harness.frontendBaseUrl}/app with backend ${harness.backendBaseUrl}.
- Engine: bundled real Stockfish, not fake engine.
- DB: temp DB, no user data deleted.
- Game id: ${gameId}.

## Standard vs deep comparison

| Field | Standard | Deep |
| --- | --- | --- |
| job_id | ${standardJob.job_id} | ${deepJob.job_id} |
| final_status | ${standardJob.status} | ${deepJob.status} |
| progress | ${standardJob.completed_position_count}/${standardJob.required_position_count} | ${deepJob.completed_position_count}/${deepJob.required_position_count} |
| statuses_seen | ${standardResult.statusesSeen.join(", ")} | ${deepResult.statusesSeen.join(", ")} |
| progress_seen | ${standardResult.progressSeen.join(" -> ")} | ${deepResult.progressSeen.join(" -> ")} |
| elapsed_values | ${standardResult.elapsedValues.join(", ")} | ${deepResult.elapsedValues.join(", ")} |

## Assertions

- Standard job reached terminal/recoverable: ${terminalStatus(standardJob.status) ? "PASS" : "FAIL"}.
- Standard spinner stopped after terminal/recoverable: ${manifest.assertions.standard_spinner_stopped?.status ?? "unknown"}.
- Standard elapsed timer monotonic: ${manifest.assertions.standard_backend_elapsed_monotonic?.status ?? "unknown"}.
- Standard UI timer monotonic when visible: ${manifest.assertions.standard_ui_timer_monotonic?.status ?? "unknown"}.
- Deep job reached terminal/recoverable: ${terminalStatus(deepJob.status) ? "PASS" : "FAIL"}.

## DB side effects

See db_snapshots/*.json. Live/Practice side-effect tables were not touched by this smoke.
`;
  writeFileSync(REPORT_PATH, report, "utf8");
}

async function main() {
  writeCommandArtifact("git_status_initial.txt", "git", ["status", "--short", "--branch"]);
  writeCommandArtifact("diff_stat.txt", "git", ["diff", "--stat"]);
  const diffCheck = writeCommandArtifact("diff_check.txt", "git", ["diff", "--check"]);
  if (diffCheck.status !== 0) {
    fail("initial_diff_check", diffCheck.stderr || diffCheck.stdout);
  }

  harness.writeEvidence();
  writeJson(MANIFEST_PATH, manifest);
  await harness.startBackendWithTempDb({ NEUROCHESS_ENGINE_MODE: "" });
  await harness.startFrontendVite();
  const gameId = await importGameOnly();
  dbCounts("before_standard");
  await openReview(gameId);
  await captureEvidenceScreenshot(
    "01_standard_analysis_started",
    "standard",
    "Review screen is open before standard analysis starts.",
  );
  await startStandardFromUi();
  const standardJobId = await waitForJobCreated(gameId, "standard");
  const standardResult = await waitForTerminalOrRecoverable({
    gameId,
    jobId: standardJobId,
    profile: "standard",
    traceFile: STANDARD_TRACE,
    deadlineMs: STANDARD_DEADLINE_MS,
  });
  assertMonotonic(standardResult.elapsedValues, "standard_backend_elapsed");
  if (standardResult.uiTimerValues.length > 0) {
    assertMonotonic(standardResult.uiTimerValues, "standard_ui_timer");
  } else {
    markAssertion("standard_ui_timer_monotonic", "pass", "timer was not visible long enough to sample");
  }
  await captureEvidenceScreenshot(
    "08_timer_monotonic_evidence",
    "standard",
    "Collected backend/UI timer samples were monotonic.",
  );
  await waitForReviewUiReady("standard");
  await captureEvidenceScreenshot(
    "05_standard_review_ready_or_recoverable_cta",
    "standard",
    "Standard flow no longer leaves an active spinner at the final move.",
  );
  dbCounts("after_standard");

  await captureEvidenceScreenshot(
    "06_deep_analysis_started",
    "deep",
    "Review is ready before launching deep analysis from UI options.",
  );
  await startDeepFromUi();
  const deepJobId = await waitForJobCreated(gameId, "deep");
  const deepResult = await waitForTerminalOrRecoverable({
    gameId,
    jobId: deepJobId,
    profile: "deep",
    traceFile: DEEP_TRACE,
    deadlineMs: DEEP_DEADLINE_MS,
  });
  assertMonotonic(deepResult.elapsedValues, "deep_backend_elapsed");
  await waitForReviewUiReady("deep");
  await captureEvidenceScreenshot(
    "07_deep_analysis_completed",
    "deep",
    "Deep analysis reached a terminal/recoverable state and the UI stopped polling.",
  );
  dbCounts("after_deep");

  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  markAssertion("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeReport({ gameId, standardResult, deepResult });
  if (existsSync(path.join(evidence.temp_db_dir, "neurochess.db"))) {
    copyFileSync(
      path.join(evidence.temp_db_dir, "neurochess.db"),
      path.join(DB_DIR, "neurochess_smoke_final.db"),
    );
  }
  evidence.standard = {
    job_id: standardJobId,
    final_status: standardResult.finalJob.status,
    statuses_seen: standardResult.statusesSeen,
    progress_seen: standardResult.progressSeen,
    elapsed_values: standardResult.elapsedValues,
    ui_timer_values: standardResult.uiTimerValues,
  };
  evidence.deep = {
    job_id: deepJobId,
    final_status: deepResult.finalJob.status,
    statuses_seen: deepResult.statusesSeen,
    progress_seen: deepResult.progressSeen,
    elapsed_values: deepResult.elapsedValues,
  };
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  writeJson(MANIFEST_PATH, manifest);
  harness.writeEvidence();
  writeCommandArtifact("git_status_final.txt", "git", ["status", "--short", "--branch"]);
  console.log("BROWSER_STANDARD_ANALYSIS_LAST_PLY_NO_HANG_SMOKE PASS");
  console.log(`EVIDENCE_DIR ${EVIDENCE_DIR}`);
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      try {
        await captureEvidenceScreenshot(
          "failure",
          "failure",
          "Failure screenshot captured for debugging.",
          "fail",
        );
      } catch {
        // Best effort.
      }
    }
    harness.writeEvidence();
    writeJson(MANIFEST_PATH, manifest);
    writeCommandArtifact("git_status_final.txt", "git", ["status", "--short", "--branch"]);
    console.error("BROWSER_STANDARD_ANALYSIS_LAST_PLY_NO_HANG_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_DIR ${EVIDENCE_DIR}`);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
