#!/usr/bin/env node
import {
  assertPeripheralSafeText,
  capturePeripheral,
  createPeripheralCoherenceHarness,
  openPeripheralVision,
  openProfile,
} from "./browser_v2_product_vision_source_room_training_profile_helpers.mjs";

const { evidence, harness } = createPeripheralCoherenceHarness("browser_v2_product_vision_desktop_profile_premium_settings_smoke");

async function main() {
  try {
    await openPeripheralVision(harness);
    await openProfile(harness);
    await harness.assertPageContains("profile_premium_labels", [
      "Controler ton experience",
      "bahij",
      "Connexions futures",
      "Apparence de l'echiquier",
      "Preferences app",
      "Donnees et confidentialite",
      "Exporter mes donnees",
      "Supprimer mes donnees",
    ]);
    const result = await harness.evalPage(() => {
      const profile = document.querySelector('[data-testid="v2-vision-profile"]');
      const buttons = [...(profile?.querySelectorAll("button") ?? [])]
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean);
      const onOffButtons = buttons.filter((label) => label === "On" || label === "Off");
      const switches = [...(profile?.querySelectorAll('[role="switch"].v2-vision-switch') ?? [])];
      const connectionCards = [...(profile?.querySelectorAll(".v2-vision-connection-card") ?? [])];
      const connectionButtons = connectionCards.flatMap((card) => [...card.querySelectorAll("button")]);
      const connectionStates = profile?.querySelectorAll(".v2-vision-connection-state").length ?? 0;
      const boardPreview = profile?.querySelector('[data-testid="v2-vision-profile-board-preview"]');
      return {
        ok:
          onOffButtons.length === 0 &&
          switches.length >= 4 &&
          switches.every((button) => button.getAttribute("aria-checked") !== null) &&
          connectionCards.length >= 3 &&
          connectionButtons.length === 0 &&
          connectionStates >= 3 &&
          boardPreview?.getAttribute("data-board-kind") === "vision-mini-board",
        onOffButtons,
        switchCount: switches.length,
        connectionCards: connectionCards.length,
        connectionButtons: connectionButtons.length,
        connectionStates,
      };
    });
    if (!result.ok) {
      harness.fail("profile_premium_settings_structure", JSON.stringify(result));
    }
    harness.mark("profile_premium_settings_structure", "pass", JSON.stringify(result));
    await capturePeripheral(harness, evidence, "profile_top", "1366x768", '[data-testid="v2-vision-profile-identity"]');
    await capturePeripheral(harness, evidence, "profile_board_settings", "1366x768", '[data-testid="v2-vision-profile-board-preferences"]');
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await capturePeripheral(harness, evidence, "profile_top", "1536x864", '[data-testid="v2-vision-profile-identity"]');
    await assertPeripheralSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
