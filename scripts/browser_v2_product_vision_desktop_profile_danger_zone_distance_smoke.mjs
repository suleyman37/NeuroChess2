#!/usr/bin/env node
import {
  assertPeripheralSafeText,
  capturePeripheral,
  createPeripheralCoherenceHarness,
  openPeripheralVision,
  openProfile,
} from "./browser_v2_product_vision_source_room_training_profile_helpers.mjs";

const { evidence, harness } = createPeripheralCoherenceHarness("browser_v2_product_vision_desktop_profile_danger_zone_distance_smoke");

async function main() {
  try {
    await openPeripheralVision(harness);
    await openProfile(harness);
    const result = await harness.evalPage(() => {
      const profile = document.querySelector('[data-testid="v2-vision-profile"]');
      const board = profile?.querySelector('[data-testid="v2-vision-profile-board-preferences"]');
      const app = profile?.querySelector('[data-testid="v2-vision-profile-app-preferences"]');
      const data = profile?.querySelector('[data-testid="v2-vision-profile-data-safety"]');
      const dangerZone = profile?.querySelector('[data-testid="v2-vision-profile-danger-zone"]');
      const exportButton = data?.querySelector(".v2-vision-secondary");
      const dangerButton = dangerZone?.querySelector(".v2-vision-danger");
      const boardRect = board?.getBoundingClientRect();
      const appRect = app?.getBoundingClientRect();
      const dangerRect = dangerZone?.getBoundingClientRect();
      return {
        ok:
          Boolean(dangerZone) &&
          Boolean(exportButton) &&
          Boolean(dangerButton) &&
          !dangerButton?.classList.contains("v2-vision-primary") &&
          dangerButton?.classList.contains("v2-vision-danger-subtle") &&
          (dangerRect?.top ?? 0) > Math.min(boardRect?.top ?? 0, appRect?.top ?? 0),
        dangerClass: dangerButton?.className ?? "",
        exportLabel: exportButton?.textContent?.trim() ?? "",
        dangerTop: Math.round(dangerRect?.top ?? 0),
        boardTop: Math.round(boardRect?.top ?? 0),
        appTop: Math.round(appRect?.top ?? 0),
      };
    });
    if (!result.ok) {
      harness.fail("profile_danger_zone_distance", JSON.stringify(result));
    }
    harness.mark("profile_danger_zone_distance", "pass", JSON.stringify(result));
    await harness.clickByText("Supprimer mes donnees", { exact: false, afterMs: 180 });
    await harness.assertPageContains("profile_danger_confirmation", [
      "Confirmation requise",
      "Aucune donnee n'est supprimee ici",
      "Annuler",
    ]);
    await capturePeripheral(harness, evidence, "profile_danger_privacy_lower", "1366x768", '[data-testid="v2-vision-profile-data-safety"]');
    await assertPeripheralSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
