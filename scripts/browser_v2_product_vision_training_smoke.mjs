#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_training_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 200 });
    await harness.assertPageContains("training_core_content", [
      "Révision du jour",
      "Revanche douce",
      "Erreurs à revoir",
      "File de session",
      "Commencer la session",
    ]);
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 250 });
    await harness.waitForPagePredicate("practice opened from training", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')),
      text: document.body?.innerText ?? "",
    }));
    harness.mark("training_opens_practice", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
