#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const DESKTOP_NORTH_STAR_MISSION = "P1.V2-VISION-11-DESKTOP-NORTH-STAR-CRITICAL-POLISH-V1";
export const DESKTOP_NORTH_STAR_MISSION_ID = "P1_V2_VISION_11_DESKTOP_NORTH_STAR_CRITICAL_POLISH_V1";
export const DESKTOP_NORTH_STAR_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", DESKTOP_NORTH_STAR_MISSION_ID);
export const DESKTOP_NORTH_STAR_SCREENSHOT_DIR = path.join(DESKTOP_NORTH_STAR_QA_DIR, "screenshots_raw");
export const DESKTOP_NORTH_STAR_EVIDENCE_DIR = path.join(DESKTOP_NORTH_STAR_QA_DIR, "browser_evidence");

mkdirSync(DESKTOP_NORTH_STAR_SCREENSHOT_DIR, { recursive: true });
mkdirSync(DESKTOP_NORTH_STAR_EVIDENCE_DIR, { recursive: true });

export function createDesktopNorthStarHarness(scriptName) {
  const evidence = createEvidence(DESKTOP_NORTH_STAR_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(DESKTOP_NORTH_STAR_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision desktop north star polish + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openDesktopVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureDesktopNorthStar(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(DESKTOP_NORTH_STAR_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function openDesktopDecisionLab(harness) {
  await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
  await harness.waitForPagePredicate("Decision Lab ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function openDesktopPractice(harness) {
  await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
  await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
  await harness.waitForPagePredicate("Practice ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')),
    text: document.body?.innerText ?? "",
  }), 15_000);
}

export async function assertNoSpoilerBoard(harness, stage, shellTestId) {
  const result = await harness.evalPage((testId) => {
    const shell = document.querySelector(`[data-testid="${testId}"]`);
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(shell) &&
        shell?.getAttribute("data-solution-visible") === "false" &&
        shell?.getAttribute("data-guides-visible") === "false" &&
        !/Coup recommandé|Mini-ligne|Solution/i.test(text),
      solutionVisible: shell?.getAttribute("data-solution-visible"),
      guidesVisible: shell?.getAttribute("data-guides-visible"),
      text,
    };
  }, shellTestId);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellTestId} guides hidden`);
}

export async function assertGuideBoardVisible(harness, stage, shellTestId) {
  const result = await harness.evalPage((testId) => {
    const shell = document.querySelector(`[data-testid="${testId}"]`);
    return {
      ok:
        Boolean(shell) &&
        shell?.getAttribute("data-solution-visible") === "true" &&
        shell?.getAttribute("data-guides-visible") === "true",
      solutionVisible: shell?.getAttribute("data-solution-visible"),
      guidesVisible: shell?.getAttribute("data-guides-visible"),
    };
  }, shellTestId);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellTestId} guides visible`);
}

export async function assertStagePremium(harness, stage, selector) {
  const result = await harness.evalPage((targetSelector) => {
    const stage = document.querySelector(targetSelector);
    const board = stage?.querySelector('[data-board-kind="vision-main-board"]');
    if (!stage || !board) {
      return { ok: false, reason: "missing stage or board" };
    }
    const rect = stage.getBoundingClientRect();
    const style = window.getComputedStyle(stage);
    const boardRect = board.getBoundingClientRect();
    return {
      ok:
        rect.width > 480 &&
        rect.height > 420 &&
        boardRect.width > 300 &&
        style.borderRadius !== "0px" &&
        style.boxShadow !== "none" &&
        style.backgroundImage !== "none",
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      board: { width: Math.round(boardRect.width), height: Math.round(boardRect.height) },
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      backgroundImage: style.backgroundImage,
    };
  }, selector);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", JSON.stringify(result.rect));
}

export async function assertDesktopSafetyText(harness, stage = "desktop_no_forbidden_text") {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const forbidden = [
    "NeuroScore",
    "NeuroXP",
    "SkillTrace",
    "Transfer Gap",
    "brain",
    "cerveau",
    "cortex",
    "atlas",
    "NeuroMonitor",
    "criticality_score",
    "diagnostic_gap",
    "raw WDL",
    "due_at",
  ].filter((label) => normalized.includes(normalizeText(label)));
  const hasUnsafeXp = /\+\d+\s*XP\b|\bXP\b/.test(text);
  if (/\belo\b/i.test(text) || hasUnsafeXp || forbidden.length > 0) {
    harness.fail(stage, JSON.stringify({ forbidden, hasElo: /\belo\b/i.test(text), hasUnsafeXp }));
  }
  harness.mark(stage, "pass", "desktop visible language safe");
}
