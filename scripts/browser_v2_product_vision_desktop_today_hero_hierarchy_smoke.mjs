#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  assertStageBox,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_hierarchy_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await harness.assertPageContains("today_board_first_copy", [
      "Mission du jour",
      "Consolide ce qui revient vraiment dans tes parties.",
      "Commencer",
      "Décision du jour",
      "Qxb7?",
      "Régularité",
    ]);
    await assertStageBox(harness, "today_board_stage_large_enough_1366", '[data-testid="v2-board-stage"]', 500, 420);
    const hierarchy = await harness.evalPage(() => {
      const navLabels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')]
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim());
      const hero = document.querySelector('[data-testid="v2-vision-today-hero"]');
      const primary = [...(hero?.querySelectorAll(".v2-vision-primary") ?? [])]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      const board = document.querySelector('[data-testid="v2-board-stage"]')?.getBoundingClientRect();
      return {
        ok:
          navLabels.join("|") === "Aujourd'hui|Mes parties|Entraînement" &&
          primary.length === 1 &&
          Boolean(board) &&
          board.width >= 500 &&
          board.height >= 420,
        navLabels,
        primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
        board: board ? { width: Math.round(board.width), height: Math.round(board.height) } : null,
      };
    });
    if (!hierarchy.ok) {
      harness.fail("today_hero_hierarchy", JSON.stringify(hierarchy));
    }
    harness.mark("today_hero_hierarchy", "pass", JSON.stringify(hierarchy.board));
    await captureDesktopComposition(harness, evidence, "today_final", "1366x768");
    await assertSafeDesktopLanguage(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
