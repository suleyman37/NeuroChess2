#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Chess } from "../frontend/node_modules/chess.js/dist/esm/chess.js";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  delay,
  fetchJson,
  findPython,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.EXPLORER-STABLE-MOVE-FEEDBACK-V1";
const MISSION_ID = "P1_EXPLORER_STABLE_MOVE_FEEDBACK_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
const CONSOLE_DIR = path.join(QA_DIR, "console_logs");
const NETWORK_DIR = path.join(QA_DIR, "network_logs");

for (const dir of [
  QA_DIR,
  SCREENSHOT_RAW_DIR,
  path.join(QA_DIR, "screenshots_annotated"),
  path.join(QA_DIR, "contact_sheets"),
  BROWSER_EVIDENCE_DIR,
  CONSOLE_DIR,
  NETWORK_DIR,
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_explorer_stable_move_feedback_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_explorer_stable_move_feedback_evidence.json",
);
evidence.strategy =
  "temp backend DB + Vite + Review Explorer board move + explicit stable Explorer evaluation";
evidence.contract_checks = {};
evidence.screenshots = [];

const manifest = {
  mission: MISSION,
  generated_at: new Date().toISOString(),
  screenshots: [],
};
const screenshotTimeline = [];
let screenshotIndex = 0;

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function safeFileToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90)
    .toUpperCase();
}

function localStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function captureContractScreenshot({
  scenario,
  state,
  action,
  expected,
  observed,
  pass,
  primaryTestId,
}) {
  screenshotIndex += 1;
  const now = new Date();
  const filename = `${localStamp(now)}__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken(scenario)}__${safeFileToken(state)}__${pass ? "PASS" : "FAIL"}.png`;
  const screenshotPath = path.join(SCREENSHOT_RAW_DIR, filename);
  const shot = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  const page = await harness.evalPage(() => ({
    url: window.location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollY: Math.round(window.scrollY),
  }));
  const entry = {
    mission_id: MISSION_ID,
    created_at_utc: now.toISOString(),
    screenshot_index: screenshotIndex,
    scenario,
    state,
    action_just_performed: action,
    expected_user_contract: expected,
    observed_result: observed,
    pass,
    route_or_url: page.url,
    viewport: page.viewport,
    scroll_y: page.scrollY,
    primary_data_testid_checked: primaryTestId,
    path: screenshotPath,
  };
  screenshotTimeline.push(entry);
  evidence.screenshots = screenshotTimeline;
  manifest.screenshots = screenshotTimeline;
  writeJson(screenshotPath.replace(/\.png$/i, ".json"), entry);
  writeScreenshotIndex();
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  harness.writeEvidence();
}

function writeScreenshotIndex() {
  const lines = [
    "# Screenshots Index",
    "",
    "| # | File | Scenario | Action | Expected | Observed | PASS/FAIL |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const shot of screenshotTimeline) {
    lines.push(
      `| ${shot.screenshot_index} | \`${path.basename(shot.path)}\` | ${shot.scenario} | ${shot.action_just_performed} | ${shot.expected_user_contract} | ${shot.observed_result} | ${
        shot.pass ? "PASS" : "FAIL"
      } |`,
    );
  }
  writeFileSync(path.join(QA_DIR, "screenshots_index.md"), `${lines.join("\n")}\n`, "utf8");
  writeJson(path.join(QA_DIR, "screenshots_timeline.json"), screenshotTimeline);
}

