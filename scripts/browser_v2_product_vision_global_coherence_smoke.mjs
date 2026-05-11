#!/usr/bin/env node
import {
  assertGlobalSafety,
  assertNoLargeEmptyCards,
  captureGlobalVision,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { evidence, harness } = createGlobalVisionHarness("browser_v2_product_vision_global_coherence_smoke");

async function assertContains(stage, labels) {
  await harness.assertPageContains(stage, labels);
  await assertGlobalSafety(harness, `${stage}_safe`);
  await assertNoLargeEmptyCards(harness, `${stage}_no_large_empty_cards`);
}

async function main() {
  try {
    await openGlobalVision(harness);
    await assertContains("today_final_accessible", ["Mission du jour", "Commencer", "Revanche douce", "Régularité"]);
    await captureGlobalVision(harness, evidence, "today_final");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 220 });
    await assertContains("games_final_accessible", ["Mes parties", "Importer PGN", "Review prête", "Erreur récupérable"]);
    await captureGlobalVision(harness, evidence, "games_final");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    await assertContains("training_final_accessible", ["Entraînement", "Commencer la session", "Révision du jour", "File de session"]);
    await captureGlobalVision(harness, evidence, "training_final");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
    await assertContains("decision_lab_summary_accessible", ["Decision Lab", "Moments clés", "Décision du moment", "Rejouer ce moment"]);
    await captureGlobalVision(harness, evidence, "decision_lab_summary_final");

    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await assertContains("decision_lab_learn_accessible", ["Apprendre", "Mini-leçon", "Checklist", "Voir la ligne"]);
    await captureGlobalVision(harness, evidence, "decision_lab_learn_final");

    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertContains("decision_lab_replay_accessible", ["Rejouer", "Effort actif", "Commencer la tentative"]);
    await captureGlobalVision(harness, evidence, "decision_lab_replay_final");

    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await assertContains("decision_lab_explorer_accessible", ["Explorer", "Branche", "Local"]);
    await captureGlobalVision(harness, evidence, "decision_lab_explorer_final");

    await harness.clickByText("Retour", { afterMs: 180, exact: true });
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
    await assertContains("practice_final_accessible", ["S'entraîner", "Rejoue cette décision", "Commencer"]);
    await captureGlobalVision(harness, evidence, "practice_final");

    await harness.clickByText("Retour", { afterMs: 180, exact: true });
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 260 });
    await assertContains("explorer_final_accessible", ["Explorer", "Local", "Créer une branche"]);
    await captureGlobalVision(harness, evidence, "explorer_final");

    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 220 });
    await assertContains("progression_final_accessible", ["Progression", "18 décisions revues", "Régularité", "Plan 30 jours"]);
    await captureGlobalVision(harness, evidence, "progression_final");

    await harness.clickByText("Retour", { afterMs: 180, exact: true });
    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 220 });
    await assertContains("profile_final_accessible", ["Profil / Paramètres", "Préférences", "Données et confidentialité"]);
    await captureGlobalVision(harness, evidence, "profile_final");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
