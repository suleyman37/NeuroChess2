#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  fetchJson,
  findPython,
  normalizeText,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "P0.PRACTICE-FEEDBACK-CORRECTNESS-AND-LEGACY-REVIEW-REBUILD-V1";
const QA_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P0_PRACTICE_FEEDBACK_CORRECTNESS_AND_LEGACY_REVIEW_REBUILD_V1",
);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots");
const API_DIR = path.join(QA_DIR, "api_snapshots");
const DB_DIR = path.join(QA_DIR, "db_snapshots");
for (const dir of [QA_DIR, SCREENSHOT_DIR, API_DIR, DB_DIR]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_practice_best_move_feedback_success_evidence.json",
);
evidence.output_path = path.join(QA_DIR, "browser_practice_best_move_feedback_success_evidence.json");
evidence.strategy =
  "temp backend DB + seeded Review moment + real Practice board click-click exact best move";
evidence.screenshots = [];

const manifest = {
  mission: MISSION,
  generated_at: new Date().toISOString(),
  screenshots: [],
};

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function captureQaScreenshot(id, flow, expectedObservation, assertionsChecked) {
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const screenshotPath = path.join(SCREENSHOT_DIR, `${id}.png`);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  const entry = {
    id,
    path: screenshotPath,
    viewport: "default headless Edge viewport",
    flow,
    expected_observation: expectedObservation,
    assertions_checked: assertionsChecked,
    pass: true,
  };
  manifest.screenshots.push(entry);
  evidence.screenshots.push(entry);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  harness.writeEvidence();
  return screenshotPath;
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

function dbCounts(label) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
tables = [
    "review_jobs",
    "game_reviews",
    "review_moments",
    "training_items",
    "review_practice_sessions",
    "review_practice_attempts",
]
with sqlite3.connect(db_path) as connection:
    counts = {}
    for table in tables:
        counts[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
print(json.dumps(counts, sort_keys=True))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`db_counts_${label}`, `${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout);
  writeJson(path.join(DB_DIR, `${label}.json`), payload);
  evidence.api[`db_counts_${label}`] = payload;
  return payload;
}

async function openPracticeFromReview(gameId) {
  try {
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  } catch {
    await harness.clickByText("S'entrainer", { exact: true, afterMs: 700 });
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
  evidence.api.practice_best_move_uci = session.items?.[0]?.best_move_uci ?? null;
  mark("review_practice_opened", "pass", `session_id=${session.session_id}`);
  return session;
}

async function assertSuccessFeedback(expectedMove) {
  const result = await harness.waitForPagePredicate(
    "best move success feedback and no contradiction",
    (expectedMove) => {
      const text = document.body?.innerText ?? "";
      const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, " ");
      const hasSuccess =
        compact.includes("bien joue") ||
        compact.includes("bonne idee") ||
        compact.includes("tu as trouve");
      const hasProblem = compact.includes("ton coup probleme");
      const hasMissedBest = compact.includes("le meilleur coup etait");
      const hasAttempt = compact.includes(String(expectedMove ?? "").toLowerCase());
      return {
        ok: hasSuccess && hasAttempt && !hasProblem && !hasMissedBest,
        hasSuccess,
        hasAttempt,
        hasProblem,
        hasMissedBest,
        text,
      };
    },
    25_000,
    expectedMove,
  );
  evidence.ui.practice_success_feedback = result;
  mark("practice_best_move_success_no_contradiction", "pass", JSON.stringify(result));
}

async function assertAttemptSaved(gameId, countsBefore, expectedMove) {
  const detail = await latestSessionForGame(gameId);
  const attempts = Array.isArray(detail.attempts) ? detail.attempts : [];
  if (attempts.length !== 1) {
    fail("practice_attempt_count", JSON.stringify(detail));
  }
  const latest = attempts[0];
  if (latest.result !== "best" || latest.attempted_uci !== expectedMove || !latest.due_at) {
    fail("practice_attempt_saved_as_best", JSON.stringify(latest));
  }
  const exportAfter = await fetchJson(`${harness.backendBaseUrl}/api/export`);
  writeJson(path.join(API_DIR, "export_after_best_attempt.json"), exportAfter);
  const countsAfter = dbCounts("after_best_attempt");
  if (countsAfter.review_practice_attempts !== countsBefore.review_practice_attempts + 1) {
    fail("db_attempt_delta", JSON.stringify({ countsBefore, countsAfter }));
  }
  for (const table of ["review_jobs", "review_moments", "training_items"]) {
    if (countsAfter[table] !== countsBefore[table]) {
      fail("db_unexpected_side_effect", JSON.stringify({ table, countsBefore, countsAfter }));
    }
  }
  evidence.api.practice_attempt = latest;
  evidence.api.export_practice_attempt_count = exportAfter.practice_attempts?.length ?? null;
  evidence.api.db_counts_after_best_attempt = countsAfter;
  mark(
    "practice_attempt_saved_as_best",
    "pass",
    `attempt_id=${latest.id}, result=${latest.result}, due_at=${latest.due_at}`,
  );
}

async function assertLegacyBestStillClassifies() {
  const payload = await fetchJson(`${harness.backendBaseUrl}/review/try-move/evaluate`, {
    method: "POST",
    body: JSON.stringify({
      fen_before: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      move_played: "Bxf7+",
      best_move_san: "Bxf7+",
      source_context: "legacy_review_api_probe",
    }),
  });
  writeJson(path.join(API_DIR, "legacy_bxf7_try_move_evaluation.json"), payload);
  if (payload.result !== "best" || payload.show_best_move !== false) {
    fail("legacy_bxf7_try_move_evaluation", JSON.stringify(payload));
  }
  evidence.api.legacy_bxf7_try_move_evaluation = payload;
  mark("legacy_bxf7_try_move_evaluation", "pass", payload.evidence?.user_move_uci ?? "best");
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
  const exportBefore = await fetchJson(`${harness.backendBaseUrl}/api/export`);
  writeJson(path.join(API_DIR, "export_before_attempt.json"), exportBefore);
  const countsBefore = dbCounts("before_best_attempt");
  const bestMove = session.items[0]?.best_move_uci;
  const bestMoveLabel = session.items[0]?.best_move_san ?? bestMove;
  if (!bestMove) {
    fail("practice_best_move_available", JSON.stringify(session.items[0] ?? null));
  }
  evidence.api.practice_attempt_move = bestMove;
  await captureQaScreenshot(
    "01_practice_challenge_before_attempt",
    "Practice challenge before attempt",
    "Practice board is visible before any correction is revealed",
    ["practice-panel", "practice-board", "no attempt yet"],
  );
  await harness.tryMoveByClickClick(bestMove, "practice-board");
  await captureQaScreenshot(
    "02_practice_best_move_played",
    "Best move played by board click-click",
    "User has submitted the exact best move on the board",
    [`move ${bestMove} submitted`, "real board click-click"],
  );
  await assertSuccessFeedback(bestMoveLabel);
  await captureQaScreenshot(
    "03_practice_success_feedback",
    "Success feedback after exact best move",
    "The UI shows success feedback for the exact best move",
    ["success feedback visible", "practice-feedback visible"],
  );
  await captureQaScreenshot(
    "04_no_contradictory_problem_label",
    "No contradictory problem label",
    "The UI does not show 'Ton coup - probleme' or 'Le meilleur coup etait' after success",
    ["no problem label", "no missed-best reproach"],
  );
  await assertAttemptSaved(gameId, countsBefore, bestMove);
  await assertLegacyBestStillClassifies();
  await captureQaScreenshot(
    "05_legacy_or_rebuild_state_if_applicable",
    "Legacy exact-best API probe",
    "Legacy SAN best move Bxf7+ classifies as best without forcing a false wrong state",
    ["legacy API result best", "show_best_move false"],
  );
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  const classificationCases = {
    exact_best_ui: {
      user_move: evidence.api.practice_attempt_move,
      expected_best: evidence.api.practice_best_move_uci,
      result: evidence.api.practice_attempt?.result,
      due_at_present: Boolean(evidence.api.practice_attempt?.due_at),
    },
    legacy_san_bxf7: {
      user_move: "Bxf7+",
      expected_best: "Bxf7+",
      result: evidence.api.legacy_bxf7_try_move_evaluation?.result,
      user_move_uci: evidence.api.legacy_bxf7_try_move_evaluation?.evidence?.user_move_uci,
      best_move_uci: evidence.api.legacy_bxf7_try_move_evaluation?.evidence?.best_move_uci,
    },
  };
  writeJson(path.join(QA_DIR, "feedback_classification_cases.json"), classificationCases);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_PRACTICE_BEST_MOVE_FEEDBACK_SUCCESS_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      try {
        await captureQaScreenshot(
          "failure_practice_best_move_feedback",
          "Failure screenshot",
          "Captured at smoke failure",
          ["failure diagnostics"],
        );
      } catch {
        await harness.captureScreenshot("browser_practice_best_move_feedback_success_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_PRACTICE_BEST_MOVE_FEEDBACK_SUCCESS_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
