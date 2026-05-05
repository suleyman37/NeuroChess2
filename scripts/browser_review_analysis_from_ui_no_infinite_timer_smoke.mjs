#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  fetchJson,
  findPython,
  fixturePgn,
  normalizeText,
} from "./browser_test_helpers.mjs";

const HARD_DEADLINE_MS = 90_000;

const evidence = createEvidence(
  "P0.REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1.review-ui-no-infinite-timer",
  "browser_review_analysis_from_ui_no_infinite_timer_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + normal frontend Review button + job API hard deadline";
evidence.hard_deadline_ms = HARD_DEADLINE_MS;

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
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
  evidence.api.game_id = gameId;
  mark("pgn_import_api_seed", "pass", `game_id=${gameId}`);
  return gameId;
}

function latestReviewJobFromDb(gameId) {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
with sqlite3.connect(db_path) as connection:
    connection.row_factory = sqlite3.Row
    row = connection.execute(
        """
        SELECT job_id, status, completed_position_count, required_position_count
        FROM review_jobs
        WHERE game_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (game_id,),
    ).fetchone()
print(json.dumps(dict(row) if row else None))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("latest_review_job_query", `${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout || "null");
}

async function openReviewAndClickAnalyze(gameId) {
  await harness.startBrowser("/app");
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
      ok:
        normalized.includes("lancer l'analyse") ||
        normalized.includes("analyser") ||
        normalized.includes("review"),
      text,
    };
  }, 30_000);
  const textBefore = await harness.visibleText();
  evidence.ui.before_click = textBefore.slice(0, 800);
  await harness.clickByText("Lancer l'analyse", { afterMs: 1200 });
  mark("review_analysis_started_from_ui", "pass", "clicked Lancer l'analyse");
}

async function waitForJobCreated(gameId) {
  const deadline = Date.now() + 30_000;
  let job = null;
  while (Date.now() < deadline) {
    job = latestReviewJobFromDb(gameId);
    if (job?.job_id) {
      evidence.api.review_job_id = job.job_id;
      mark("review_job_created_by_ui", "pass", JSON.stringify(job));
      return job.job_id;
    }
    await delay(500);
  }
  fail("review_job_created_by_ui", JSON.stringify(job));
}

async function waitForTerminalUiState(status) {
  const result = await harness.waitForPagePredicate(
    "terminal Review UI without active spinner",
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
      const activeSpinnerText = normalized.includes("analyse approfondie en cours");
      const recoverableOrReady =
        normalized.includes("reprendre") ||
        normalized.includes("review prete") ||
        normalized.includes("voir la review") ||
        normalized.includes("moments") ||
        normalized.includes("relancer") ||
        normalized.includes("reparer") ||
        normalized.includes("verifier") ||
        normalized.includes("review incomplete") ||
        normalized.includes("analyse incomplete") ||
        Boolean(document.querySelector('[data-testid="review-board"]'));
      return {
        ok: !activeProgress && !activeSpinnerText && recoverableOrReady,
        text,
        activeProgress,
        activeSpinnerText,
        recoverableOrReady,
      };
    },
    15_000,
  );
  evidence.ui.terminal_state = {
    status,
    activeProgress: result.activeProgress,
    activeSpinnerText: result.activeSpinnerText,
    recoverableOrReady: result.recoverableOrReady,
    text: String(result.text ?? "").slice(0, 1000),
  };
  return String(result.text ?? "");
}

async function waitForTerminalOrRecoverable(jobId) {
  const deadline = Date.now() + HARD_DEADLINE_MS;
  evidence.api.statuses_seen = [];
  evidence.api.progress_seen = [];
  let finalJob = null;
  let finalUi = "";
  while (Date.now() < deadline) {
    const job = await fetchJson(`${harness.backendBaseUrl}/review/jobs/${jobId}`);
    finalJob = job;
    const status = String(job.status ?? "");
    const progress = `${job.completed_position_count ?? 0}/${job.required_position_count ?? 0}`;
    if (!evidence.api.statuses_seen.includes(status)) {
      evidence.api.statuses_seen.push(status);
    }
    if (!evidence.api.progress_seen.includes(progress)) {
      evidence.api.progress_seen.push(progress);
    }
    finalUi = await harness.visibleText();
    const normalized = normalizeText(finalUi);
    const recoverableUi =
      normalized.includes("reprendre") ||
      normalized.includes("review prete") ||
      normalized.includes("voir la review") ||
      normalized.includes("moments") ||
      normalized.includes("relancer");
    if (terminalStatus(status)) {
      evidence.api.final_status = status;
      evidence.api.final_progress = progress;
      finalUi = await waitForTerminalUiState(status);
      evidence.ui.final_text = finalUi.slice(0, 1000);
      if ((status === "completed" || status === "completed_with_warnings") && !recoverableUi) {
        const updatedUi = normalizeText(finalUi);
        const updatedRecoverableUi =
          updatedUi.includes("reprendre") ||
          updatedUi.includes("review prete") ||
          updatedUi.includes("voir la review") ||
          updatedUi.includes("moments") ||
          updatedUi.includes("relancer") ||
          updatedUi.includes("reparer") ||
          updatedUi.includes("verifier") ||
          updatedUi.includes("review incomplete") ||
          updatedUi.includes("analyse incomplete");
        if (!updatedRecoverableUi) {
          fail("terminal_ui_visible", JSON.stringify({ status, finalUi }));
        }
      }
      if (status !== "completed" && !recoverableUi) {
        const updatedUi = normalizeText(finalUi);
        const updatedRecoverableUi =
          updatedUi.includes("reprendre") ||
          updatedUi.includes("review prete") ||
          updatedUi.includes("voir la review") ||
          updatedUi.includes("moments") ||
          updatedUi.includes("relancer") ||
          updatedUi.includes("reparer") ||
          updatedUi.includes("verifier") ||
          updatedUi.includes("review incomplete") ||
          updatedUi.includes("analyse incomplete");
        if (!updatedRecoverableUi) {
          fail("recoverable_ui_visible", JSON.stringify({ status, finalUi }));
        }
      }
      mark("analysis_terminal_or_recoverable", "pass", `${status} ${progress}`);
      return job;
    }
    await delay(750);
  }
  fail("analysis_hard_deadline_no_infinite_timer", JSON.stringify({ finalJob, finalUi }));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const gameId = await importGameOnly();
  await openReviewAndClickAnalyze(gameId);
  const jobId = await waitForJobCreated(gameId);
  const finalJob = await waitForTerminalOrRecoverable(jobId);
  evidence.api.final_job = finalJob;
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_ANALYSIS_FROM_UI_NO_INFINITE_TIMER_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_review_analysis_from_ui_no_infinite_timer_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_ANALYSIS_FROM_UI_NO_INFINITE_TIMER_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
