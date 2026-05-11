#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  assertStageBox,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_visual_3d_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const result = await harness.evalPage(() => {
      const visual = document.querySelector('[data-testid="v2-hero-visual"]');
      const navLabels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')]
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean);
      const hero = document.querySelector('[data-testid="v2-vision-today-hero"]');
      const primary = [...(hero?.querySelectorAll(".v2-vision-primary") ?? [])].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        ok:
          Boolean(visual) &&
          visual?.getAttribute("data-hero-visual-theme") === "decision-constellation" &&
          visual?.getAttribute("data-renderer") === "svg" &&
          Boolean(document.querySelector('[data-testid="v2-hero-visual-constellation"]')) &&
          primary.length === 1 &&
          navLabels.length === 3,
        renderer: visual?.getAttribute("data-renderer") ?? "",
        motion: visual?.getAttribute("data-motion") ?? "",
        theme: visual?.getAttribute("data-hero-visual-theme") ?? "",
        navLabels,
        primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
      };
    });
    if (!result.ok) {
      harness.fail("today_hero_visual_3d_contract", JSON.stringify(result));
    }
    harness.mark("today_hero_visual_3d_contract", "pass", JSON.stringify(result));
    await assertStageBox(harness, "today_hero_visual_board_stage", '[data-testid="v2-board-stage"]', 500, 420);
    await captureDesktopComposition(harness, evidence, "today_hero_visual_3d", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_hero_visual_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
