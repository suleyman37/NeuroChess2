#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_details_smoke");

async function main() {
  try {
    await openDecisionLab(harness);
    const before = await harness.evalPage(() => {
      const card = document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent ?? "";
      return {
        ok:
          card.includes("Pourquoi") &&
          card.includes("Impact pratique") &&
          card.includes("Meilleure idée") &&
          card.includes("Action recommandée") &&
          !document.querySelector('[data-testid="v2-vision-details-drawer"]'),
        card,
      };
    });
    if (!before.ok) {
      harness.fail("details_essential_info_visible_before_open", JSON.stringify(before));
    }
    harness.mark("details_essential_info_visible_before_open", "pass");

    await harness.clickByTestId("v2-vision-details-open", { afterMs: 220 });
    const opened = await harness.evalPage(() => {
      const drawer = document.querySelector('[data-testid="v2-vision-details-drawer"]')?.textContent ?? "";
      return {
        ok:
          drawer.includes("Décision complète") &&
          drawer.includes("Ligne") &&
          drawer.includes("Score") &&
          drawer.includes("Moments") &&
          drawer.includes("Légende"),
        drawer,
      };
    });
    if (!opened.ok) {
      harness.fail("details_drawer_contract", JSON.stringify(opened));
    }
    harness.mark("details_drawer_contract", "pass");
    await captureDecisionLab(harness, evidence, "decision_lab_details_drawer");

    await harness.clickByTestId("v2-vision-details-close", { afterMs: 180 });
    await harness.waitForPagePredicate("details closed", () => ({
      ok: !document.querySelector('[data-testid="v2-vision-details-drawer"]'),
      text: document.body?.innerText ?? "",
    }));
    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
