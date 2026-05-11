import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

export const PRODUCT_VISION_MISSION = "P1.FRONTEND-V2-PRODUCT-VISION-PROTOTYPE-V1";
export const PRODUCT_VISION_MISSION_ID = "P1_FRONTEND_V2_PRODUCT_VISION_PROTOTYPE_V1";
export const PRODUCT_VISION_QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", PRODUCT_VISION_MISSION_ID);
export const PRODUCT_VISION_SCREENSHOT_DIR = path.join(PRODUCT_VISION_QA_DIR, "screenshots_raw");
export const PRODUCT_VISION_EVIDENCE_DIR = path.join(PRODUCT_VISION_QA_DIR, "browser_evidence");

export const productVisionForbiddenLabels = [
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
];

mkdirSync(PRODUCT_VISION_SCREENSHOT_DIR, { recursive: true });
mkdirSync(PRODUCT_VISION_EVIDENCE_DIR, { recursive: true });

export function createProductVisionHarness(scriptName) {
  const evidence = createEvidence(PRODUCT_VISION_MISSION, `${scriptName}.json`);
  evidence.output_path = path.join(PRODUCT_VISION_EVIDENCE_DIR, `${scriptName}.json`);
  evidence.strategy = "static DEV-only V2 Product Vision + fake data + Vite + Edge CDP";
  evidence.screenshots = [];
  const harness = new BrowserSmokeHarness(evidence);
  return { evidence, harness };
}

export async function openProductVision(harness, options = {}) {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app#/v2-vision");
  await harness.setViewport(options.viewport ?? { width: 1366, height: 768 });
  await harness.waitForPagePredicate("V2 Product Vision ready", () => ({
    ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

export async function captureProductVision(harness, evidence, name, viewport = "1366x768") {
  const filename = `${name}_${viewport}.png`;
  const screenshotPath = path.join(PRODUCT_VISION_SCREENSHOT_DIR, filename);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath, viewport });
  harness.writeEvidence();
  return screenshotPath;
}

export async function assertProductVisionForbiddenAbsent(harness, stage = "no_forbidden_product_vision_labels") {
  const text = await harness.visibleText();
  const normalized = normalizeText(text);
  const visible = productVisionForbiddenLabels.filter((label) => normalized.includes(normalizeText(label)));
  if (visible.length > 0) {
    harness.fail(stage, `forbidden visible: ${visible.join(", ")}`);
  }
  harness.mark(stage, "pass", "no forbidden V2/V1 metrics or claims visible");
}

export async function assertProductVisionMainNav(harness) {
  const result = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const labels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')].map((button) =>
      normalize(button.textContent),
    );
    return {
      ok: labels.join("|") === "aujourd'hui|mes parties|entrainement",
      labels,
    };
  });
  if (!result.ok) {
    harness.fail("v2_vision_three_main_tabs_only", JSON.stringify(result));
  }
  harness.mark("v2_vision_three_main_tabs_only", "pass", result.labels.join(" / "));
}
