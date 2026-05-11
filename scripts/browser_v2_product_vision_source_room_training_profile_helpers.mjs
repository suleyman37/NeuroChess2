#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const PERIPHERAL_COHERENCE_MISSION = "P1.V2-VISION-14-SOURCE-ROOM-TRAINING-PROFILE-FINAL-COHERENCE-V1";
export const PERIPHERAL_COHERENCE_MISSION_ID = "P1_V2_VISION_14_SOURCE_ROOM_TRAINING_PROFILE_FINAL_COHERENCE_V1";
export const PERIPHERAL_COHERENCE_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", PERIPHERAL_COHERENCE_MISSION_ID);
export const PERIPHERAL_COHERENCE_SCREENSHOT_DIR = path.join(PERIPHERAL_COHERENCE_QA_DIR, "screenshots_raw");
export const PERIPHERAL_COHERENCE_EVIDENCE_DIR = path.join(PERIPHERAL_COHERENCE_QA_DIR, "browser_evidence");

mkdirSync(PERIPHERAL_COHERENCE_SCREENSHOT_DIR, { recursive: true });
mkdirSync(PERIPHERAL_COHERENCE_EVIDENCE_DIR, { recursive: true });

export function createPeripheralCoherenceHarness(scriptName) {
  const evidence = createEvidence(PERIPHERAL_COHERENCE_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(PERIPHERAL_COHERENCE_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision desktop Source Room / Training / Profile coherence + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openPeripheralVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function capturePeripheral(harness, evidence, name, viewport = "1366x768", selector = null) {
  if (selector) {
    await harness.evalPage((targetSelector) => {
      document.querySelector(targetSelector)?.scrollIntoView({ block: "center", inline: "nearest" });
      return { ok: true };
    }, selector);
  } else {
    await harness.evalPage(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return { ok: true };
    });
  }
  await harness.browserClient.send("Page.bringToFront");
  const screenshotPath = path.join(PERIPHERAL_COHERENCE_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertPeripheralSafeText(harness, stage = "peripheral_safe_text") {
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
    "Daily Plan",
    "due_at",
  ].filter((label) => normalized.includes(normalizeText(label)));
  const hasUnsafeXp = /\+\d+\s*XP\b|\bXP\b/.test(text);
  if (forbidden.length > 0 || hasUnsafeXp || /\belo\b/i.test(text)) {
    harness.fail(stage, JSON.stringify({ forbidden, hasUnsafeXp, hasElo: /\belo\b/i.test(text) }));
  }
  harness.mark(stage, "pass", "safe visible peripheral text");
}

export async function assertScreenPrimaryCount(harness, stage, selector, max = 1) {
  const result = await harness.evalPage(({ selector, max }) => {
    const root = document.querySelector(selector);
    const primary = [...(root?.querySelectorAll(".v2-vision-primary") ?? [])]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "");
    return { ok: primary.length <= max, primary, max };
  }, { selector, max });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", result.primary.join(" / ") || "no primary");
  return result.primary;
}

export async function openProfile(harness) {
  await harness.clickByTestId("v2-vision-open-profile", { afterMs: 240 });
  await harness.waitForPagePredicate("Profile visible", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-profile"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}
