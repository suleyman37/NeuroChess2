#!/usr/bin/env node
import {
  assertNoForbidden,
  assertOnePrimary,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_explorer_lab_flow_smoke");

async function main() {
  try {
    await openVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 260 });

    await harness.waitForPagePredicate("explorer initial", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Joue une ligne sur l'échiquier.") && text.includes("Créer une branche"), text };
    });
    await assertOnePrimary(harness, "explorer_initial_one_primary");
    await captureTpe(harness, evidence, "explorer_initial");

    await harness.clickByTestId("v2-vision-explorer-create-branch", { afterMs: 220 });
    await harness.waitForPagePredicate("explorer branch", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Branche · 3 coups") && text.includes("Analyser la ligne"), text };
    });
    await assertOnePrimary(harness, "explorer_branch_one_primary");
    await captureTpe(harness, evidence, "explorer_branch");

    await harness.clickByTestId("v2-vision-explorer-analyze-line", { afterMs: 160 });
    await harness.waitForPagePredicate("explorer analyzing", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Évaluation de la ligne"), text };
    });
    await harness.waitForPagePredicate("explorer analyzed", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLocaleLowerCase("fr-FR");
      return {
        ok:
          text.includes("Ligne jouable") &&
          text.includes("Rejouer la branche") &&
          normalized.includes("local · hors entraînement") &&
          !normalized.includes("due_at"),
        text,
      };
    }, 5000);
    await assertOnePrimary(harness, "explorer_analyzed_one_primary");
    await captureTpe(harness, evidence, "explorer_analyzed");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
