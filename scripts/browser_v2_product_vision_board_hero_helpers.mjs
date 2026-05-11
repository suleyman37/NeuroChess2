#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
} from "./browser_test_helpers.mjs";

export const BOARD_HERO_MISSION = "P1.V2-VISION-06A-BOARD-HERO-SYSTEM-V1";
export const BOARD_HERO_MISSION_ID = "P1_V2_VISION_06A_BOARD_HERO_SYSTEM_V1";
export const BOARD_HERO_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", BOARD_HERO_MISSION_ID);
export const BOARD_HERO_SCREENSHOT_DIR = path.join(BOARD_HERO_QA_DIR, "screenshots_raw");
export const BOARD_HERO_EVIDENCE_DIR = path.join(BOARD_HERO_QA_DIR, "browser_evidence");

mkdirSync(BOARD_HERO_SCREENSHOT_DIR, { recursive: true });
mkdirSync(BOARD_HERO_EVIDENCE_DIR, { recursive: true });

export function createBoardHeroHarness(scriptName) {
  const evidence = createEvidence(BOARD_HERO_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(BOARD_HERO_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision board hero system + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openBoardHeroVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureBoardHero(harness, evidence, name, viewport = "1366x768") {
  const screenshotPath = path.join(BOARD_HERO_SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertBoardReady(harness, stage, selector) {
  const result = await harness.evalPage((targetSelector) => {
    const board = document.querySelector(targetSelector);
    if (!board) return { ok: false, reason: "missing", selector: targetSelector };
    const rect = board.getBoundingClientRect();
    const cases = Number(board.getAttribute("data-board-cases") ?? 0);
    const pieceCount = Number(board.getAttribute("data-piece-count") ?? 0);
    return {
      ok: rect.width >= 72 && rect.height >= 72 && cases >= 64 && pieceCount > 0,
      cases,
      pieceCount,
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      kind: board.getAttribute("data-board-kind"),
      mood: board.getAttribute("data-board-mood"),
    };
  }, selector);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${result.kind} pieces=${result.pieceCount} size=${result.rect.width}x${result.rect.height}`);
  return result;
}
