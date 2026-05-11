#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_practice_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-today-start", { afterMs: 250 });
    await harness.waitForPagePredicate("practice ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-practice"]')) &&
        Boolean(document.querySelector('[data-testid="v2-vision-practice-board"]')),
      text: document.body?.innerText ?? "",
    }));
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 200 });
    await harness.waitForPagePredicate("practice trying", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("À toi de jouer") && text.includes("Valider le coup"), text };
    });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 200 });
    await harness.waitForPagePredicate("practice feedback", () => {
      const text = document.body?.innerText ?? "";
      const normalizedText = text.toLocaleLowerCase("fr-FR");
      return { ok: normalizedText.includes("feedback compact") && text.includes("Position suivante"), text };
    });
    harness.mark("practice_mock_flow", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
