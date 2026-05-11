#!/usr/bin/env node
import {
  assertOnePrimaryIn,
  captureButtonVision,
  createButtonHarness,
  openButtonVision,
} from "./browser_v2_product_vision_button_helpers.mjs";

const { evidence, harness } = createButtonHarness("browser_v2_product_vision_button_hierarchy_smoke");

async function main() {
  try {
    await openButtonVision(harness);
    await assertOnePrimaryIn(harness, "today_one_primary", '[data-testid="v2-vision-today"]');
    await captureButtonVision(harness, evidence, "today_buttons");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await assertOnePrimaryIn(harness, "training_one_primary", '[data-testid="v2-vision-training"]');
    await captureButtonVision(harness, evidence, "training_buttons");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await assertOnePrimaryIn(harness, "decision_lab_summary_one_primary", '[data-testid="v2-vision-board-stage"]');
    await captureButtonVision(harness, evidence, "decision_lab_summary_actions");

    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await assertOnePrimaryIn(harness, "decision_lab_learn_one_primary", '[data-testid="v2-vision-board-stage"]');
    await captureButtonVision(harness, evidence, "decision_lab_learn_actions");

    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertOnePrimaryIn(harness, "decision_lab_replay_one_primary", '[data-testid="v2-vision-board-stage"]');

    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await assertOnePrimaryIn(harness, "practice_one_primary", '[data-testid="v2-vision-practice"]');
    await captureButtonVision(harness, evidence, "practice_actions");

    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await assertOnePrimaryIn(harness, "explorer_one_primary", '[data-testid="v2-vision-explorer"]');
    await captureButtonVision(harness, evidence, "explorer_actions");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
