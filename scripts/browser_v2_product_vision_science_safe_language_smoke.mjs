#!/usr/bin/env node
import {
  assertScienceSafeLanguage,
  captureLanguage,
  createLanguageHarness,
  openLanguageVision,
} from "./browser_v2_product_vision_language_helpers.mjs";

const { evidence, harness } = createLanguageHarness("browser_v2_product_vision_science_safe_language_smoke");

async function check(stage) {
  await assertScienceSafeLanguage(harness, stage);
}

async function main() {
  try {
    await openLanguageVision(harness);
    await check("today_language_safe");
    await captureLanguage(harness, evidence, "today_language");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await check("games_language_safe");
    await captureLanguage(harness, evidence, "games_language");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await check("training_language_safe");
    await captureLanguage(harness, evidence, "training_language");

    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await check("practice_language_safe");
    await captureLanguage(harness, evidence, "practice_language");

    await harness.clickByText("Retour", { exact: true, afterMs: 160 });
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await check("decision_lab_language_safe");
    await captureLanguage(harness, evidence, "decision_lab_language");

    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await check("explorer_language_safe");
    await captureLanguage(harness, evidence, "explorer_language");

    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 180 });
    await check("progression_language_safe");
    await captureLanguage(harness, evidence, "progression_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
