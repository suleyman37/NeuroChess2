#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_visual_regression_smoke");

async function assertVisible(stage, selector) {
  const result = await harness.evalPage((selector) => {
    const element = document.querySelector(selector);
    const rect = element?.getBoundingClientRect();
    return {
      ok: Boolean(element) && rect.width > 0 && rect.height > 0,
      selector,
      width: rect ? Math.round(rect.width) : 0,
      height: rect ? Math.round(rect.height) : 0,
    };
  }, selector);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${selector} ${result.width}x${result.height}`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await assertVisible("today_hero_visual_visible", '[data-testid="v2-hero-visual"]');
    await assertVisible("today_board_stage_visible", '[data-testid="v2-board-stage"]');

    const nav = await harness.evalPage(() => {
      const labels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')]
        .map((button) => button.textContent?.trim())
        .filter(Boolean);
      return {
        ok: labels.length === 3 && labels.includes("Aujourd'hui") && labels.includes("Mes parties") && labels.includes("Entraînement"),
        labels,
      };
    });
    if (!nav.ok) {
      harness.fail("board_state_header_three_tabs", JSON.stringify(nav));
    }
    harness.mark("board_state_header_three_tabs", "pass", nav.labels.join(" / "));

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await assertVisible("source_room_accessible", '[data-testid="v2-vision-games"]');
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await assertVisible("training_accessible", '[data-testid="v2-vision-training"]');
    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 180 });
    await assertVisible("profile_accessible", '[data-testid="v2-vision-profile"]');
    await assertSafeDesktopLanguage(harness, "board_state_visual_regression_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
