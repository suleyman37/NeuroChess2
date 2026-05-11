#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const DESKTOP_COMPOSITION_MISSION = "P1.V2-VISION-12-DESKTOP-COMPOSITION-AND-STAGE-ART-DIRECTION-V1";
export const DESKTOP_COMPOSITION_MISSION_ID = "P1_V2_VISION_12_DESKTOP_COMPOSITION_AND_STAGE_ART_DIRECTION_V1";
export const DESKTOP_COMPOSITION_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", DESKTOP_COMPOSITION_MISSION_ID);
export const DESKTOP_COMPOSITION_SCREENSHOT_DIR = path.join(DESKTOP_COMPOSITION_QA_DIR, "screenshots_raw");
export const DESKTOP_COMPOSITION_EVIDENCE_DIR = path.join(DESKTOP_COMPOSITION_QA_DIR, "browser_evidence");

mkdirSync(DESKTOP_COMPOSITION_SCREENSHOT_DIR, { recursive: true });
mkdirSync(DESKTOP_COMPOSITION_EVIDENCE_DIR, { recursive: true });

export function createDesktopCompositionHarness(scriptName) {
  const evidence = createEvidence(DESKTOP_COMPOSITION_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(DESKTOP_COMPOSITION_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision desktop composition + board stage + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openDesktopCompositionVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureDesktopComposition(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(DESKTOP_COMPOSITION_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  await harness.browserClient.send("Page.bringToFront");
  const metrics = await harness.evalPage(() => ({
    width: Math.max(1, Math.round(window.innerWidth)),
    height: Math.max(1, Math.round(window.innerHeight)),
  }));
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 },
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function openCompositionDecisionLab(harness) {
  await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
  await harness.waitForPagePredicate("Decision Lab ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function openCompositionPractice(harness) {
  await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
  await harness.waitForPagePredicate("Practice ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function assertSafeDesktopLanguage(harness, stage = "desktop_composition_language_safe") {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const forbidden = [
    "NeuroScore",
    "NeuroXP",
    "SkillTrace",
    "Transfer Gap",
    "criticality_score",
    "diagnostic_gap",
    "raw WDL",
    "ETV",
    "FSRS",
    "NeuroMonitor",
    "brain",
    "cerveau",
    "cortex",
    "atlas",
    "tu vas gagner",
  ].filter((label) => normalized.includes(normalizeText(label)));
  const hasUnsafeXp = /\+\d+\s*XP\b|\bXP\b/.test(text);
  if (forbidden.length > 0 || hasUnsafeXp || /\belo\b/i.test(text)) {
    harness.fail(stage, JSON.stringify({ forbidden, hasUnsafeXp, hasElo: /\belo\b/i.test(text) }));
  }
  harness.mark(stage, "pass", "safe visible desktop language");
}

export async function getBox(harness, selector) {
  return harness.evalPage((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return { ok: false, selector: targetSelector, reason: "missing" };
    }
    element.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      ok: rect.width > 0 && rect.height > 0,
      selector: targetSelector,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      backgroundImage: style.backgroundImage,
      tone: element.getAttribute("data-tone") ?? element.querySelector("[data-tone]")?.getAttribute("data-tone") ?? "",
    };
  }, selector);
}

export async function assertStageBox(harness, stage, selector, minWidth = 420, minHeight = 360) {
  const box = await getBox(harness, selector);
  if (!box.ok || box.width < minWidth || box.height < minHeight || box.boxShadow === "none") {
    harness.fail(stage, JSON.stringify({ box, minWidth, minHeight }));
  }
  harness.mark(stage, "pass", `${box.width}x${box.height} tone=${box.tone}`);
  return box;
}
