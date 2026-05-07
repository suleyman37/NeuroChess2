#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  fetchJson,
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-CARD-QUALITY-RIBBON-AND-MOVE-TIMELINE-V1";
const MISSION_ID = "P1_REVIEW_DECISION_CARD_QUALITY_RIBBON_AND_MOVE_TIMELINE_V1";
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

for (const dir of [
  SCREENSHOT_RAW_DIR,
  path.join(QA_DIR, "screenshots_annotated"),
  path.join(QA_DIR, "contact_sheets"),
  BROWSER_EVIDENCE_DIR,
  CONSOLE_DIR,
  NETWORK_DIR,
  API_DIR,
]) {
  cleanGeneratedDirectory(dir);
}

function cleanGeneratedDirectory(dir) {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "full_validation_logs") {
      continue;
    }
    rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

const evidence = createEvidence(
  MISSION,
  "browser_review_decision_card_quality_ribbon_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_decision_card_quality_ribbon_evidence.json",
);
evidence.strategy =
  "temp backend DB + seeded Review moment + real Summary/Learn/Explorer/Practice interactions + viewport geometry checks";
evidence.contract_checks = {};
evidence.screenshots = [];

const manifest = {
  mission: MISSION,
  mission_id: MISSION_ID,
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
  )}__${safeFileToken("REVIEW_DECISION")}__${safeFileToken(
    scenario,
  )}__${safeFileToken(state)}__ACTION_${safeFileToken(
    action,
  )}__EXPECT_${safeFileToken(expected)}__${pass ? "PASS" : "FAIL"}.png`;
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

async function visibleContractSnapshot() {
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
    const visible = (selector) => {
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
    const countVisible = (selector) =>
      [...document.querySelectorAll(selector)].filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth
        );
      }).length;
    const legend = document.querySelector('[data-testid="review-quality-legend"]');
    const ribbon = document.querySelector('[data-testid="review-quality-ribbon"]');
    const ribbonRect = ribbon?.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflowX:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      summary: visible('[data-testid="review-summary"]'),
      decisionCard: visible('[data-testid="review-decision-card"]'),
      historicalRow: visible('[data-testid="review-decision-card-historical-row"]'),
      bestRow: visible('[data-testid="review-decision-card-best-row"]'),
      attemptRow: visible('[data-testid="review-decision-card-attempt-row"]'),
      historicalBadgeCount: countVisible('[data-testid="historical-move-quality-badge"]'),
      currentAttemptBadgeCount: countVisible('[data-testid="current-attempt-quality-badge"]'),
      bestIdeaBadgeCount: countVisible('[data-testid="best-idea-quality-badge"]'),
      ribbon: visible('[data-testid="review-quality-ribbon"]'),
      ribbonItemCount: countVisible('[data-testid="review-quality-ribbon-item"]'),
      ribbonBadgeCount: countVisible('[data-testid="review-quality-ribbon-badge"]'),
      ribbonWithinViewport: ribbonRect
        ? ribbonRect.left >= -2 && ribbonRect.right <= window.innerWidth + 2
        : false,
      legendOpen: Boolean(legend?.hasAttribute("open")),
      legendItemCount: document.querySelectorAll('[data-testid="review-quality-legend-item"]').length,
      legendText: legend?.textContent ?? "",
      board: visible('[data-testid="practice-board"]') || visible('[data-testid="review-board"]'),
      overlay: visible('[data-testid="board-move-outcome-overlay"]'),
      primaryNext: visible('[data-testid="review-training-next-button"]'),
      primaryFinish: visible('[data-testid="review-training-finish-button"]'),
      primaryRetry: visible('[data-testid="review-training-retry-button"]'),
      explorer: visible(".review-laboratory"),
      currentFocus:
        [...document.querySelectorAll('[data-testid^="review-focus-"]')]
          .find((button) => button.getAttribute("aria-selected") === "true")
          ?.getAttribute("data-testid") ?? null,
      visibleText: document.body?.innerText ?? "",
    };
  });
}

async function assertSummaryDecisionAndRibbon() {
  await harness.setViewport({ width: 1440, height: 860 });
  await harness.evalPage(() => {
    window.scrollTo(0, 0);
    return { ok: true };
  });
  const snapshot = await harness.waitForPagePredicate("summary decision and ribbon", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    const ribbon = document.querySelector('[data-testid="review-quality-ribbon"]');
    const ribbonRect = ribbon?.getBoundingClientRect();
    const ribbonWithinViewport =
      ribbonRect && ribbonRect.left >= -2 && ribbonRect.right <= window.innerWidth + 2;
    return {
      ok:
        visible('[data-testid="review-summary"]') &&
        visible('[data-testid="review-decision-card"]') &&
        visible('[data-testid="review-decision-card-historical-row"]') &&
        visible('[data-testid="historical-move-quality-badge"]') &&
        visible('[data-testid="review-quality-ribbon"]') &&
        visible('[data-testid="review-quality-ribbon-item"]') &&
        visible('[data-testid="review-quality-ribbon-badge"]') &&
        Boolean(ribbonWithinViewport),
      ribbonWithinViewport: Boolean(ribbonWithinViewport),
      ribbonText: ribbon?.textContent?.trim() ?? "",
    };
  }, 30_000);
  evidence.contract_checks.summary = snapshot;
  await captureContractScreenshot({
    scenario: "SUMMARY_HISTORICAL_BADGE",
    state: "REVIEW_OPEN",
    action: "opened Summary",
    expected: "Resume shows historical badge and compact quality ribbon",
    observed: `ribbonWithinViewport=${snapshot.ribbonWithinViewport}`,
    pass: true,
    primaryTestId: "review-quality-ribbon",
  });
}

async function assertLegend() {
  const before = await visibleContractSnapshot();
  if (!before.ribbon || !before.decisionCard || before.legendOpen) {
    fail("legend_collapsed_by_default", JSON.stringify(before));
  }
  mark("legend_collapsed_by_default", "pass", "details open=false");
  await harness.clickByTestId("review-quality-legend-toggle", { afterMs: 500 });
  const after = await harness.waitForPagePredicate("quality legend opened", () => {
    const legend = document.querySelector('[data-testid="review-quality-legend"]');
    const text = legend?.textContent ?? "";
    return {
      ok:
        Boolean(legend?.hasAttribute("open")) &&
        document.querySelectorAll('[data-testid="review-quality-legend-item"]').length >= 7 &&
        !/brilliant|genius/i.test(text),
      open: Boolean(legend?.hasAttribute("open")),
      itemCount: document.querySelectorAll('[data-testid="review-quality-legend-item"]').length,
      text,
    };
  }, 10_000);
  evidence.contract_checks.legend = after;
  await captureContractScreenshot({
    scenario: "SYMBOL_LEGEND",
    state: "OPEN",
    action: "opened Comprendre les symboles",
    expected: "legend opens with compact symbols and no brilliant/genius copy",
    observed: `items=${after.itemCount}, open=${after.open}`,
    pass: true,
    primaryTestId: "review-quality-legend",
  });
}

async function assertLearnDecisionCard() {
  await harness.clickByTestId("review-focus-learn", { afterMs: 800 });
  const challenge = await harness.waitForPagePredicate("learn decision card without spoiler", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible('[data-testid="review-decision-card"]') &&
        visible('[data-testid="review-decision-card-historical-row"]') &&
        !document.querySelector('[data-testid="review-decision-card-attempt-row"]') &&
        !document.querySelector('[data-testid="review-decision-card-best-row"]'),
      text: document.body?.innerText ?? "",
    };
  }, 20_000);
  evidence.contract_checks.learn_before_correction = challenge;
  await captureContractScreenshot({
    scenario: "LEARN_DECISION_CARD",
    state: "BEFORE_CORRECTION",
    action: "opened Apprendre",
    expected: "Decision Card shows historical row and hides best/attempt rows",
    observed: "historical row visible; best and attempt rows absent",
    pass: true,
    primaryTestId: "review-decision-card",
  });

  await harness.clickByText("correction", { exact: false, afterMs: 800 });
  const correction = await harness.waitForPagePredicate("learn correction best row allowed", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible('[data-testid="review-decision-card"]') &&
        visible('[data-testid="review-decision-card-historical-row"]') &&
        visible('[data-testid="review-decision-card-best-row"]') &&
        visible('[data-testid="best-idea-quality-badge"]') &&
        !document.querySelector('[data-testid="review-decision-card-attempt-row"]'),
      text: document.body?.innerText ?? "",
    };
  }, 20_000);
  evidence.contract_checks.learn_after_correction = correction;
  mark("learn_decision_card_contract", "pass", "historical visible, best only after correction, attempt absent");
  await captureContractScreenshot({
    scenario: "LEARN_DECISION_CARD",
    state: "CORRECTION",
    action: "clicked correction",
    expected: "best idea row appears only in correction context",
    observed: "best row and best-idea badge visible; attempt row absent",
    pass: true,
    primaryTestId: "review-decision-card-best-row",
  });
}

async function assertExplorerHistoricalBadge() {
  await harness.clickByTestId("review-focus-lab", { afterMs: 800 });
  const explorer = await harness.waitForPagePredicate("explorer historical badge", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible(".review-laboratory") &&
        visible('[data-testid="historical-move-quality-badge"]') &&
        !document.querySelector('[data-testid="current-attempt-quality-badge"]'),
      text: document.body?.innerText ?? "",
    };
  }, 20_000);
  evidence.contract_checks.explorer = explorer;
  await captureContractScreenshot({
    scenario: "EXPLORER_HISTORICAL_BADGE",
    state: "LAB_OPEN",
    action: "opened Explorer",
    expected: "historical selected moment badge visible and no attempt classification",
    observed: "historical badge visible; current attempt badge absent",
    pass: true,
    primaryTestId: "historical-move-quality-badge",
  });
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
  await harness.waitForPagePredicate("review POV selector ready for practice", () => ({
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
    mark("review_pov_both_for_practice", "pass", current.label);
    return;
  }
  await harness.clickByTestId("review-analyzed-player-change-button", { afterMs: 300 });
  await harness.clickByTestId("review-analyzed-player-option-both", { afterMs: 700 });
  const selected = await harness.waitForPagePredicate("review POV both selected for practice", () => {
    const label =
      document
        .querySelector('[data-testid="review-analyzed-player-current"]')
        ?.textContent?.trim() ?? "";
    return { ok: label.includes("Les deux"), label };
  }, 10_000);
  mark("review_pov_both_for_practice", "pass", selected.label);
}

async function openPracticeFromReview(gameId) {
  await switchReviewPovToBothForPractice();
  await harness.clickByTestId("review-focus-practice", { afterMs: 700 });
  await harness.waitForPagePredicate("practice launch ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-practice-button"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  await harness.waitForPagePredicate("practice panel visible", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-decision-card"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  const session = await latestSessionForGame(gameId);
  if (!Array.isArray(session.items) || session.items.length < 1) {
    fail("practice_items_available", JSON.stringify(session));
  }
  evidence.api.practice_session_id = session.session_id;
  evidence.api.practice_item_count = session.items.length;
  writeJson(path.join(API_DIR, "practice_session_initial.json"), session);
  mark("review_practice_opened", "pass", `session_id=${session.session_id}`);
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

async function assertPracticeBeforeAttempt(gameId) {
  const session = await openPracticeFromReview(gameId);
  const before = await harness.waitForPagePredicate("practice before attempt no spoiler", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-decision-card"]') &&
        visible('[data-testid="review-decision-card-historical-row"]') &&
        !document.querySelector('[data-testid="review-decision-card-attempt-row"]') &&
        !document.querySelector('[data-testid="current-attempt-quality-badge"]') &&
        !document.querySelector('[data-testid="review-decision-card-best-row"]'),
      text: document.body?.innerText ?? "",
    };
  }, 20_000);
  evidence.contract_checks.practice_before_attempt = before;
  await captureContractScreenshot({
    scenario: "PRACTICE_BEFORE_ATTEMPT",
    state: "NO_ATTEMPT",
    action: "opened S'entrainer",
    expected: "no current attempt badge and no best move spoiler before attempt",
    observed: "historical row visible; best and attempt rows absent",
    pass: true,
    primaryTestId: "practice-board",
  });
  return session;
}

async function assertPracticeAfterAttempt(bestMoveUci) {
  await submitPracticeMoveWithFallback(bestMoveUci);
  const after = await harness.waitForPagePredicate("practice attempt decision feedback", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(
        rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight,
      );
    };
    return {
      ok:
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-training-feedback"]') &&
        visible('[data-testid="review-decision-card-attempt-row"]') &&
        visible('[data-testid="current-attempt-quality-badge"]') &&
        visible('[data-testid="board-move-outcome-overlay"]') &&
        (visible('[data-testid="review-training-next-button"]') ||
          visible('[data-testid="review-training-finish-button"]') ||
          visible('[data-testid="review-training-retry-button"]')),
      next: visible('[data-testid="review-training-next-button"]'),
      finish: visible('[data-testid="review-training-finish-button"]'),
      retry: visible('[data-testid="review-training-retry-button"]'),
      text: document.body?.innerText ?? "",
    };
  }, 25_000);
  evidence.contract_checks.practice_after_attempt = after;
  await captureContractScreenshot({
    scenario: "PRACTICE_AFTER_ATTEMPT",
    state: `AFTER_${bestMoveUci}`,
    action: `played ${bestMoveUci}`,
    expected: "attempt badge, board overlay, feedback, and primary CTA visible together",
    observed: `next=${after.next}, finish=${after.finish}, retry=${after.retry}`,
    pass: true,
    primaryTestId: "current-attempt-quality-badge",
  });
}

async function assertMobileNarrowSafe() {
  await harness.setViewport({ width: 390, height: 844, mobile: true });
  await harness.evalPage(() => {
    document.querySelector('[data-testid="review-decision-card"]')?.scrollIntoView({
      block: "center",
      inline: "center",
    });
    return { ok: true };
  });
  await harness.assertNoHorizontalOverflow("mobile_decision_ribbon_no_horizontal_overflow", [
    "html",
    "body",
    '[data-testid="app-root"]',
    '[data-testid="practice-board"]',
    '[data-testid="review-decision-card"]',
    '[data-testid="review-quality-ribbon"]',
    '[data-testid="review-quality-legend"]',
  ]);
  const mobile = await harness.waitForPagePredicate("mobile decision badge readable", () => {
    const badge =
      document.querySelector('[data-testid="current-attempt-quality-badge"]') ??
      document.querySelector('[data-testid="historical-move-quality-badge"]');
    const card = document.querySelector('[data-testid="review-decision-card"]');
    const badgeRect = badge?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const cta =
      document.querySelector('[data-testid="review-training-next-button"]') ??
      document.querySelector('[data-testid="review-training-finish-button"]') ??
      document.querySelector('[data-testid="review-training-retry-button"]');
    const ctaRect = cta?.getBoundingClientRect();
    return {
      ok:
        Boolean(cardRect) &&
        Boolean(badgeRect) &&
        badgeRect.width >= 18 &&
        badgeRect.height >= 18 &&
        Boolean(ctaRect) &&
        ctaRect.width > 0 &&
        ctaRect.height > 0,
      badgeWidth: badgeRect ? Math.round(badgeRect.width) : null,
      badgeHeight: badgeRect ? Math.round(badgeRect.height) : null,
      ctaVisible: Boolean(ctaRect),
    };
  }, 15_000);
  evidence.contract_checks.mobile = mobile;
  await captureContractScreenshot({
    scenario: "MOBILE_NARROW",
    state: "PRACTICE_FEEDBACK",
    action: "set 390px viewport",
    expected: "decision card, badge, and CTA stay readable with no horizontal overflow",
    observed: `badge=${mobile.badgeWidth}x${mobile.badgeHeight}, ctaVisible=${mobile.ctaVisible}`,
    pass: true,
    primaryTestId: "review-decision-card",
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
  evidence.api.review_annotation_count = review.move_annotations?.length ?? null;
  writeJson(path.join(API_DIR, "review_decision_card_fixture.json"), review);
  await openReviewFromPersistedState(harness, gameId);
  await assertSummaryDecisionAndRibbon();
  await assertLegend();
  await assertLearnDecisionCard();
  await assertExplorerHistoricalBadge();
  const session = await assertPracticeBeforeAttempt(gameId);
  const firstItem = session.items[0] ?? null;
  const bestMove = firstItem?.best_move_uci ?? firstItem?.expected_best_uci ?? null;
  if (!bestMove) {
    fail("practice_best_move_available", JSON.stringify(firstItem));
  }
  evidence.api.practice_best_move_for_attempt = bestMove;
  await assertPracticeAfterAttempt(bestMove);
  await assertMobileNarrowSafe();
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
  console.log("BROWSER_REVIEW_DECISION_CARD_QUALITY_RIBBON_SMOKE PASS");
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
        await harness.captureScreenshot("browser_review_decision_card_quality_ribbon_failure");
      }
    }
    writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
      console: evidence.browser_errors.console,
      page: evidence.browser_errors.page,
    });
    writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_DECISION_CARD_QUALITY_RIBBON_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
