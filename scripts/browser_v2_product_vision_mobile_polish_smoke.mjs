#!/usr/bin/env node
import {
  assertGlobalSafety,
  captureGlobalVision,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { evidence, harness } = createGlobalVisionHarness("browser_v2_product_vision_mobile_polish_smoke");

async function assertCtaVisible(stage, testId) {
  const result = await harness.evalPage((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) return { ok: false, reason: "missing" };
    const rect = element.getBoundingClientRect();
    return {
      ok: rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 24 && rect.right <= window.innerWidth + 2,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }, testId);
  if (!result.ok) harness.fail(stage, JSON.stringify(result));
  harness.mark(stage, "pass", testId);
}

async function main() {
  try {
    await openGlobalVision(harness, { viewport: { width: 390, height: 844, mobile: true } });
    await harness.assertNoHorizontalOverflow("mobile_today_no_horizontal_overflow", [
      "html",
      "body",
      ".v2-vision-app",
      ".v2-vision-workspace",
      ".v2-vision-screen",
      ".v2-vision-header",
      ".v2-vision-nav",
    ]);
    await assertCtaVisible("mobile_today_cta_visible", "v2-vision-today-start");
    await assertGlobalSafety(harness, "mobile_today_safe");
    await captureGlobalVision(harness, evidence, "mobile_today_final", "390x844");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    await harness.assertNoHorizontalOverflow("mobile_training_no_horizontal_overflow", [
      "html",
      "body",
      ".v2-vision-app",
      ".v2-vision-workspace",
      ".v2-vision-screen",
      ".v2-vision-dojo",
    ]);
    await assertCtaVisible("mobile_training_cta_visible", "v2-vision-training-start");
    await captureGlobalVision(harness, evidence, "mobile_training_final", "390x844");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
    await harness.assertNoHorizontalOverflow("mobile_decision_lab_no_horizontal_overflow", [
      "html",
      "body",
      ".v2-vision-app",
      ".v2-vision-workspace",
      ".v2-vision-lab",
      ".v2-vision-board-stage",
    ]);
    await captureGlobalVision(harness, evidence, "mobile_decision_lab_final", "390x844");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
