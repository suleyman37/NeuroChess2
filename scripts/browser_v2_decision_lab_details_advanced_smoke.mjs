#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_details_advanced_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_details_advanced_smoke.json");

const harness = new BrowserSmokeHarness(evidence);

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

    const closed = await harness.evalPage(() => {
      const cardText = document.querySelector('[data-testid="decision-lab-card"]')?.textContent ?? "";
      return {
        ok:
          cardText.includes("Pourquoi ce moment compte") &&
          cardText.includes("Impact pratique") &&
          cardText.includes("Détails avancés") &&
          !document.querySelector('[data-testid="decision-lab-deep-dive"]'),
        cardText,
      };
    });
    if (!closed.ok) fail("details_closed_with_essentials_visible", JSON.stringify(closed));
    mark("details_closed_with_essentials_visible", "pass");

    await harness.clickByTestId("decision-lab-card-details", { afterMs: 200 });
    const opened = await harness.evalPage(() => {
      const drawerText = document.querySelector('[data-testid="decision-lab-deep-dive"]')?.textContent ?? "";
      return {
        ok:
          drawerText.includes("Détails avancés") &&
          drawerText.includes("Décision") &&
          drawerText.includes("Ligne") &&
          drawerText.includes("Score") &&
          drawerText.includes("Moments") &&
          drawerText.includes("Légende"),
        drawerText,
      };
    });
    if (!opened.ok) fail("details_drawer_opened", JSON.stringify(opened));
    mark("details_drawer_opened", "pass");

    await harness.clickByTestId("decision-lab-close-details", { afterMs: 150 });
    const closedAgain = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="decision-lab-deep-dive"]'),
    }));
    if (!closedAgain.ok) fail("details_drawer_closed", JSON.stringify(closedAgain));
    mark("details_drawer_closed", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
