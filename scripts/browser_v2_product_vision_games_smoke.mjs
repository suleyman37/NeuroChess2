#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_games_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 200 });
    await harness.assertPageContains("games_core_content", [
      "Importer PGN",
      "Review prête",
      "Analyse en cours",
      "Erreur récupérable",
      "Voir la Review",
    ]);
    await harness.clickByText("Supprimer", { afterMs: 150 });
    await harness.waitForPagePredicate("delete confirmation is mock", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Aucune donnée n'est supprimée"), text };
    });
    await harness.clickByTestId("v2-vision-delete-cancel", { afterMs: 100 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 250 });
    await harness.waitForPagePredicate("review opens from games", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
      text: document.body?.innerText ?? "",
    }));
    harness.mark("games_review_and_safe_delete", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
