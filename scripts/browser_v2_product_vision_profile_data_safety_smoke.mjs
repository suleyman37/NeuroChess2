#!/usr/bin/env node
import {
  captureProgressionProfile,
  createProgressionProfileHarness,
  openProfile,
  openProgressionProfileVision,
} from "./browser_v2_product_vision_progression_profile_helpers.mjs";

const { evidence, harness } = createProgressionProfileHarness("browser_v2_product_vision_profile_data_safety_smoke");

async function main() {
  try {
    await openProgressionProfileVision(harness);
    await openProfile(harness);
    await harness.assertPageContains("profile_data_safety_labels", [
      "Exporter mes données",
      "Supprimer mes données",
      "demande confirmation",
    ]);
    const dangerState = await harness.evalPage(() => {
      const danger = document.querySelector('[data-testid="v2-vision-profile-data-safety"] .v2-vision-danger');
      const primaryDanger = danger?.classList.contains("v2-vision-primary") ?? false;
      return {
        ok: Boolean(danger) && !primaryDanger,
        className: danger?.className ?? "",
        text: danger?.textContent?.trim() ?? "",
      };
    });
    if (!dangerState.ok) {
      harness.fail("profile_delete_is_discreet_danger", JSON.stringify(dangerState));
    }
    harness.mark("profile_delete_is_discreet_danger", "pass", JSON.stringify(dangerState));
    await harness.clickByText("Supprimer mes données", { exact: true, afterMs: 180 });
    await harness.assertPageContains("profile_delete_confirmation", [
      "Confirmation requise",
      "Aucune donnée n'est supprimée ici",
      "Annuler",
    ]);
    await captureProgressionProfile(harness, evidence, "profile_data_safety", "1366x768", '[data-testid="v2-vision-profile-data-safety"]');
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
