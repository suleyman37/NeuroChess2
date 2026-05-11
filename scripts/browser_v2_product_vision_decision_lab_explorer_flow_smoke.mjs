#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  assertOnePrimary,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_explorer_flow_smoke");

async function main() {
  try {
    await openDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 220 });
    const before = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalizedText = text.toLocaleLowerCase("fr-FR");
      const analyzeLineButtons = [...document.querySelectorAll("button")].filter((button) =>
        (button.textContent ?? "").includes("Analyser la ligne"),
      );
      return {
        ok:
          normalizedText.includes("branche locale") &&
          normalizedText.includes("local · hors entraînement") &&
          normalizedText.includes("non analysé") &&
          analyzeLineButtons.length === 1,
        text,
        analyzeLineButtons: analyzeLineButtons.length,
      };
    });
    if (!before.ok) {
      harness.fail("explorer_before_contract", JSON.stringify(before));
    }
    await assertOnePrimary(harness, "explorer_before_one_primary");
    await captureDecisionLab(harness, evidence, "decision_lab_explorer_before");

    await harness.clickByTestId("v2-vision-analyze-line", { afterMs: 260 });
    await harness.waitForPagePredicate("explorer analyzed", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Ligne analysée") && text.includes("Jouable"), text };
    });
    const after = await harness.evalPage(() => {
      const left = document.querySelector('[data-testid="v2-vision-lab-left"]')?.textContent ?? "";
      const right = document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent ?? "";
      const normalizedRight = right.toLocaleLowerCase("fr-FR");
      return {
        ok: left.includes("Bxf7+") && normalizedRight.includes("le dernier coup reste défendable"),
        left,
        right,
      };
    });
    if (!after.ok) {
      harness.fail("explorer_after_analysis_contract", JSON.stringify(after));
    }
    await captureDecisionLab(harness, evidence, "decision_lab_explorer_after_analysis");

    await harness.clickByText("Retour à la partie", { exact: true, afterMs: 220 });
    await harness.waitForPagePredicate("returned to summary", () => {
      const text = document.body?.innerText ?? "";
      const normalizedText = text.toLocaleLowerCase("fr-FR");
      return { ok: normalizedText.includes("décision du moment") && text.includes("Rejouer ce moment"), text };
    });
    harness.mark("explorer_return_partie", "pass");
    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
