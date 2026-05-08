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
} from "./browser_test_helpers.mjs";

const evidence = createEvidence(
  "P0.REAL-RUNTIME-BOARD-EXPLORATION-AND-ANALYSIS-REPAIR-V1.review-exploration",
  "browser_review_exploration_real_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + Vite + real browser click-click Review exploration + Practice attempt separation";

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

function chooseIllegalMove(fen) {
  const board = new Chess(fen);
  const legal = new Set(legalUcis(fen));
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
  fail("illegal_exploration_move_available", fen);
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
      fail("review_job_terminal_before_review", JSON.stringify(payload));
    }
    await delay(750);
  }
  fail("review_job_timeout", JSON.stringify(payload));
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
    fail("eligible_review_seed", `${result.stdout}\n${result.stderr}`);
  }
  const session = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`, {
    method: "POST",
    body: JSON.stringify({ pov: "both", scope: "top_priority", max_items: 5 }),
  });
  if (!session.item_count || !Array.isArray(session.items) || session.items.length < 1) {
    fail("eligible_review_practice_seed", JSON.stringify(session));
  }
  await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${session.session_id}/abandon`, {
    method: "POST",
  });
  mark("eligible_review_practice_seed", "pass", `${session.item_count} item`);
}

async function prepareReview() {
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
  await pollReviewJob(job);
  let review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  if (!["done", "completed"].includes(review.status)) {
    fail("review_ready_api", JSON.stringify(review));
  }
  await seedEligibleReviewMoment(gameId);
  review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  evidence.api.review_status = review.status;
  evidence.api.review_moment_count = Array.isArray(review.moments) ? review.moments.length : 0;
  mark("review_ready_api", "pass", `moments=${evidence.api.review_moment_count}`);
  return { gameId };
}

async function openReview() {
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_initial");
  await harness.clickByTestId("nav-games", { afterMs: 600 });
  try {
    await harness.clickByText("Voir historique", { afterMs: 700 });
  } catch {
    // History may already be visible.
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
    }, 12_000);
  } catch {
    const text = await harness.visibleText();
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (normalized.includes("lancer l'analyse")) {
      await harness.clickByText("Lancer l'analyse", { afterMs: 1200 });
    }
    await harness.waitForPagePredicate("review summary visible after refresh", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 60_000);
  }
  mark("review_opened", "pass", "review-summary + review-board visible");
}

async function exportAttemptCount() {
  const payload = await fetchJson(`${harness.backendBaseUrl}/api/export`);
  return Array.isArray(payload.practice_attempts) ? payload.practice_attempts.length : 0;
}

async function currentReviewBoardFen() {
  const value = await harness.evalPage(() => {
    const board = document.querySelector('[data-testid="review-board"]');
    return {
      ok: Boolean(board),
      fen: board?.getAttribute("data-board-fen") ?? null,
      text: document.body?.innerText ?? "",
    };
  });
  if (!value.ok || !value.fen) {
    fail("review_board_fen_visible", JSON.stringify(value));
  }
  return value.fen;
}

async function assertReviewBoardFen(expectedFen, stage) {
  await harness.waitForPagePredicate(stage, (fen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    return {
      ok: board?.getAttribute("data-board-fen") === fen,
      fen: board?.getAttribute("data-board-fen") ?? null,
    };
  }, 10_000, expectedFen);
  mark(stage, "pass", expectedFen);
}

