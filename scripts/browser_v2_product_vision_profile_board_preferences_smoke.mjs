#!/usr/bin/env node
import {
  captureProgressionProfile,
  createProgressionProfileHarness,
  openProfile,
  openProgressionProfileVision,
} from "./browser_v2_product_vision_progression_profile_helpers.mjs";

const { evidence, harness } = createProgressionProfileHarness("browser_v2_product_vision_profile_board_preferences_smoke");

async function main() {
  try {
    await openProgressionProfileVision(harness);
    await openProfile(harness);
    await harness.assertPageContains("profile_board_preference_labels", [
      "Style pièces",
      "Classic",
      "Cburnett",
      "Staunton",
      "Thème cases",
      "Nebula",
      "Wood",
      "High contrast",
      "Animations",
      "Sons",
    ]);
    const result = await harness.evalPage(() => {
      const preview = document.querySelector('[data-testid="v2-vision-profile-board-preview"]');
      const boardKind = preview?.getAttribute("data-board-kind");
      const cases = preview?.getAttribute("data-board-cases");
      const pieceCount = Number(preview?.getAttribute("data-piece-count") ?? 0);
      const activeButtons = [...document.querySelectorAll('[data-testid="v2-vision-profile-board-preferences"] .v2-vision-preference-group button.is-active')]
        .map((button) => button.textContent?.trim())
        .filter(Boolean);
      const switches = [...document.querySelectorAll('[data-testid="v2-vision-profile-board-preferences"] [role="switch"].v2-vision-switch')];
      return {
        ok:
          boardKind === "vision-mini-board" &&
          cases === "64" &&
          pieceCount > 0 &&
          activeButtons.length >= 2 &&
          switches.length >= 2,
        boardKind,
        cases,
        pieceCount,
        activeButtons,
        switchCount: switches.length,
      };
    });
    if (!result.ok) {
      harness.fail("profile_board_preferences_preview", JSON.stringify(result));
    }
    harness.mark("profile_board_preferences_preview", "pass", JSON.stringify(result));
    await captureProgressionProfile(harness, evidence, "profile_board_preferences", "1366x768", '[data-testid="v2-vision-profile-board-preferences"]');
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
