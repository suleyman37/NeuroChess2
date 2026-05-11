#!/usr/bin/env node
import {
  assertPeripheralSafeText,
  capturePeripheral,
  createPeripheralCoherenceHarness,
  openPeripheralVision,
  openProfile,
} from "./browser_v2_product_vision_source_room_training_profile_helpers.mjs";

const { evidence, harness } = createPeripheralCoherenceHarness("browser_v2_product_vision_desktop_final_coherence_smoke");

async function main() {
  try {
    await openPeripheralVision(harness);
    const header = await harness.evalPage(() => {
      const navLabels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')]
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean);
      const prototype = document.querySelector(".v2-vision-dev-badge");
      const exit = document.querySelector('[data-testid="v2-vision-exit"]');
      return {
        ok:
          navLabels.length === 3 &&
          navLabels.join("|").includes("Aujourd") &&
          navLabels.join("|").includes("Mes parties") &&
          navLabels.join("|").includes("Entra") &&
          Boolean(prototype) &&
          Boolean(exit),
        navLabels,
        prototype: prototype?.textContent?.trim() ?? "",
        exit: exit?.textContent?.trim() ?? "",
      };
    });
    if (!header.ok) {
      harness.fail("desktop_header_three_tabs_discreet", JSON.stringify(header));
    }
    harness.mark("desktop_header_three_tabs_discreet", "pass", JSON.stringify(header.navLabels));
    await capturePeripheral(harness, evidence, "today_regression_check", "1366x768");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 220 });
    const gamesSurface = await harness.evalPage(() => ({
      ok:
        Boolean(document.querySelector(".v2-vision-games-hero")) &&
        document.querySelectorAll(".v2-vision-game-card .v2-vision-mini-board-card").length >= 3,
      cards: document.querySelectorAll(".v2-vision-game-card").length,
      miniBoards: document.querySelectorAll(".v2-vision-game-card .v2-vision-mini-board-card").length,
    }));
    if (!gamesSurface.ok) {
      harness.fail("games_surface_coherent", JSON.stringify(gamesSurface));
    }
    harness.mark("games_surface_coherent", "pass", `${gamesSurface.cards} cards / ${gamesSurface.miniBoards} boards`);
    await capturePeripheral(harness, evidence, "header_in_games", "1366x768");

    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 220 });
    const trainingSurface = await harness.evalPage(() => ({
      ok:
        Boolean(document.querySelector(".v2-vision-dojo-hero")) &&
        Boolean(document.querySelector('[data-testid="v2-vision-training-preview-board"]')) &&
        document.querySelectorAll(".v2-vision-dojo-lane").length === 3,
    }));
    if (!trainingSurface.ok) {
      harness.fail("training_surface_coherent", JSON.stringify(trainingSurface));
    }
    harness.mark("training_surface_coherent", "pass", "dojo hero + lanes + board");

    await openProfile(harness);
    const profileSurface = await harness.evalPage(() => ({
      ok:
        Boolean(document.querySelector(".v2-vision-profile-identity")) &&
        Boolean(document.querySelector(".v2-vision-connection-state")) &&
        Boolean(document.querySelector('[data-testid="v2-vision-profile-danger-zone"]')),
    }));
    if (!profileSurface.ok) {
      harness.fail("profile_surface_coherent", JSON.stringify(profileSurface));
    }
    harness.mark("profile_surface_coherent", "pass", "identity + calm connections + danger zone");
    await capturePeripheral(harness, evidence, "header_in_profile", "1366x768");

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
    await harness.waitForPagePredicate("Decision Lab regression visible", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')) && Boolean(document.querySelector('[data-testid="v2-vision-board-stage"]')),
      text: document.body?.innerText ?? "",
    }), 15_000);
    await capturePeripheral(harness, evidence, "decision_lab_regression_check", "1366x768");
    await assertPeripheralSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
