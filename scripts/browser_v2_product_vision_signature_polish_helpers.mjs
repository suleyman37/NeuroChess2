#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const SIGNATURE_POLISH_MISSION = "P1.V2-VISION-13-DECISION-LAB-PRACTICE-EXPLORER-SIGNATURE-POLISH-V1";
export const SIGNATURE_POLISH_MISSION_ID = "P1_V2_VISION_13_DECISION_LAB_PRACTICE_EXPLORER_SIGNATURE_POLISH_V1";
export const SIGNATURE_POLISH_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", SIGNATURE_POLISH_MISSION_ID);
export const SIGNATURE_POLISH_SCREENSHOT_DIR = path.join(SIGNATURE_POLISH_QA_DIR, "screenshots_raw");
export const SIGNATURE_POLISH_EVIDENCE_DIR = path.join(SIGNATURE_POLISH_QA_DIR, "browser_evidence");

mkdirSync(SIGNATURE_POLISH_SCREENSHOT_DIR, { recursive: true });
mkdirSync(SIGNATURE_POLISH_EVIDENCE_DIR, { recursive: true });

export function createSignaturePolishHarness(scriptName) {
  const evidence = createEvidence(SIGNATURE_POLISH_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(SIGNATURE_POLISH_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision desktop signature polish + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openSignatureVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureSignature(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(SIGNATURE_POLISH_SCREENSHOT_DIR, `${name}_${viewport}.png`);
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

export async function openSignatureDecisionLab(harness) {
  await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
  await harness.waitForPagePredicate("Decision Lab ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function openSignaturePractice(harness) {
  await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
  await harness.waitForPagePredicate("Practice ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function openSignatureExplorer(harness) {
  await openSignatureDecisionLab(harness);
  await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 260 });
  await harness.waitForPagePredicate("Explorer ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-explorer"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function assertSignatureSafeText(harness, stage = "signature_safe_text") {
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
  harness.mark(stage, "pass", "safe visible signature text");
}

export async function assertNoVisibleSolution(harness, stage, shellTestId) {
  const result = await harness.evalPage((testId) => {
    const shell = document.querySelector(`[data-testid="${testId}"]`);
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(shell) &&
        shell.getAttribute("data-guides-visible") === "false" &&
        shell.getAttribute("data-solution-visible") === "false" &&
        !/Coup recommandé|Mini-ligne|Solution/i.test(text) &&
        !document.querySelector('[data-testid="v2-vision-line-player"]'),
      guides: shell?.getAttribute("data-guides-visible") ?? "",
      solution: shell?.getAttribute("data-solution-visible") ?? "",
      hasLinePlayer: Boolean(document.querySelector('[data-testid="v2-vision-line-player"]')),
      text,
    };
  }, shellTestId);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellTestId} no visible solution`);
}

export async function assertBoardTone(harness, stage, shellTestId, expectedTone) {
  const result = await harness.evalPage(({ testId, tone }) => {
    const shell = document.querySelector(`[data-testid="${testId}"]`);
    return {
      ok: Boolean(shell) && shell.getAttribute("data-tone") === tone,
      actual: shell?.getAttribute("data-tone") ?? "",
      tone,
    };
  }, { testId: shellTestId, tone: expectedTone });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellTestId} tone=${result.actual}`);
}
