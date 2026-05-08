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

const MISSION = "P1.REVIEW-COCKPIT-UX-BOARD-FIRST-REDESIGN-V1";
const MISSION_ID = "P1_REVIEW_COCKPIT_UX_BOARD_FIRST_REDESIGN_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
const CONSOLE_DIR = path.join(QA_DIR, "console_logs");
const NETWORK_DIR = path.join(QA_DIR, "network_logs");
const API_DIR = path.join(QA_DIR, "api_snapshots");

for (const dir of [
  QA_DIR,
  SCREENSHOT_RAW_DIR,
  path.join(QA_DIR, "screenshots_annotated"),
  path.join(QA_DIR, "contact_sheets"),
  BROWSER_EVIDENCE_DIR,
  CONSOLE_DIR,
  NETWORK_DIR,
  API_DIR,
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_review_cockpit_board_first_layout_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_cockpit_board_first_layout_evidence.json",
);
evidence.strategy =
  "temp backend DB + seeded two-item Review Practice session + real board success and line-player interactions + deterministic wrong-attempt response for frontend layout assertions";
evidence.contract_checks = {};
evidence.screenshots = [];

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

function gitShortHead() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function safeFileToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 92)
    .toUpperCase();
}

function localIso(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
  const filename = `${localStamp(now)}_LOCAL__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken("REVIEW_COCKPIT")}__${safeFileToken(scenario)}__${safeFileToken(
    state,
  )}__ACTION_${safeFileToken(action)}__EXPECT_${safeFileToken(expected)}__${
    pass ? "PASS" : "FAIL"
  }.png`;
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
    console_errors_count:
      evidence.browser_errors.console.length + evidence.browser_errors.page.length,
    network_500_count: evidence.browser_errors.network_500.length,
    notes,
    previous_screenshot: screenshotTimeline.at(-1)?.path
      ? path.basename(screenshotTimeline.at(-1).path)
      : null,
    next_screenshot: null,
    path: screenshotPath,
    type: "screenshot",
  };
  if (screenshotTimeline.length) {
    screenshotTimeline[screenshotTimeline.length - 1].next_screenshot = filename;
  }
  screenshotTimeline.push(entry);
  writeJson(screenshotPath.replace(/\.png$/i, ".json"), entry);
  evidence.screenshots = screenshotTimeline;
  manifest.screenshots = screenshotTimeline;
  manifest.artifacts.push({
    id: `screenshot_${String(screenshotIndex).padStart(2, "0")}`,
    path: screenshotPath,
    type: "screenshot",
    expected_observation: expected,
    assertions_checked: [primaryTestId, observed].filter(Boolean),
    pass,
  });
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
      )}\` | ${shot.scenario} | ${shot.action_just_performed} | ${
        shot.expected_user_contract
      } | ${shot.observed_result} | ${shot.pass ? "PASS" : "FAIL"} |`,
    );
  }
  writeFileSync(path.join(QA_DIR, "screenshots_index.md"), `${lines.join("\n")}\n`, "utf8");
  writeJson(path.join(QA_DIR, "screenshots_timeline.json"), screenshotTimeline);
}

