#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_no_forbidden_metrics_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await assertProductVisionForbiddenAbsent(harness, "today_no_forbidden");
    for (const testId of ["v2-vision-nav-games", "v2-vision-nav-training", "v2-vision-open-progression", "v2-vision-open-profile"]) {
      await harness.clickByTestId(testId, { afterMs: 150 });
      await assertProductVisionForbiddenAbsent(harness, `${testId}_no_forbidden`);
    }
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 100 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 150 });
    for (const mode of ["summary", "learn", "replay", "explore"]) {
      await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 100 });
      await assertProductVisionForbiddenAbsent(harness, `decision_${mode}_no_forbidden`);
    }
    const apiResult = await harness.evalPage(() => {
      const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
      const apiLike = urls.filter((url) => {
        try {
          const pathname = new URL(url).pathname;
          return ["/api/", "/games/", "/review/", "/practice/", "/daily-plan"].some((prefix) =>
            pathname.startsWith(prefix),
          );
        } catch {
          return false;
        }
      });
      return { ok: apiLike.length === 0, apiLike };
    });
    if (!apiResult.ok) {
      harness.fail("product_vision_no_api_calls", JSON.stringify(apiResult));
    }
    harness.mark("product_vision_no_api_calls", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
