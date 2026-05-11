#!/usr/bin/env node
import {
  assertGlobalSafety,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { harness } = createGlobalVisionHarness("browser_v2_product_vision_microcopy_safety_smoke");

async function check(stage) {
  await assertGlobalSafety(harness, stage);
}

async function main() {
  try {
    await openGlobalVision(harness);
    await check("today_safe");
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await check("games_safe");
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await check("training_safe");
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await check("practice_safe");
    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await check("decision_lab_safe");
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await check("explorer_safe");
    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 180 });
    await check("progression_safe");
    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 180 });
    await check("profile_safe");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
