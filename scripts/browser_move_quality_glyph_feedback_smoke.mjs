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

const MISSION = "V1_1.MOVE-QUALITY-GLYPH-FEEDBACK-SYSTEM-V1";
const MISSION_ID = "V1_1_MOVE_QUALITY_GLYPH_FEEDBACK_SYSTEM_V1";
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
  "browser_move_quality_glyph_feedback_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_move_quality_glyph_feedback_evidence.json",
);
evidence.strategy =
  "temp backend DB + Review Practice best attempt + intercepted Review/Lesson accepted and wrong attempts";
evidence.screenshots = [];
evidence.contract_checks = {};

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
  notes = "",
}) {
  screenshotIndex += 1;
  const now = new Date();
  const resultLabel = pass ? "PASS" : "FAIL";
  const filename = `${localStamp(now)}_LOCAL__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken("MOVE_QUALITY_GLYPH")}__${safeFileToken(
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
    no_spoiler_checked: scenario.includes("NO_SPOILER"),
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
  evidence.api.practice_item_id = session.items[0]?.item_id ?? null;
  mark("review_practice_opened", "pass", `session_id=${session.session_id}`);
  return session;
}

async function assertNoSpoilerBeforePracticeAttempt() {
  const result = await harness.waitForPagePredicate("no quality spoiler before practice attempt", () => {
    const panel = document.querySelector('[data-testid="practice-panel"]');
    const badge = panel?.querySelector('[data-testid="practice-attempt-quality-badge"]');
    const boardOverlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const bestBadge = [...(panel?.querySelectorAll('[data-quality-id]') ?? [])].some(
      (node) => node.getAttribute("data-quality-id") === "critical_best",
    );
    return {
      ok: Boolean(panel) && !badge && !bestBadge && !boardOverlay,
      hasBadge: Boolean(badge),
      hasBoardOverlay: Boolean(boardOverlay),
      hasBestBadge: bestBadge,
      text: panel?.textContent ?? "",
    };
  }, 20_000);
  evidence.contract_checks.practice_no_spoiler = result;
  mark("practice_no_solution_quality_badge_before_attempt", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "PRACTICE_NO_SPOILER",
    state: "PRE_ATTEMPT",
    action: "opened practice position",
    expected: "no solution quality badge before attempt",
    observed: "no practice quality badge is rendered before attempt",
    pass: true,
    primaryTestId: "practice-panel",
  });
}

async function playPracticeBestAndAssertBadge(session) {
  const item = session.items[0];
  const bestMove = item.best_move_uci;
  if (!bestMove) {
    fail("practice_best_move_available", JSON.stringify(item));
  }
  await harness.tryMoveByClickClick(bestMove, "practice-board");
  const result = await harness.waitForPagePredicate("practice best badge visible", () => {
    const badge = document.querySelector('[data-testid="practice-attempt-quality-badge"]');
    const label = badge?.textContent ?? "";
    const qualityId = badge?.getAttribute("data-quality-id") ?? null;
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const overlayGlyph = overlay?.querySelector('[data-testid="board-move-outcome-glyph"]')?.textContent?.trim() ?? "";
    const next = document.querySelector('[data-testid="review-training-next-button"], [data-testid="review-training-finish-button"]');
    return {
      ok:
        Boolean(badge) &&
        qualityId === "critical_best" &&
        label.includes("Meilleure") &&
        Boolean(overlay) &&
        overlay?.getAttribute("data-quality-id") === "critical_best" &&
        overlayGlyph === "!" &&
        Boolean(next),
      label,
      qualityId,
      overlayQualityId: overlay?.getAttribute("data-quality-id") ?? null,
      overlayGlyph,
      nextVisible: Boolean(next),
      text: document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "",
    };
  }, 25_000);
  evidence.contract_checks.practice_best_badge = result;
  mark("practice_best_move_quality_badge", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "PRACTICE_SUCCESS_BADGE",
    state: "AFTER_BEST_MOVE",
    action: `played ${bestMove}`,
    expected: "critical best badge and continuation CTA",
    observed: "badge ! Meilleure idee visible; next/finish CTA preserved",
    pass: true,
    primaryTestId: "practice-attempt-quality-badge",
    qualityId: "critical_best",
  });
}

function reviewGlyphAnnotation(baseAnnotation = {}) {
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
    reason: "move_quality_glyph_fixture",
    win_loss: 11,
    move_accuracy: 58,
    best_move_uci: "b8c6",
    best_move_san: "Nc6",
    top_moves: [
      { uci: "b8c6", san: "Nc6", rank: 1, eval_cp: -80, pv: bestLine },
      { uci: "b8a6", san: "Na6", rank: 2, eval_cp: -30, pv: [{ uci: "b8a6", san: "Na6" }] },
      { uci: "b8d7", san: "Nd7", rank: 3, eval_cp: 50, pv: playedLine },
    ],
    try_move_supported: true,
    try_move_model_version: "try_move_v1",
    accepted_moves: [{ uci: "b8a6", san: "Na6", quality: "acceptable" }],
    acceptable_moves: [{ uci: "b8a6", san: "Na6", quality: "acceptable" }],
    accepted_moves_uci: ["b8a6"],
    stable_attempt_evaluation: {
      uci: "g8f6",
      eval_cp: 120,
      mate_in: null,
      source_kind: "fixture_stable_eval",
    },
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

function buildReviewGlyphPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = reviewGlyphAnnotation(baseAnnotation);
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
  evidence.api.review_glyph_annotation = annotation;
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

async function openReviewWithInterceptedPayload(gameId, reviewPayload) {
  await harness.startBrowser("/app");
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
    url: `${harness.frontendBaseUrl}/app?moveQualityGlyph=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review board restored with glyph payload", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-board"]')) ||
        text.includes("Review") ||
        text.includes("Analyse"),
      text,
    };
  }, 30_000);
}

