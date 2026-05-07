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

const MISSION = "P1.REVIEW-MOMENT-SELECTION-INTELLIGENCE-V1";
const MISSION_ID = "P1_REVIEW_MOMENT_SELECTION_INTELLIGENCE_V1";
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
    rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

const evidence = createEvidence(
  MISSION,
  "browser_review_moment_selection_intelligence_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_moment_selection_intelligence_evidence.json",
);
evidence.strategy =
  "temp backend DB + fake engine Review fixture + real Summary/Practice/Explorer UI + API category contract checks";
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
  )}__${safeFileToken("REVIEW_MOMENT_INTELLIGENCE")}__${safeFileToken(
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

function reviewCategorySnapshot(review) {
  const sections = review.review_sections ?? {};
  const annotations = Array.isArray(review.move_annotations) ? review.move_annotations : [];
  const byImportance = annotations.reduce((acc, annotation) => {
    const key = annotation.moment_importance ?? "missing";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return {
    annotation_count: annotations.length,
    by_importance: byImportance,
    section_counts: {
      priority_training: sections.priority_training?.length ?? 0,
      secondary_training: sections.secondary_training?.length ?? 0,
      micro_gaps: sections.micro_gaps?.length ?? 0,
      good_decisions: sections.good_decisions?.length ?? 0,
      informational: sections.informational?.length ?? 0,
      to_review: sections.to_review?.length ?? 0,
      all: sections.all?.length ?? 0,
    },
    summary: review.moment_selection_summary ?? null,
  };
}

function assertApiCategoryContract(review) {
  const snapshot = reviewCategorySnapshot(review);
  evidence.api.category_snapshot = snapshot;
  if (!review.review_moment_importance_version) {
    fail("api_importance_version_present", JSON.stringify(snapshot));
  }
  mark("api_importance_version_present", "pass", review.review_moment_importance_version);
  if (!snapshot.summary) {
    fail("api_moment_selection_summary_present", JSON.stringify(snapshot));
  }
  mark("api_moment_selection_summary_present", "pass", JSON.stringify(snapshot.summary));
  if (snapshot.annotation_count < 1) {
    fail("api_annotations_available", JSON.stringify(snapshot));
  }
  if (snapshot.by_importance.missing) {
    fail("api_every_annotation_has_importance", JSON.stringify(snapshot));
  }
  mark("api_every_annotation_has_importance", "pass", JSON.stringify(snapshot.by_importance));
  if (snapshot.section_counts.priority_training < 1 && !snapshot.summary?.no_major_moment) {
    fail("api_priority_or_no_major_state", JSON.stringify(snapshot));
  }
  mark("api_priority_or_no_major_state", "pass", JSON.stringify(snapshot.section_counts));
  return snapshot;
}

async function assertNoRawMetricsVisible(stage) {
  const visible = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const forbidden = [
      "criticality_score",
      "diagnostic_gap",
      "raw WDL",
      "stockfish wdl",
      "win_loss",
      "ETV",
      "FSRS",
      "Transfer Gap",
    ];
    return forbidden.filter((label) => text.toLowerCase().includes(label.toLowerCase()));
  });
  if (visible.length) {
    fail(stage, `raw/internal labels visible: ${visible.join(", ")}`);
  }
  mark(stage, "pass", "no raw metric labels visible");
}

async function assertSummaryMomentIntelligence(categorySnapshot) {
  await harness.setViewport({ width: 1440, height: 860 });
  await harness.evalPage(() => {
    window.scrollTo(0, 0);
    return { ok: true };
  });
  const summary = await harness.waitForPagePredicate(
    "summary moment intelligence labels",
    (expected) => {
      const visible = (selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return Boolean(rect && rect.width > 0 && rect.height > 0);
      };
      const text = document.body?.innerText ?? "";
      const lowerText = text.toLowerCase();
      const wantsPriority = expected.priority > 0;
      const wantsMicro = expected.micro > 0;
      const wantsGood = expected.good > 0;
      const wantsNoMajor = Boolean(expected.noMajor);
      return {
        ok:
          visible('[data-testid="review-summary"]') &&
          visible('[data-testid="review-decision-card"]') &&
          lowerText.includes("pourquoi ce moment") &&
          (!wantsPriority || text.includes("Moment prioritaire")) &&
          (!wantsMicro || text.includes("Micro-écart")) &&
          (!wantsGood || text.includes("Bonne décision") || text.includes("Bonnes décisions")) &&
          (!wantsNoMajor || text.includes("Aucun moment prioritaire")),
        text,
        priorityVisible: text.includes("Moment prioritaire"),
        microVisible: text.includes("Micro-écart"),
        goodVisible: text.includes("Bonne décision") || text.includes("Bonnes décisions"),
        noMajorVisible: text.includes("Aucun moment prioritaire"),
      };
    },
    30_000,
    {
      priority: categorySnapshot.section_counts.priority_training,
      micro: categorySnapshot.section_counts.micro_gaps,
      good: categorySnapshot.section_counts.good_decisions,
      noMajor: categorySnapshot.summary?.no_major_moment,
    },
  );
  evidence.contract_checks.summary_moment_intelligence = {
    ...summary,
    text: summary.text.slice(0, 6000),
  };
  await assertNoRawMetricsVisible("summary_no_raw_metrics_visible");
  await captureContractScreenshot({
    scenario: "SUMMARY_GROUPED_MOMENTS",
    state: "REVIEW_OPEN",
    action: "opened Summary",
    expected: "grouped Review summary shows moment category and Pourquoi ce moment",
    observed: `priority=${summary.priorityVisible}, micro=${summary.microVisible}, good=${summary.goodVisible}, noMajor=${summary.noMajorVisible}`,
    pass: true,
    primaryTestId: "review-summary",
  });
  if (categorySnapshot.section_counts.priority_training > 0) {
    await captureContractScreenshot({
      scenario: "PRIORITY_MOMENT_WHY",
      state: "VISIBLE",
      action: "verified priority category",
      expected: "priority moment label appears with Pourquoi ce moment",
      observed: "Moment prioritaire visible",
      pass: true,
      primaryTestId: "review-decision-card",
    });
  }
  if (categorySnapshot.section_counts.micro_gaps > 0) {
    await captureContractScreenshot({
      scenario: "MICRO_GAP_VISIBLE",
      state: "SUPPORTED_BY_FIXTURE",
      action: "verified micro-gap group",
      expected: "micro-gap is displayed as a reviewed observation",
      observed: "Micro-écart visible",
      pass: true,
      primaryTestId: "review-summary",
    });
  }
  if (categorySnapshot.section_counts.good_decisions > 0) {
    await captureContractScreenshot({
      scenario: "GOOD_DECISION_VISIBLE",
      state: "SUPPORTED_BY_FIXTURE",
      action: "verified good decision group",
      expected: "good decision is displayed when backend provides it",
      observed: "Bonne décision visible",
      pass: true,
      primaryTestId: "review-summary",
    });
  }
  if (categorySnapshot.summary?.no_major_moment) {
    await captureContractScreenshot({
      scenario: "NO_MAJOR_MOMENT_STATE",
      state: "SUPPORTED_BY_FIXTURE",
      action: "verified no-priority empty state",
      expected: "clean/high-accuracy state does not fake a forced challenge",
      observed: "Aucun moment prioritaire visible",
      pass: true,
      primaryTestId: "review-summary",
    });
  }
}

async function switchReviewPovToBothIfNeeded() {
  await harness.setViewport({ width: 1440, height: 860 });
  await harness.waitForPagePredicate("review POV selector ready", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-analyzed-player-current"]')) &&
      Boolean(document.querySelector('[data-testid="review-analyzed-player-change-button"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  const current = await harness.evalPage(() => ({
    label:
      document
        .querySelector('[data-testid="review-analyzed-player-current"]')
        ?.textContent?.trim() ?? "",
  }));
  if (current.label.includes("Les deux")) {
    mark("review_pov_both_selected", "pass", current.label);
    return;
  }
  await harness.clickByTestId("review-analyzed-player-change-button", { afterMs: 300 });
  await harness.clickByTestId("review-analyzed-player-option-both", { afterMs: 700 });
  const selected = await harness.waitForPagePredicate("review POV both selected", () => {
    const label =
      document
        .querySelector('[data-testid="review-analyzed-player-current"]')
        ?.textContent?.trim() ?? "";
    return { ok: label.includes("Les deux"), label };
  }, 10_000);
  mark("review_pov_both_selected", "pass", selected.label);
}

async function assertExplorerHistoricalCategory(categorySnapshot) {
  await harness.clickByTestId("review-focus-lab", { afterMs: 900 });
  const explorer = await harness.waitForPagePredicate("explorer category label", () => {
    const text = document.body?.innerText ?? "";
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible(".review-laboratory") &&
        (text.includes("Moment prioritaire") ||
          text.includes("Moment secondaire") ||
          text.includes("Micro-écart") ||
          text.includes("Bonne décision") ||
          text.includes("Observation")) &&
        !document.querySelector('[data-testid="current-attempt-quality-badge"]'),
      text,
    };
  }, 20_000);
  evidence.contract_checks.explorer_historical_category = {
    ...explorer,
    text: explorer.text.slice(0, 6000),
  };
  await assertNoRawMetricsVisible("explorer_no_raw_metrics_visible");
  await captureContractScreenshot({
    scenario: "EXPLORER_HISTORICAL_CATEGORY",
    state: "EXPLORER_OPEN",
    action: "opened Explorer",
    expected: "Explorer shows selected historical category without attempt classification",
    observed: `sections=${JSON.stringify(categorySnapshot.section_counts)}`,
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

async function assertPracticeFiltersNonTrainingMoments(gameId, categorySnapshot) {
  if (categorySnapshot.section_counts.priority_training < 1) {
    mark(
      "practice_filter_non_training_moments",
      "skip",
      "fixture has no priority item, so Practice is unavailable by design",
    );
    return;
  }
  await harness.clickByTestId("review-focus-practice", { afterMs: 800 });
  await harness.waitForPagePredicate("practice start available", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-practice-button"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  await harness.waitForPagePredicate("practice opened before attempt", () => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0);
    };
    return {
      ok:
        visible('[data-testid="practice-panel"]') &&
        visible('[data-testid="practice-board"]') &&
        visible('[data-testid="review-decision-card"]') &&
        !document.querySelector('[data-testid="current-attempt-quality-badge"]') &&
        !document.querySelector('[data-testid="review-decision-card-best-row"]'),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  const session = await latestSessionForGame(gameId);
  const items = Array.isArray(session.items) ? session.items : [];
  const forcedNonTraining = items.filter(
    (item) =>
      item.is_training_recommended === false ||
      item.is_micro_gap ||
      item.is_good_decision ||
      ["micro_gap", "good_decision", "informational"].includes(item.moment_importance),
  );
  if (forcedNonTraining.length) {
    fail("practice_filter_non_training_moments", JSON.stringify(forcedNonTraining));
  }
  evidence.contract_checks.practice_filter_non_training_moments = {
    item_count: items.length,
    unsupported_micro_fixture: categorySnapshot.section_counts.micro_gaps === 0,
    unsupported_good_fixture: categorySnapshot.section_counts.good_decisions === 0,
  };
  mark(
    "practice_filter_non_training_moments",
    "pass",
    `items=${items.length}; non-training forced=0`,
  );
  await assertNoRawMetricsVisible("practice_no_raw_metrics_visible");
  await captureContractScreenshot({
    scenario: "PRACTICE_BEFORE_ATTEMPT",
    state: "NO_SPOILER",
    action: "opened S'entrainer",
    expected: "Practice opens only training-recommended moments and hides attempt/best rows before move",
    observed: `practice_items=${items.length}, forced_non_training=0`,
    pass: true,
    primaryTestId: "practice-panel",
  });
}

async function assertMobileSummarySafe() {
  await harness.clickByTestId("review-focus-summary", { afterMs: 600 });
  await harness.setViewport({ width: 390, height: 844, mobile: true });
  await harness.evalPage(() => {
    document.querySelector('[data-testid="review-decision-card"]')?.scrollIntoView({
      block: "center",
      inline: "center",
    });
    return { ok: true };
  });
  await harness.assertNoHorizontalOverflow("mobile_moment_intelligence_no_horizontal_overflow", [
    "html",
    "body",
    '[data-testid="app-root"]',
    '[data-testid="review-summary"]',
    '[data-testid="review-decision-card"]',
    '[data-testid="review-quality-ribbon"]',
  ]);
  const mobile = await harness.waitForPagePredicate("mobile moment category readable", () => {
    const card = document.querySelector('[data-testid="review-decision-card"]');
    const cardRect = card?.getBoundingClientRect();
    const text = document.body?.innerText ?? "";
    return {
      ok: Boolean(cardRect) && text.toLowerCase().includes("pourquoi ce moment"),
      cardWidth: cardRect ? Math.round(cardRect.width) : null,
      text: text.slice(0, 1600),
    };
  }, 15_000);
  evidence.contract_checks.mobile_summary = mobile;
  await captureContractScreenshot({
    scenario: "MOBILE_SUMMARY",
    state: "NARROW_VIEWPORT",
    action: "set 390px viewport",
    expected: "moment category and Pourquoi ce moment remain readable without overflow",
    observed: `cardWidth=${mobile.cardWidth}`,
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
  writeJson(path.join(API_DIR, "review_moment_selection_fixture.json"), review);
  const categorySnapshot = assertApiCategoryContract(review);
  await openReviewFromPersistedState(harness, gameId);
  await switchReviewPovToBothIfNeeded();
  await assertSummaryMomentIntelligence(categorySnapshot);
  await assertExplorerHistoricalCategory(categorySnapshot);
  await assertPracticeFiltersNonTrainingMoments(gameId, categorySnapshot);
  await assertMobileSummarySafe();
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
  console.log("BROWSER_REVIEW_MOMENT_SELECTION_INTELLIGENCE_SMOKE PASS");
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
        await harness.captureScreenshot("browser_review_moment_selection_intelligence_failure");
      }
    }
    writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
      console: evidence.browser_errors.console,
      page: evidence.browser_errors.page,
    });
    writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_MOMENT_SELECTION_INTELLIGENCE_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
