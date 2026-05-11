#!/usr/bin/env node
import {
  assertBoardReady,
  captureBoardHero,
  createBoardHeroHarness,
  openBoardHeroVision,
} from "./browser_v2_product_vision_board_hero_helpers.mjs";

const { evidence, harness } = createBoardHeroHarness("browser_v2_product_vision_today_board_preview_smoke");

async function main() {
  try {
    await openBoardHeroVision(harness);
    await harness.assertPageContains("today_board_copy", ["Décision du jour", "Qxb7?", "Défense du roi", "Commencer"]);
    await assertBoardReady(harness, "today_board_preview_visible", '[data-testid="v2-vision-today-board-preview"]');
    const cta = await harness.evalPage(() => {
      const button = document.querySelector('[data-testid="v2-vision-today-start"]');
      if (!button) return { ok: false, reason: "missing" };
      const rect = button.getBoundingClientRect();
      return { ok: rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 4, rect };
    });
    if (!cta.ok) {
      harness.fail("today_cta_still_visible", JSON.stringify(cta));
    }
    harness.mark("today_cta_still_visible", "pass");
    await captureBoardHero(harness, evidence, "today_board_preview");

    await harness.setViewport({ width: 390, height: 844, mobile: true });
    await assertBoardReady(harness, "today_mobile_board_preview_visible", '[data-testid="v2-vision-today-board-preview"]');
    await captureBoardHero(harness, evidence, "mobile_today_board_preview", "390x844");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
