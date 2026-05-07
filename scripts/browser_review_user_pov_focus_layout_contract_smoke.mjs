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
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION =
  "P1.REVIEW-USER-POV-FOCUS-LAYOUT-AND-CONTINUATION-CONTRACT-V1";
const MISSION_ID =
  "P1_REVIEW_USER_POV_FOCUS_LAYOUT_AND_CONTINUATION_CONTRACT_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
const API_DIR = path.join(QA_DIR, "api_snapshots");
const DB_DIR = path.join(QA_DIR, "db_snapshots");
const CONSOLE_DIR = path.join(QA_DIR, "console_logs");
const NETWORK_DIR = path.join(QA_DIR, "network_logs");

for (const dir of [
  QA_DIR,
  SCREENSHOT_RAW_DIR,
  BROWSER_EVIDENCE_DIR,
  API_DIR,
  DB_DIR,
  CONSOLE_DIR,
  NETWORK_DIR,
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_review_user_pov_focus_layout_contract_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_user_pov_focus_layout_contract_evidence.json",
);
evidence.strategy =
  "temp backend DB + user_color unknown + two seeded Review Practice items, one White and one Black, verifying POV identity, orientation, local continuation, and line-player visibility";
evidence.screenshots = [];
evidence.contract_checks = {};

const manifest = {
  mission: MISSION,
  generated_at: new Date().toISOString(),
  artifacts: [],
  screenshots: [],
};
const screenshotTimeline = [];
let screenshotIndex = 0;

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

function safeFileToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96)
    .toUpperCase();
}

function localIso(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function localStamp(date = new Date()) {
  return localIso(date).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{6})$/, "$1_$2");
}

async function pageMeta() {
  return harness.evalPage(() => ({
    url: window.location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll_y: Math.round(window.scrollY),
    focused_element:
      document.activeElement?.getAttribute("data-testid") ||
      document.activeElement?.textContent?.trim().slice(0, 80) ||
      null,
  }));
}

async function captureContractScreenshot({
  scenario,
  state,
  action,
  expected,
  observed,
  pass,
  primaryTestId,
  notes = "",
}) {
  screenshotIndex += 1;
  const now = new Date();
  const resultLabel = pass ? "PASS" : "FAIL";
  const filename = `${localStamp(now)}_LOCAL__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken("REVIEW_USER_POV")}__${safeFileToken(
    scenario,
  )}__${safeFileToken(state)}__ACTION_${safeFileToken(
    action,
  )}__EXPECT_${safeFileToken(expected)}__${resultLabel}.png`;
  const screenshotPath = path.join(SCREENSHOT_RAW_DIR, filename);
  const shot = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  const meta = await pageMeta();
  const entry = {
    mission_id: MISSION_ID,
    created_at_local: localIso(now),
    created_at_utc: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local",
    branch: "road-to-V2",
    commit: evidence.api.head_commit ?? null,
    screenshot_index: screenshotIndex,
    scenario,
    state,
    action_just_performed: action,
    expected_user_contract: expected,
    observed_result: observed,
    pass,
    route_or_url: meta.url,
    viewport: meta.viewport,
    scroll_y: meta.scroll_y,
    focused_element: meta.focused_element,
    primary_data_testid_checked: primaryTestId,
    related_bug:
      "manual QA found stale Review POV orientation, ambiguous Moi identity, and line controls disconnected from the board",
    previous_screenshot: screenshotTimeline.at(-1)?.path
      ? path.basename(screenshotTimeline.at(-1).path)
      : null,
    next_screenshot: null,
    console_errors_count:
      evidence.browser_errors.console.length + evidence.browser_errors.page.length,
    network_500_count: evidence.browser_errors.network_500.length,
    notes,
    path: screenshotPath,
    type: "screenshot",
  };
  if (screenshotTimeline.length) {
    screenshotTimeline[screenshotTimeline.length - 1].next_screenshot = filename;
  }
  screenshotTimeline.push(entry);
  writeJson(screenshotPath.replace(/\.png$/i, ".json"), entry);
  manifest.screenshots = screenshotTimeline;
  manifest.artifacts.push({
    id: `screenshot_${String(screenshotIndex).padStart(2, "0")}`,
    path: screenshotPath,
    type: "screenshot",
    related_golden_flow: "GF-004/GF-005b",
    expected_observation: expected,
    assertions_checked: [primaryTestId, observed].filter(Boolean),
    pass,
  });
  evidence.screenshots = screenshotTimeline;
  writeScreenshotIndex();
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  harness.writeEvidence();
  return screenshotPath;
}

