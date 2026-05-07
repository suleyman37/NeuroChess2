#!/usr/bin/env node
import { Chess } from "../frontend/node_modules/chess.js/dist/esm/chess.js";
import {
  BrowserSmokeHarness,
  createEvidence,
  fetchJson,
  normalizeText,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const evidence = createEvidence(
  "P0.REVIEW-ANALYSIS-INFINITE-TIMER-AND-LIVE-ANALYSIS-V1.practice-no-live-spoiler",
  "browser_practice_no_live_spoiler_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + Review Practice + verify live eval/best move hidden before attempt";

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

async function latestSessionForGame(gameId) {
  const payload = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const latest = sessions[0] ?? null;
  if (!latest?.session_id) {
    fail("latest_practice_session", JSON.stringify(payload));
  }
  return fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${latest.session_id}`);
}

async function openPracticeFromReview(gameId) {
  await harness.waitForPagePredicate("review practice entry ready", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-practice-button"]')) ||
        Boolean(document.querySelector('[data-testid="review-focus-practice"]')) ||
        text.includes("S'entraîner"),
      text,
    };
  }, 30_000);
  try {
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  } catch {
    try {
      await harness.clickByTestId("review-focus-practice", { afterMs: 700 });
    } catch {
      await harness.clickByText("S'entraîner", { exact: false, afterMs: 700 });
    }
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  }
  await harness.waitForPagePredicate("practice panel visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  const session = await latestSessionForGame(gameId);
  evidence.api.practice_session_id = session.session_id;
  evidence.api.practice_item_id = session.items?.[0]?.item_id ?? null;
  mark("review_practice_opened", "pass", `session_id=${session.session_id}`);
  return session;
}

async function assertNoLiveSpoilerBeforeAttempt(item) {
  const result = await harness.evalPage((expectedBestMove) => {
    const text = document.body?.innerText ?? "";
    const evalText = document.querySelector(".eval-wrap")?.textContent ?? "";
    const source = document.querySelector(".eval-source")?.textContent ?? "";
    const sourceDetails = document.querySelector(".eval-source-details")?.textContent ?? "";
    const combined = `${evalText} ${source} ${sourceDetails}`;
    const normalizedCombined = combined
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const normalizedBody = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const bestMoveVisible =
      Boolean(expectedBestMove) && normalizedBody.includes(String(expectedBestMove).toLowerCase());
    const liveVisible = normalizedCombined.includes("live") && !normalizedCombined.includes("masquee");
    const boardOverlayVisible = Boolean(document.querySelector('[data-testid="board-move-outcome-overlay"]'));
    const practiceBadgeVisible = Boolean(document.querySelector('[data-testid="practice-attempt-quality-badge"]'));
    return {
      ok: !liveVisible && !bestMoveVisible && !boardOverlayVisible && !practiceBadgeVisible,
      evalText,
      source,
      sourceDetails,
      bestMoveVisible,
      liveVisible,
      boardOverlayVisible,
      practiceBadgeVisible,
    };
  }, item?.best_move_uci ?? null);
  if (!result.ok) {
    fail("practice_no_live_spoiler_before_attempt", JSON.stringify(result));
  }
  evidence.ui.practice_eval_before_attempt = result;
  mark("practice_no_live_spoiler_before_attempt", "pass", JSON.stringify(result));
}

async function submitLegalPracticeMove(session) {
  const item = session.items?.[0];
  if (!item?.fen_before) {
    fail("practice_item_available", JSON.stringify(session));
  }
  const move = item.best_move_uci || legalUcis(item.fen_before)[0];
  if (!move) {
    fail("practice_legal_move_available", item.fen_before);
  }
  evidence.api.practice_attempt_move = move;
  await harness.tryMoveByClickClick(move, "practice-board");
  await harness.waitForPagePredicate("practice feedback visible", () => {
    return { ok: Boolean(document.querySelector('[data-testid="practice-feedback"]')) };
  }, 20_000);
  const detail = await latestSessionForGame(evidence.api.game_id);
  const attempts = Array.isArray(detail.attempts) ? detail.attempts : [];
  if (attempts.length < 1) {
    fail("practice_attempt_saved", JSON.stringify(detail));
  }
  const latest = attempts[attempts.length - 1];
  evidence.api.practice_attempt_id = latest.id;
  evidence.api.practice_attempt_result = latest.result;
  evidence.api.practice_attempt_due_at = latest.due_at;
  mark("practice_attempt_saved_after_hidden_live", "pass", `attempt_id=${latest.id}, result=${latest.result}`);
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
    return { ok: Boolean(document.querySelector('[data-testid="review-board"]')) };
  }, 30_000);
  const session = await openPracticeFromReview(gameId);
  if (!Array.isArray(session.items) || session.items.length < 1) {
    fail("practice_items_available", JSON.stringify(session));
  }
  await assertNoLiveSpoilerBeforeAttempt(session.items[0]);
  await submitLegalPracticeMove(session);
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_PRACTICE_NO_LIVE_SPOILER_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_practice_no_live_spoiler_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_PRACTICE_NO_LIVE_SPOILER_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
