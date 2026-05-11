#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  assertProductVisionMainNav,
  captureProductVision,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { evidence, harness } = createProductVisionHarness("browser_v2_product_vision_shell_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await assertProductVisionMainNav(harness);
    await captureProductVision(harness, evidence, "01_today");

    for (const [testId, stage, screenshot] of [
      ["v2-vision-nav-games", "games_nav", "02_games"],
      ["v2-vision-nav-training", "training_nav", "03_training"],
      ["v2-vision-open-progression", "progression_open", "04_progression"],
      ["v2-vision-open-profile", "profile_open", "05_profile"],
    ]) {
      await harness.clickByTestId(testId, { afterMs: 250 });
      await captureProductVision(harness, evidence, screenshot);
      harness.mark(stage, "pass");
    }

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 250 });
    await captureProductVision(harness, evidence, "06_decision_lab_summary");
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 150 });
    await captureProductVision(harness, evidence, "07_decision_lab_learn");
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 150 });
    await captureProductVision(harness, evidence, "08_decision_lab_replay");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 150 });
    await captureProductVision(harness, evidence, "09_decision_lab_replay_feedback");
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 150 });
    await captureProductVision(harness, evidence, "10_decision_lab_explorer");
    await harness.clickByTestId("v2-vision-analyze-line", { afterMs: 200 });
    await captureProductVision(harness, evidence, "11_decision_lab_explorer_analyzed");
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 150 });
    await harness.clickByText("Voir la ligne", { exact: true, afterMs: 150 });
    await captureProductVision(harness, evidence, "12_line_player");
    await harness.clickByTestId("v2-vision-line-close", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-details-open", { afterMs: 150 }).catch(async () => {
      await harness.clickByTestId("v2-vision-mode-summary", { afterMs: 100 });
      await harness.clickByTestId("v2-vision-details-open", { afterMs: 150 });
    });
    await captureProductVision(harness, evidence, "13_details_advanced");

    await assertProductVisionForbiddenAbsent(harness);
    harness.mark("v2_product_vision_shell", "pass", "main visual surfaces captured");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
