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
  "P0.CORE-FLOW-BOARD-INTERACTION-QA-REPAIR-V1",
  "browser_core_board_interaction_smoke_latest.json",
);
evidence.strategy =
  "API PGN/review seed + Vite browser + real board click-click attempts in Review and Daily Plan Practice";

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function pollReviewJob(backendBaseUrl, jobPayload, timeoutMs = 120_000) {
  const jobId = jobPayload.job_id;
  if (!jobId || jobPayload.status === "completed") {
    return jobPayload;
  }
  const deadline = Date.now() + timeoutMs;
  let payload = jobPayload;
  while (Date.now() < deadline) {
    payload = await fetchJson(`${backendBaseUrl}/review/jobs/${jobId}`);
    const status = payload.status ?? payload.review_status;
    if (status === "completed" || status === "done") {
      return payload;
    }
    if (status === "failed" || status === "stalled") {
      throw new Error(`Review job ended with ${status}: ${JSON.stringify(payload)}`);
    }
    await delay(750);
  }
  throw new Error(`Review job timeout: ${JSON.stringify(payload)}`);
}

async function prepareReviewAndDailyPlan(backendBaseUrl) {
  const importPayload = await fetchJson(`${backendBaseUrl}/games/import-pgn`, {
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

  const reviewJob = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = reviewJob.job_id ?? null;
  const completedJob = await pollReviewJob(backendBaseUrl, reviewJob);
  evidence.api.review_status = completedJob.status ?? completedJob.review_status ?? null;
  const review = await fetchJson(`${backendBaseUrl}/games/${gameId}/review?profile=standard`);
  evidence.api.review_status = review.status;
  evidence.api.review_moment_count = Array.isArray(review.moments) ? review.moments.length : 0;
  evidence.api.training_items_available = review.training_items_available ?? 0;
  if (!["done", "completed"].includes(review.status) || evidence.api.review_moment_count < 1) {
    fail("review_ready_api", `status=${review.status}, moments=${evidence.api.review_moment_count}`);
  }
  mark(
    "review_ready_api",
    "pass",
    `job=${evidence.api.review_job_id}, moments=${evidence.api.review_moment_count}`,
  );
  await seedEligibleReviewMoment(backendBaseUrl, gameId);

  const plan = await fetchJson(`${backendBaseUrl}/api/training/daily-plan`, {
    method: "POST",
    body: JSON.stringify({ max_items: 6 }),
  });
  evidence.api.daily_plan_id = plan.plan_id ?? plan.id ?? null;
  evidence.api.daily_plan_count = plan.item_count ?? 0;
  if (!Array.isArray(plan.items) || plan.items.length < 1) {
    fail("daily_plan_created", JSON.stringify(plan));
  }
  mark("daily_plan_created", "pass", `${plan.items.length} items`);
  return { gameId, review, plan };
}

async function seedEligibleReviewMoment(backendBaseUrl, gameId) {
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
    {
        "uci": "e2e4",
        "san": "e4",
        "rank": 1,
        "eval_cp": 85,
        "mate_in": None,
        "pv": ["e2e4", "e7e5", "g1f3"],
    },
    {
        "uci": "d2d4",
        "san": "d4",
        "rank": 2,
        "eval_cp": -120,
        "mate_in": None,
        "pv": ["d2d4", "d7d5"],
    },
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
            review_id,
            game_id,
            move_id,
            ply,
            played_by,
            side_to_move_before,
            fen_before,
            fen_after,
            played_uci,
            played_san,
            best_move_uci,
            best_move_san,
            eval_before_cp,
            eval_after_cp,
            mate_before,
            mate_after,
            cp_loss,
            cp_loss_label,
            importance_score,
            reliability_score,
            reliability_label,
            top_moves_json,
            review_type,
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
    fail("eligible_review_seed", `${result.stdout}\n${result.stderr}`);
  }
  const review = await fetchJson(`${backendBaseUrl}/games/${gameId}/review?profile=standard`);
  const session = await fetchJson(`${backendBaseUrl}/games/${gameId}/review/practice/sessions`, {
    method: "POST",
    body: JSON.stringify({ pov: "both", scope: "top_priority", max_items: 5 }),
  });
  if (!session.item_count || !Array.isArray(session.items) || session.items.length < 1) {
    fail("eligible_review_practice_seed", JSON.stringify({ review, session }));
  }
  await fetchJson(`${backendBaseUrl}/review/practice/sessions/${session.session_id}/abandon`, {
    method: "POST",
  });
  evidence.api.review_practice_seed_session_id = session.session_id;
  mark("eligible_review_practice_seed", "pass", `${session.item_count} item`);
}

async function openReviewFromHistory() {
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_initial");
  await harness.assertTrainingExactly3();
  await harness.clickByTestId("nav-games", { afterMs: 600 });
  try {
    await harness.clickByText("Voir historique", { afterMs: 700 });
  } catch {
    // Some states already show history; continue to the Review button wait.
  }
  await harness.waitForPagePredicate("history shows review", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Voir review") || text.includes("Review disponible"), text };
  }, 25_000);
  await harness.clickByText("Voir review", { exact: true, afterMs: 1200 });
  try {
    await harness.waitForPagePredicate("review summary visible", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 8_000);
  } catch {
    const text = await harness.visibleText();
    if (normalizeText(text).includes("lancer l'analyse")) {
      await harness.clickByText("Lancer l'analyse", { afterMs: 1200 });
    }
    await harness.waitForPagePredicate("review summary visible after generate", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 60_000);
  }
  mark("review_summary_and_board_visible", "pass", "Review contextuelle");
}