async function exerciseExploration() {
  const attemptsBefore = await exportAttemptCount();
  evidence.api.attempts_before = attemptsBefore;

  await harness.clickByTestId("review-exploration-start", { afterMs: 800 });
  await harness.waitForPagePredicate("exploration active", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        text.includes("Exploration locale") &&
        Boolean(document.querySelector('[data-testid="review-exploration-feedback"]')),
      text,
    };
  }, 10_000);
  const originalFen = await currentReviewBoardFen();
  evidence.api.original_fen = originalFen;
  const exploredMove = legalUcis(originalFen)[0];
  if (!exploredMove) {
    fail("exploration_legal_move_available", originalFen);
  }
  evidence.api.explored_move = exploredMove;

  await harness.tryMoveByClickClick(exploredMove, "review-board");
  const changed = await harness.waitForPagePredicate("review exploration board changed", (fen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    const moves = document.querySelector('[data-testid="review-exploration-moves"]');
    return {
      ok:
        Boolean(board?.getAttribute("data-board-fen")) &&
        board?.getAttribute("data-board-fen") !== fen &&
        Boolean(moves?.textContent?.trim()),
      fen: board?.getAttribute("data-board-fen") ?? null,
      moves: moves?.textContent ?? "",
    };
  }, 10_000, originalFen);
  evidence.api.board_changed = true;
  evidence.api.after_exploration_fen = changed.fen;
  mark("review_exploration_move", "pass", `${exploredMove} -> ${changed.fen}`);

  const attemptsAfterExploration = await exportAttemptCount();
  evidence.api.attempts_after_exploration = attemptsAfterExploration;
  if (attemptsAfterExploration !== attemptsBefore) {
    fail(
      "exploration_does_not_create_attempt",
      `before=${attemptsBefore}, after=${attemptsAfterExploration}`,
    );
  }
  mark("exploration_does_not_create_attempt", "pass", String(attemptsAfterExploration));

  await harness.clickByTestId("review-exploration-undo", { afterMs: 500 });
  await assertReviewBoardFen(originalFen, "review_exploration_undo");

  await harness.tryMoveByClickClick(exploredMove, "review-board");
  await harness.waitForPagePredicate("board changed before reset", (fen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    return { ok: board?.getAttribute("data-board-fen") !== fen };
  }, 10_000, originalFen);
  await harness.clickByTestId("review-exploration-reset", { afterMs: 500 });
  await assertReviewBoardFen(originalFen, "review_exploration_reset");

  const illegalMove = chooseIllegalMove(originalFen);
  evidence.api.illegal_exploration_move = illegalMove;
  await harness.tryMoveByClickClick(illegalMove, "review-board");
  await harness.waitForPagePredicate("illegal exploration message", () => {
    const text = document.querySelector('[data-testid="review-exploration-feedback"]')?.textContent ?? "";
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return { ok: normalized.includes("pas legal"), text };
  }, 10_000);
  const attemptsAfterIllegal = await exportAttemptCount();
  evidence.api.attempts_after_illegal_exploration = attemptsAfterIllegal;
  if (attemptsAfterIllegal !== attemptsBefore) {
    fail("illegal_exploration_does_not_create_attempt", String(attemptsAfterIllegal));
  }
  mark("review_exploration_illegal_move", "pass", illegalMove);

  await harness.clickByTestId("review-exploration-exit", { afterMs: 500 });
  mark("review_exploration_exit", "pass");
}

async function startPracticeAndSaveAttempt(gameId) {
  await harness.evalPage(({ nextGameId }) => {
    window.localStorage.setItem(`neurochess.reviewPov.${nextGameId}`, "both");
    return { ok: true };
  }, { nextGameId: gameId });
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?reviewExplorationPractice=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review ready for practice after exploration", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-focus-practice"], [data-testid="review-practice-button"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  try {
    await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  } catch {
    await harness.clickByText("entrainer", { afterMs: 700 });
    await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  }
  await harness.waitForPagePredicate("practice opens after exploration", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')),
    };
  }, 30_000);
  const sessionsPayload = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const session = sessionsPayload.sessions?.[0];
  if (!session?.session_id) {
    fail("review_practice_session_after_exploration", JSON.stringify(sessionsPayload));
  }
  const detail = await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${session.session_id}`);
  const item = detail.items?.[0];
  if (!item?.best_move_uci || !item?.fen_before) {
    fail("practice_item_after_exploration", JSON.stringify(detail));
  }
  const before = detail.attempts?.length ?? 0;
  await harness.tryMoveByClickClick(item.best_move_uci, "practice-board");
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
    fail("practice_attempt_after_exploration_saved", `session=${session.session_id}`);
  }
  evidence.api.practice_session_id = session.session_id;
  evidence.api.practice_item_id = item.item_id;
  evidence.api.practice_accepted_move = item.best_move_uci;
  evidence.api.practice_attempt_id = latest.id;
  evidence.api.practice_attempt_result = latest.result;
  evidence.api.practice_due_at = latest.due_at;
  mark("practice_attempt_after_exploration_saved", "pass", JSON.stringify(latest));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReview();
  await harness.startBrowser("/app");
  await openReview();
  await exerciseExploration();
  await startPracticeAndSaveAttempt(gameId);

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
  console.log("BROWSER_REVIEW_EXPLORATION_REAL_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_review_exploration_real_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_EXPLORATION_REAL_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
