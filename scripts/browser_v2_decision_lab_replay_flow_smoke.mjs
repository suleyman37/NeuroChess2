#!/usr/bin/env node
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_replay_flow_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_replay_flow_smoke.json");
const screenshotDir = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "screenshots_raw");
mkdirSync(screenshotDir, { recursive: true });

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function capture(name) {
  const screenshotPath = path.join(screenshotDir, name);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  return screenshotPath;
}

async function contains(stage, labels) {
  const result = await harness.evalPage((expected) => {
    const text = document.body?.innerText ?? "";
    const normalized = text.toLocaleLowerCase("fr-FR");
    return {
      ok: expected.every((label) => normalized.includes(String(label).toLocaleLowerCase("fr-FR"))),
      expected,
      text,
    };
  }, labels);
  if (!result.ok) fail(stage, JSON.stringify(result));
  mark(stage, "pass", labels.join(" | "));
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app#/v2-review-lab");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.waitForPagePredicate("Decision Lab ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="decision-lab-shell"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);

    await harness.clickByTestId("decision-lab-mode-replay", { afterMs: 200 });
    await contains("replay_before", ["Objectif", "Consigne", "Aide disponible", "Commencer la tentative"]);

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await contains("replay_active", ["À toi de jouer", "Valider", "Indice", "Voir correction"]);
    await capture("10_replay_active_1366x768.png");

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await contains("replay_feedback", ["Feedback", "Bien joué", "Position suivante", "À retenir"]);
    await capture("11_replay_feedback_flow_1366x768.png");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
