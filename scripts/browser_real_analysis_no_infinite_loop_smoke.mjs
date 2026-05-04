#!/usr/bin/env node
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  fetchJson,
  fixturePgn,
} from "./browser_test_helpers.mjs";

const HARD_DEADLINE_MS = 90_000;

const evidence = createEvidence(
  "P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1.analysis-no-infinite-loop",
  "browser_real_analysis_no_infinite_loop_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + normal browser Review polling + hard deadline against infinite analysis UI";
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
    "done",
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

async function importAndStartAnalysis() {
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
    fail("pgn_import_api", JSON.stringify(importPayload));
  }
  evidence.api.game_id = gameId;
  mark("pgn_import_api_seed", "pass", `game_id=${gameId}`);

  const job = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = job.job_id ?? null;
  evidence.api.statuses_seen = [job.status];
  evidence.api.progress_seen = [
    `${job.completed_position_count ?? 0}/${job.required_position_count ?? 0}`,
  ];
  mark("review_job_started", "pass", JSON.stringify({
    job_id: job.job_id,
    status: job.status,
    progress: evidence.api.progress_seen[0],
  }));
  return { gameId, jobId: job.job_id };
}

async function restoreJobInBrowser(gameId, jobId) {
  await harness.startBrowser("/app");
  await harness.loadApp();
  await harness.evalPage(
    ({ gameId, jobId }) => {
      window.localStorage.setItem(
        "neurochess.appState.v5_3a4d",
        JSON.stringify({
          gameId,
          activeTab: "review",
          displayedPositionPly: 0,
          activeReviewJobId: jobId,
          reviewAnalysisProfile: "standard",
          updatedAt: Date.now(),
        }),
      );
      return { ok: true };
    },
    { gameId, jobId },
  );
  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate("review route restored", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok: text.includes("Review") || text.includes("Analyse") || text.includes("Reprendre"),
      text,
    };
  }, 30_000);
  mark("review_job_restored_in_browser", "pass", `job_id=${jobId}`);
}

async function waitForTerminalOrRecoverable(jobId) {
  const deadline = Date.now() + HARD_DEADLINE_MS;
  let finalJob = null;
  let finalText = "";
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
    finalText = await harness.visibleText();
    const normalized = finalText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const recoverableUi =
      normalized.includes("reprendre") ||
      normalized.includes("verifier") ||
      normalized.includes("relancer") ||
      normalized.includes("review");
    if (terminalStatus(status)) {
      evidence.api.final_status = status;
      evidence.api.final_progress = progress;
      evidence.api.final_ui_text = finalText.slice(0, 800);
      if (status === "completed" || status === "done") {
        const review = await fetchJson(`${harness.backendBaseUrl}/games/${evidence.api.game_id}/review?profile=standard`);
        evidence.api.review_available = ["done", "completed"].includes(review.status);
        if (!evidence.api.review_available) {
          fail("review_available_after_completed_job", JSON.stringify(review));
        }
      } else if (!recoverableUi) {
        fail("recoverable_ui_present_for_terminal_analysis_state", JSON.stringify({ status, finalText }));
      }
      mark("analysis_terminal_or_recoverable", "pass", `${status} ${progress}`);
      return finalJob;
    }
    if (job.derived_needs_reconcile && job.can_reconcile) {
      evidence.api.final_status = status;
      evidence.api.final_progress = progress;
      evidence.api.final_ui_text = finalText.slice(0, 800);
      if (!recoverableUi) {
        fail("reconcile_ui_present", JSON.stringify({ job, finalText }));
      }
      mark("analysis_terminal_or_recoverable", "pass", `reconcile ${progress}`);
      return job;
    }
    await delay(750);
  }
  fail("analysis_hard_deadline_no_infinite_loop", JSON.stringify({ finalJob, finalText }));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, jobId } = await importAndStartAnalysis();
  await restoreJobInBrowser(gameId, jobId);
  const finalJob = await waitForTerminalOrRecoverable(jobId);
  evidence.api.final_job = finalJob;

  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  const pageErrors = evidence.browser_errors.page.filter((error) =>
    /typeerror|referenceerror|uncaught/i.test(String(error)),
  );
  if (pageErrors.length > 0 || evidence.browser_errors.network_500.length > 0) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REAL_ANALYSIS_NO_INFINITE_LOOP_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_real_analysis_no_infinite_loop_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_REAL_ANALYSIS_NO_INFINITE_LOOP_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
