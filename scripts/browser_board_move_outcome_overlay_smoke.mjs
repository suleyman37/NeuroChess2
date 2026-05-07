#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  fetchJson,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "V1_1.BOARD-OVERLAY-MOVE-OUTCOME-GLYPHS-CSS-V1";
const MISSION_ID = "V1_1_BOARD_OVERLAY_MOVE_OUTCOME_GLYPHS_CSS_V1";
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
  "browser_board_move_outcome_overlay_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_board_move_outcome_overlay_evidence.json",
);
evidence.strategy =
  "temp backend DB + Review/Lesson attempts + Practice attempt; asserts board-level CSS outcome overlay";
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

function gitShortHead() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

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
    .slice(0, 90)
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
  qualityId = null,
  glyph = null,
  square = null,
  boardOrientation = null,
  notes = "",
}) {
  screenshotIndex += 1;
  const now = new Date();
  const resultLabel = pass ? "PASS" : "FAIL";
  const filename = `${localStamp(now)}_LOCAL__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken("BOARD_MOVE_OUTCOME")}__${safeFileToken(
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
    quality_id: qualityId,
    glyph,
    square,
    board_orientation: boardOrientation,
    console_errors_count: evidence.browser_errors.console.length + evidence.browser_errors.page.length,
    network_500_count: evidence.browser_errors.network_500.length,
    notes,
    previous_screenshot: screenshotTimeline.at(-1)?.path
      ? path.basename(screenshotTimeline.at(-1).path)
      : null,
    next_screenshot: null,
    path: screenshotPath,
  };
  if (screenshotTimeline.length) {
    screenshotTimeline[screenshotTimeline.length - 1].next_screenshot = filename;
  }
  screenshotTimeline.push(entry);
  writeJson(screenshotPath.replace(/\.png$/i, ".json"), entry);
  evidence.screenshots = screenshotTimeline;
  manifest.screenshots = screenshotTimeline;
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

function reviewOverlayAnnotation(baseAnnotation = {}) {
  const fenBefore =
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
  const playedFen =
    "r1bqkbnr/pppnpppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 3";
  const bestLine = [
    { uci: "b8c6", san: "Nc6" },
    { uci: "g1f3", san: "Nf3" },
  ];
  const playedLine = [
    { uci: "b8d7", san: "Nd7" },
    { uci: "e4d5", san: "exd5" },
  ];
  return {
    ...baseAnnotation,
    ply: 8,
    move_number: 8,
    color: "black",
    side: "black",
    san: "Nd7",
    uci: "b8d7",
    fen_before: fenBefore,
    fen_after: playedFen,
    primary_category: "missed_opportunity",
    category_label: "Problème",
    tags: ["missed_opportunity"],
    tag_labels: ["Opportunité manquée"],
    reason: "board_overlay_fixture",
    win_loss: 11,
    move_accuracy: 58,
    best_move_uci: "b8c6",
    best_move_san: "Nc6",
    top_moves: [
      { uci: "b8c6", san: "Nc6", rank: 1, eval_cp: -80, pv: bestLine },
      { uci: "b8a6", san: "Na6", rank: 2, eval_cp: -76, pv: [{ uci: "b8a6", san: "Na6" }] },
      { uci: "b8d7", san: "Nd7", rank: 3, eval_cp: 50, pv: playedLine },
    ],
    try_move_supported: true,
    try_move_model_version: "try_move_v1",
    accepted_moves: [{ uci: "b8a6", san: "Na6", quality: "acceptable" }],
    acceptable_moves: [{ uci: "b8a6", san: "Na6", quality: "acceptable" }],
    accepted_moves_uci: ["b8a6"],
    pv_line: bestLine,
    pv_line_available: true,
    pv_contrast_evidence: {
      available: true,
      played_branch: { pv: playedLine },
      best_branch: { pv: bestLine },
    },
    pedagogical_explanation: {
      available: true,
      error_type: "tactical",
      why_played_move_bad: "Dans la partie, le coup joué avait laissé moins de marge.",
      why_best_move_good: "La meilleure idée développe la pièce avec plus de pression.",
      training_takeaway: "Cherche le coup qui répond le mieux à la menace.",
    },
    contrast_coach_explanation: {
      available: true,
      what_happened_after_played: "Dans la partie, la ligne jouée était moins précise.",
      why_solution_is_better: "La solution garde plus d'initiative.",
      played_line_preview: "Nd7 exd5",
      best_line_preview: "Nc6 Nf3",
      main_difference_type: "initiative",
      main_difference: "La solution garde plus d'initiative.",
    },
    impact_label: "important",
    move_quality_label: "Moyenne",
    compact_label: "Nc6",
    coach_card_title: "Coup 8",
  };
}

function buildReviewOverlayPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = reviewOverlayAnnotation(baseAnnotation);
  const payload = {
    ...review,
    status: review?.status ?? "done",
    user_color: "white",
    move_annotations: [annotation],
    review_sections: {
      to_review: [annotation],
      strong_moves: [],
      missed_opportunities: [annotation],
      all: [annotation],
    },
  };
  evidence.api.review_overlay_annotation = annotation;
  return payload;
}

async function installReviewPayloadIntercept(gameId, reviewPayload) {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
(() => {
  const gameId = ${JSON.stringify(String(gameId))};
  const reviewPayload = ${JSON.stringify(reviewPayload)};
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === "string" ? input : String(input && input.url ? input.url : "");
    let isReviewEndpoint = false;
    try {
      const parsed = new URL(rawUrl, window.location.href);
      isReviewEndpoint = parsed.pathname === "/games/" + gameId + "/review";
    } catch {
      isReviewEndpoint =
        rawUrl.endsWith("/games/" + gameId + "/review") ||
        rawUrl.includes("/games/" + gameId + "/review?");
    }
    if (isReviewEndpoint) {
      return new Response(JSON.stringify(reviewPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
})();
`,
  });
}

