#!/usr/bin/env node
import {
  assertBoardReady,
  captureBoardHero,
  createBoardHeroHarness,
  openBoardHeroVision,
} from "./browser_v2_product_vision_board_hero_helpers.mjs";

const { evidence, harness } = createBoardHeroHarness("browser_v2_product_vision_board_hero_smoke");

async function main() {
  try {
    await openBoardHeroVision(harness);
    await assertBoardReady(harness, "today_board_preview_ready", '[data-testid="v2-vision-today-board-preview"]');
    await captureBoardHero(harness, evidence, "today_board_hero");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
    await assertBoardReady(harness, "decision_lab_board_ready", '[data-testid="v2-vision-lab-board-shell"]');
    await captureBoardHero(harness, evidence, "decision_lab_board");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await assertBoardReady(harness, "training_preview_board_ready", '[data-testid="v2-vision-training-preview-board"]');
    await captureBoardHero(harness, evidence, "training_board_preview");
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
    await assertBoardReady(harness, "practice_board_ready", '[data-testid="v2-vision-practice-board-shell"]');
    await captureBoardHero(harness, evidence, "practice_board");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 260 });
    await assertBoardReady(harness, "explorer_board_ready", '[data-testid="v2-vision-explorer-board-shell"]');
    await captureBoardHero(harness, evidence, "explorer_board");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
