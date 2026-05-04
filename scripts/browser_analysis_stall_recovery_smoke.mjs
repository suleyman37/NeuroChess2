#!/usr/bin/env node
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  fetchJson,
  fixturePgn,
  normalizeText,
} from "./browser_test_helpers.mjs";

const RETRY_COPY = "Vous pouvez reprendre l'analyse.";
const evidence = createEvidence(
  "P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1.analysis-stall",
  "browser_analysis_stall_recovery_smoke_latest.json",
);
evidence.strategy =
  "controlled fake-engine timeout + persisted Review job restore + browser retry CTA";

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function waitForJobStatus(jobId, wantedStatuses, timeoutMs = 120_000) {
  const wanted = new Set(wantedStatuses);
  const deadline = Date.now() + timeoutMs;
  let payload = null;
  while (Date.now() < deadline) {
    payload = await fetchJson(`${harness.backendBaseUrl}/review/jobs/${jobId}`);
    if (wanted.has(payload.status)) {
      return payload;
    }
    await delay(750);
  }
  fail("review_job_status_timeout", JSON.stringify(payload));
}

async function createStalledReviewJob() {
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
  const stalled = await waitForJobStatus(job.job_id, ["stalled", "failed"], 120_000);
  evidence.api.stalled_job = stalled;
  if (!["stalled", "failed"].includes(stalled.status) || !stalled.retryable) {
    fail("controlled_stall_created", JSON.stringify(stalled));
  }
  mark(
    "controlled_stall_created",
    "pass",
    `${stalled.completed_position_count}/${stalled.required_position_count} ${stalled.error_message}`,
  );
  return { gameId, jobId: job.job_id, stalled };
}

async function restoreStalledJobInBrowser(gameId, jobId) {
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
  const restored = await harness.waitForPagePredicate("stalled job visible", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return {
      ok: normalized.includes("analyse") && normalized.includes("reprendre"),
      text,
    };
  }, 30_000);
  const retryCount = (restored.text.match(new RegExp(RETRY_COPY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  evidence.api.retry_copy_count = retryCount;
  if (retryCount !== 1) {
    fail("retry_copy_not_duplicated", JSON.stringify({ retryCount, text: restored.text }));
  }
  mark("stalled_state_visible_once", "pass", `retry_copy_count=${retryCount}`);
}

async function retryAndVerifyRecovery(gameId) {
  await harness.clickByText("Reprendre", { exact: true, afterMs: 1500 });
  const deadline = Date.now() + 120_000;
  let review = null;
  while (Date.now() < deadline) {
    review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
    if (review.status === "done" || review.status === "completed") {
      evidence.api.review_status_after_retry = review.status;
      evidence.api.review_moment_count = Array.isArray(review.moments) ? review.moments.length : 0;
      mark("retry_recovered_review", "pass", `moments=${evidence.api.review_moment_count}`);
      return;
    }
    await delay(1000);
  }
  fail("retry_recovered_review", JSON.stringify(review));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb({
    FAKE_ENGINE_TIMEOUT_ON_INDEX: "12",
    FAKE_ENGINE_HARD_TIMEOUT_MS: "800",
  });
  await harness.startFrontendVite();
  const { gameId, jobId } = await createStalledReviewJob();
  await restoreStalledJobInBrowser(gameId, jobId);
  await retryAndVerifyRecovery(gameId);

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate("app stable after stall retry", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra") };
  }, 20_000);
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length > 0 || evidence.browser_errors.network_500.length > 0) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_ANALYSIS_STALL_RECOVERY_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_analysis_stall_recovery_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_ANALYSIS_STALL_RECOVERY_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