async function restoreReviewStateForPractice(gameId) {
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
})();
`,
  });
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?moveQualityGlyphPractice=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review shell restored before practice", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-board"]')) ||
        Boolean(document.querySelector('[data-testid="review-focus-practice"]')) ||
        text.includes("Review") ||
        text.includes("Analyse"),
      text,
    };
  }, 30_000);
}

async function replaceReviewPayloadAndReload(gameId, reviewPayload) {
  await installReviewPayloadIntercept(gameId, reviewPayload);
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?moveQualityGlyph=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review board restored with glyph payload", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-board"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function openLessonChallenge() {
  await harness.clickByTestId("review-focus-learn", { afterMs: 700 });
  const openingState = await harness.waitForPagePredicate("lesson challenge or moment opener visible", () => {
    const challenge = document.querySelector('[data-public-lesson-step="challenge"]');
    const momentCardButton = document.querySelector('[data-testid="review-moment-card"] button');
    const exactVoirButton = [...document.querySelectorAll("button")].find(
      (button) => (button.textContent ?? "").trim() === "Voir",
    );
    return {
      ok: Boolean(challenge || momentCardButton || exactVoirButton),
      hasChallenge: Boolean(challenge),
      hasMomentCardButton: Boolean(momentCardButton),
      hasExactVoirButton: Boolean(exactVoirButton),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  if (!openingState.hasChallenge) {
    const clicked = await harness.evalPage(() => {
      const momentCardButton = document.querySelector('[data-testid="review-moment-card"] button');
      const exactVoirButton = [...document.querySelectorAll("button")].find(
        (button) => (button.textContent ?? "").trim() === "Voir",
      );
      const target = momentCardButton ?? exactVoirButton;
      if (!target) {
        return { ok: false, reason: "missing_review_moment_opener" };
      }
      target.scrollIntoView({ block: "center", inline: "center" });
      target.click();
      return { ok: true, text: target.textContent?.trim() ?? "" };
    });
    if (!clicked?.ok) {
      fail("lesson_moment_opener_click", JSON.stringify(clicked));
    }
    await delay(800);
  }
  await harness.waitForPagePredicate("lesson challenge visible", () => ({
    ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function playReviewMoveAndAssertBadge({ gameId, reviewPayload, move, expectedQualityId, scenario }) {
  await replaceReviewPayloadAndReload(gameId, reviewPayload);
  await openLessonChallenge();
  await harness.clickByText("Essayer", { exact: true, afterMs: 700 });
  await harness.tryMoveByClickClick(move, "review-board");
  const result = await harness.waitForPagePredicate("review attempt badge visible", (qualityId) => {
    const badge = document.querySelector('[data-testid="review-attempt-quality-badge"]');
    const overlay = document.querySelector('[data-testid="board-move-outcome-overlay"]');
    const root =
      document.querySelector('[data-public-lesson-step="challenge"]') ??
      document.querySelector('[data-public-lesson-step="correction"]');
    const text = root?.textContent ?? "";
    const compact = String(text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    return {
      ok:
        Boolean(badge) &&
        badge?.getAttribute("data-quality-id") === qualityId &&
        Boolean(overlay) &&
        overlay?.getAttribute("data-quality-id") === qualityId &&
        !compact.includes("apres le coup joue"),
      qualityId: badge?.getAttribute("data-quality-id") ?? null,
      overlayQualityId: overlay?.getAttribute("data-quality-id") ?? null,
      overlaySquare: overlay?.getAttribute("data-square") ?? null,
      label: badge?.textContent ?? "",
      compact,
      text,
    };
  }, 30_000, expectedQualityId);
  evidence.contract_checks[scenario] = result;
  mark(`review_${scenario}_quality_badge`, "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario,
    state: `AFTER_MOVE_${move}`,
    action: `played ${move}`,
    expected: `${expectedQualityId} badge after current attempt`,
    observed: `review attempt badge ${expectedQualityId} visible`,
    pass: true,
    primaryTestId: "review-attempt-quality-badge",
    qualityId: expectedQualityId,
  });
}

async function assertLineComparisonStillStable(gameId, reviewPayload) {
  await replaceReviewPayloadAndReload(gameId, reviewPayload);
  await openLessonChallenge();
  await harness.clickByText("Voir la correction", { exact: true, afterMs: 800 });
  await harness.clickByText("Voir la ligne", { exact: true, afterMs: 800 });
  const result = await harness.waitForPagePredicate("line comparison stable with glyph system", () => {
    const details = document.querySelector(".review-line-comparison-disclosure");
    const text = details?.textContent ?? "";
    return {
      ok:
        Boolean(details?.open) &&
        text.includes("Comparer les lignes") &&
        Boolean(document.querySelector('[data-testid="review-line-game-play-button"]')) &&
        Boolean(document.querySelector('[data-testid="review-line-solution-play-button"]')),
      text,
    };
  }, 20_000);
  evidence.contract_checks.line_comparison = result;
  mark("line_comparison_not_broken_by_badges", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "LINE_COMPARISON",
    state: "AFTER_OPEN_COMPARER_LIGNES",
    action: "opened line comparison",
    expected: "line player actions remain stable",
    observed: "line comparison buttons remain visible and enabled by line availability",
    pass: true,
    primaryTestId: "review-line-game-play-button",
  });
}

async function assertMobileBadgeReadable() {
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const result = await harness.waitForPagePredicate("mobile badge readable", () => {
    const badge = document.querySelector('[data-testid="review-attempt-quality-badge"]');
    const rect = badge?.getBoundingClientRect();
    return {
      ok: Boolean(rect) && rect.width > 48 && rect.right <= window.innerWidth + 1,
      width: rect?.width ?? null,
      right: rect?.right ?? null,
      viewportWidth: window.innerWidth,
      text: badge?.textContent ?? "",
    };
  }, 10_000);
  evidence.contract_checks.mobile_badge_readable = result;
  mark("mobile_badge_readable_no_overflow", "pass", JSON.stringify(result));
  await captureContractScreenshot({
    scenario: "MOBILE_VIEWPORT",
    state: "FEEDBACK_BADGE_VISIBLE",
    action: "set 390px viewport",
    expected: "badge readable without overflow",
    observed: "badge fits narrow viewport",
    pass: true,
    primaryTestId: "review-attempt-quality-badge",
    qualityId: result.text ? "wrong" : null,
  });
  await harness.browserClient.send("Emulation.clearDeviceMetricsOverride");
}

async function main() {
  harness.writeEvidence();
  evidence.api.head_commit = gitShortHead();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness);
  evidence.api.game_id = gameId;
  const reviewPayload = buildReviewGlyphPayload(review);
  await openReviewWithInterceptedPayload(gameId, reviewPayload);
  await playReviewMoveAndAssertBadge({
    gameId,
    reviewPayload,
    move: "b8a6",
    expectedQualityId: "good",
    scenario: "REVIEW_ACCEPTED_BADGE",
  });
  await playReviewMoveAndAssertBadge({
    gameId,
    reviewPayload,
    move: "g8f6",
    expectedQualityId: "wrong",
    scenario: "REVIEW_WRONG_BADGE",
  });
  await assertMobileBadgeReadable();
  await assertLineComparisonStillStable(gameId, reviewPayload);

  await restoreReviewStateForPractice(gameId);
  const session = await openPracticeFromReview(gameId);
  await assertNoSpoilerBeforePracticeAttempt();
  await playPracticeBestAndAssertBadge(session);

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
  console.log("BROWSER_MOVE_QUALITY_GLYPH_FEEDBACK_SMOKE PASS");
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
          primaryTestId: "move-quality-badge",
        });
      } catch {
        await harness.captureScreenshot("browser_move_quality_glyph_feedback_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_MOVE_QUALITY_GLYPH_FEEDBACK_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
