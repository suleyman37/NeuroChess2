#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const LANGUAGE_MISSION = "P1.V2-VISION-06B-SCIENCE-SAFE-LANGUAGE-AND-VOCABULARY-V1";
export const LANGUAGE_MISSION_ID = "P1_V2_VISION_06B_SCIENCE_SAFE_LANGUAGE_AND_VOCABULARY_V1";
export const LANGUAGE_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", LANGUAGE_MISSION_ID);
export const LANGUAGE_SCREENSHOT_DIR = path.join(LANGUAGE_QA_DIR, "screenshots_raw");
export const LANGUAGE_EVIDENCE_DIR = path.join(LANGUAGE_QA_DIR, "browser_evidence");

const forbiddenTextLabels = [
  "NeuroScore",
  "NeuroXP",
  "Candidate Trainer",
  "Transfer Gap",
  "SkillTrace",
  "NeuroMonitor",
  "criticality_score",
  "diagnostic_gap",
  "raw WDL",
  "FSRS",
  "ETV",
  "Mission Control",
  "Dojo Personnel",
  "Mode Focus",
  "fake data",
  "Maquette locale",
  "sans API",
  "V2 Vision",
  "DEV-only",
  "brain",
  "cortex",
  "atlas",
  "cerveau",
];

mkdirSync(LANGUAGE_SCREENSHOT_DIR, { recursive: true });
mkdirSync(LANGUAGE_EVIDENCE_DIR, { recursive: true });

export function createLanguageHarness(scriptName) {
  const evidence = createEvidence(LANGUAGE_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(LANGUAGE_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision science-safe language + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openLanguageVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureLanguage(harness, evidence, name, viewport = "1366x768") {
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(LANGUAGE_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport });
  harness.writeEvidence();
  return screenshotPath;
}

export async function captureLanguageElement(harness, evidence, name, selector, viewport = "1366x768") {
  const rect = await harness.evalPage((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    };
  }, selector);
  if (!rect) {
    harness.fail(`capture_${name}`, `missing selector ${selector}`);
  }
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(LANGUAGE_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: { ...rect, scale: 1 },
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport, selector });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertScienceSafeLanguage(harness, stage = "science_safe_language") {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const visible = forbiddenTextLabels.filter((label) => normalized.includes(normalizeText(label)));
  const regexFindings = [];
  if (/\bXP\b/i.test(text) || /\+\s*\d+\s*XP\b/i.test(text)) regexFindings.push("XP");
  if (/\bElo\b/i.test(text)) regexFindings.push("Elo");
  if (/tu\s+vas\s+gagner/i.test(text)) regexFindings.push("tu vas gagner");
  if (visible.length > 0 || regexFindings.length > 0) {
    harness.fail(stage, `unsafe visible language: ${[...visible, ...regexFindings].join(", ")}`);
  }
  harness.mark(stage, "pass", "science-safe visible text");
}

export async function assertNoDevLanguageInMainHero(harness, stage = "dev_labels_not_in_hero") {
  const result = await harness.evalPage(() => {
    const heroText = document.querySelector('[data-testid="v2-vision-today-hero"]')?.textContent ?? "";
    const forbidden = ["fake data", "sans api", "maquette locale", "dev-only", "v2 vision"];
    const normalized = heroText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const visible = forbidden.filter((label) => normalized.includes(label));
    return { ok: visible.length === 0, visible, heroText };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", "no dev labels in Today hero");
}
