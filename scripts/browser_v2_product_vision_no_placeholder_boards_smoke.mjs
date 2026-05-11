#!/usr/bin/env node
import {
  assertBoardReady,
  captureBoardHero,
  createBoardHeroHarness,
  openBoardHeroVision,
} from "./browser_v2_product_vision_board_hero_helpers.mjs";

const { evidence, harness } = createBoardHeroHarness("browser_v2_product_vision_no_placeholder_boards_smoke");

async function main() {
  try {
    await openBoardHeroVision(harness);
    const todayPlaceholders = await harness.evalPage(() => ({
      sourcePreviewCount: document.querySelectorAll(".v2-vision-source-preview").length,
      legacyMiniCells: document.querySelectorAll(".v2-vision-mini-board > span").length,
    }));
    if (todayPlaceholders.sourcePreviewCount > 0 || todayPlaceholders.legacyMiniCells > 0) {
      harness.fail("today_no_placeholder_board", JSON.stringify(todayPlaceholders));
    }
    harness.mark("today_no_placeholder_board", "pass");
    await assertBoardReady(harness, "today_mini_board_non_empty", '[data-testid="v2-vision-today-board-preview"]');

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    const gameBoardSummary = await harness.evalPage(() => {
      const cards = [...document.querySelectorAll(".v2-vision-game-card")];
      const boards = cards.map((card) => {
        const board = card.querySelector('[data-board-kind="vision-mini-board"]');
        return {
          ok:
            Boolean(board) &&
            Number(board?.getAttribute("data-board-cases") ?? 0) >= 64 &&
            Number(board?.getAttribute("data-piece-count") ?? 0) > 0,
          label: card.querySelector('[data-testid^="v2-vision-game-moment-"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        };
      });
      return {
        ok:
          cards.length === 3 &&
          boards.length === 3 &&
          boards.every((item) => item.ok) &&
          document.querySelectorAll(".v2-vision-source-preview").length === 0,
        cards: cards.length,
        boards,
      };
    });
    if (!gameBoardSummary.ok) {
      harness.fail("games_no_placeholder_boards", JSON.stringify(gameBoardSummary));
    }
    harness.mark("games_no_placeholder_boards", "pass");
    await captureBoardHero(harness, evidence, "games_mini_boards");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await assertBoardReady(harness, "training_mini_board_non_empty", '[data-testid="v2-vision-training-preview-board"]');
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
