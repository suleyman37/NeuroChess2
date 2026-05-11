#!/usr/bin/env node
import {
  assertAtMostOnePrimary,
  assertGlobalSafety,
  assertNoDuplicateButtonLabels,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { harness } = createGlobalVisionHarness("browser_v2_product_vision_action_hierarchy_smoke");

async function check(stage) {
  await assertAtMostOnePrimary(harness, `${stage}_at_most_one_primary`);
  await assertNoDuplicateButtonLabels(harness, `${stage}_no_duplicate_button_labels`);
  await assertGlobalSafety(harness, `${stage}_safe_copy`);
}

async function main() {
  try {
    await openGlobalVision(harness);
    await check("today");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await check("games");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await check("training");

    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await check("practice_ready");
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await check("practice_attempting");
    await harness.clickByText("Retour", { exact: true, afterMs: 160 });

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await check("decision_lab_summary");
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 160 });
    await check("decision_lab_learn");
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 160 });
    await check("decision_lab_replay");
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await check("decision_lab_explore");

    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await check("explorer_initial");

    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 180 });
    await check("progression");
    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 180 });
    await check("profile");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
