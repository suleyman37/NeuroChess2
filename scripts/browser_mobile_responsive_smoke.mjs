#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Chess } from "../frontend/node_modules/chess.js/dist/esm/chess.js";
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
  "P1.MOBILE-RESPONSIVE-AND-A11Y-V1.mobile-responsive",
  "browser_mobile_responsive_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + fake engine + Vite + Edge CDP mobile viewport + real board tap/click";

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function pollReviewJob(jobPayload, timeoutMs = 120_000) {
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
    if (status === "failed" || status === "stalled") {
      fail("review_job_terminal_before_mobile_review", JSON.stringify(payload));
    }
    await delay(750);
  }
  fail("review_job_timeout", JSON.stringify(payload));
}

async function prepareReviewAndDailyPlan() {
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
    fail("mobile_pgn_import_api", JSON.stringify(importPayload));
  }
  evidence.api.game_id = gameId;
  mark("mobile_pgn_import_api", "pass", `game_id=${gameId}`);

  const reviewJob = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = reviewJob.job_id ?? null;
  await pollReviewJob(reviewJob);
  await seedEligibleReviewMoment(gameId);
  const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  evidence.api.review_status = review.status;
  evidence.api.review_moment_count = Array.isArray(review.moments) ? review.moments.length : 0;
  if (!["done", "completed"].includes(review.status) || evidence.api.review_moment_count < 1) {
    fail("mobile_review_ready_api", JSON.stringify(review));
  }
  mark("mobile_review_ready_api", "pass", `moments=${evidence.api.review_moment_count}`);

  const plan = await fetchJson(`${harness.backendBaseUrl}/api/training/daily-plan`, {
    method: "POST",
    body: JSON.stringify({ max_items: 6 }),
  });
  evidence.api.daily_plan_id = plan.plan_id ?? plan.id ?? null;
  evidence.api.daily_plan_count = plan.item_count ?? 0;
  if (!Array.isArray(plan.items) || plan.items.length < 1) {
    fail("mobile_daily_plan_created", JSON.stringify(plan));
  }
  mark("mobile_daily_plan_created", "pass", `${plan.items.length} items`);
  return { gameId };
}

async function seedEligibleReviewMoment(gameId) {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
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
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("mobile_eligible_review_seed", `${result.stdout}\n${result.stderr}`);
  }
  const session = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`, {
    method: "POST",
    body: JSON.stringify({ pov: "both", scope: "top_priority", max_items: 5 }),
  });
  if (!session.item_count || !Array.isArray(session.items) || session.items.length < 1) {
    fail("mobile_eligible_review_practice_seed", JSON.stringify(session));
  }
  await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${session.session_id}/abandon`, {
    method: "POST",
  });
  mark("mobile_eligible_review_practice_seed", "pass", `${session.item_count} item`);
}

async function openReviewFromHistory() {
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  await harness.assertForbiddenV1LabelsAbsent("mobile_forbidden_labels_absent_initial");
  await harness.assertNoHorizontalOverflow("mobile_today_no_horizontal_overflow");
  await harness.clickByTestId("nav-games", { afterMs: 600 });
  await harness.waitForPagePredicate("mobile games import action visible", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Importer") || text.includes("PGN"), text };
  }, 15_000);
  await harness.assertNoHorizontalOverflow("mobile_games_no_horizontal_overflow");
  try {
    await harness.clickByText("Voir historique", { afterMs: 700 });
  } catch {
    // History may already be visible.
  }
  await harness.waitForPagePredicate("mobile history shows review", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Voir review") || text.includes("Review disponible"), text };
  }, 25_000);
  await harness.clickByText("Voir review", { exact: true, afterMs: 1200 });
  try {
    await harness.waitForPagePredicate("mobile review summary visible", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 10_000);
  } catch {
    const text = await harness.visibleText();
    if (normalizeText(text).includes("lancer l'analyse")) {
      await harness.clickByText("Lancer l'analyse", { afterMs: 1200 });
    }
    await harness.waitForPagePredicate("mobile review summary visible after generate", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 60_000);
  }
  await assertBoardFitsViewport("review-board", "mobile_review_board_fits");
  await harness.assertNoHorizontalOverflow("mobile_review_no_horizontal_overflow");
  mark("mobile_review_opened", "pass", "review-summary + review-board visible");
}

async function assertBoardFitsViewport(testId, stage) {
  const box = await harness.getBoardBox(testId);
  const viewport = await harness.evalPage(() => ({ width: window.innerWidth, height: window.innerHeight }));
  if (box.left < -2 || box.left + box.width > viewport.width + 2 || box.width < 250) {
    fail(stage, JSON.stringify({ box, viewport }));
  }
  mark(stage, "pass", `width=${Math.round(box.width)}, viewport=${viewport.width}`);
}

function legalUcis(fen) {
  const board = new Chess(fen);
  return board.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
}

