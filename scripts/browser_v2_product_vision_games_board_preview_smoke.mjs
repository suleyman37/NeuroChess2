#!/usr/bin/env node
import {
  captureBoardHero,
  createBoardHeroHarness,
  openBoardHeroVision,
} from "./browser_v2_product_vision_board_hero_helpers.mjs";

const { evidence, harness } = createBoardHeroHarness("browser_v2_product_vision_games_board_preview_smoke");

async function main() {
  try {
    await openBoardHeroVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 220 });
    const result = await harness.evalPage(() => {
      const cards = [...document.querySelectorAll(".v2-vision-game-card")];
      const summaries = cards.map((card) => {
        const board = card.querySelector('[data-board-kind="vision-mini-board"]');
        const momentText = card.querySelector('[data-testid^="v2-vision-game-moment-"]')?.textContent ?? "";
        return {
          hasMoment: momentText.includes("Moment clé"),
          hasBoard: Boolean(board),
          cases: Number(board?.getAttribute("data-board-cases") ?? 0),
          pieceCount: Number(board?.getAttribute("data-piece-count") ?? 0),
          label: board?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        };
      });
      return {
        ok:
          cards.length === 3 &&
          summaries.every((item) => item.hasMoment && item.hasBoard && item.cases >= 64 && item.pieceCount > 0),
        cards: cards.length,
        summaries,
      };
    });
    if (!result.ok) {
      harness.fail("games_each_card_has_board_preview", JSON.stringify(result));
    }
    harness.mark("games_each_card_has_board_preview", "pass");
    await captureBoardHero(harness, evidence, "games_board_previews");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
