#!/usr/bin/env node
import {
  assertNoLargeEmptyCards,
  captureGlobalVision,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { evidence, harness } = createGlobalVisionHarness("browser_v2_product_vision_visual_empty_space_smoke");

async function assertVisualSignals(stage, selectors) {
  const result = await harness.evalPage((items) => {
    const missing = items.filter((selector) => !document.querySelector(selector));
    return { ok: missing.length === 0, missing };
  }, selectors);
  if (!result.ok) harness.fail(stage, JSON.stringify(result.missing));
  harness.mark(stage, "pass", selectors.join(" / "));
  await assertNoLargeEmptyCards(harness, `${stage}_no_large_empty_cards`);
}

async function main() {
  try {
    await openGlobalVision(harness);
    await assertVisualSignals("today_has_visual_structure", [
      '[data-testid="v2-vision-today-hero"]',
      '[data-testid="v2-vision-mission-stack"]',
      '[data-testid="v2-vision-today-progress"]',
    ]);
    await captureGlobalVision(harness, evidence, "visual_today_density");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await assertVisualSignals("games_has_visual_structure", [
      '[data-testid^="v2-vision-game-preview-"]',
      ".v2-vision-game-card",
      ".v2-vision-learning-note",
    ]);
    await captureGlobalVision(harness, evidence, "visual_games_density");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await assertVisualSignals("training_has_visual_structure", [
      '[data-testid="v2-vision-training-lanes"]',
      '[data-testid="v2-vision-training-queue"]',
      '[data-testid="v2-vision-training-preview-board"]',
    ]);
    await captureGlobalVision(harness, evidence, "visual_training_density");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await assertVisualSignals("decision_lab_has_visual_structure", [
      '[data-testid="v2-vision-lab-left"]',
      '[data-testid="v2-vision-lab-board"]',
      '[data-testid="v2-vision-decision-card"]',
      '[data-testid="v2-vision-action-dock"]',
    ]);
    await captureGlobalVision(harness, evidence, "visual_decision_lab_density");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
