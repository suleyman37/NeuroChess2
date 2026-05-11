#!/usr/bin/env node
import {
  assertDesktopSafetyText,
  assertNoSpoilerBoard,
  assertStagePremium,
  captureDesktopNorthStar,
  createDesktopNorthStarHarness,
  openDesktopDecisionLab,
  openDesktopPractice,
  openDesktopVision,
} from "./browser_v2_product_vision_desktop_north_star_helpers.mjs";

const { evidence, harness } = createDesktopNorthStarHarness("browser_v2_product_vision_desktop_board_stage_smoke");

async function main() {
  try {
    await openDesktopVision(harness);
    await openDesktopDecisionLab(harness);
    await assertStagePremium(harness, "decision_lab_board_stage_premium", '[data-testid="v2-vision-board-stage"]');
    await captureDesktopNorthStar(harness, evidence, "decision_lab_board_stage_desktop");

    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 200 });
    await assertNoSpoilerBoard(harness, "decision_replay_stage_no_spoiler", "v2-vision-lab-board-shell");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openDesktopPractice(harness);
    await assertStagePremium(harness, "practice_board_stage_premium", ".v2-vision-practice-stage");
    await assertNoSpoilerBoard(harness, "practice_stage_no_spoiler", "v2-vision-practice-board-shell");
    await captureDesktopNorthStar(harness, evidence, "practice_board_stage_desktop");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openDesktopDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 200 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 240 });
    await assertStagePremium(harness, "explorer_board_stage_premium", ".v2-vision-explorer-stage");
    await captureDesktopNorthStar(harness, evidence, "explorer_board_stage_desktop");
    await assertDesktopSafetyText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