function dbCounts() {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
tables = ("review_practice_attempts", "training_items", "daily_plan_items")
with sqlite3.connect(db_path) as connection:
    counts = {}
    for table in tables:
        counts[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    def has_column(table, column):
        return any(row[1] == column for row in connection.execute(f"PRAGMA table_info({table})"))
    counts["practice_attempts_with_due_at"] = (
        connection.execute("SELECT COUNT(*) FROM review_practice_attempts WHERE due_at IS NOT NULL").fetchone()[0]
        if has_column("review_practice_attempts", "due_at")
        else 0
    )
    counts["training_items_with_due_at"] = (
        connection.execute("SELECT COUNT(*) FROM training_items WHERE due_at IS NOT NULL").fetchone()[0]
        if has_column("training_items", "due_at")
        else 0
    )
print(json.dumps(counts, sort_keys=True))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath], {
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("db_counts", `${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function chooseExplorationMove(fen) {
  const board = new Chess(fen);
  const legal = board.moves({ verbose: true }).map(
    (move) => `${move.from}${move.to}${move.promotion ?? ""}`,
  );
  const preferred = ["a2a3", "h2h3", "b1c3", "g1f3", "a7a6", "h7h6", "b8c6", "g8f6"];
  return preferred.find((move) => legal.includes(move)) ?? legal[0] ?? null;
}

async function reviewBoardSnapshot() {
  return harness.evalPage(() => {
    const board = document.querySelector('[data-testid="review-board"]');
    return {
      ok: Boolean(board),
      fen: board?.getAttribute("data-board-fen") ?? null,
      orientation: board?.getAttribute("data-board-orientation") ?? null,
    };
  });
}

async function openExplorerLab() {
  await harness.clickByTestId("review-exploration-start", { afterMs: 700 });
  await harness.waitForPagePredicate("review explorer active", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-exploration-panel"].active')) &&
      Boolean(document.querySelector('[data-testid="review-board"]')),
    text: document.body?.innerText ?? "",
  }), 12_000);
  await captureContractScreenshot({
    scenario: "EXPLORER_BEFORE_NEW_MOVE",
    state: "ACTIVE_EMPTY",
    action: "opened Review Explorer",
    expected: "Explorer active with board visible before new move",
    observed: "Review board and Explorer panel visible",
    pass: true,
    primaryTestId: "review-exploration-panel",
  });
}

async function playNewExplorationMove() {
  const before = await reviewBoardSnapshot();
  if (!before.ok || !before.fen) {
    fail("review_board_before_exploration_move", JSON.stringify(before));
  }
  const move = chooseExplorationMove(before.fen);
  if (!move) {
    fail("legal_exploration_move_available", before.fen);
  }
  evidence.api.exploration_move = move;
  evidence.api.exploration_fen_before = before.fen;
  await harness.tryMoveByClickClick(move, "review-board");
  await harness.waitForPagePredicate("latest exploration move awaiting analysis", () => {
    const feedback = document.querySelector('[data-testid="review-explorer-move-feedback"]');
    const state = document.querySelector('[data-testid="review-explorer-analysis-state"]');
    return {
      ok:
        Boolean(feedback) &&
        Boolean(document.querySelector('[data-testid="review-explorer-analyze-move"]')) &&
        state?.textContent?.toLowerCase().includes("non"),
      text: feedback?.textContent ?? "",
    };
  }, 12_000);
  const after = await reviewBoardSnapshot();
  evidence.api.exploration_fen_after = after.fen;
  mark("explorer_new_move_non_analyzed", "pass", `${move} -> ${after.fen}`);
  await captureContractScreenshot({
    scenario: "EXPLORER_NEW_MOVE",
    state: "NON_ANALYSED",
    action: `played ${move}`,
    expected: "Non analysé state with Analyser ce coup CTA",
    observed: "Feedback dock shows unevaluated latest move",
    pass: true,
    primaryTestId: "review-explorer-move-feedback",
  });
}

async function analyzeExplorationMove() {
  await harness.clickByTestId("review-explorer-analyze-move", { afterMs: 10 });
  try {
    await harness.waitForPagePredicate("analysis in progress visible", () => {
      const state = document.querySelector('[data-testid="review-explorer-analysis-state"]');
      const normalized = String(state?.textContent ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return { ok: normalized.includes("evaluation du coup"), text: state?.textContent ?? "" };
    }, 5_000);
    mark("explorer_analysis_in_progress_visible", "pass");
    await captureContractScreenshot({
      scenario: "EXPLORER_ANALYSIS",
      state: "IN_PROGRESS",
      action: "clicked Analyser ce coup",
      expected: "Évaluation du coup… appears before stable result",
      observed: "In-progress state rendered",
      pass: true,
      primaryTestId: "review-explorer-analysis-state",
    });
  } catch (error) {
    mark("explorer_analysis_in_progress_visible", "warn", error?.message ?? String(error));
  }

  const result = await harness.waitForPagePredicate("stable exploration result visible", () => {
    const badge = document.querySelector('[data-testid="review-explorer-quality-badge"]');
    const local = document.querySelector('[data-testid="review-explorer-local-only"]');
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    return {
      ok: Boolean(badge) && Boolean(local) && Boolean(overlay),
      badge: badge?.textContent ?? "",
      local: local?.textContent ?? "",
      overlayQuality: overlay?.getAttribute("data-quality-id") ?? null,
      overlaySquare: overlay?.getAttribute("data-square") ?? null,
      text: document.body?.innerText ?? "",
    };
  }, 45_000);
  evidence.contract_checks.stable_result = result;
  mark("explorer_stable_result_badge_visible", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "EXPLORER_STABLE_RESULT",
    state: "BADGE_VISIBLE",
    action: "waited for stable Explorer evaluation",
    expected: "Stable quality badge and board overlay visible",
    observed: `badge=${result.badge}, overlay=${result.overlayQuality}`,
    pass: true,
    primaryTestId: "review-explorer-quality-badge",
  });
}

async function assertNoExplorerSideEffects(beforeCounts) {
  const afterCounts = dbCounts();
  evidence.api.counts_after_explorer_analysis = afterCounts;
  const keys = [
    "review_practice_attempts",
    "training_items",
    "daily_plan_items",
    "practice_attempts_with_due_at",
    "training_items_with_due_at",
  ];
  const changed = keys.filter((key) => beforeCounts[key] !== afterCounts[key]);
  if (changed.length) {
    fail(
      "explorer_evaluation_has_no_practice_due_daily_side_effects",
      JSON.stringify({ beforeCounts, afterCounts, changed }),
    );
  }
  mark("explorer_evaluation_has_no_practice_due_daily_side_effects", "pass", JSON.stringify(afterCounts));
}

async function toggleOrientation() {
  const before = await reviewBoardSnapshot();
  if (!before.orientation) {
    fail("orientation_before_toggle_available", JSON.stringify(before));
  }
  await captureContractScreenshot({
    scenario: "EXPLORER_ORIENTATION",
    state: "BEFORE_TOGGLE",
    action: "read current orientation",
    expected: "Board orientation visible in Explorer",
    observed: `orientation=${before.orientation}`,
    pass: true,
    primaryTestId: "review-board",
  });
  await harness.clickByTestId("review-exploration-flip-board", { afterMs: 600 });
  const after = await harness.waitForPagePredicate("orientation toggled", (previous) => {
    const board = document.querySelector('[data-testid="review-board"]');
    const orientation = board?.getAttribute("data-board-orientation") ?? null;
    return { ok: Boolean(orientation) && orientation !== previous, orientation };
  }, 10_000, before.orientation);
  evidence.contract_checks.orientation = { before: before.orientation, after: after.orientation };
  mark("explorer_orientation_toggle", "pass", `${before.orientation} -> ${after.orientation}`);
  await captureContractScreenshot({
    scenario: "EXPLORER_ORIENTATION",
    state: "AFTER_TOGGLE",
    action: "clicked Tourner l'échiquier",
    expected: "Pure frontend board orientation toggle",
    observed: `orientation=${after.orientation}`,
    pass: true,
    primaryTestId: "review-exploration-flip-board",
  });
}

async function assertPracticeNoSpoilerStillIntact() {
  await harness.clickByTestId("review-exploration-exit", { afterMs: 400 });
  try {
    await harness.clickByTestId("review-focus-practice", { afterMs: 800 });
  } catch {
    await harness.clickByText("S'entraîner", { afterMs: 800 });
  }
  const entry = await harness.waitForPagePredicate("practice entry or empty state visible", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-practice-button"]')) ||
        text.includes("Aucune position") ||
        text.includes("Plan en construction"),
      hasStart: Boolean(document.querySelector('[data-testid="review-practice-button"]')),
      text,
    };
  }, 20_000);
  if (!entry.hasStart) {
    const empty = await harness.evalPage(() => ({
      ok:
        !document.querySelector('[data-testid="board-move-outcome-overlay"]') &&
        !document.querySelector('[data-testid="current-attempt-quality-badge"]') &&
        !document.querySelector('[data-testid="practice-attempt-quality-badge"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!empty.ok) {
      fail("practice_empty_state_no_spoiler", JSON.stringify(empty));
    }
    evidence.contract_checks.practice_no_spoiler_empty_state = empty;
    mark("practice_no_spoiler_still_intact", "pass", "empty Practice state has no attempt badge or board overlay");
    return;
  }

  await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  const result = await harness.waitForPagePredicate("practice no spoiler before move", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      !document.querySelector('[data-testid="board-move-outcome-overlay"]') &&
      !document.querySelector('[data-testid="current-attempt-quality-badge"]') &&
      !document.querySelector('[data-testid="practice-attempt-quality-badge"]'),
    text: document.body?.innerText ?? "",
  }), 30_000);
  evidence.contract_checks.practice_no_spoiler = result;
  mark("practice_no_spoiler_still_intact", "pass");
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb({ FAKE_ENGINE_DELAY_MS: "350" });
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness);
  evidence.api.game_id = gameId;
  evidence.api.review_moment_count = review.move_annotations?.length ?? review.moments?.length ?? null;
  await openReviewFromPersistedState(harness, gameId);
  await harness.waitForPagePredicate("review explorer ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-exploration-start"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);

  const beforeCounts = dbCounts();
  evidence.api.counts_before_explorer_analysis = beforeCounts;
  await openExplorerLab();
  await playNewExplorationMove();
  await analyzeExplorationMove();
  await assertNoExplorerSideEffects(beforeCounts);
  await toggleOrientation();
  await assertPracticeNoSpoilerStillIntact();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");

  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), evidence.browser_errors.console);
  writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_EXPLORER_STABLE_MOVE_FEEDBACK_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      try {
        await captureContractScreenshot({
          scenario: "FAILURE",
          state: "SMOKE_FAILURE",
          action: "captured failure",
          expected: "diagnostic screenshot",
          observed: error?.message ?? String(error),
          pass: false,
          primaryTestId: "review-explorer-move-feedback",
        });
      } catch {
        await harness.captureScreenshot("browser_explorer_stable_move_feedback_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_EXPLORER_STABLE_MOVE_FEEDBACK_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
