#!/usr/bin/env node
import {
  assertScienceSafeLanguage,
  createLanguageHarness,
  openLanguageVision,
} from "./browser_v2_product_vision_language_helpers.mjs";

const { harness } = createLanguageHarness("browser_v2_product_vision_vocabulary_coherence_smoke");

async function main() {
  try {
    await openLanguageVision(harness);
    await harness.assertPageContains("today_vocabulary", [
      "Aujourd'hui",
      "Mes parties",
      "Entraînement",
      "Régularité",
      "Rejouer",
    ]);
    await assertScienceSafeLanguage(harness, "today_vocabulary_safe");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.assertPageContains("decision_lab_vocabulary", [
      "Decision Lab",
      "Décision",
      "Rejouer",
      "Explorer",
      "Détails avancés",
    ]);
    await assertScienceSafeLanguage(harness, "decision_lab_vocabulary_safe");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await harness.assertPageContains("training_vocabulary", [
      "Atelier personnel",
      "Revanche douce",
      "Engagement",
      "File de session",
    ]);
    await assertScienceSafeLanguage(harness, "training_vocabulary_safe");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
