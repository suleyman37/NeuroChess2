#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.V2-VISION-01-SHELL-AND-TODAY-NORTH-STAR-V1";
const MISSION_ID = "P1_V2_VISION_01_SHELL_AND_TODAY_NORTH_STAR_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots_raw");
const EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_v2_product_vision_today_north_star_smoke.json");
evidence.output_path = path.join(EVIDENCE_DIR, "browser_v2_product_vision_today_north_star_smoke.json");
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
  "prédiction Elo",
  "gagner 300 Elo",
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
    if (!element) {
      return null;
    }
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
    await harness.waitForPagePredicate("Today North Star visible", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const missionItems = document.querySelectorAll(".v2-vision-mission-item").length;
      const navButtons = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')].map((button) =>
        button.textContent?.trim(),
      );
      return {
        ok:
          Boolean(document.querySelector('[data-testid="v2-vision-today"]')) &&
          normalized.includes("mission du jour") &&
          normalized.includes("commencer") &&
          normalized.includes("revanche douce") &&
          normalized.includes("decision critique") &&
          normalized.includes("revision due") &&
          normalized.includes("18 decisions revues") &&
          normalized.includes("regularite") &&
          normalized.includes("effort") &&
          normalized.includes("regularite") &&
          missionItems === 3 &&
          navButtons.length === 3,
        text,
        missionItems,
        navButtons,
      };
    }, 30_000);
    await capture("today_desktop_1366", "1366x768");
    await captureElement("mission_stack_focus", '[data-testid="v2-vision-mission-stack"]', "1366x768");

    const ctaResult = await harness.evalPage(() => {
      const visibleButtons = [...document.querySelectorAll('[data-testid="v2-vision-today"] button')]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((button) => ({
          text: button.textContent?.replace(/\s+/g, " ").trim() ?? "",
          primary: button.classList.contains("v2-vision-primary"),
        }));
      return {
        ok:
          visibleButtons.filter((button) => button.primary).length === 1 &&
          visibleButtons.length <= 3 &&
          visibleButtons.some((button) => button.text === "Commencer") &&
          visibleButtons.some((button) => button.text === "Voir le plan du jour") &&
          visibleButtons.some((button) => button.text === "Importer une partie"),
        visibleButtons,
      };
    });
    if (!ctaResult.ok) {
      harness.fail("today_cta_hierarchy", JSON.stringify(ctaResult));
    }
    harness.mark("today_cta_hierarchy", "pass", JSON.stringify(ctaResult.visibleButtons));

    await harness.setViewport({ width: 1536, height: 864 });
    await capture("today_desktop_1536", "1536x864");
    await harness.setViewport({ width: 390, height: 844, mobile: true });
    await capture("today_mobile_390", "390x844");

    await assertNoForbidden("today_no_forbidden_or_elo");
    harness.mark("today_north_star_smoke", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
