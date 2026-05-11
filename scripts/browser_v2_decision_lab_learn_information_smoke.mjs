#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_learn_information_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_learn_information_smoke.json");

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

    await harness.clickByTestId("decision-lab-mode-learn", { afterMs: 200 });
    const result = await harness.evalPage(() => {
      const cardText = document.querySelector('[data-testid="decision-lab-card"]')?.textContent ?? "";
      const left = document.querySelector('[data-testid="decision-lab-path"]');
      const leftText = left?.textContent ?? "";
      const cuePills = [...(left?.querySelectorAll(".decision-lab-cue-pill") ?? [])]
        .map((pill) => pill.textContent?.trim() ?? "");
      const longCues = cuePills.filter((cue) => cue.split(/\s+/).length > 4);
      const actionsText = document.querySelector('[data-testid="decision-lab-actions"]')?.textContent ?? "";
      return {
        ok:
          cardText.includes("Idée clé") &&
          cardText.includes("Pourquoi") &&
          cardText.includes("Checklist") &&
          cardText.includes("À retenir") &&
          cardText.includes("Mini-ligne") &&
          cuePills.length >= 3 &&
          longCues.length === 0 &&
          actionsText.includes("Voir la ligne") &&
          !actionsText.replace("Voir la ligne", "").includes("Voir la ligne"),
        cardText,
        leftText,
        cuePills,
        longCues,
        actionsText,
      };
    });
    if (!result.ok) fail("learn_information", JSON.stringify(result));
    mark("learn_information", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
