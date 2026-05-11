#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const GLOBAL_VISION_MISSION = "P1.V2-VISION-05-GLOBAL-POLISH-AND-COHERENCE-V1";
export const GLOBAL_VISION_MISSION_ID = "P1_V2_VISION_05_GLOBAL_POLISH_AND_COHERENCE_V1";
export const GLOBAL_VISION_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", GLOBAL_VISION_MISSION_ID);
export const GLOBAL_VISION_SCREENSHOT_DIR = path.join(GLOBAL_VISION_QA_DIR, "screenshots_raw");
export const GLOBAL_VISION_EVIDENCE_DIR = path.join(GLOBAL_VISION_QA_DIR, "browser_evidence");

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
  "NeuroScore",
  "NeuroXP",
  "brain",
  "cortex",
  "atlas",
  "prédiction Elo",
  "gagner 300 Elo",
  "LLM coach",
  "due_at",
  "neuroplasticité mesurée",
];

const devishVisibleLabels = ["undefined", "failed job", "stack trace", "Jouer une branche mock", "Valider le coup mock"];

mkdirSync(GLOBAL_VISION_SCREENSHOT_DIR, { recursive: true });
mkdirSync(GLOBAL_VISION_EVIDENCE_DIR, { recursive: true });

export function createGlobalVisionHarness(scriptName) {
  const evidence = createEvidence(GLOBAL_VISION_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(GLOBAL_VISION_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "DEV-only V2 Product Vision global polish + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openGlobalVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768, mobile: false });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureGlobalVision(harness, evidence, name, viewport = "1366x768") {
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(GLOBAL_VISION_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertGlobalSafety(harness, stage = "global_microcopy_safe") {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const visible = forbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  const devish = devishVisibleLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (/\belo\b/i.test(text)) {
    visible.push("Elo");
  }
  if (visible.length > 0 || devish.length > 0) {
    harness.fail(stage, `unsafe visible labels: ${[...visible, ...devish].join(", ")}`);
  }
  harness.mark(stage, "pass", "no forbidden metrics, Elo claims, or dev-only labels visible");
}

export async function visiblePrimaryLabels(harness) {
  return harness.evalPage(() =>
    [...document.querySelectorAll(".v2-vision-primary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
  );
}

export async function assertAtMostOnePrimary(harness, stage) {
  const labels = await visiblePrimaryLabels(harness);
  if (labels.length > 1) {
    harness.fail(stage, JSON.stringify(labels));
  }
  harness.mark(stage, "pass", labels[0] ?? "no screen-level primary");
  return labels;
}

export async function assertNoDuplicateButtonLabels(harness, stage) {
  const result = await harness.evalPage(() => {
    const visibleButtons = [...document.querySelectorAll("button")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean);
    const counts = new Map();
    for (const label of visibleButtons) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const repeatedListActions = ["Retour", "Annuler", "Détails", "Supprimer", "Reprendre l'analyse"];
    const duplicates = [...counts.entries()]
      .filter(([label, count]) => count > 1 && !repeatedListActions.includes(label))
      .map(([label, count]) => ({ label, count }));
    return { ok: duplicates.length === 0, duplicates, labels: visibleButtons };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result.duplicates));
  }
  harness.mark(stage, "pass", "no duplicate visible button labels");
}

export async function assertNoLargeEmptyCards(harness, stage) {
  const result = await harness.evalPage(() => {
    const empty = [...document.querySelectorAll(".v2-vision-hero, .v2-vision-panel, .v2-vision-card, .v2-vision-game-card")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return {
          className: typeof element.className === "string" ? element.className : "",
          area: Math.round(rect.width * rect.height),
          textLength: text.length,
        };
      })
      .filter((item) => item.area > 14_000 && item.textLength < 18);
    return { ok: empty.length === 0, empty };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result.empty));
  }
  harness.mark(stage, "pass", "no large empty content surfaces detected");
}

export async function clickHeaderAction(harness, testId) {
  await harness.clickByTestId(testId, { afterMs: 220 });
}
