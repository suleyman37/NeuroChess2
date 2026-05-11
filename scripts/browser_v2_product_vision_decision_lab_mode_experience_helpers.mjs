#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const MODE_MISSION = "P1.V2-VISION-08-DECISION-LAB-MODE-EXPERIENCE-V1";
export const MODE_MISSION_ID = "P1_V2_VISION_08_DECISION_LAB_MODE_EXPERIENCE_V1";
export const MODE_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MODE_MISSION_ID);
export const MODE_SCREENSHOT_DIR = path.join(MODE_QA_DIR, "screenshots_raw");
export const MODE_EVIDENCE_DIR = path.join(MODE_QA_DIR, "browser_evidence");

const forbiddenLabels = [
  "NeuroScore",
  "NeuroXP",
  "+120 XP",
  "Candidate Trainer",
  "Transfer Gap",
  "criticality_score",
  "diagnostic_gap",
  "raw WDL",
  "ETV",
  "FSRS",
  "SkillTrace",
  "NeuroMonitor",
  "brain",
  "cortex",
  "atlas",
  "prédiction Elo",
  "gagner 300 Elo",
  "LLM coach",
];

mkdirSync(MODE_SCREENSHOT_DIR, { recursive: true });
mkdirSync(MODE_EVIDENCE_DIR, { recursive: true });

export function createModeHarness(scriptName) {
  const evidence = createEvidence(MODE_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(MODE_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision Decision Lab mode experience + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openModeDecisionLab(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768 });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
  await harness.waitForPagePredicate("Decision Lab ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function captureModeDecisionLab(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(MODE_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertNoForbiddenModeText(harness, stage = "decision_lab_mode_no_forbidden") {
  const normalized = normalizeText(await harness.visibleText());
  const visible = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (visible.length > 0) {
    harness.fail(stage, `forbidden visible: ${visible.join(", ")}`);
  }
  harness.mark(stage, "pass", "no forbidden labels visible");
}

export async function getModeSnapshot(harness) {
  return harness.evalPage(() => {
    const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const lab = document.querySelector('[data-testid="v2-vision-decision-lab"]');
    const board = document.querySelector('[data-testid="v2-vision-lab-board-shell"]');
    const activeButton = document.querySelector(".v2-vision-mode-segmented button.is-active");
    return {
      activeMode: lab?.getAttribute("data-active-mode") ?? "",
      rootClass: lab?.className ?? "",
      activeButtonMode: activeButton?.getAttribute("data-mode") ?? "",
      boardMood: board?.getAttribute("data-board-mood") ?? "",
      solutionVisible: board?.getAttribute("data-solution-visible") ?? "",
      left: normalize(document.querySelector('[data-testid="v2-vision-lab-left"]')?.textContent),
      right: normalize(document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent),
      dock: normalize(document.querySelector('[data-testid="v2-vision-action-dock"]')?.textContent),
      cue: normalize(document.querySelector('[data-testid="v2-vision-mode-cue"]')?.textContent),
      text: normalize(document.body?.innerText),
    };
  });
}
