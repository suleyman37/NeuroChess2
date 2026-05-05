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

const evidence = createEvidence(
  "P0.REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1.live-pauses-review",
  "browser_live_analysis_pauses_during_review_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + Review UI standard analysis + live pause copy + terminal/recoverable job";

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

async function openReviewAndStartAnalysis(gameId) {
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
  await harness.waitForPagePredicate("review analysis action visible", () => {
    const normalized = (document.body?.innerText ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return {
      ok: normalized.includes("lancer l'analyse") || normalized.includes("analyser"),
      text: normalized.slice(0, 1200),
    };
  }, 30_000);
  await harness.clickByText("Lancer l'analyse", { afterMs: 600 });
  mark("standard_review_analysis_started_from_ui", "pass", "clicked Lancer l'analyse");
}

async function waitForPauseCopy() {
  const result = await harness.waitForPagePredicate("live pause copy visible", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return {
      ok: normalized.includes("analyse live en pause pendant la review"),
      text: text.slice(0, 1000),
    };
  }, 20_000);
  evidence.ui.pause_copy = result.text;
  mark("live_analysis_paused_during_review_job", "pass", "Analyse live en pause pendant la Review");
}

async function waitForTerminalOrRecoverable(jobId) {
  const deadline = Date.now() + 120_000;
  evidence.api.statuses_seen = [];
  evidence.api.progress_seen = [];
  let finalJob = null;
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
    if (terminalStatus(status)) {
      evidence.api.final_status = status;
      evidence.api.final_progress = progress;
      mark("review_job_terminal_or_recoverable", "pass", `${status} ${progress}`);
      return job;
    }
    await delay(750);
  }
  fail("review_job_terminal_or_recoverable", JSON.stringify(finalJob));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb({ FAKE_ENGINE_DELAY_MS: "500" });
  await harness.startFrontendVite();
  const gameId = await importGameOnly();
  await openReviewAndStartAnalysis(gameId);
  const job = latestReviewJobFromDb(gameId);
  if (!job?.job_id) {
    fail("review_job_created", JSON.stringify(job));
  }
  evidence.api.review_job_id = job.job_id;
  mark("review_job_created", "pass", JSON.stringify(job));
  await waitForPauseCopy();
  const finalJob = await waitForTerminalOrRecoverable(job.job_id);
  evidence.api.final_job = finalJob;
  await harness.waitForPagePredicate("live resumes or review recovery visible", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const evalText = document.querySelector(".eval-wrap")?.textContent ?? "";
    return {
      ok:
        normalized.includes("voir la review") ||
        normalized.includes("review prete") ||
        normalized.includes("reprendre") ||
        evalText.toLowerCase().includes("live"),
      text: text.slice(0, 1000),
      evalText,
    };
  }, 30_000);
  mark("live_or_recovery_available_after_review_job", "pass", "terminal state reached");
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_LIVE_ANALYSIS_PAUSES_DURING_REVIEW_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_live_analysis_pauses_during_review_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_LIVE_ANALYSIS_PAUSES_DURING_REVIEW_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
