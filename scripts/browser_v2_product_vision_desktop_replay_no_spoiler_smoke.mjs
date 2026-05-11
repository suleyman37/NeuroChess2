#!/usr/bin/env node
import {
  assertDesktopSafetyText,
  assertGuideBoardVisible,
  assertNoSpoilerBoard,
  captureDesktopNorthStar,
  createDesktopNorthStarHarness,
  openDesktopDecisionLab,
  openDesktopVision,
} from "./browser_v2_product_vision_desktop_north_star_helpers.mjs";

const { evidence, harness } = createDesktopNorthStarHarness("browser_v2_product_vision_desktop_replay_no_spoiler_smoke");

async function main() {
  try {
    await openDesktopVision(harness);
    await openDesktopDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 220 });
    await assertNoSpoilerBoard(harness, "decision_replay_before_no_solution_guides", "v2-vision-lab-board-shell");
    await harness.assertPageContains("decision_replay_before_cta", ["Commencer la tentative", "Ligne après tentative"]);
    await captureDesktopNorthStar(harness, evidence, "decision_lab_replay_before_no_spoiler");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await assertNoSpoilerBoard(harness, "decision_replay_attempting_no_solution_guides", "v2-vision-lab-board-shell");
    await harness.assertPageContains("decision_replay_attempting_cta", ["À toi de jouer", "Valider le coup", "Indice", "Voir correction", "Passer"]);
    await captureDesktopNorthStar(harness, evidence, "decision_lab_replay_attempting_no_spoiler");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await assertGuideBoardVisible(harness, "decision_replay_feedback_guides_return", "v2-vision-lab-board-shell");
    await harness.assertPageContains("decision_replay_feedback_cta", ["Feedback", "Position suivante", "Revoir la ligne"]);
    await captureDesktopNorthStar(harness, evidence, "decision_lab_replay_feedback_guides_return");
    await assertDesktopSafetyText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
