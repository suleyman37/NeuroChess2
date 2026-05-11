#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_today_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.assertPageContains("today_core_content", [
      "Mission du jour",
      "12 minutes",
      "4 positions à revoir",
      "1 décision critique",
      "Commencer",
      "Régularité",
      "effort",
      "régularité",
    ]);
    await harness.clickByTestId("v2-vision-today-start", { afterMs: 250 });
    await harness.waitForPagePredicate("practice opened from today", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')),
      text: document.body?.innerText ?? "",
    }));
    harness.mark("today_start_opens_practice", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
