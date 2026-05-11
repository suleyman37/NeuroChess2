#!/usr/bin/env node
import {
  assertPeripheralSafeText,
  assertScreenPrimaryCount,
  capturePeripheral,
  createPeripheralCoherenceHarness,
  openPeripheralVision,
} from "./browser_v2_product_vision_source_room_training_profile_helpers.mjs";

const { evidence, harness } = createPeripheralCoherenceHarness("browser_v2_product_vision_desktop_training_atelier_smoke");

async function main() {
  try {
    await openPeripheralVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    await harness.assertPageContains("training_atelier_labels", [
      "Entrainement",
      "Commencer la session",
      "Session du jour",
      "File du jour",
      "Revision du jour",
      "Revanche contre toi",
      "Erreurs",
      "File de session",
    ]);
    const result = await harness.evalPage(() => {
      const lanes = [...document.querySelectorAll(".v2-vision-dojo-lane")];
      const queue = document.querySelector('[data-testid="v2-vision-training-queue"]');
      const board = document.querySelector('[data-testid="v2-vision-training-preview-board"]');
      const activeItems = [...document.querySelectorAll(".v2-vision-training-list li.is-active")];
      return {
        ok:
          lanes.length === 3 &&
          lanes.every((lane) => lane.getAttribute("data-lane-kind") && lane.textContent?.trim()) &&
          Boolean(queue) &&
          activeItems.length === 1 &&
          board?.getAttribute("data-board-cases") === "64" &&
          Number(board?.getAttribute("data-piece-count") ?? 0) > 0,
        laneCount: lanes.length,
        activeItems: activeItems.length,
        boardPieces: board?.getAttribute("data-piece-count") ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("training_atelier_structure", JSON.stringify(result));
    }
    harness.mark("training_atelier_structure", "pass", JSON.stringify(result));
    await assertScreenPrimaryCount(harness, "training_atelier_one_primary", '[data-testid="v2-vision-training"]', 1);
    await capturePeripheral(harness, evidence, "training_overview", "1366x768");
    await capturePeripheral(harness, evidence, "training_session_lane", "1366x768", '[data-testid="v2-vision-training-queue"]');
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await capturePeripheral(harness, evidence, "training_overview", "1536x864");
    await assertPeripheralSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
