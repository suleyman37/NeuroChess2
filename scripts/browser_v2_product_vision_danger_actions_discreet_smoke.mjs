#!/usr/bin/env node
import {
  captureButtonVision,
  createButtonHarness,
  openButtonVision,
} from "./browser_v2_product_vision_button_helpers.mjs";

const { evidence, harness } = createButtonHarness("browser_v2_product_vision_danger_actions_discreet_smoke");

async function main() {
  try {
    await openButtonVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    const gamesResult = await harness.evalPage(() => {
      const deleteButtons = [...document.querySelectorAll(".v2-vision-danger")];
      return {
        ok:
          deleteButtons.length > 0 &&
          deleteButtons.every((button) => !button.classList.contains("v2-vision-primary")) &&
          deleteButtons.every((button) => button.classList.contains("v2-vision-danger-subtle")),
        count: deleteButtons.length,
        labels: deleteButtons.map((button) => button.textContent?.trim()),
      };
    });
    if (!gamesResult.ok) {
      harness.fail("games_danger_not_primary", JSON.stringify(gamesResult));
    }
    harness.mark("games_danger_not_primary", "pass", `${gamesResult.count} danger buttons`);
    await captureButtonVision(harness, evidence, "games_danger_actions");

    await harness.clickByText("Supprimer", { exact: true, afterMs: 180 });
    await harness.assertPageContains("games_delete_confirmation", ["Confirmation visuelle", "Annuler"]);
    await harness.clickByTestId("v2-vision-delete-cancel", { afterMs: 160 });

    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 220 });
    const profileResult = await harness.evalPage(() => {
      const danger = document.querySelector('[data-testid="v2-vision-profile"] .v2-vision-danger');
      return {
        ok: Boolean(danger) && !danger?.classList.contains("v2-vision-primary"),
        label: danger?.textContent?.trim() ?? "",
      };
    });
    if (!profileResult.ok) {
      harness.fail("profile_danger_not_primary", JSON.stringify(profileResult));
    }
    harness.mark("profile_danger_not_primary", "pass", profileResult.label);
    await captureButtonVision(harness, evidence, "profile_danger_actions");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
