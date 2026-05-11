#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
} from "./browser_test_helpers.mjs";

export const BUTTON_MISSION = "P1.V2-VISION-07-BUTTON-HIERARCHY-AND-PREMIUM-TYPOGRAPHY-V1";
export const BUTTON_MISSION_ID = "P1_V2_VISION_07_BUTTON_HIERARCHY_AND_PREMIUM_TYPOGRAPHY_V1";
export const BUTTON_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", BUTTON_MISSION_ID);
export const BUTTON_SCREENSHOT_DIR = path.join(BUTTON_QA_DIR, "screenshots_raw");
export const BUTTON_EVIDENCE_DIR = path.join(BUTTON_QA_DIR, "browser_evidence");

mkdirSync(BUTTON_SCREENSHOT_DIR, { recursive: true });
mkdirSync(BUTTON_EVIDENCE_DIR, { recursive: true });

export function createButtonHarness(scriptName) {
  const evidence = createEvidence(BUTTON_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(BUTTON_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision button hierarchy + typography + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openButtonVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureButtonVision(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(BUTTON_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function visiblePrimaryButtons(harness, rootSelector = "body") {
  return harness.evalPage((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    return [...root.querySelectorAll(".v2-vision-primary")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
  }, rootSelector);
}

export async function assertOnePrimaryIn(harness, stage, rootSelector) {
  const labels = await visiblePrimaryButtons(harness, rootSelector);
  if (labels.length !== 1) {
    harness.fail(stage, JSON.stringify({ rootSelector, labels }));
  }
  harness.mark(stage, "pass", labels[0]);
  return labels[0];
}

export async function assertNoHorizontalOverflow(harness, stage) {
  const result = await harness.evalPage(() => ({
    ok: document.documentElement.scrollWidth <= window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${result.scrollWidth}/${result.innerWidth}`);
}
