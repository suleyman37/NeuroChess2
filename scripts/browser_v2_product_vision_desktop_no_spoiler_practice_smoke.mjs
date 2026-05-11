#!/usr/bin/env node
import {
  assertDesktopSafetyText,
  assertGuideBoardVisible,
  assertNoSpoilerBoard,
  captureDesktopNorthStar,
  createDesktopNorthStarHarness,
  openDesktopPractice,
  openDesktopVision,
} from "./browser_v2_product_vision_desktop_north_star_helpers.mjs";

const { evidence, harness } = createDesktopNorthStarHarness("browser_v2_product_vision_desktop_no_spoiler_practice_smoke");

async function main() {
  try {
    await openDesktopVision(harness);
    await openDesktopPractice(harness);
    await assertNoSpoilerBoard(harness, "practice_ready_no_solution_guides", "v2-vision-practice-board-shell");
    await harness.assertPageContains("practice_ready_cta", ["Commencer", "Ligne après tentative"]);
    await captureDesktopNorthStar(harness, evidence, "practice_ready_no_spoiler");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await assertNoSpoilerBoard(harness, "practice_attempting_no_solution_guides", "v2-vision-practice-board-shell");
    await harness.assertPageContains("practice_attempting_cta", ["À toi de jouer", "Valider le coup", "Indice", "Voir correction", "Passer"]);
    await captureDesktopNorthStar(harness, evidence, "practice_attempting_no_spoiler");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await assertGuideBoardVisible(harness, "practice_feedback_guides_return", "v2-vision-practice-board-shell");
    await harness.assertPageContains("practice_feedback_cta", ["Bien joué", "Position suivante", "Revoir la ligne"]);
    await captureDesktopNorthStar(harness, evidence, "practice_feedback_guides_return");
    await assertDesktopSafetyText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
