#!/usr/bin/env node
import {
  assertGlobalSafety,
  captureGlobalVision,
  createGlobalVisionHarness,
  openGlobalVision,
} from "./browser_v2_product_vision_global_helpers.mjs";

const { evidence, harness } = createGlobalVisionHarness("browser_v2_product_vision_end_to_end_mock_journey_smoke");

async function main() {
  try {
    await openGlobalVision(harness);
    await harness.clickByTestId("v2-vision-today-start", { afterMs: 260 });
    await harness.waitForPagePredicate("practice from today", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Rejoue cette décision") && text.includes("Commencer"), text };
    });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("practice attempting", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("À toi de jouer") && text.includes("Valider le coup"), text };
    });
    await captureGlobalVision(harness, evidence, "journey_practice_attempting");
    await harness.clickByText("Retour", { exact: true, afterMs: 180 });

    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 260 });
    await harness.waitForPagePredicate("decision lab opened", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-decision-lab"]')),
      text: document.body?.innerText ?? "",
    }));
    await captureGlobalVision(harness, evidence, "journey_decision_lab");

    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-explorer-create-branch", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-explorer-analyze-line", { afterMs: 220 });
    await harness.waitForPagePredicate("explorer analyzed", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Ligne jouable") && text.includes("Rejouer la branche"), text };
    }, 5_000);
    await captureGlobalVision(harness, evidence, "journey_explorer_analyzed");

    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 220 });
    await harness.waitForPagePredicate("progression opened", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLocaleLowerCase("fr-FR");
      return { ok: normalized.includes("effort, régularité") && normalized.includes("plan 30 jours"), text };
    });
    await assertGlobalSafety(harness, "journey_safe");
    await captureGlobalVision(harness, evidence, "journey_progression");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