async function openReviewWithPayload(gameId, reviewPayload, queryKey = "boardOverlay") {
  await installReviewPayloadIntercept(gameId, reviewPayload);
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
(() => {
  const gameId = ${JSON.stringify(gameId)};
  window.localStorage.setItem(
    "neurochess.appState.v5_3a4d",
    JSON.stringify({
      gameId,
      activeTab: "review",
      displayedPositionPly: 0,
      activeReviewJobId: null,
      reviewAnalysisProfile: "standard",
      updatedAt: Date.now(),
    }),
  );
  window.localStorage.setItem("neurochess.reviewPov." + gameId, "both");
})();
`,
  });
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?${queryKey}=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review board restored with overlay payload", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-board"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function openLessonChallenge() {
  await harness.clickByTestId("review-focus-learn", { afterMs: 700 });
  await harness.waitForPagePredicate("lesson challenge visible", () => ({
    ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function assertNoBoardOverlayBeforeAttempt() {
  const result = await harness.waitForPagePredicate("no board overlay before attempt", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      !document.querySelector('[data-testid="board-move-outcome-overlay"]'),
    overlayVisible: Boolean(document.querySelector('[data-testid="board-move-outcome-overlay"]')),
    text: document.body?.innerText ?? "",
  }), 10_000);
  evidence.contract_checks.review_pre_attempt_no_overlay = result;
  mark("review_pre_attempt_no_board_overlay", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "PRE_ATTEMPT",
    state: "REVIEW_CHALLENGE",
    action: "opened try mode before move",
    expected: "no board overlay before attempt",
    observed: "board has no outcome overlay before user action",
    pass: true,
    primaryTestId: "review-board",
  });
}

async function overlaySnapshot() {
  return harness.evalPage(() => {
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const board =
      document.querySelector('[data-testid="review-board"]') ??
      document.querySelector('[data-testid="practice-board"]');
    const glyph = overlay?.querySelector('[data-testid="board-move-outcome-glyph"]')?.textContent?.trim() ?? null;
    const overlayRect = overlay?.getBoundingClientRect();
    const boardRect = board?.getBoundingClientRect();
    const style = overlay ? window.getComputedStyle(overlay) : null;
    const insideBoard = Boolean(
      overlayRect &&
        boardRect &&
        overlayRect.left >= boardRect.left - 2 &&
        overlayRect.top >= boardRect.top - 2 &&
        overlayRect.right <= boardRect.right + 2 &&
        overlayRect.bottom <= boardRect.bottom + 2,
    );
    return {
      visible: Boolean(overlay),
      qualityId: overlay?.getAttribute("data-quality-id") ?? null,
      result: overlay?.getAttribute("data-result") ?? null,
      square: overlay?.getAttribute("data-square") ?? null,
      moveUci: overlay?.getAttribute("data-move-uci") ?? null,
      boardOrientation: overlay?.getAttribute("data-board-orientation") ?? null,
      glyph,
      pointerEvents: style?.pointerEvents ?? null,
      insideBoard,
      overlayRect: overlayRect
        ? {
            left: Math.round(overlayRect.left),
            top: Math.round(overlayRect.top),
            right: Math.round(overlayRect.right),
            bottom: Math.round(overlayRect.bottom),
            width: Math.round(overlayRect.width),
            height: Math.round(overlayRect.height),
          }
        : null,
      boardRect: boardRect
        ? {
            left: Math.round(boardRect.left),
            top: Math.round(boardRect.top),
            right: Math.round(boardRect.right),
            bottom: Math.round(boardRect.bottom),
            width: Math.round(boardRect.width),
            height: Math.round(boardRect.height),
          }
        : null,
      text: document.body?.innerText ?? "",
    };
  });
}

async function assertOverlay({
  label,
  expectedQualityId,
  expectedGlyph,
  expectedSquare,
  expectedOrientation = null,
}) {
  const result = await harness.waitForPagePredicate(label, (expected) => {
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const board =
      document.querySelector('[data-testid="review-board"]') ??
      document.querySelector('[data-testid="practice-board"]');
    const glyph = overlay?.querySelector('[data-testid="board-move-outcome-glyph"]')?.textContent?.trim() ?? null;
    const overlayRect = overlay?.getBoundingClientRect();
    const boardRect = board?.getBoundingClientRect();
    const style = overlay ? window.getComputedStyle(overlay) : null;
    const insideBoard = Boolean(
      overlayRect &&
        boardRect &&
        overlayRect.left >= boardRect.left - 2 &&
        overlayRect.top >= boardRect.top - 2 &&
        overlayRect.right <= boardRect.right + 2 &&
        overlayRect.bottom <= boardRect.bottom + 2,
    );
    const snapshot = {
      visible: Boolean(overlay),
      qualityId: overlay?.getAttribute("data-quality-id") ?? null,
      glyph,
      square: overlay?.getAttribute("data-square") ?? null,
      boardOrientation: overlay?.getAttribute("data-board-orientation") ?? null,
      pointerEvents: style?.pointerEvents ?? null,
      insideBoard,
      text: document.body?.innerText ?? "",
    };
    return {
      ok:
        snapshot.visible &&
        snapshot.qualityId === expected.qualityId &&
        snapshot.glyph === expected.glyph &&
        snapshot.square === expected.square &&
        (!expected.orientation || snapshot.boardOrientation === expected.orientation) &&
        snapshot.pointerEvents === "none" &&
        snapshot.insideBoard,
      ...snapshot,
    };
  }, 30_000, {
    qualityId: expectedQualityId,
    glyph: expectedGlyph,
    square: expectedSquare,
    orientation: expectedOrientation,
  });
  evidence.contract_checks[label] = result;
  mark(label, "pass", JSON.stringify(result));
  return result;
}

async function playReviewMoveAndAssertOverlay({
  gameId,
  reviewPayload,
  move,
  expectedQualityId,
  expectedGlyph,
  expectedSquare,
  scenario,
  staleGuard = false,
  capture = true,
}) {
  await openReviewWithPayload(gameId, reviewPayload, scenario);
  await openLessonChallenge();
  await assertNoBoardOverlayBeforeAttempt();
  await harness.clickByText("Essayer", { exact: true, afterMs: 700 });
  await harness.tryMoveByClickClick(move, "review-board");
  const result = await assertOverlay({
    label: `review_${scenario}_overlay`,
    expectedQualityId,
    expectedGlyph,
    expectedSquare,
    expectedOrientation: "black",
  });
  if (staleGuard) {
    const compact = String(result.text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    if (compact.includes("apres le coup joue")) {
      fail("stale_historical_comment_guard", compact);
    }
  }
  if (capture) {
    await captureContractScreenshot({
      scenario,
      state: `AFTER_MOVE_${move}`,
      action: `played ${move}`,
      expected: `${expectedGlyph} overlay on destination square`,
      observed: `board overlay ${expectedQualityId} on ${expectedSquare}`,
      pass: true,
      primaryTestId: "board-move-outcome-overlay",
      qualityId: expectedQualityId,
      glyph: expectedGlyph,
      square: expectedSquare,
      boardOrientation: "black",
    });
  }
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
  await openReviewWithPayload(gameId, evidence.api.review_payload, "practiceOverlay");
  await harness.waitForPagePredicate("review practice entry ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-practice-button"]')) ||
      Boolean(document.querySelector('[data-testid="review-focus-practice"]')) ||
      (document.body?.innerText ?? "").includes("S'entraîner"),
    text: document.body?.innerText ?? "",
  }), 30_000);
  try {
    await harness.clickByTestId("review-focus-practice", { afterMs: 800 });
  } catch {
    await harness.clickByText("S'entraîner", { exact: false, afterMs: 800 });
  }
  await harness.waitForPagePredicate("review practice start button ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-practice-button"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByText("Commencer", { exact: false, afterMs: 1500 });
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
  mark("review_practice_opened_for_overlay", "pass", `session_id=${session.session_id}`);
  return session;
}

async function assertPracticePreAttemptNoOverlay() {
  const result = await harness.waitForPagePredicate("practice pre attempt no overlay", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      !document.querySelector('[data-testid="board-move-outcome-overlay"]') &&
      !document.querySelector('[data-testid="practice-attempt-quality-badge"]'),
    overlayVisible: Boolean(document.querySelector('[data-testid="board-move-outcome-overlay"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  evidence.contract_checks.practice_pre_attempt_no_overlay = result;
  mark("practice_pre_attempt_no_board_overlay_no_spoiler", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "PRACTICE_NO_SPOILER",
    state: "PRE_ATTEMPT",
    action: "opened practice position",
    expected: "no board overlay before attempt",
    observed: "no board outcome marker or practice badge before attempt",
    pass: true,
    primaryTestId: "practice-board",
  });
}

async function playPracticeBestAndAssertOverlay(session) {
  const item = session.items[0];
  const bestMove = item.best_move_uci;
  if (!bestMove) {
    fail("practice_best_move_available", JSON.stringify(item));
  }
  const expectedSquare = bestMove.slice(2, 4);
  const beforeLabel = await harness.evalPage(() =>
    document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "",
  );
  await harness.tryMoveByClickClick(bestMove, "practice-board");
  const result = await assertOverlay({
    label: "practice_best_overlay",
    expectedQualityId: "critical_best",
    expectedGlyph: "!",
    expectedSquare,
  });
  const continuation = await harness.waitForPagePredicate("practice positive continuation visible", () => ({
    ok: Boolean(
      document.querySelector('[data-testid="review-training-next-button"], [data-testid="review-training-finish-button"]'),
    ),
    text: document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "",
  }), 20_000);
  evidence.contract_checks.practice_best_continuation = continuation;
  await captureContractScreenshot({
    scenario: "PRACTICE_BEST_MOVE_OVERLAY",
    state: "AFTER_BEST_MOVE",
    action: `played ${bestMove}`,
    expected: "exclamation overlay on board and continuation CTA",
    observed: `board overlay ${result.qualityId} on ${result.square}`,
    pass: true,
    primaryTestId: "board-move-outcome-overlay",
    qualityId: "critical_best",
    glyph: "!",
    square: expectedSquare,
    boardOrientation: result.boardOrientation,
  });

  const nextButtonSelector =
    '[data-testid="review-training-next-button"], [data-testid="review-training-finish-button"]';
  await harness.evalPage((selector) => {
    const button = document.querySelector(selector);
    if (!(button instanceof HTMLElement)) {
      throw new Error("missing next/finish button");
    }
    button.click();
    return true;
  }, nextButtonSelector);
  const reset = await harness.waitForPagePredicate("overlay reset after practice continuation", (previousLabel) => {
    const label =
      document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ??
      document.querySelector('[data-testid="review-training-complete-state"]')?.textContent?.trim() ??
      "";
    return {
      ok:
        !document.querySelector('[data-testid="board-move-outcome-overlay"]') &&
        label !== previousLabel,
      previousLabel,
      label,
      overlayVisible: Boolean(document.querySelector('[data-testid="board-move-outcome-overlay"]')),
      text: document.body?.innerText ?? "",
    };
  }, 20_000, beforeLabel);
  evidence.contract_checks.practice_overlay_reset_after_next = reset;
  mark("practice_position_suivante_clears_board_overlay", "pass", JSON.stringify(reset));
  await captureContractScreenshot({
    scenario: "PRACTICE_CONTINUATION_RESET",
    state: "AFTER_POSITION_SUIVANTE",
    action: "clicked next or finish",
    expected: "overlay cleared and training position changes",
    observed: "board overlay cleared after continuation action",
    pass: true,
    primaryTestId: "practice-board",
  });
}

async function assertMobileOverlayReadable() {
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const snapshot = await overlaySnapshot();
  if (!snapshot.visible) {
    fail("mobile_overlay_visible", JSON.stringify(snapshot));
  }
  if (snapshot.overlayRect.width > 64 || !snapshot.insideBoard) {
    fail("mobile_overlay_readable", JSON.stringify(snapshot));
  }
  mark("mobile_overlay_readable", "pass", JSON.stringify(snapshot));
  await captureContractScreenshot({
    scenario: "MOBILE_OVERLAY",
    state: "NARROW_VIEWPORT",
    action: "set 390px viewport",
    expected: "overlay readable and inside board",
    observed: `overlay ${snapshot.glyph} remains compact`,
    pass: true,
    primaryTestId: "board-move-outcome-overlay",
    qualityId: snapshot.qualityId,
    glyph: snapshot.glyph,
    square: snapshot.square,
    boardOrientation: snapshot.boardOrientation,
  });
  await harness.browserClient.send("Emulation.clearDeviceMetricsOverride");
}

async function main() {
  harness.writeEvidence();
  evidence.api.head_commit = gitShortHead();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app");
  const { gameId, review } = await prepareReviewFixture(harness);
  evidence.api.game_id = gameId;
  const reviewPayload = buildReviewOverlayPayload(review);
  evidence.api.review_payload = reviewPayload;

  await openReviewWithPayload(gameId, reviewPayload);
  await openLessonChallenge();
  await assertNoBoardOverlayBeforeAttempt();

  await playReviewMoveAndAssertOverlay({
    gameId,
    reviewPayload,
    move: "b8c6",
    expectedQualityId: "critical_best",
    expectedGlyph: "!",
    expectedSquare: "c6",
    scenario: "BEST_MOVE_OVERLAY_ON_BOARD",
  });

  await playReviewMoveAndAssertOverlay({
    gameId,
    reviewPayload,
    move: "b8a6",
    expectedQualityId: "good",
    expectedGlyph: "✓",
    expectedSquare: "a6",
    scenario: "ACCEPTED_MOVE_OVERLAY_ON_BOARD",
  });

  await playReviewMoveAndAssertOverlay({
    gameId,
    reviewPayload,
    move: "g8f6",
    expectedQualityId: "wrong",
    expectedGlyph: "?",
    expectedSquare: "f6",
    scenario: "WRONG_MOVE_OVERLAY_NO_STALE_COMMENT",
    staleGuard: true,
  });

  await playReviewMoveAndAssertOverlay({
    gameId,
    reviewPayload,
    move: "b8b5",
    expectedQualityId: "illegal",
    expectedGlyph: "×",
    expectedSquare: "b5",
    scenario: "ILLEGAL_MOVE_OVERLAY_ON_BOARD",
  });

  await assertMobileOverlayReadable();

  const session = await openPracticeFromReview(gameId);
  await assertPracticePreAttemptNoOverlay();
  await playPracticeBestAndAssertOverlay(session);

  mark("playable_fixture_status", "not_available", "No deterministic playable-only current-attempt fixture is available in this smoke.");
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
  console.log("BROWSER_BOARD_MOVE_OUTCOME_OVERLAY_SMOKE PASS");
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
          primaryTestId: "board-move-outcome-overlay",
        });
      } catch {
        await harness.captureScreenshot("browser_board_move_outcome_overlay_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_BOARD_MOVE_OUTCOME_OVERLAY_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
