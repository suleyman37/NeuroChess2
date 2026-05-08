import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Chess } from "../frontend/node_modules/chess.js/dist/esm/chess.js";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  findPython,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

export const MISSION = "P1.REVIEW-EXPLORER-COCKPIT-READABILITY-AND-CONTEXT-FIX-V1";
export const MISSION_ID = "P1_REVIEW_EXPLORER_COCKPIT_READABILITY_AND_CONTEXT_FIX_V1";
export const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
export const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
export const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
export const CONSOLE_DIR = path.join(QA_DIR, "console_logs");
export const NETWORK_DIR = path.join(QA_DIR, "network_logs");

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

export function createReadabilityHarness(scriptName) {
  const evidence = createEvidence(MISSION, `${scriptName}_evidence.json`);
  evidence.output_path = path.join(BROWSER_EVIDENCE_DIR, `${scriptName}_evidence.json`);
  evidence.contract_checks = {};
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { harness, evidence };
}

export function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function captureQaScreenshot(harness, name) {
  const safeName = String(name).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  const screenshotPath = path.join(
    SCREENSHOT_RAW_DIR,
    `${new Date().toISOString().replace(/[:.]/g, "-")}__${safeName}.png`,
  );
  const shot = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  harness.evidence.screenshots.push({ name, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function setupReviewContext(
  harness,
  evidence,
  extraEnv = {},
  fixtureOptions = {},
) {
  harness.writeEvidence();
  await harness.startBackendWithTempDb({ FAKE_ENGINE_DELAY_MS: "250", ...extraEnv });
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness, fixtureOptions);
  evidence.api.game_id = gameId;
  evidence.api.review_moment_count = review.move_annotations?.length ?? review.moments?.length ?? null;
  await openReviewFromPersistedState(harness, gameId);
  await harness.waitForPagePredicate("review board ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-exploration-start"]')),
      text: document.body?.innerText ?? "",
  }), 30_000);
  return { gameId, review };
}

export async function setupReviewExplorer(harness, evidence, extraEnv = {}) {
  const context = await setupReviewContext(harness, evidence, extraEnv);
  await harness.clickByTestId("review-exploration-start", { afterMs: 700 });
  await harness.waitForPagePredicate("review explorer active", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-exploration-panel"].active')) &&
      Boolean(document.querySelector('[data-testid="review-board"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
  return context;
}

export async function reviewBoardSnapshot(harness) {
  return harness.evalPage(() => {
    const board = document.querySelector('[data-testid="review-board"]');
    return {
      ok: Boolean(board),
      fen: board?.getAttribute("data-board-fen") ?? null,
      orientation: board?.getAttribute("data-board-orientation") ?? null,
      box: board
        ? (() => {
            const rect = board.getBoundingClientRect();
            return {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })()
        : null,
    };
  });
}

export function chooseExplorationMove(fen, preferred = []) {
  const board = new Chess(fen);
  const legal = board.moves({ verbose: true }).map(
    (move) => `${move.from}${move.to}${move.promotion ?? ""}`,
  );
  const defaults = ["a2a3", "h2h3", "b1c3", "g1f3", "a7a6", "h7h6", "b8c6", "g8f6"];
  return [...preferred, ...defaults].find((move) => legal.includes(move)) ?? legal[0] ?? null;
}

export async function playExplorationMove(harness, preferred = []) {
  const before = await reviewBoardSnapshot(harness);
  if (!before.ok || !before.fen) {
    throw new Error(`review board missing before move: ${JSON.stringify(before)}`);
  }
  const move = chooseExplorationMove(before.fen, preferred);
  if (!move) {
    throw new Error(`no legal exploration move available: ${before.fen}`);
  }
  await harness.tryMoveByClickClick(move, "review-board");
  await harness.waitForPagePredicate("exploration move awaiting analysis", () => {
    const dock = document.querySelector('[data-testid="review-explorer-cockpit-actions"]');
    const moveButton = document.querySelector('[data-testid="review-explorer-analyze-move"]');
    const lineButton = document.querySelector('[data-testid="review-explorer-analyze-line"]');
    const state = document.querySelector('[data-testid="review-explorer-analysis-state"]');
    return {
      ok:
        Boolean(dock) &&
        Boolean(moveButton) &&
        Boolean(lineButton) &&
        String(state?.textContent ?? "").toLowerCase().includes("non"),
      text: dock?.textContent ?? "",
    };
  }, 15_000);
  return move;
}

export function dbCounts(harness) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
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
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

export function assertNoSideEffects(beforeCounts, afterCounts) {
  const keys = [
    "review_practice_attempts",
    "training_items",
    "daily_plan_items",
    "practice_attempts_with_due_at",
    "training_items_with_due_at",
  ];
  const changed = keys.filter((key) => beforeCounts[key] !== afterCounts[key]);
  if (changed.length) {
    throw new Error(`Explorer side effects detected: ${JSON.stringify({ beforeCounts, afterCounts, changed })}`);
  }
}

export async function finishHarness(harness, evidence, scriptName, result = "pass") {
  if (evidence.browser_errors?.page?.length || evidence.browser_errors?.network_500?.length) {
    throw new Error(`browser errors: ${JSON.stringify(evidence.browser_errors)}`);
  }
  writeJson(path.join(CONSOLE_DIR, `${scriptName}_console_errors.json`), evidence.browser_errors?.console ?? []);
  writeJson(path.join(NETWORK_DIR, `${scriptName}_network_500.json`), evidence.browser_errors?.network_500 ?? []);
  evidence.finished_at = new Date().toISOString();
  evidence.result = result;
  harness.writeEvidence();
}
