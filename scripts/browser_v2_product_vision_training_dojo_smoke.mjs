#!/usr/bin/env node
import {
  assertNoForbidden,
  assertOnePrimary,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_training_dojo_smoke");

async function main() {
  try {
    await openVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    const result = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalizedText = text.toLocaleLowerCase("fr-FR");
      return {
        ok:
          normalizedText.includes("entraînement") &&
          normalizedText.includes("commencer la session") &&
          normalizedText.includes("révision du jour") &&
          normalizedText.includes("revanche contre toi-même") &&
          normalizedText.includes("erreurs à revoir") &&
          normalizedText.includes("file de session") &&
        Boolean(document.querySelector('[data-testid="v2-vision-training-preview-board"]')),
        text,
      };
    });
    if (!result.ok) {
      harness.fail("training_dojo_contract", JSON.stringify(result));
    }
    harness.mark("training_dojo_contract", "pass");
    await assertOnePrimary(harness, "training_dojo_one_primary");
    await captureTpe(harness, evidence, "training_desktop");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
