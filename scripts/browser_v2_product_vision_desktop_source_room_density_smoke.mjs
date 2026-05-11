#!/usr/bin/env node
import {
  assertPeripheralSafeText,
  assertScreenPrimaryCount,
  capturePeripheral,
  createPeripheralCoherenceHarness,
  openPeripheralVision,
} from "./browser_v2_product_vision_source_room_training_profile_helpers.mjs";

const { evidence, harness } = createPeripheralCoherenceHarness("browser_v2_product_vision_desktop_source_room_density_smoke");

async function main() {
  try {
    await openPeripheralVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 220 });
    await harness.assertPageContains("source_room_core_labels", [
      "Mes parties",
      "Importer PGN",
      "Review pr",
      "Analyse en cours",
      "Erreur r",
      "Moment cl",
      "Voir la Review",
      "Reprendre l'analyse",
    ]);
    const result = await harness.evalPage(() => {
      const cards = [...document.querySelectorAll(".v2-vision-game-card")];
      const details = cards.map((card) => {
        const board = card.querySelector('[data-board-kind="vision-mini-board"]');
        const primary = card.querySelector(".v2-vision-card-primary");
        const danger = card.querySelector(".v2-vision-danger");
        const moment = card.querySelector('[data-testid^="v2-vision-game-moment-"]');
        return {
          hasDenseLayout: Boolean(card.querySelector(".v2-vision-source-room-card")),
          hasBoard: board?.getAttribute("data-board-cases") === "64" && Number(board?.getAttribute("data-piece-count") ?? 0) > 0,
          hasMoment: Boolean(moment) && /Moment cl/i.test(moment.textContent ?? ""),
          hasPrimary: Boolean(primary) && primary.getBoundingClientRect().width > 0,
          dangerSubtle:
            Boolean(danger) &&
            danger.classList.contains("v2-vision-danger-subtle") &&
            !danger.classList.contains("v2-vision-primary"),
        };
      });
      return {
        ok:
          cards.length >= 3 &&
          details.every((item) => item.hasDenseLayout && item.hasBoard && item.hasMoment && item.hasPrimary && item.dangerSubtle),
        count: cards.length,
        details,
      };
    });
    if (!result.ok) {
      harness.fail("source_room_dense_cards", JSON.stringify(result));
    }
    harness.mark("source_room_dense_cards", "pass", `${result.count} cards`);
    await assertScreenPrimaryCount(harness, "source_room_screen_primary", '[data-testid="v2-vision-games"]', 1);
    await capturePeripheral(harness, evidence, "games_source_room", "1366x768");
    await capturePeripheral(harness, evidence, "games_card_detail", "1366x768", '[data-testid="v2-vision-game-game-1"]');
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await capturePeripheral(harness, evidence, "games_source_room", "1536x864");
    await assertPeripheralSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
