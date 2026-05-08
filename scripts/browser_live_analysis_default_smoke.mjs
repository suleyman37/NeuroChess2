#!/usr/bin/env node
import { Chess } from "../frontend/node_modules/chess.js/dist/esm/chess.js";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  normalizeText,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const evidence = createEvidence(
  "P0.REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1.live-default",
  "browser_live_analysis_default_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + Review board + live analysis default + Review exploration FEN update";

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

function legalUcis(fen) {
  const board = new Chess(fen);
  return board.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
}

async function currentBoardFen(testId = "review-board") {
  const value = await harness.evalPage((id) => {
    const board = document.querySelector(`[data-testid="${id}"]`);
    return {
      ok: Boolean(board),
      fen: board?.getAttribute("data-board-fen") ?? null,
    };
  }, testId);
  if (!value.ok || !value.fen) {
    fail(`${testId}_fen_visible`, JSON.stringify(value));
  }
  return value.fen;
}

async function waitForLiveEval(stage) {
  let payload;
  try {
    payload = await harness.waitForPagePredicate(stage, () => {
      const evalText = document.querySelector(".eval-wrap")?.textContent ?? "";
      const source = document.querySelector(".eval-source")?.textContent ?? "";
      const sourceDetails = document.querySelector(".eval-source-details")?.textContent ?? "";
      const combined = `${evalText} ${source} ${sourceDetails}`;
      return {
        ok: combined.toLowerCase().includes("live"),
        evalText,
        source,
        sourceDetails,
      };
    }, 30_000);
  } catch (error) {
    const debugSnapshot = await harness.evalPage(() => {
      const entries = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes("live-analysis"));
      return {
        liveNetworkEntries: entries,
        boardFen: document
          .querySelector('[data-testid="review-board"]')
          ?.getAttribute("data-board-fen"),
        text: (document.body?.innerText ?? "").slice(0, 1200),
      };
    });
    let directStartResponse = null;
    if (debugSnapshot.boardFen) {
      directStartResponse = await fetch(`${harness.backendBaseUrl}/live-analysis/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: debugSnapshot.boardFen,
          context: "review",
          game_id: evidence.api.game_id ?? null,
          ply: 0,
        }),
      }).then((response) => response.json());
    }
    evidence.ui[`${stage}_debug`] = {
      ...debugSnapshot,
      directStartResponse,
    };
    throw error;
  }
  evidence.api[stage] = payload;
  mark(stage, "pass", JSON.stringify(payload));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness);
  evidence.api.game_id = gameId;
  evidence.api.review_status = review.status;
  await openReviewFromPersistedState(harness, gameId);
  await harness.waitForPagePredicate("review board visible", () => {
    return {
      ok: Boolean(document.querySelector('[data-testid="review-board"]')),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  await waitForLiveEval("live_analysis_visible_on_review_board");

  const beforeFen = await currentBoardFen("review-board");
  const move = legalUcis(beforeFen)[0];
  if (!move) {
    fail("review_exploration_legal_move_available", beforeFen);
  }
  evidence.api.exploration_move = move;
  await harness.waitForPagePredicate("review exploration button enabled", () => {
    const button = document.querySelector('[data-testid="review-exploration-start"]');
    return {
      ok: Boolean(button && !button.disabled),
      disabled: button && "disabled" in button ? button.disabled : null,
      text: document.body?.innerText ?? "",
    };
  }, 15_000);
  await harness.clickByTestId("review-exploration-start", { afterMs: 700 });
  await harness.tryMoveByClickClick(move, "review-board");
  await harness.waitForPagePredicate("review exploration board changed", (fen) => {
    const nextFen = document
      .querySelector('[data-testid="review-board"]')
      ?.getAttribute("data-board-fen");
    return { ok: Boolean(nextFen && nextFen !== fen), before: fen, after: nextFen };
  }, 15_000, beforeFen);
  const afterFen = await currentBoardFen("review-board");
  evidence.api.exploration_after_fen = afterFen;
  await delay(500);
  await waitForLiveEval("live_analysis_updates_after_review_exploration_move");

  const text = normalizeText(await harness.visibleText());
  if (text.includes("analyse live en pause pendant la review")) {
    fail("live_not_paused_when_no_review_job_running", text);
  }
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_LIVE_ANALYSIS_DEFAULT_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_live_analysis_default_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_LIVE_ANALYSIS_DEFAULT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
