#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_progression_safe_claims_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 200 });
    await harness.assertPageContains("progression_safe_content", [
      "Effort",
      "régularité",
      "décisions consolidées",
      "Régularité",
      "4 jours actifs",
      "Plan 30 jours",
    ]);
    await assertProductVisionForbiddenAbsent(harness);
    const result = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      return {
        ok: !/elo/i.test(text) && !/prediction/i.test(text),
        text,
      };
    });
    if (!result.ok) {
      harness.fail("progression_no_elo_prediction_claims", JSON.stringify(result));
    }
    harness.mark("progression_no_elo_prediction_claims", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