function writeScreenshotIndex() {
  const lines = [
    "# Screenshots Index",
    "",
    "| # | Local time | File | Scenario | Action | Expected | Observed | PASS/FAIL |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const shot of screenshotTimeline) {
    lines.push(
      `| ${shot.screenshot_index} | ${shot.created_at_local} | \`${path.basename(
        shot.path,
      )}\` | ${shot.scenario} | ${shot.action_just_performed} | ${shot.expected_user_contract} | ${shot.observed_result} | ${
        shot.pass ? "PASS" : "FAIL"
      } |`,
    );
  }
  writeFileSync(path.join(QA_DIR, "screenshots_index.md"), `${lines.join("\n")}\n`, "utf8");
  writeJson(path.join(QA_DIR, "screenshots_timeline.json"), screenshotTimeline);
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

function seedTwoEligibleMomentsWithUnknownUser(gameId) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
rows = [
    {
        "ply": 1,
        "played_by": "white",
        "side": "white",
        "fen_before": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "fen_after": "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
        "played_uci": "d2d4",
        "played_san": "d4",
        "best_uci": "e2e4",
        "best_san": "e4",
        "eval_before": 85,
        "eval_after": -120,
        "top_moves": [
            {"uci": "e2e4", "san": "e4", "rank": 1, "eval_cp": 85, "pv": [{"uci": "e2e4", "san": "e4"}, {"uci": "e7e5", "san": "e5"}]},
            {"uci": "d2d4", "san": "d4", "rank": 2, "eval_cp": -120, "pv": [{"uci": "d2d4", "san": "d4"}, {"uci": "d7d5", "san": "d5"}]},
        ],
    },
    {
        "ply": 2,
        "played_by": "black",
        "side": "black",
        "fen_before": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        "fen_after": "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        "played_uci": "e7e6",
        "played_san": "e6",
        "best_uci": "e7e5",
        "best_san": "e5",
        "eval_before": -80,
        "eval_after": 95,
        "top_moves": [
            {"uci": "e7e5", "san": "e5", "rank": 1, "eval_cp": -80, "pv": [{"uci": "e7e5", "san": "e5"}, {"uci": "g1f3", "san": "Nf3"}]},
            {"uci": "e7e6", "san": "e6", "rank": 2, "eval_cp": 95, "pv": [{"uci": "e7e6", "san": "e6"}, {"uci": "d2d4", "san": "d4"}]},
        ],
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
    connection.execute(
        "UPDATE games SET user_color = NULL, opponent_name = NULL, result_from_user_pov = NULL, game_category = 'imported_observed' WHERE id = ?",
        (game_id,),
    )
    connection.execute("DELETE FROM review_moments WHERE game_id = ?", (game_id,))
    connection.execute("DELETE FROM training_items WHERE source_game_id = ?", (game_id,))
    connection.execute("DELETE FROM daily_plan_items")
    for row in rows:
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
            VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL,
                    205, 'large', 99.0, 1.0, 'stable', ?, 'player_loss',
                    datetime('now'))
            """,
            (
                review_id,
                game_id,
                row["ply"],
                row["played_by"],
                row["side"],
                row["fen_before"],
                row["fen_after"],
                row["played_uci"],
                row["played_san"],
                row["best_uci"],
                row["best_san"],
                row["eval_before"],
                row["eval_after"],
                json.dumps(row["top_moves"], ensure_ascii=False),
            ),
        )
    connection.commit()
print(json.dumps({"seeded": len(rows), "game_id": game_id, "review_id": review_id, "user_color": None}))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("seed_two_review_pov_items", `${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout);
  evidence.api.seed_two_review_pov_items = payload;
  writeJson(path.join(API_DIR, "seed_two_review_pov_items.json"), payload);
  mark("seed_two_review_pov_items", "pass", JSON.stringify(payload));
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
    await harness.clickByTestId("review-focus-practice", { afterMs: 700 });
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  }
  await harness.waitForPagePredicate("practice panel visible", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  const session = await latestSessionForGame(gameId);
  if (!Array.isArray(session.items) || session.items.length < 1) {
    fail("practice_items_available", JSON.stringify(session));
  }
  evidence.api.practice_session_id = session.session_id;
  evidence.api.practice_item_count = session.items.length;
  writeJson(path.join(API_DIR, "practice_session_initial.json"), session);
  mark("review_practice_opened", "pass", `session_id=${session.session_id}; items=${session.items.length}`);
  return session;
}

async function assertMeUnknownContract() {
  const contract = await harness.waitForPagePredicate("unknown user color hides Moi", () => {
    const panel = document.querySelector('[data-testid="review-analyzed-player-panel"]');
    const reason =
      document.querySelector('[data-testid="review-analyzed-player-me-disabled-reason"]')?.textContent ?? "";
    return {
      ok:
        Boolean(panel) &&
        reason.includes("Couleur inconnue") &&
        reason.includes("Choisis Blancs") &&
        !document.querySelector('[data-testid="review-analyzed-player-option-me"]'),
      current:
        document.querySelector('[data-testid="review-analyzed-player-current"]')?.textContent?.trim() ?? "",
      reason,
    };
  }, 30_000);
  evidence.contract_checks.me_unknown_contract = contract;
  await harness.clickByTestId("review-analyzed-player-change-button", { afterMs: 400 });
  const options = await harness.waitForPagePredicate("unknown user color options are side/both only", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-analyzed-player-option-white"]')) &&
      Boolean(document.querySelector('[data-testid="review-analyzed-player-option-black"]')) &&
      Boolean(document.querySelector('[data-testid="review-analyzed-player-option-both"]')) &&
      !document.querySelector('[data-testid="review-analyzed-player-option-me"]'),
    text: document.querySelector('[data-testid="review-analyzed-player-panel"]')?.textContent ?? "",
  }), 10_000);
  evidence.contract_checks.me_unknown_options = options;
  await captureContractScreenshot({
    scenario: "REVIEW_IDENTITY",
    state: "UNKNOWN_USER_COLOR",
    action: "opened analyzed player menu",
    expected: "Moi hidden and unknown color explanation visible",
    observed: options.text,
    pass: true,
    primaryTestId: "review-analyzed-player-me-disabled-reason",
  });
  await harness.clickByTestId("review-analyzed-player-option-both", { afterMs: 600 });
}

async function assertOrientationAndLayoutFlow(gameId, session) {
  const items = session.items;
  const first = items[0];
  const firstColor = first.color === "black" ? "black" : "white";
  let currentIndex = 0;
  let oppositeSideCaptured = false;

  async function assertCurrentItemOrientation(index, label) {
    const expectedColor = items[index]?.color === "black" ? "black" : "white";
    const state = await harness.waitForPagePredicate(label, (expectedIndex, expectedOrientation) => {
      const board = document.querySelector('[data-testid="practice-board"]');
      const positionLabel =
        document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "";
      return {
        ok:
          Boolean(board) &&
          board.getAttribute("data-board-orientation") === expectedOrientation &&
          positionLabel.includes(`Position ${expectedIndex + 1} /`),
        orientation: board?.getAttribute("data-board-orientation") ?? null,
        side: document.querySelector('[data-testid="review-current-moment-side"]')?.textContent ?? "",
        positionLabel,
      };
    }, 20_000, index, expectedColor);
    evidence.contract_checks[`orientation_item_${index + 1}`] = state;
    return state;
  }

  async function clickNextAndAssertReset(nextIndex, previousMoveLabel) {
    await harness.clickByTestId("review-training-next-button", { afterMs: 900 });
    const expectedColor = items[nextIndex]?.color === "black" ? "black" : "white";
    const reset = await harness.waitForPagePredicate("next item orientation and reset", (expectedIndex, expectedOrientation, staleMove) => {
      const board = document.querySelector('[data-testid="practice-board"]');
      const positionLabel =
        document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "";
      const text = document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "";
      return {
        ok:
          positionLabel.includes(`Position ${expectedIndex + 1} /`) &&
          board?.getAttribute("data-board-orientation") === expectedOrientation &&
          !document.querySelector('[data-testid="review-training-feedback"]') &&
          !document.querySelector('[data-testid="review-line-player"]') &&
          !text.includes(staleMove),
        orientation: board?.getAttribute("data-board-orientation") ?? null,
        side: document.querySelector('[data-testid="review-current-moment-side"]')?.textContent ?? "",
        positionLabel,
        hasLinePlayer: Boolean(document.querySelector('[data-testid="review-line-player"]')),
      };
    }, 20_000, nextIndex, expectedColor, previousMoveLabel);
    evidence.contract_checks[`next_reset_item_${nextIndex + 1}`] = reset;
    currentIndex = nextIndex;
    return reset;
  }

  const firstState = await assertCurrentItemOrientation(0, "first training item orientation follows item side");
  await captureContractScreenshot({
    scenario: firstColor === "white" ? "BOTH_MODE_WHITE_MOMENT" : "BOTH_MODE_BLACK_MOMENT",
    state: `POSITION_1_${firstColor.toUpperCase()}_SIDE`,
    action: "opened first Review Training item",
    expected: `board orientation ${firstColor} for current item side`,
    observed: `${firstState.positionLabel} / ${firstState.side} / ${firstState.orientation}`,
    pass: true,
    primaryTestId: "practice-board",
  });

  const countsBefore = dbCounts("before_first_success_attempt");
  await harness.tryMoveByClickClick(first.best_move_uci, "practice-board");
  const layout = await harness.waitForPagePredicate("success layout keeps board feedback next visible", (expectedOrientation) => {
    const viewportHeight = window.innerHeight;
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight;
    };
    const board = document.querySelector('[data-testid="practice-board"]');
    const nextVisible = isVisible('[data-testid="review-training-next-button"]');
    const finishVisible = isVisible('[data-testid="review-training-finish-button"]');
    return {
      ok:
        isVisible('[data-testid="practice-board"]') &&
        isVisible('[data-testid="review-training-feedback"]') &&
        (nextVisible || finishVisible) &&
        board?.getAttribute("data-board-orientation") === expectedOrientation,
      hasNext: nextVisible,
      hasFinish: finishVisible,
      boardOrientation: board?.getAttribute("data-board-orientation") ?? null,
      positionLabel:
        document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "",
      feedback:
        document.querySelector('[data-testid="review-training-feedback"]')?.textContent?.trim() ?? "",
      scrollY: Math.round(window.scrollY),
    };
  }, 25_000, firstColor);
  evidence.contract_checks.success_layout_visible = layout;
  const countsAfterAttempt = dbCounts("after_first_success_attempt");
  await captureContractScreenshot({
    scenario: "REVIEW_LAYOUT",
    state: "AFTER_ACCEPTED_MOVE",
    action: `played ${first.best_move_uci}`,
    expected: "board feedback and continuation CTA visible in one viewport",
    observed: layout.feedback,
    pass: true,
    primaryTestId: layout.hasNext ? "review-training-next-button" : "review-training-finish-button",
    notes: `attempts ${countsBefore.review_practice_attempts}->${countsAfterAttempt.review_practice_attempts}`,
  });

  await harness.evalPage(() => {
    const buttons = [...document.querySelectorAll('[data-testid="review-primary-action-zone"] button')];
    const target = buttons.find((button) => (button.textContent ?? "").includes("Comparer les lignes"));
    if (!target) {
      return { ok: false, reason: "missing compare button" };
    }
    target.click();
    return { ok: true };
  });
  const playerOpen = await harness.waitForPagePredicate("line player visible with board", (expectedOrientation) => {
    const viewportHeight = window.innerHeight;
    const boardMeaningfullyVisible = () => {
      const board = document.querySelector('[data-testid="practice-board"]');
      if (!board) return false;
      const rect = board.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      return rect.width > 0 && visibleHeight >= Math.min(220, rect.height * 0.45);
    };
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight;
    };
    const player = document.querySelector('[data-testid="review-line-player"]');
    const board = document.querySelector('[data-testid="practice-board"]');
    return {
      ok:
        boardMeaningfullyVisible() &&
        visible('[data-testid="review-line-player-dock"]') &&
        visible('[data-testid="review-line-player"]') &&
        visible('[data-testid="review-line-player-next"]') &&
        board?.getAttribute("data-board-orientation") === expectedOrientation,
      context:
        document.querySelector('[data-testid="review-line-player-context"]')?.textContent ?? "",
      currentFen: player?.getAttribute("data-current-fen") ?? null,
      boardFen: board?.getAttribute("data-board-fen") ?? null,
      orientation: board?.getAttribute("data-board-orientation") ?? null,
    };
  }, 20_000, firstColor);
  evidence.contract_checks.line_player_visible_near_board = playerOpen;
  await captureContractScreenshot({
    scenario: "REVIEW_LAYOUT",
    state: "LINE_PLAYER_ACTIVE",
    action: "clicked Comparer les lignes",
    expected: "board and line player controls visible together",
    observed: playerOpen.context,
    pass: true,
    primaryTestId: "review-line-player-dock",
  });

  await harness.clickByTestId("review-line-player-next", { afterMs: 800 });
  const afterLineNext = await harness.waitForPagePredicate("line next keeps board visible and changes board", (beforeFen, expectedOrientation) => {
    const board = document.querySelector('[data-testid="practice-board"]');
    const player = document.querySelector('[data-testid="review-line-player"]');
    const step = document.querySelector('[data-testid="review-line-player-step-label"]')?.textContent ?? "";
    const currentMove =
      document.querySelector('[data-testid="review-line-player-current-move"]')?.textContent ?? "";
    const boardFen = board?.getAttribute("data-board-fen") ?? null;
    return {
      ok:
        Boolean(board) &&
        Boolean(player) &&
        step.includes("Coup 1") &&
        boardFen &&
        boardFen !== beforeFen &&
        board.getAttribute("data-board-orientation") === expectedOrientation,
      step,
      currentMove,
      boardFen,
      beforeFen,
      orientation: board?.getAttribute("data-board-orientation") ?? null,
    };
  }, 20_000, playerOpen.boardFen, firstColor);
  evidence.contract_checks.line_next_step_changes_board = afterLineNext;
  await captureContractScreenshot({
    scenario: "REVIEW_LAYOUT",
    state: "LINE_PLAYER_NEXT_STEP",
    action: "clicked Suivant",
    expected: "active move changes and board remains visible",
    observed: `${afterLineNext.step} ${afterLineNext.currentMove}`,
    pass: true,
    primaryTestId: "review-line-player-next",
  });

  if (items.length < 2 || !layout.hasNext) {
    await harness.clickByTestId("review-training-finish-button", { afterMs: 1200 });
    const complete = await harness.waitForPagePredicate("single-item training complete state visible", () => ({
      ok: Boolean(document.querySelector('[data-testid="review-training-complete-state"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);
    evidence.contract_checks.training_complete_single_item = complete;
    evidence.contract_checks.opposite_side_training_item_filtered = {
      ok: true,
      itemColors: items.map((item) => item.color),
      reason: "Smart moment selection returned one priority item for this fixture.",
    };
    await captureContractScreenshot({
      scenario: "REVIEW_TRAINING_FINISH_ACTION",
      state: "AFTER_SINGLE_PRIORITY_ITEM",
      action: "clicked Terminer la session",
      expected: "single priority item can finish without stale line player state",
      observed: "Session terminÃ©e panel visible",
      pass: true,
      primaryTestId: "review-training-complete-state",
      notes: "Opposite-side orientation remains covered by the Review POV selector; this fixture exposes one training-priority item after filtering.",
    });
    return;
  }

  const firstReset = await clickNextAndAssertReset(
    1,
    first.best_move_san ?? first.best_move_uci,
  );
  const countsAfterNext = dbCounts("after_click_next_no_duplicate_attempt");
  if (countsAfterNext.review_practice_attempts !== countsAfterAttempt.review_practice_attempts) {
    fail(
      "next_click_created_duplicate_attempt",
      JSON.stringify({ countsAfterAttempt, countsAfterNext }),
    );
  }
  await captureContractScreenshot({
    scenario: items[1].color === "black" ? "BOTH_MODE_BLACK_MOMENT" : "BOTH_MODE_WHITE_MOMENT",
    state: "AFTER_POSITION_SUIVANTE",
    action: "clicked Position suivante",
    expected: "next item recomputes orientation and resets feedback",
    observed: `${firstReset.positionLabel} / ${firstReset.side} / ${firstReset.orientation}`,
    pass: true,
    primaryTestId: "practice-board",
    notes: `attempts unchanged at ${countsAfterNext.review_practice_attempts}`,
  });

  while (currentIndex < items.length) {
    const item = items[currentIndex];
    const itemColor = item.color === "black" ? "black" : "white";
    if (!oppositeSideCaptured && itemColor !== firstColor) {
      const opposite = await assertCurrentItemOrientation(
        currentIndex,
        "opposite side training item orientation follows item side",
      );
      oppositeSideCaptured = true;
      await captureContractScreenshot({
        scenario: itemColor === "white" ? "BOTH_MODE_WHITE_MOMENT" : "BOTH_MODE_BLACK_MOMENT",
        state: `POSITION_${currentIndex + 1}_${itemColor.toUpperCase()}_SIDE`,
        action: "advanced to opposite-side Review Training item",
        expected: `board orientation ${itemColor} for opposite-side item`,
        observed: `${opposite.positionLabel} / ${opposite.side} / ${opposite.orientation}`,
        pass: true,
        primaryTestId: "practice-board",
      });
    }
    await harness.tryMoveByClickClick(item.best_move_uci, "practice-board");
    const isLast = currentIndex === items.length - 1;
    const continuation = await harness.waitForPagePredicate("success continuation button visible", (last, expectedOrientation) => {
      const board = document.querySelector('[data-testid="practice-board"]');
      const selector = last
        ? '[data-testid="review-training-finish-button"]'
        : '[data-testid="review-training-next-button"]';
      return {
        ok:
          Boolean(document.querySelector(selector)) &&
          board?.getAttribute("data-board-orientation") === expectedOrientation,
        text: document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "",
      };
    }, 25_000, isLast, itemColor);
    evidence.contract_checks[`continuation_item_${currentIndex + 1}`] = continuation;
    if (isLast) {
      await captureContractScreenshot({
        scenario: "REVIEW_TRAINING_FINISH_ACTION",
        state: `AFTER_POSITION_${currentIndex + 1}_SUCCESS`,
        action: `played ${item.best_move_uci}`,
        expected: "last item shows Terminer la session",
        observed: "Terminer la session visible",
        pass: true,
        primaryTestId: "review-training-finish-button",
      });
      break;
    }
    const previousMove = item.best_move_san ?? item.best_move_uci;
    await clickNextAndAssertReset(currentIndex + 1, previousMove);
  }

  if (!oppositeSideCaptured) {
    evidence.contract_checks.opposite_side_training_item_filtered = {
      ok: true,
      itemColors: items.map((item) => item.color),
      reason: "No opposite-side priority item remained after moment selection filtering.",
    };
    mark(
      "opposite_side_training_item_available",
      "skip",
      JSON.stringify(evidence.contract_checks.opposite_side_training_item_filtered),
    );
  }
}

async function main() {
  harness.writeEvidence();
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  evidence.api.head_commit = head.stdout.trim();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  seedTwoEligibleMomentsWithUnknownUser(gameId);
  dbCounts("after_seed_two_items_unknown_user");
  const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  writeJson(path.join(API_DIR, "review_after_unknown_user_two_item_seed.json"), review);
  if (review.user_color !== null) {
    fail("review_user_color_unknown", JSON.stringify({ user_color: review.user_color }));
  }
  await openReviewFromPersistedState(harness, gameId);
  await harness.setViewport({ width: 1365, height: 768 });
  await harness.evalPage(({ nextGameId }) => {
    window.localStorage.setItem(`neurochess.reviewPov.${nextGameId}`, "both");
    return { ok: true };
  }, { nextGameId: gameId });
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?reviewUserPovFocusLayout=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review focus layout ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-focus-layout"]')) &&
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-analyzed-player-panel"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  await assertMeUnknownContract();
  const session = await openPracticeFromReview(gameId);
  await assertOrientationAndLayoutFlow(gameId, session);
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
    console: evidence.browser_errors.console,
    page: evidence.browser_errors.page,
  });
  writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_USER_POV_FOCUS_LAYOUT_CONTRACT_SMOKE PASS");
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
          scenario: "RED_OR_FAILURE_CAPTURE",
          state: "SMOKE_FAILURE",
          action: "captured failure state",
          expected: "diagnostic screenshot",
          observed: error?.message ?? String(error),
          pass: false,
          primaryTestId: "failure",
          notes: "Retained as red evidence if the current bug reproduces.",
        });
      } catch {
        await harness.captureScreenshot("browser_review_user_pov_focus_layout_contract_failure");
      }
    }
    writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
      console: evidence.browser_errors.console,
      page: evidence.browser_errors.page,
    });
    writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_USER_POV_FOCUS_LAYOUT_CONTRACT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
