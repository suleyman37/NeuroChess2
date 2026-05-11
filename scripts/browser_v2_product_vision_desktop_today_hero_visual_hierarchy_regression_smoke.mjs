#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  assertStageBox,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_visual_hierarchy_regression_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await assertStageBox(harness, "today_visual_hierarchy_board_stage", '[data-testid="v2-board-stage"]', 500, 420);
    const result = await harness.evalPage(() => {
      const visual = document.querySelector('[data-testid="v2-hero-visual"]');
      const board = document.querySelector('[data-testid="v2-board-stage"]');
      const title = document.querySelector('[data-testid="v2-vision-today-hero"] h2');
      const cta = document.querySelector('[data-testid="v2-vision-today-start"]');
      const titleBox = title?.getBoundingClientRect();
      const ctaBox = cta?.getBoundingClientRect();
      const boardBox = board?.getBoundingClientRect();
      const visualStyle = visual ? window.getComputedStyle(visual) : null;
      const boardStyle = board ? window.getComputedStyle(board) : null;
      const ctaStyle = cta ? window.getComputedStyle(cta) : null;
      return {
        ok:
          Boolean(visual) &&
          visualStyle?.pointerEvents === "none" &&
          Number(visualStyle?.zIndex ?? 1) <= 0 &&
          Boolean(titleBox) &&
          titleBox.width > 320 &&
          Boolean(ctaBox) &&
          ctaBox.width > 90 &&
          ctaStyle?.pointerEvents !== "none" &&
          Boolean(boardBox) &&
          boardBox.width >= 500 &&
          boardBox.height >= 420 &&
          Number(boardStyle?.zIndex ?? 1) >= 1,
        visualZ: visualStyle?.zIndex ?? "",
        visualPointerEvents: visualStyle?.pointerEvents ?? "",
        board: boardBox ? { width: Math.round(boardBox.width), height: Math.round(boardBox.height), zIndex: boardStyle?.zIndex ?? "" } : null,
        title: titleBox ? { width: Math.round(titleBox.width), height: Math.round(titleBox.height) } : null,
        cta: ctaBox ? { width: Math.round(ctaBox.width), height: Math.round(ctaBox.height), pointerEvents: ctaStyle?.pointerEvents ?? "" } : null,
      };
    });
    if (!result.ok) {
      harness.fail("today_hero_visual_hierarchy_regression", JSON.stringify(result));
    }
    harness.mark("today_hero_visual_hierarchy_regression", "pass", JSON.stringify(result));
    await captureDesktopComposition(harness, evidence, "today_hero_visual_hierarchy", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_hero_visual_hierarchy_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
