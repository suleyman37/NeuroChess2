#!/usr/bin/env node
import {
  captureProgressionProfile,
  createProgressionProfileHarness,
  openProfile,
  openProgressionProfileVision,
} from "./browser_v2_product_vision_progression_profile_helpers.mjs";

const { evidence, harness } = createProgressionProfileHarness("browser_v2_product_vision_profile_depth_smoke");

async function main() {
  try {
    await openProgressionProfileVision(harness);
    await openProfile(harness);
    await harness.assertPageContains("profile_depth_labels", [
      "Contrôler ton expérience",
      "bahij",
      "Connexions",
      "Apparence de l'échiquier",
      "Préférences app",
      "Données et confidentialité",
    ]);
    const result = await harness.evalPage(() => {
      const identity = Boolean(document.querySelector('[data-testid="v2-vision-profile-identity"]'));
      const connections = document.querySelectorAll(".v2-vision-connection-card").length;
      const boardPreferences = Boolean(document.querySelector('[data-testid="v2-vision-profile-board-preferences"]'));
      const appPreferences = Boolean(document.querySelector('[data-testid="v2-vision-profile-app-preferences"]'));
      const dataSafety = Boolean(document.querySelector('[data-testid="v2-vision-profile-data-safety"]'));
      return {
        ok: identity && connections >= 3 && boardPreferences && appPreferences && dataSafety,
        identity,
        connections,
        boardPreferences,
        appPreferences,
        dataSafety,
      };
    });
    if (!result.ok) {
      harness.fail("profile_depth_structure", JSON.stringify(result));
    }
    harness.mark("profile_depth_structure", "pass", JSON.stringify(result));
    await captureProgressionProfile(harness, evidence, "profile_full");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
