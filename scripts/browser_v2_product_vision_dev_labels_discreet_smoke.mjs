#!/usr/bin/env node
import {
  assertNoDevLanguageInMainHero,
  assertScienceSafeLanguage,
  captureLanguageElement,
  createLanguageHarness,
  openLanguageVision,
} from "./browser_v2_product_vision_language_helpers.mjs";

const { evidence, harness } = createLanguageHarness("browser_v2_product_vision_dev_labels_discreet_smoke");

async function main() {
  try {
    await openLanguageVision(harness);
    await harness.assertPageContains("prototype_badge_and_v1_exit", ["Prototype", "Retour V1"]);
    await assertNoDevLanguageInMainHero(harness);
    await assertScienceSafeLanguage(harness, "dev_labels_science_safe");
    await captureLanguageElement(harness, evidence, "header_dev_labels", '[data-testid="v2-vision-header"]');
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