async function exerciseReviewBoardNavigation() {
  const firstMoment = await harness.evalPage(() => {
    const button = document.querySelector('[data-testid="review-moment-card"] button');
    if (!button) {
      return { ok: false, reason: "missing moment" };
    }
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    return { ok: true, text: button.textContent?.trim() ?? "" };
  });
  if (!firstMoment.ok) {
    fail("review_moment_card_click", JSON.stringify(firstMoment));
  }
  await harness.waitForPagePredicate("review board still rendered after moment", () => {
    const board = document.querySelector('[data-testid="review-board"]');
    const rect = board?.getBoundingClientRect();
    return { ok: Boolean(rect && rect.width > 100 && rect.height > 100) };
  }, 10_000);
  mark("review_board_moment_sync", "pass", firstMoment.text);
}

async function openPracticeFromReview(gameId) {
  try {
    await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  } catch {
    await harness.clickByText("S'entraîner", { exact: true, afterMs: 700 });
    await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  }
  await harness.waitForPagePredicate("practice opens", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
    };
  }, 30_000);
  const session = await latestSessionForGame(gameId);
  evidence.api.review_session_id = session.session_id;
  mark("review_practice_opened", "pass", `session_id=${session.session_id}`);
  return session;
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

async function waitForAttemptSaved(sessionId, previousCount, expectedResult, stageName) {
  const deadline = Date.now() + 20_000;
  let detail = null;
  while (Date.now() < deadline) {
    detail = await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${sessionId}`);
    const attempts = Array.isArray(detail.attempts) ? detail.attempts : [];
    if (attempts.length > previousCount) {
      const latest = attempts[attempts.length - 1];
      if (expectedResult && latest.result !== expectedResult) {
        fail(stageName, JSON.stringify(latest));
      }
      mark(stageName, "pass", `attempt_id=${latest.id}, result=${latest.result}`);
      return { detail, latest };
    }
    await delay(300);
  }
  fail(stageName, `attempt count did not exceed ${previousCount}: ${JSON.stringify(detail)}`);
}

async function assertAttemptSaved(sessionId, previousCount, expectedResult, stageName) {
  return waitForAttemptSaved(sessionId, previousCount, expectedResult, stageName);
}

function acceptedMoveSet(item) {
  return new Set([
    item.best_move_uci,
    ...(item.acceptable_moves ?? []).map((move) => move?.uci).filter(Boolean),
  ]);
}

function assertBestMoveLegal(item) {
  const board = new Chess(item.fen_before);
  const best = item.best_move_uci;
  const legal = legalUcis(board);
  if (!best || !legal.includes(best)) {
    fail("best_move_legal_in_practice_fen", JSON.stringify({
      item_id: item.item_id,
      ply: item.ply,
      best,
      fen_before: item.fen_before,
      legal: legal.slice(0, 20),
    }));
  }
  return best;
}

function chooseWrongLegalMove(item) {
  const board = new Chess(item.fen_before);
  const accepted = acceptedMoveSet(item);
  const move = legalUcis(board).find((uci) => !accepted.has(uci));
  if (!move) {
    fail("wrong_legal_move_available", JSON.stringify({ item_id: item.item_id, accepted: [...accepted] }));
  }
  return move;
}

function chooseIllegalMove(item) {
  const board = new Chess(item.fen_before);
  const legal = new Set(legalUcis(board));
  const squares = [];
  for (const file of "abcdefgh") {
    for (const rank of "12345678") {
      squares.push(`${file}${rank}`);
    }
  }
  for (const source of squares) {
    const piece = board.get(source);
    if (!piece || piece.color !== board.turn()) {
      continue;
    }
    for (const target of squares) {
      if (source === target) {
        continue;
      }
      const targetPiece = board.get(target);
      if (targetPiece?.color === piece.color) {
        continue;
      }
      const uci = `${source}${target}`;
      if (!legal.has(uci)) {
        return uci;
      }
    }
  }
  fail("illegal_move_available", JSON.stringify({ item_id: item.item_id }));
}

function legalUcis(board) {
  return board.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);
}

async function playMoveAndWait(session, itemIndex, uci, expectedResult, stageName) {
  const before = Array.isArray(session.attempts) ? session.attempts.length : 0;
  await harness.tryMoveByClickClick(uci, "practice-board");
  await harness.waitForPagePredicate(`${stageName} feedback visible`, () => {
    return { ok: Boolean(document.querySelector('[data-testid="practice-feedback"]')) };
  }, 20_000);
  const saved = await assertAttemptSaved(session.session_id, before, expectedResult, stageName);
  const latest = saved.latest;
  const item = session.items[itemIndex];
  if (!latest.due_at) {
    fail(`${stageName}_due_at`, JSON.stringify(latest));
  }
  const expectedItemId = item.item_id ?? `review:${latest.game_id}:ply:${item.ply}`;
  if (latest.item_id !== expectedItemId) {
    fail(`${stageName}_item_id`, JSON.stringify({ expected: expectedItemId, latest }));
  }
  return saved;
}

async function clickNextPracticeItem() {
  await harness.clickByTestId("practice-next-button", { afterMs: 900 });
  await harness.waitForPagePredicate("next practice item ready", () => {
    const feedback = document.querySelector('[data-testid="practice-feedback"]');
    const reveal = document.querySelector('[data-testid="practice-reveal-button"]');
    return { ok: !feedback && Boolean(reveal) };
  }, 15_000);
}

async function quitPracticeIfVisible() {
  await harness.clickByText("Quitter", { exact: true, afterMs: 900 });
}

async function revealInFreshReviewPractice(gameId) {
  await quitPracticeIfVisible();
  const session = await openPracticeFromReview(gameId);
  const before = Array.isArray(session.attempts) ? session.attempts.length : 0;
  await harness.clickByTestId("practice-reveal-button", { afterMs: 1200 });
  const saved = await assertAttemptSaved(
    session.session_id,
    before,
    "revealed",
    "reveal_attempt_saved",
  );
  evidence.api.reveal_attempt_id = saved.latest.id;
  evidence.api.reveal_used = saved.latest.reveal_used;
  return saved;
}

async function startDailyPlanPractice(gameId) {
  await quitPracticeIfVisible();
  await harness.clickByTestId("nav-training", { afterMs: 700 });
  await harness.clickByTestId("daily-plan-start-button", { afterMs: 1500 });
  await harness.waitForPagePredicate("daily plan practice board visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')),
    };
  }, 30_000);
  const session = await latestSessionForGame(gameId);
  evidence.api.daily_plan_session_id = session.session_id;
  mark("daily_plan_practice_opened", "pass", `session_id=${session.session_id}`);
  return session;
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReviewAndDailyPlan(harness.backendBaseUrl);
  await harness.startBrowser("/app");

  await openReviewFromHistory();
  await exerciseReviewBoardNavigation();

  let session = await openPracticeFromReview(gameId);
  if (!Array.isArray(session.items) || session.items.length < 1) {
    fail("practice_has_items_for_interaction_contract", JSON.stringify(session.items));
  }

  const firstItem = session.items[0];
  const correctMove = assertBestMoveLegal(firstItem);
  evidence.api.item_id = firstItem.item_id;
  evidence.api.accepted_move = correctMove;
  evidence.api.attempted_correct_move = correctMove;
  let saved = await playMoveAndWait(session, 0, correctMove, "best", "correct_attempt_saved");
  evidence.api.correct_attempt_id = saved.latest.id;
  evidence.api.correct_attempt_result = saved.latest.result;
  evidence.api.hint_used = saved.latest.hint_used;
  evidence.api.due_at = saved.latest.due_at;

  await quitPracticeIfVisible();
  session = await openPracticeFromReview(gameId);
  const wrongItem = session.items[0];
  const wrongMove = chooseWrongLegalMove(wrongItem);
  evidence.api.attempted_wrong_move = wrongMove;
  saved = await playMoveAndWait(session, 0, wrongMove, "wrong", "wrong_attempt_saved");
  evidence.api.wrong_attempt_id = saved.latest.id;
  evidence.api.wrong_attempt_result = saved.latest.result;

  await quitPracticeIfVisible();
  session = await openPracticeFromReview(gameId);
  const illegalItem = session.items[0];
  const illegalMove = chooseIllegalMove(illegalItem);
  evidence.api.attempted_illegal_move = illegalMove;
  saved = await playMoveAndWait(session, 0, illegalMove, "illegal", "illegal_attempt_saved");
  evidence.api.illegal_attempt_id = saved.latest.id;
  evidence.api.illegal_attempt_result = saved.latest.result;

  await revealInFreshReviewPractice(gameId);

  const dailySession = await startDailyPlanPractice(gameId);
  const dailyItem = dailySession.items[0];
  const dailyMove = assertBestMoveLegal(dailyItem);
  evidence.api.daily_plan_item_id = dailyItem.item_id;
  evidence.api.daily_plan_accepted_move = dailyMove;
  const dailySaved = await playMoveAndWait(
    dailySession,
    0,
    dailyMove,
    "best",
    "daily_plan_board_attempt_saved",
  );
  evidence.api.daily_plan_attempt_id = dailySaved.latest.id;
  evidence.api.daily_plan_attempt_result = dailySaved.latest.result;

  const sessionsAfterAttempt = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  evidence.api.learning_summary = sessionsAfterAttempt.learning_summary ?? null;
  evidence.api.learning_summary_practice_event_count =
    sessionsAfterAttempt.learning_summary?.practice_event_count ??
    sessionsAfterAttempt.learning_summary?.attempt_count ??
    null;
  if (!evidence.api.learning_summary) {
    fail("learning_summary_updated", JSON.stringify(sessionsAfterAttempt));
  }
  mark("learning_summary_updated", "pass", JSON.stringify(evidence.api.learning_summary));

  const exportPayload = await fetchJson(`${harness.backendBaseUrl}/api/export`);
  const exportedAttempts = exportPayload.practice_attempts ?? [];
  if (exportedAttempts.length < 5) {
    fail("export_contains_board_attempts", `attempts=${exportedAttempts.length}`);
  }
  mark("export_contains_board_attempts", "pass", `${exportedAttempts.length} attempts`);

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate("reload stable", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra") };
  }, 20_000);
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
  console.log("BROWSER_CORE_BOARD_INTERACTION_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_core_board_interaction_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_CORE_BOARD_INTERACTION_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
