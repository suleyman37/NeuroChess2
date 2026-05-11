#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const TPE_MISSION = "P1.V2-VISION-04-TRAINING-PRACTICE-EXPLORER-NORTH-STAR-V1";
export const TPE_MISSION_ID = "P1_V2_VISION_04_TRAINING_PRACTICE_EXPLORER_NORTH_STAR_V1";
export const TPE_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", TPE_MISSION_ID);
export const TPE_SCREENSHOT_DIR = path.join(TPE_QA_DIR, "screenshots_raw");
export const TPE_EVIDENCE_DIR = path.join(TPE_QA_DIR, "browser_evidence");

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
  "due_at",
];

mkdirSync(TPE_SCREENSHOT_DIR, { recursive: true });
mkdirSync(TPE_EVIDENCE_DIR, { recursive: true });

export function createTpeHarness(scriptName) {
  const evidence = createEvidence(TPE_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(TPE_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision Training/Practice/Explorer + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureTpe(harness, evidence, name, viewport = "1366x768") {
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(TPE_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertNoForbidden(harness, stage = "tpe_no_forbidden_metrics") {
  const normalized = normalizeText(await harness.visibleText());
  const visible = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (visible.length > 0) {
    harness.fail(stage, `forbidden visible: ${visible.join(", ")}`);
  }
  harness.mark(stage, "pass", "no forbidden Training/Practice/Explorer labels visible");
}

export async function assertOnePrimary(harness, stage) {
  const labels = await harness.evalPage(() =>
    [...document.querySelectorAll(".v2-vision-primary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
  );
  if (labels.length !== 1) {
    harness.fail(stage, JSON.stringify(labels));
  }
  harness.mark(stage, "pass", labels[0]);
  return labels[0];
}
