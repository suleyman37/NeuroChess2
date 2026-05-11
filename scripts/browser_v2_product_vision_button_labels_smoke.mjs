#!/usr/bin/env node
import {
  captureButtonVision,
  createButtonHarness,
  openButtonVision,
} from "./browser_v2_product_vision_button_helpers.mjs";

const { evidence, harness } = createButtonHarness("browser_v2_product_vision_button_labels_smoke");

async function main() {
  try {
    await openButtonVision(harness);
    await harness.assertPageContains("today_action_labels", ["Commencer", "Voir le plan du jour", "Importer une partie"]);

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.assertPageContains("games_action_labels", ["Voir la Review", "Reprendre l'analyse", "Détails", "Supprimer"]);
    await captureButtonVision(harness, evidence, "games_card_actions");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await harness.assertPageContains("training_action_labels", ["Commencer la session", "Voir la file du jour"]);

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.assertPageContains("decision_lab_summary_labels", ["Rejouer ce moment", "Explorer depuis ici", "Voir la ligne"]);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await harness.assertPageContains("decision_lab_replay_labels", ["Commencer la tentative"]);
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.assertPageContains("decision_lab_replay_feedback_labels", ["Position suivante"]);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.assertPageContains("decision_lab_explorer_labels", ["Analyser la ligne", "Retour à la partie"]);

    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-explorer-create-branch", { afterMs: 180 });
    await harness.assertPageContains("explorer_action_labels", ["Analyser la ligne", "Retour à la partie"]);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
