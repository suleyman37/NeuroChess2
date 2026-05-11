#!/usr/bin/env node
import {
  assertSafeProgressionProfileText,
  createProgressionProfileHarness,
  openProgression,
  openProgressionProfileVision,
} from "./browser_v2_product_vision_progression_profile_helpers.mjs";

const { harness } = createProgressionProfileHarness("browser_v2_product_vision_progression_safe_no_claims_smoke");

async function main() {
  try {
    await openProgressionProfileVision(harness);
    await openProgression(harness);
    await assertSafeProgressionProfileText(harness, "progression_safe_no_claims");
    const result = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          !/\bElo\b/i.test(text) &&
          !/SkillTrace/i.test(text) &&
          !/Transfer Gap/i.test(text) &&
          !/ma[îi]trise\s*\d+\s*%/i.test(text) &&
          !/cerveau|brain|cortex|atlas|NeuroMonitor/i.test(text),
        text,
      };
    });
    if (!result.ok) {
      harness.fail("progression_no_claims_detail", JSON.stringify(result));
    }
    harness.mark("progression_no_claims_detail", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
