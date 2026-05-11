#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_summary_information_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_summary_information_smoke.json");

const harness = new BrowserSmokeHarness(evidence);
const required = [
  "Pourquoi ce moment compte",
  "Impact pratique",
  "Meilleure idée",
  "Action recommandée",
  "Détails avancés",
];

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
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

    const result = await harness.evalPage((labels) => {
      const cardText = document.querySelector('[data-testid="decision-lab-card"]')?.textContent ?? "";
      const actionsText = document.querySelector('[data-testid="decision-lab-actions"]')?.textContent ?? "";
      return {
        ok:
          labels.every((label) => cardText.includes(label)) &&
          actionsText.includes("Rejouer ce moment") &&
          actionsText.includes("Explorer depuis ici") &&
          actionsText.includes("Voir la ligne") &&
          !actionsText.includes("Détails avancés"),
        cardText,
        actionsText,
      };
    }, required);
    if (!result.ok) fail("summary_information", JSON.stringify(result));
    mark("summary_information", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