async function currentBoardFen(testId) {
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

async function exerciseReviewExplorationMobile() {
  await harness.clickByTestId("review-exploration-start", { afterMs: 700 });
  await harness.waitForPagePredicate("mobile exploration active", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        text.includes("Exploration locale") &&
        Boolean(document.querySelector('[data-testid="review-exploration-feedback"]')),
      text,
    };
  }, 10_000);
  const originalFen = await currentBoardFen("review-board");
  const move = legalUcis(originalFen)[0];
  if (!move) {
    fail("mobile_exploration_legal_move_available", originalFen);
  }
  evidence.api.mobile_explored_move = move;
  await harness.tryMoveByClickClick(move, "review-board");
  await harness.waitForPagePredicate("mobile exploration board changed", (fen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    return {
      ok: Boolean(board?.getAttribute("data-board-fen")) && board?.getAttribute("data-board-fen") !== fen,
      fen: board?.getAttribute("data-board-fen") ?? null,
    };
  }, 10_000, originalFen);
  await harness.clickByTestId("review-exploration-reset", { afterMs: 500 });
  await harness.waitForPagePredicate("mobile exploration reset", (fen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    return { ok: board?.getAttribute("data-board-fen") === fen };
  }, 10_000, originalFen);
  await assertBoardFitsViewport("review-board", "mobile_review_board_after_exploration_fits");
  await harness.assertNoHorizontalOverflow("mobile_review_exploration_no_horizontal_overflow");
  mark("mobile_review_exploration_tap", "pass", move);
}

async function latestSessionForGame(gameId) {
  const payload = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const latest = sessions[0] ?? null;
  if (!latest?.session_id) {
    fail("mobile_latest_practice_session", JSON.stringify(payload));
  }
  return fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${latest.session_id}`);
}

async function playBestMoveAndWait(session, stageName) {
  const item = session.items?.[0];
  if (!item?.best_move_uci || !item?.fen_before) {
    fail(`${stageName}_item_available`, JSON.stringify(session));
  }
  const before = session.attempts?.length ?? 0;
  await harness.tryMoveByClickClick(item.best_move_uci, "practice-board");
  await harness.waitForPagePredicate(`${stageName} feedback visible`, () => {
    return { ok: Boolean(document.querySelector('[data-testid="practice-feedback"]')) };
  }, 20_000);
  const deadline = Date.now() + 20_000;
  let latest = null;
  while (Date.now() < deadline) {
    const next = await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${session.session_id}`);
    const attempts = Array.isArray(next.attempts) ? next.attempts : [];
    if (attempts.length > before) {
      latest = attempts[attempts.length - 1];
      break;
    }
    await delay(300);
  }
  if (!latest) {
    fail(stageName, `attempt count did not exceed ${before}`);
  }
  mark(stageName, "pass", `attempt_id=${latest.id}, result=${latest.result}`);
  return { item, latest };
}

async function startPracticeFromReviewMobile(gameId) {
  await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  await harness.waitForPagePredicate("mobile review practice board visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
    };
  }, 30_000);
  await assertBoardFitsViewport("practice-board", "mobile_practice_board_fits");
  await harness.assertNoHorizontalOverflow("mobile_practice_no_horizontal_overflow");
  const session = await latestSessionForGame(gameId);
  evidence.api.mobile_review_session_id = session.session_id;
  const { latest } = await playBestMoveAndWait(session, "mobile_review_practice_attempt_saved");
  evidence.api.mobile_review_attempt_id = latest.id;
  evidence.api.mobile_review_attempt_result = latest.result;
  await harness.clickByText("Quitter", { exact: true, afterMs: 600 });
}

async function startDailyPlanPracticeMobile(gameId) {
  await harness.clickByTestId("nav-training", { afterMs: 700 });
  await harness.assertTrainingExactly3();
  await harness.assertNoHorizontalOverflow("mobile_training_no_horizontal_overflow");
  await harness.clickByTestId("daily-plan-start-button", { afterMs: 1200 });
  await harness.waitForPagePredicate("mobile daily plan practice board visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')),
    };
  }, 30_000);
  await assertBoardFitsViewport("practice-board", "mobile_daily_practice_board_fits");
  const session = await latestSessionForGame(gameId);
  evidence.api.mobile_daily_session_id = session.session_id;
  const { latest } = await playBestMoveAndWait(session, "mobile_daily_plan_attempt_saved");
  evidence.api.mobile_daily_attempt_id = latest.id;
  evidence.api.mobile_daily_attempt_result = latest.result;
  await harness.clickByText("Quitter", { exact: true, afterMs: 600 });
}

async function verifyProfileMobile() {
  await harness.clickByTestId("profile-settings-button", { afterMs: 500 });
  await harness.waitForPagePredicate("mobile profile privacy visible", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="profile-privacy-panel"]')) &&
        text.includes("Exporter mes") &&
        text.includes("Supprimer mes"),
      text,
    };
  }, 10_000);
  await harness.assertNoHorizontalOverflow("mobile_profile_no_horizontal_overflow");
  mark("mobile_profile_privacy_visible", "pass", "export/delete visible");
}

async function browserErrorGate() {
  const pageErrors = evidence.browser_errors.page.filter((error) =>
    /typeerror|referenceerror|uncaught/i.test(String(error)),
  );
  if (pageErrors.length > 0 || evidence.browser_errors.network_500.length > 0) {
    fail("mobile_browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("mobile_browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReviewAndDailyPlan();
  await harness.startBrowser("/app");
  await harness.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await openReviewFromHistory();
  await exerciseReviewExplorationMobile();
  await startPracticeFromReviewMobile(gameId);
  await startDailyPlanPracticeMobile(gameId);
  await verifyProfileMobile();
  await harness.assertForbiddenV1LabelsAbsent("mobile_forbidden_labels_absent_final");
  await browserErrorGate();

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_MOBILE_RESPONSIVE_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_mobile_responsive_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_MOBILE_RESPONSIVE_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
