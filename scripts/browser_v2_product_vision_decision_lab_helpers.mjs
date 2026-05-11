#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const DECISION_LAB_MISSION = "P1.V2-VISION-03-DECISION-LAB-NORTH-STAR-V1";
export const DECISION_LAB_MISSION_ID = "P1_V2_VISION_03_DECISION_LAB_NORTH_STAR_V1";
export const DECISION_LAB_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", DECISION_LAB_MISSION_ID);
export const DECISION_LAB_SCREENSHOT_DIR = path.join(DECISION_LAB_QA_DIR, "screenshots_raw");
export const DECISION_LAB_EVIDENCE_DIR = path.join(DECISION_LAB_QA_DIR, "browser_evidence");

const forbiddenLabels = [
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

mkdirSync(DECISION_LAB_SCREENSHOT_DIR, { recursive: true });
mkdirSync(DECISION_LAB_EVIDENCE_DIR, { recursive: true });

export function createDecisionLabHarness(scriptName) {
  const evidence = createEvidence(DECISION_LAB_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(DECISION_LAB_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision Decision Lab + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openDecisionLab(harness, options = {}) {
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

export async function captureDecisionLab(harness, evidence, name, viewport = "1366x768") {
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(DECISION_LAB_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport });
  harness.writeEvidence();
  return screenshotPath;
}

export async function visiblePrimaryLabels(harness) {
  return harness.evalPage(() =>
    [...document.querySelectorAll(".v2-vision-primary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
  );
}

export async function assertOnePrimary(harness, stage) {
  const labels = await visiblePrimaryLabels(harness);
  if (labels.length !== 1) {
    harness.fail(stage, JSON.stringify(labels));
  }
  harness.mark(stage, "pass", labels[0]);
  return labels[0];
}

export async function assertDecisionLabForbiddenAbsent(harness, stage = "decision_lab_no_forbidden_metrics") {
  const normalized = normalizeText(await harness.visibleText());
  const visible = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (visible.length > 0) {
    harness.fail(stage, `forbidden visible: ${visible.join(", ")}`);
  }
  harness.mark(stage, "pass", "no forbidden labels visible");
}
