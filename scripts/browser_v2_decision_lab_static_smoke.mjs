#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots_raw");
const EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_v2_decision_lab_static_smoke.json");
evidence.output_path = path.join(EVIDENCE_DIR, "browser_v2_decision_lab_static_smoke.json");
evidence.strategy = "polished static DEV-only Review V2 prototype + fake data + Vite + Edge CDP";
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);
let screenshotIndex = 0;

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function capture(name) {
  screenshotIndex += 1;
  const filename = `${String(screenshotIndex).padStart(2, "0")}_${name}_1366x768.png`;
  const screenshotPath = path.join(SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport: "1366x768" });
  harness.writeEvidence();
  return screenshotPath;
}

async function openDecisionLab() {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app#/v2-review-lab`,
  });
  await harness.waitForPagePredicate("Decision Lab route", () => ({
    ok: Boolean(document.querySelector('[data-testid="decision-lab-shell"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
}

async function assertNoLegacy(stage) {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const forbidden = [
      "review coach",
      "score coach",
      "exploration locale",
      "criticality_score",
      "diagnostic_gap",
      "stockfish wdl",
      "candidate trainer",
      "llm coach",
      "transfer gap",
      "fsrs",
      "etv",
      "skilltrace",
    ].filter((label) => normalized.includes(label));
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) fail(stage, JSON.stringify(result.forbidden));
  mark(stage, "pass", "no legacy dashboard or forbidden metric labels");
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.loadApp();

    const defaultState = await harness.evalPage(() => ({
      ok:
        !document.querySelector('[data-testid="decision-lab-shell"]') &&
        Boolean(document.querySelector('[data-testid="main-nav"]')),
      text: document.body?.innerText ?? "",
    }));
    if (!defaultState.ok) fail("v1_default_unchanged", JSON.stringify(defaultState));
    mark("v1_default_unchanged", "pass", "Decision Lab hidden unless hash/query is explicit");

    await openDecisionLab();
    await capture("summary");

    const layout = await harness.evalPage(() => {
      const board = document.querySelector('[data-testid="decision-lab-board"]')?.getBoundingClientRect();
      const path = document.querySelector('[data-testid="decision-lab-path"]')?.getBoundingClientRect();
      const card = document.querySelector('[data-testid="decision-lab-card"]')?.getBoundingClientRect();
      const actions = document.querySelector('[data-testid="decision-lab-actions"]')?.getBoundingClientRect();
      const primaryCount = [...document.querySelectorAll('[data-testid="decision-lab-primary-action"]')]
        .filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        }).length;
      return {
        ok:
          Boolean(board && path && card && actions) &&
          primaryCount === 1 &&
          board.width >= 360 &&
          board.left > path.right &&
          card.left > board.right - 20,
        board,
        path,
        card,
        actions,
        primaryCount,
      };
    });
    if (!layout.ok) fail("decision_lab_layout", JSON.stringify(layout));
    mark("decision_lab_layout", "pass", "board central + path/card/dock + one primary action");

    for (const [mode, expectedLeftTitle] of [
      ["summary", "Moments clés"],
      ["learn", "Repères"],
      ["replay", "File de reprise"],
      ["explore", "Branche locale"],
    ]) {
      await harness.clickByTestId(`decision-lab-mode-${mode}`, { afterMs: 250 });
      const result = await harness.evalPage((expected) => {
        const card = document.querySelector('[data-testid="decision-lab-card"]');
        const leftTitle = document.querySelector('[data-testid="decision-lab-left-title"]')?.textContent?.trim();
        return {
          ok: card?.getAttribute("data-mode") === expected.mode && leftTitle === expected.leftTitle,
          mode: card?.getAttribute("data-mode"),
          leftTitle,
          text: document.body?.innerText ?? "",
        };
      }, { mode, leftTitle: expectedLeftTitle });
      if (!result.ok) fail(`mode_${mode}_dynamic`, JSON.stringify(result));
      await capture(`mode_${mode}`);
    }
    mark("four_modes_clickable", "pass", "summary/learn/replay/explore update left and right panels");

    await harness.clickByTestId("decision-lab-mode-replay", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    await harness.waitForPagePredicate("replay attempting", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("À toi de jouer") && text.includes("Valider"), text };
    });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    await harness.waitForPagePredicate("replay feedback", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Feedback") && text.includes("Position suivante"), text };
    });
    await capture("replay_feedback");
    mark("replay_mock_flow", "pass");

    await harness.clickByTestId("decision-lab-mode-summary", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-filter-good", { afterMs: 250 });
    const filterResult = await harness.evalPage(() => ({
      ok:
        document.querySelector('[data-testid="decision-lab-filter-good"]')?.classList.contains("is-active") &&
        String(document.querySelector('[data-testid="decision-lab-filter-summary"]')?.textContent ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes("bon"),
      summary: document.querySelector('[data-testid="decision-lab-filter-summary"]')?.textContent ?? "",
    }));
    if (!filterResult.ok) fail("decision_path_filter_changes", JSON.stringify(filterResult));
    mark("decision_path_filter_changes", "pass", filterResult.summary);

    const drawerClosed = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="decision-lab-deep-dive"]'),
    }));
    if (!drawerClosed.ok) fail("deep_dive_closed_by_default", "drawer visible on default");
    await harness.clickByTestId("decision-lab-card-details", { afterMs: 250 });
    await harness.waitForPagePredicate("deep dive opened", () => ({
      ok: Boolean(document.querySelector('[data-testid="decision-lab-deep-dive"]')),
      text: document.body?.innerText ?? "",
    }));
    await capture("deep_dive");
    await harness.clickByTestId("decision-lab-close-details", { afterMs: 150 });
    mark("deep_dive_opens_and_closes", "pass");

    await harness.clickByTestId("decision-lab-mode-learn", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    const linePlayer = await harness.evalPage(() => ({
      ok:
        Boolean(document.querySelector('[data-testid="decision-lab-line-player"]')) &&
        !document.querySelector('[data-testid="decision-lab-actions"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!linePlayer.ok) fail("line_player_replaces_dock", JSON.stringify(linePlayer));
    await capture("line_player");
    await harness.clickByTestId("decision-lab-line-close", { afterMs: 150 });
    mark("line_player_replaces_dock", "pass");

    await harness.clickByTestId("decision-lab-mode-explore", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    const exploreResult = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      return {
        ok: text.includes("Ligne analysée") && text.includes("Local"),
        text,
      };
    });
    if (!exploreResult.ok) fail("explorer_mock_analyze_line", JSON.stringify(exploreResult));
    await capture("explorer_after_analyze");
    mark("explorer_mock_analyze_line", "pass");

    await assertNoLegacy("no_legacy_or_forbidden_labels");
    await harness.assertForbiddenV1LabelsAbsent("shared_forbidden_labels_absent");
    mark("decision_lab_static_smoke", "pass", "Decision Lab prototype polish verified");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
