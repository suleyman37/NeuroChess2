#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const PROGRESSION_PROFILE_MISSION = "P1.V2-VISION-09-PROGRESSION-AND-PROFILE-DEPTH-V1";
export const PROGRESSION_PROFILE_MISSION_ID = "P1_V2_VISION_09_PROGRESSION_AND_PROFILE_DEPTH_V1";
export const PROGRESSION_PROFILE_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", PROGRESSION_PROFILE_MISSION_ID);
export const PROGRESSION_PROFILE_SCREENSHOT_DIR = path.join(PROGRESSION_PROFILE_QA_DIR, "screenshots_raw");
export const PROGRESSION_PROFILE_EVIDENCE_DIR = path.join(PROGRESSION_PROFILE_QA_DIR, "browser_evidence");

mkdirSync(PROGRESSION_PROFILE_SCREENSHOT_DIR, { recursive: true });
mkdirSync(PROGRESSION_PROFILE_EVIDENCE_DIR, { recursive: true });

export function createProgressionProfileHarness(scriptName) {
  const evidence = createEvidence(PROGRESSION_PROFILE_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(PROGRESSION_PROFILE_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision Progression/Profile + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openProgressionProfileVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureProgressionProfile(harness, evidence, name, viewport = "1366x768", selector = null) {
  if (selector) {
    await harness.evalPage((targetSelector) => {
      document.querySelector(targetSelector)?.scrollIntoView({ block: "center", inline: "nearest" });
      return { ok: true };
    }, selector);
  }
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(PROGRESSION_PROFILE_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport, selector });
  harness.writeEvidence();
  return screenshotPath;
}

export async function openProgression(harness) {
  await harness.clickByTestId("v2-vision-open-progression", { afterMs: 220 });
  await harness.waitForPagePredicate("progression ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-progression"]')),
    text: document.body?.innerText ?? "",
  }), 10_000);
}

export async function openProfile(harness) {
  await harness.clickByTestId("v2-vision-open-profile", { afterMs: 220 });
  await harness.waitForPagePredicate("profile ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-profile"]')),
    text: document.body?.innerText ?? "",
  }), 10_000);
}

export async function assertSafeProgressionProfileText(harness, stage = "progression_profile_safe_text") {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const forbidden = [
      "Elo",
      "SkillTrace",
      "Transfer Gap",
      "criticality_score",
      "diagnostic_gap",
      "raw WDL",
      "ETV",
      "FSRS",
      "NeuroScore",
      "NeuroXP",
      "XP",
      "cerveau",
      "brain",
      "cortex",
      "atlas",
      "NeuroMonitor",
    ];
    const visible = forbidden.filter((label) => text.includes(label));
    const neuroMatches = [...text.matchAll(/\bNeuro(?!Chess\b)\w*/g)].map((match) => match[0]);
    const hasMasteryPercent = /ma[îi]trise\s*\d+\s*%/i.test(text) || /mastery\s*\d+\s*%/i.test(text);
    const hasEloClaim = /tu vas gagner|gagner\s+\d+\s*Elo|pr[ée]diction\s+Elo/i.test(text);
    return {
      ok: visible.length === 0 && neuroMatches.length === 0 && !hasMasteryPercent && !hasEloClaim,
      visible,
      neuroMatches,
      hasMasteryPercent,
      hasEloClaim,
      text,
    };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", "safe visible Progression/Profile language");
}

export function includesNormalized(text, label) {
  return normalizeText(text).includes(normalizeText(label));
}
