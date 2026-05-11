#!/usr/bin/env node
import {
  assertNoHorizontalOverflow,
  assertOnePrimaryIn,
  captureButtonVision,
  createButtonHarness,
  openButtonVision,
} from "./browser_v2_product_vision_button_helpers.mjs";

const { evidence, harness } = createButtonHarness("browser_v2_product_vision_mobile_button_hierarchy_smoke");

async function assertPrimaryVisible(stage, testId) {
  const result = await harness.evalPage((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!button) return { ok: false, reason: "missing" };
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      ok:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none",
      rect: { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
    };
  }, testId);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", JSON.stringify(result.rect));
}

async function main() {
  try {
    await openButtonVision(harness, { viewport: { width: 390, height: 844, mobile: true } });
    await assertOnePrimaryIn(harness, "mobile_today_one_primary", '[data-testid="v2-vision-today"]');
    await assertPrimaryVisible("mobile_today_cta_visible", "v2-vision-today-start");
    await assertNoHorizontalOverflow(harness, "mobile_today_no_horizontal_overflow");
    await captureButtonVision(harness, evidence, "mobile_today", "390x844");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    await assertOnePrimaryIn(harness, "mobile_training_one_primary", '[data-testid="v2-vision-training"]');
    await assertPrimaryVisible("mobile_training_cta_visible", "v2-vision-training-start");
    await assertNoHorizontalOverflow(harness, "mobile_training_no_horizontal_overflow");
    await captureButtonVision(harness, evidence, "mobile_training", "390x844");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
