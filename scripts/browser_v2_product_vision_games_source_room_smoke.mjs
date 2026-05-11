#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.V2-VISION-02-GAMES-SOURCE-ROOM-V1";
const MISSION_ID = "P1_V2_VISION_02_GAMES_SOURCE_ROOM_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots_raw");
const EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_v2_product_vision_games_source_room_smoke.json");
evidence.output_path = path.join(EVIDENCE_DIR, "browser_v2_product_vision_games_source_room_smoke.json");
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);

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
  "cortex",
  "atlas",
];

async function capture(name, viewport) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
}

async function captureElement(name, selector, viewport) {
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
    harness.fail(`capture_${name}`, `missing ${selector}`);
  }
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: { ...rect, scale: 1 },
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath, selector });
  harness.writeEvidence();
}

async function assertNoForbidden(stage) {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const found = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (found.length > 0 || /\belo\b/i.test(text)) {
    harness.fail(stage, JSON.stringify({ found, text }));
  }
  harness.mark(stage, "pass", "no forbidden metrics or Elo prediction visible");
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app#/v2-vision");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.waitForPagePredicate("V2 shell ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-main-nav"]')),
      text: document.body?.innerText ?? "",
    }), 30_000);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 250 });
    await harness.waitForPagePredicate("Source Room visible", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const cards = [...document.querySelectorAll(".v2-vision-game-card")];
      const previews = document.querySelectorAll('[data-testid^="v2-vision-game-preview-"]').length;
      const moments = document.querySelectorAll('[data-testid^="v2-vision-game-moment-"]').length;
      const primaryByCard = cards.map((card) => Boolean(card.querySelector(".v2-vision-actions button:first-child")));
      const dangerButtons = [...document.querySelectorAll(".v2-vision-game-actions .v2-vision-danger")];
      return {
        ok:
          normalized.includes("mes parties") &&
          normalized.includes("chaque partie devient une source") &&
          normalized.includes("importer pgn") &&
          normalized.includes("review prete") &&
          normalized.includes("analyse en cours") &&
          normalized.includes("erreur recuperable") &&
          normalized.includes("qxb7?") &&
          normalized.includes("rd8?!") &&
          normalized.includes("kh2!") &&
          previews === 3 &&
          moments === 3 &&
          cards.length === 3 &&
          primaryByCard.every(Boolean) &&
          dangerButtons.length === 3,
        text,
        previews,
        moments,
        cardCount: cards.length,
        primaryByCard,
        dangerCount: dangerButtons.length,
      };
    }, 30_000);
    await capture("games_desktop_1366", "1366x768");
    await captureElement("game_card_focus", '[data-testid="v2-vision-game-game-1"]', "1366x768");
    await harness.setViewport({ width: 1536, height: 864 });
    await capture("games_desktop_1536", "1536x864");
    await harness.setViewport({ width: 390, height: 844, mobile: true });
    await capture("games_mobile_390", "390x844");

    await assertNoForbidden("games_source_room_no_forbidden");
    harness.mark("games_source_room_smoke", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