function seedTwoEligibleMoments(gameId) {
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
print(json.dumps({"seeded": len(rows), "game_id": game_id, "review_id": review_id}))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("seed_two_review_practice_items", `${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout);
  evidence.api.seed_two_review_practice_items = payload;
  writeJson(path.join(API_DIR, "seed_two_review_practice_items.json"), payload);
  mark("seed_two_review_practice_items", "pass", JSON.stringify(payload));
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

async function switchReviewPovToBothForPractice() {
  await harness.clickByTestId("review-focus-summary", { afterMs: 500 });
  await harness.waitForPagePredicate("review POV selector ready for cockpit practice", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-analyzed-player-current"]')) &&
      Boolean(document.querySelector('[data-testid="review-analyzed-player-change-button"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  const current = await harness.evalPage(() => ({
    label:
      document
        .querySelector('[data-testid="review-analyzed-player-current"]')
        ?.textContent?.trim() ?? "",
  }));
  if (current.label.includes("Les deux")) {
    mark("review_pov_both_for_cockpit_practice", "pass", current.label);
    return;
  }
  await harness.clickByTestId("review-analyzed-player-change-button", { afterMs: 300 });
  await harness.clickByTestId("review-analyzed-player-option-both", { afterMs: 700 });
  const selected = await harness.waitForPagePredicate("review POV both selected for cockpit practice", () => {
    const label =
      document
        .querySelector('[data-testid="review-analyzed-player-current"]')
        ?.textContent?.trim() ?? "";
    return { ok: label.includes("Les deux"), label };
  }, 10_000);
  mark("review_pov_both_for_cockpit_practice", "pass", selected.label);
}

async function openPracticeFromReview(gameId) {
  await switchReviewPovToBothForPractice();
  await harness.waitForPagePredicate("review practice entry ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-practice-button"]')) ||
      Boolean(document.querySelector('[data-testid="review-focus-practice"]')) ||
      (document.body?.innerText ?? "").includes("S'entra"),
    text: document.body?.innerText ?? "",
  }), 30_000);
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

async function submitPracticeMoveWithFallback(uci) {
  await harness.tryMoveByClickClick(uci, "practice-board");
  try {
    await harness.waitForPagePredicate("practice feedback visible after click-click", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="practice-feedback"]')) ||
        Boolean(document.querySelector('[data-testid="review-training-feedback"]')),
    }), 5_000);
  } catch {
    await harness.tryMoveByDragDrop(uci, "practice-board");
  }
}

async function layoutSnapshot() {
  return harness.evalPage(() => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect
        ? {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null;
    };
    const visibleInViewport = (selector) => {
      const rect = rectFor(selector);
      return Boolean(
        rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth,
      );
    };
    const stickyColumn = document.querySelector('[data-testid="review-board-sticky-column"]');
    const stickyStyle = stickyColumn ? window.getComputedStyle(stickyColumn) : null;
    const board =
      document.querySelector('[data-testid="practice-board"]') ??
      document.querySelector('[data-testid="review-board"]');
    const boardRect = board?.getBoundingClientRect();
    const rightRect = document.querySelector(".right-panel")?.getBoundingClientRect();
    const boardArea = boardRect ? boardRect.width * boardRect.height : 0;
    const rightArea = rightRect ? rightRect.width * rightRect.height : 0;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      board: rectFor('[data-testid="practice-board"]') ?? rectFor('[data-testid="review-board"]'),
      rightPanel: rectFor(".right-panel"),
      stickyColumn: rectFor('[data-testid="review-board-sticky-column"]'),
      feedback: rectFor('[data-testid="review-training-feedback"]'),
      successCta: rectFor('[data-testid="review-training-next-button"]'),
      finishCta: rectFor('[data-testid="review-training-finish-button"]'),
      retryCta: rectFor('[data-testid="review-training-retry-button"]'),
      linePlayer: rectFor('[data-testid="review-line-player"]'),
      lineNext: rectFor('[data-testid="review-line-player-next"]'),
      overlay: rectFor('[data-testid="board-move-outcome-overlay"]'),
      boardVisible: visibleInViewport('[data-testid="practice-board"]') || visibleInViewport('[data-testid="review-board"]'),
      feedbackVisible: visibleInViewport('[data-testid="review-training-feedback"]'),
      successCtaVisible: visibleInViewport('[data-testid="review-training-next-button"]'),
      finishCtaVisible: visibleInViewport('[data-testid="review-training-finish-button"]'),
      retryCtaVisible: visibleInViewport('[data-testid="review-training-retry-button"]'),
      linePlayerVisible: visibleInViewport('[data-testid="review-line-player"]'),
      lineNextVisible: visibleInViewport('[data-testid="review-line-player-next"]'),
      overlayVisible: visibleInViewport('[data-testid="board-move-outcome-overlay"]'),
      stickyPosition: stickyStyle?.position ?? null,
      stickyTop: stickyStyle?.top ?? null,
      boardArea,
      rightArea,
      boardOrientation: board?.getAttribute("data-board-orientation") ?? null,
      boardFen: board?.getAttribute("data-board-fen") ?? null,
    };
  });
}

async function overlayGeometrySnapshot() {
  return harness.evalPage(() => {
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const board =
      document.querySelector('[data-testid="practice-board"]') ??
      document.querySelector('[data-testid="review-board"]');
    const overlayRect = overlay?.getBoundingClientRect();
    const boardRect = board?.getBoundingClientRect();
    const square = overlay?.getAttribute("data-square") ?? null;
    const orientation = overlay?.getAttribute("data-board-orientation") ?? "white";
    const fileIndex = square ? square.charCodeAt(0) - "a".charCodeAt(0) : null;
    const rank = square ? Number(square[1]) : null;
    let column = null;
    let row = null;
    if (fileIndex !== null && rank) {
      if (orientation === "black") {
        column = 7 - fileIndex;
        row = rank - 1;
      } else {
        column = fileIndex;
        row = 8 - rank;
      }
    }
    const squareSize = boardRect ? boardRect.width / 8 : 0;
    const squareRect =
      boardRect && column !== null && row !== null
        ? {
            left: boardRect.left + column * squareSize,
            top: boardRect.top + row * squareSize,
            right: boardRect.left + (column + 1) * squareSize,
            bottom: boardRect.top + (row + 1) * squareSize,
            width: squareSize,
            height: squareSize,
          }
        : null;
    const center =
      overlayRect
        ? {
            x: overlayRect.left + overlayRect.width / 2,
            y: overlayRect.top + overlayRect.height / 2,
          }
        : null;
    const insideBoard = Boolean(
      overlayRect &&
        boardRect &&
        overlayRect.left >= boardRect.left - 2 &&
        overlayRect.top >= boardRect.top - 2 &&
        overlayRect.right <= boardRect.right + 2 &&
        overlayRect.bottom <= boardRect.bottom + 2,
    );
    const insideSquare = Boolean(
      overlayRect &&
        squareRect &&
        overlayRect.left >= squareRect.left - 2 &&
        overlayRect.top >= squareRect.top - 2 &&
        overlayRect.right <= squareRect.right + 2 &&
        overlayRect.bottom <= squareRect.bottom + 2,
    );
    const topRightInside = Boolean(
      center &&
        squareRect &&
        center.x >= squareRect.left + squareRect.width * 0.58 &&
        center.y <= squareRect.top + squareRect.height * 0.42,
    );
    const squareCenter = squareRect
      ? { x: squareRect.left + squareRect.width / 2, y: squareRect.top + squareRect.height / 2 }
      : null;
    const notCentered = Boolean(
      center &&
        squareCenter &&
        Math.hypot(center.x - squareCenter.x, center.y - squareCenter.y) >= squareSize * 0.18,
    );
    const style = overlay ? window.getComputedStyle(overlay) : null;
    return {
      visible: Boolean(overlay),
      qualityId: overlay?.getAttribute("data-quality-id") ?? null,
      result: overlay?.getAttribute("data-result") ?? null,
      square,
      orientation,
      insideBoard,
      insideSquare,
      topRightInside,
      notCentered,
      pointerEvents: style?.pointerEvents ?? null,
      width: overlayRect ? Math.round(overlayRect.width) : null,
      height: overlayRect ? Math.round(overlayRect.height) : null,
    };
  });
}

async function assertDesktopInitialCockpit() {
  await harness.setViewport({ width: 1440, height: 860 });
  await harness.evalPage(() => {
    window.scrollTo(0, 0);
    return { ok: true };
  });
  const layout = await harness.waitForPagePredicate("review cockpit desktop initial", () => {
    const board = document.querySelector('[data-testid="review-board"]');
    const stickyColumn = document.querySelector('[data-testid="review-board-sticky-column"]');
    const boardRect = board?.getBoundingClientRect();
    const stickyStyle = stickyColumn ? window.getComputedStyle(stickyColumn) : null;
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-focus-layout"]')) &&
        Boolean(board) &&
        boardRect &&
        boardRect.width >= 500 &&
        boardRect.height >= 500 &&
        stickyStyle?.position === "sticky",
      boardWidth: boardRect ? Math.round(boardRect.width) : null,
      boardHeight: boardRect ? Math.round(boardRect.height) : null,
      stickyPosition: stickyStyle?.position ?? null,
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  evidence.contract_checks.desktop_initial = layout;
  await captureContractScreenshot({
    scenario: "DESKTOP_INITIAL",
    state: "REVIEW_COCKPIT_OPEN",
    action: "opened Review desktop",
    expected: "board dominant and sticky in cockpit layout",
    observed: `board ${layout.boardWidth}x${layout.boardHeight}, sticky=${layout.stickyPosition}`,
    pass: true,
    primaryTestId: "review-focus-layout",
  });
}

async function assertSuccessState(firstItem) {
  await submitPracticeMoveWithFallback(firstItem.best_move_uci);
  const result = await harness.waitForPagePredicate("success board feedback and next visible", () => {
    const viewportHeight = window.innerHeight;
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight);
    };
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-training-feedback"]') &&
        (visible('[data-testid="review-training-next-button"]') ||
          visible('[data-testid="review-training-finish-button"]')) &&
        Boolean(overlay) &&
        overlay.getAttribute("data-quality-id") === "critical_best",
      overlayQuality: overlay?.getAttribute("data-quality-id") ?? null,
      overlaySquare: overlay?.getAttribute("data-square") ?? null,
      feedback:
        document.querySelector('[data-testid="review-training-feedback"]')?.textContent?.trim() ?? "",
    };
  }, 25_000);
  evidence.contract_checks.success_state = result;
  const layout = await layoutSnapshot();
  await captureContractScreenshot({
    scenario: "SUCCESS_ATTEMPT",
    state: `AFTER_${firstItem.best_move_uci}`,
    action: `played ${firstItem.best_move_uci}`,
    expected: "board feedback and primary continuation CTA visible in one viewport",
    observed: `boardVisible=${layout.boardVisible}, feedbackVisible=${layout.feedbackVisible}, nextVisible=${layout.successCtaVisible}, finishVisible=${layout.finishCtaVisible}`,
    pass: true,
    primaryTestId: layout.successCtaVisible
      ? "review-training-next-button"
      : "review-training-finish-button",
  });
  const overlay = await overlayGeometrySnapshot();
  if (
    !overlay.visible ||
    !overlay.insideBoard ||
    !overlay.insideSquare ||
    !overlay.topRightInside ||
    !overlay.notCentered ||
    overlay.pointerEvents !== "none"
  ) {
    fail("success_overlay_top_right_geometry", JSON.stringify(overlay));
  }
  evidence.contract_checks.success_overlay_geometry = overlay;
  mark("success_overlay_top_right_geometry", "pass", JSON.stringify(overlay));
  await captureContractScreenshot({
    scenario: "OVERLAY_GEOMETRY",
    state: `DESTINATION_${overlay.square}`,
    action: "measured success overlay geometry",
    expected: "small top-right chip inside destination square",
    observed: `quality=${overlay.qualityId}, square=${overlay.square}, ${overlay.width}x${overlay.height}`,
    pass: true,
    primaryTestId: "board-move-outcome-overlay",
  });
}

async function assertLinePlayerNearBoard() {
  await harness.evalPage(() => {
    const buttons = [
      ...document.querySelectorAll('[data-testid="review-primary-action-zone"] button'),
    ];
    const target = buttons.find((button) =>
      (button.textContent ?? "").toLowerCase().includes("comparer"),
    );
    if (!(target instanceof HTMLElement)) {
      return { ok: false, reason: "missing compare button" };
    }
    target.click();
    return { ok: true };
  });
  const opened = await harness.waitForPagePredicate("line player docked near board", () => {
    const viewportHeight = window.innerHeight;
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight);
    };
    const board = document.querySelector('[data-testid="practice-board"]');
    const player = document.querySelector('[data-testid="review-line-player"]');
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-line-player"]') &&
        visible('[data-testid="review-line-player-next"]') &&
        Boolean(player),
      boardFen: board?.getAttribute("data-board-fen") ?? null,
      currentFen: player?.getAttribute("data-current-fen") ?? null,
      currentIndex: player?.getAttribute("data-current-index") ?? null,
      context:
        document.querySelector('[data-testid="review-line-player-context"]')?.textContent ?? "",
    };
  }, 20_000);
  evidence.contract_checks.line_player_opened = opened;
  await captureContractScreenshot({
    scenario: "LINE_PLAYER",
    state: "ACTIVE_WITH_BOARD",
    action: "clicked line comparison",
    expected: "board and line player controls visible together",
    observed: opened.context,
    pass: true,
    primaryTestId: "review-line-player",
  });
  await harness.clickByTestId("review-line-player-next", { afterMs: 700 });
  const advanced = await harness.waitForPagePredicate("line next changes state", (beforeFen, beforeIndex) => {
    const player = document.querySelector('[data-testid="review-line-player"]');
    const board = document.querySelector('[data-testid="practice-board"]');
    const currentFen = player?.getAttribute("data-current-fen") ?? null;
    const currentIndex = player?.getAttribute("data-current-index") ?? null;
    const step =
      document.querySelector('[data-testid="review-line-player-step-label"]')?.textContent ?? "";
    return {
      ok:
        Boolean(player) &&
        Boolean(board) &&
        (currentFen !== beforeFen || currentIndex !== beforeIndex) &&
        step.length > 0,
      beforeFen,
      currentFen,
      beforeIndex,
      currentIndex,
      step,
    };
  }, 20_000, opened.currentFen, opened.currentIndex);
  evidence.contract_checks.line_player_next_advanced = advanced;
  mark("line_player_next_advanced", "pass", JSON.stringify(advanced));
}

async function installWrongAttemptIntercept(session, item, wrongMove, wrongMoveSan) {
  await harness.evalPage(({ sessionId, item, wrongMove, wrongMoveSan }) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === "string" ? input : String(input?.url ?? "");
      const body = typeof init?.body === "string" ? init.body : "";
      if (
        rawUrl.includes(`/review/practice/sessions/${sessionId}/attempts`) &&
        body.includes(wrongMove)
      ) {
        const payload = {
          session_id: sessionId,
          item_count: 2,
          positions_worked_count: 2,
          success_count: 1,
          review_count: 1,
          scheduled_count: 1,
          latest_attempt: {
            id: 999001,
            session_id: sessionId,
            game_id: item.game_id ?? 0,
            ply: item.ply,
            attempted_uci: wrongMove,
            attempted_san: wrongMoveSan,
            expected_best_uci: item.best_move_uci,
            result: "wrong",
            attempt_number: 1,
            item_id: item.item_id ?? null,
          },
          attempt_feedback: {
            result: "wrong",
            message: "Ce coup ne traite pas le probleme principal.",
            show_best_move: true,
            attempted_uci: wrongMove,
            attempted_san: wrongMoveSan,
            best_move_uci: item.best_move_uci,
            best_move_san: item.best_move_san,
          },
          result_by_ply: { [String(item.ply)]: "wrong" },
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
    return { ok: true };
  }, { sessionId: session.session_id, item, wrongMove, wrongMoveSan });
  evidence.contract_checks.wrong_intercept = {
    session_id: session.session_id,
    ply: item.ply,
    wrong_move: wrongMove,
    wrong_move_san: wrongMoveSan,
  };
}

async function assertWrongState(session) {
  await harness.clickByTestId("review-training-next-button", { afterMs: 900 });
  await harness.waitForPagePredicate("second practice item ready", () => {
    const label =
      document.querySelector('[data-testid="review-training-position-label"]')?.textContent ?? "";
    return {
      ok:
        label.includes("2 /") &&
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        !document.querySelector('[data-testid="review-training-feedback"]'),
      label,
    };
  }, 20_000);
  const item = session.items[1];
  const wrongMove =
    item.uci && item.uci !== item.best_move_uci
      ? item.uci
      : item.played_uci && item.played_uci !== item.best_move_uci
        ? item.played_uci
        : null;
  if (!wrongMove) {
    fail("wrong_fixture_move_available", JSON.stringify(item));
  }
  const wrongMoveSan = item.san ?? item.played_san ?? wrongMove;
  await installWrongAttemptIntercept(session, item, wrongMove, wrongMoveSan);
  await submitPracticeMoveWithFallback(wrongMove);
  const wrong = await harness.waitForPagePredicate("wrong retry visible with board overlay", () => {
    const viewportHeight = window.innerHeight;
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight);
    };
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-training-feedback"]') &&
        visible('[data-testid="review-training-retry-button"]') &&
        Boolean(overlay) &&
        overlay.getAttribute("data-quality-id") === "wrong",
      overlayQuality: overlay?.getAttribute("data-quality-id") ?? null,
      overlaySquare: overlay?.getAttribute("data-square") ?? null,
      retryText:
        document.querySelector('[data-testid="review-training-retry-button"]')?.textContent?.trim() ??
        "",
    };
  }, 25_000);
  evidence.contract_checks.wrong_state = wrong;
  const layout = await layoutSnapshot();
  await captureContractScreenshot({
    scenario: "WRONG_ATTEMPT",
    state: `AFTER_${wrongMove}`,
    action: `played ${wrongMove}`,
    expected: "board feedback and Reessayer visible in one viewport",
    observed: `boardVisible=${layout.boardVisible}, feedbackVisible=${layout.feedbackVisible}, retryVisible=${layout.retryCtaVisible}`,
    pass: true,
    primaryTestId: "review-training-retry-button",
    notes: "wrong feedback is deterministic frontend layout fixture response",
  });
}

async function assertWrongStateCurrentItem(session, item) {
  const wrongMove =
    item.uci && item.uci !== item.best_move_uci
      ? item.uci
      : item.played_uci && item.played_uci !== item.best_move_uci
        ? item.played_uci
        : null;
  if (!wrongMove) {
    fail("wrong_fixture_move_available", JSON.stringify(item));
  }
  const wrongMoveSan = item.san ?? item.played_san ?? wrongMove;
  await installWrongAttemptIntercept(session, item, wrongMove, wrongMoveSan);
  await submitPracticeMoveWithFallback(wrongMove);
  const wrong = await harness.waitForPagePredicate("single-item wrong retry visible with board overlay", () => {
    const viewportHeight = window.innerHeight;
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight);
    };
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-training-feedback"]') &&
        visible('[data-testid="review-training-retry-button"]') &&
        Boolean(overlay) &&
        overlay.getAttribute("data-quality-id") === "wrong",
      overlayQuality: overlay?.getAttribute("data-quality-id") ?? null,
      overlaySquare: overlay?.getAttribute("data-square") ?? null,
      retryText:
        document.querySelector('[data-testid="review-training-retry-button"]')?.textContent?.trim() ??
        "",
    };
  }, 25_000);
  evidence.contract_checks.wrong_state_single_item = wrong;
  const layout = await layoutSnapshot();
  await captureContractScreenshot({
    scenario: "WRONG_ATTEMPT",
    state: `AFTER_${wrongMove}`,
    action: `played ${wrongMove}`,
    expected: "board feedback and Reessayer visible in one viewport",
    observed: `boardVisible=${layout.boardVisible}, feedbackVisible=${layout.feedbackVisible}, retryVisible=${layout.retryCtaVisible}`,
    pass: true,
    primaryTestId: "review-training-retry-button",
    notes: "single-item wrong feedback uses deterministic frontend layout fixture response",
  });
}

async function resetAfterWrongAttempt() {
  await harness.clickByTestId("review-training-retry-button", { afterMs: 700 });
  await harness.waitForPagePredicate("practice reset after wrong attempt", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      !document.querySelector('[data-testid="review-training-feedback"]'),
    text: document.body?.innerText ?? "",
  }), 15_000);
  mark("practice_reset_after_wrong_attempt", "pass", "feedback cleared");
}

async function assertMobileNarrowSafe() {
  await harness.setViewport({ width: 390, height: 844, mobile: true });
  await harness.evalPage(() => {
    document.querySelector('[data-testid="practice-board"]')?.scrollIntoView({
      block: "center",
      inline: "center",
    });
    return { ok: true };
  });
  const mobile = await harness.waitForPagePredicate("mobile board overlay readable", () => {
    const board = document.querySelector('[data-testid="practice-board"]');
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const boardRect = board?.getBoundingClientRect();
    const overlayRect = overlay?.getBoundingClientRect();
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return {
      ok:
        Boolean(board) &&
        Boolean(overlay) &&
        !overflowX &&
        overlayRect &&
        overlayRect.width <= 48 &&
        overlayRect.height <= 36 &&
        boardRect &&
        overlayRect.left >= boardRect.left - 2 &&
        overlayRect.right <= boardRect.right + 2,
      overflowX,
      boardWidth: boardRect ? Math.round(boardRect.width) : null,
      overlayWidth: overlayRect ? Math.round(overlayRect.width) : null,
      overlayHeight: overlayRect ? Math.round(overlayRect.height) : null,
      retryExists: Boolean(document.querySelector('[data-testid="review-training-retry-button"]')),
    };
  }, 20_000);
  evidence.contract_checks.mobile_overlay = mobile;
  await harness.evalPage(() => {
    document.querySelector('[data-testid="review-training-retry-button"]')?.scrollIntoView({
      block: "center",
      inline: "center",
    });
    return { ok: true };
  });
  const cta = await harness.waitForPagePredicate("mobile retry accessible", () => {
    const button = document.querySelector('[data-testid="review-training-retry-button"]');
    const rect = button?.getBoundingClientRect();
    return {
      ok:
        Boolean(button) &&
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight,
      rect: rect
        ? {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
    };
  }, 10_000);
  evidence.contract_checks.mobile_retry_accessible = cta;
  await captureContractScreenshot({
    scenario: "MOBILE_NARROW",
    state: "WRONG_STATE",
    action: "set 390px viewport and scrolled to CTA",
    expected: "no horizontal overflow and primary CTA accessible",
    observed: `overflowX=${mobile.overflowX}, retryVisible=${Boolean(cta.ok)}`,
    pass: true,
    primaryTestId: "review-training-retry-button",
  });
  await harness.browserClient.send("Emulation.clearDeviceMetricsOverride");
}

async function main() {
  harness.writeEvidence();
  evidence.api.head_commit = gitShortHead();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  seedTwoEligibleMoments(gameId);
  const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  writeJson(path.join(API_DIR, "review_after_cockpit_seed.json"), review);
  await openReviewFromPersistedState(harness, gameId);
  await assertDesktopInitialCockpit();
  const session = await openPracticeFromReview(gameId);
  if (session.items.length >= 2) {
    await assertSuccessState(session.items[0]);
    await assertLinePlayerNearBoard();
    await assertWrongState(session);
    await assertMobileNarrowSafe();
  } else {
    await assertWrongStateCurrentItem(session, session.items[0]);
    await assertMobileNarrowSafe();
    await resetAfterWrongAttempt();
    await harness.setViewport({ width: 1440, height: 860 });
    await assertSuccessState(session.items[0]);
    await assertLinePlayerNearBoard();
  }
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
  console.log("BROWSER_REVIEW_COCKPIT_BOARD_FIRST_LAYOUT_SMOKE PASS");
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
          primaryTestId: "failure",
        });
      } catch {
        await harness.captureScreenshot("browser_review_cockpit_board_first_layout_failure");
      }
    }
    writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
      console: evidence.browser_errors.console,
      page: evidence.browser_errors.page,
    });
    writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_COCKPIT_BOARD_FIRST_LAYOUT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
