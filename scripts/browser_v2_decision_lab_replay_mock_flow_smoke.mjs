#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_replay_mock_flow_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_replay_mock_flow_smoke.json");

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function expectText(stage, requiredLabels) {
  const result = await harness.evalPage((labels) => {
    const text = document.body?.innerText ?? "";
    return {
      ok: labels.every((label) => text.includes(label)),
      labels,
      text,
    };
  }, requiredLabels);
  if (!result.ok) fail(stage, JSON.stringify(result));
  mark(stage, "pass", requiredLabels.join(" | "));
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
    await expectText("replay_idle", ["File de reprise", "Commencer la tentative", "Prêt à rejouer"]);

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await expectText("replay_attempting", ["À toi de jouer", "Valider", "Indice", "Voir correction"]);

    await harness.clickByTestId("decision-lab-replay-correction", { afterMs: 200 });
    await expectText("replay_feedback_from_correction", ["Feedback", "Bien joué", "Position suivante", "Réessayer"]);

    await harness.clickByTestId("decision-lab-replay-retry", { afterMs: 200 });
    await expectText("replay_retry", ["Commencer la tentative", "Prêt à rejouer"]);

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    const nextResult = await harness.evalPage(() => {
      const title = document.querySelector('[data-testid="decision-lab-left-title"]')?.textContent ?? "";
      const primary = document.querySelector('[data-testid="decision-lab-primary-action"]')?.textContent ?? "";
      return { ok: title === "File de reprise" && primary.includes("Commencer"), title, primary };
    });
    if (!nextResult.ok) fail("replay_next_position", JSON.stringify(nextResult));
    mark("replay_next_position", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
