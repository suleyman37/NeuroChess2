#!/usr/bin/env node
import {
  assertNoForbidden,
  assertOnePrimary,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_practice_feedback_safety_smoke");

async function main() {
  try {
    await openVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    const attempting = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      return {
        ok: text.includes("Indice") && text.includes("Voir correction") && text.includes("Passer"),
        text,
      };
    });
    if (!attempting.ok) {
      harness.fail("practice_attempting_help_actions", JSON.stringify(attempting));
    }
    harness.mark("practice_attempting_help_actions", "pass");

    await harness.clickByText("Passer", { exact: true, afterMs: 220 });
    await harness.waitForPagePredicate("practice wrong feedback", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLocaleLowerCase("fr-FR");
      return {
        ok:
          text.includes("À revoir") &&
          text.includes("Cette réponse rate la ressource principale.") &&
          !normalized.includes("tu es nul") &&
          !normalized.includes("mauvais joueur"),
        text,
      };
    });
    await assertOnePrimary(harness, "practice_wrong_feedback_one_primary");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("practice correction", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Correction") && text.includes("Coup recommandé") && text.includes("Position suivante"), text };
    });
    await assertOnePrimary(harness, "practice_correction_one_primary");
    await captureTpe(harness, evidence, "practice_correction");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
