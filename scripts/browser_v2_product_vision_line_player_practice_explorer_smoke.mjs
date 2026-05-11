#!/usr/bin/env node
import {
  assertNoForbidden,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_line_player_practice_explorer_smoke");

async function main() {
  try {
    await openVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-practice-open-line", { afterMs: 220 });
    await harness.waitForPagePredicate("practice line player", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-line-player"]')) &&
        !document.querySelector('[data-testid="v2-vision-practice-dock"]'),
      text: document.body?.innerText ?? "",
    }));
    await captureTpe(harness, evidence, "line_player_practice");
    await harness.clickByTestId("v2-vision-line-close", { afterMs: 180 });

    await harness.clickByText("Retour", { exact: true, afterMs: 220 });
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-explorer-create-branch", { afterMs: 160 });
    await harness.clickByTestId("v2-vision-explorer-analyze-line", { afterMs: 160 });
    await harness.waitForPagePredicate("explorer analyzed for line player", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Rejouer la branche"), text };
    }, 5000);
    await harness.clickByTestId("v2-vision-explorer-open-line", { afterMs: 220 });
    await harness.waitForPagePredicate("explorer line player", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-line-player"]')) &&
        !document.querySelector('[data-testid="v2-vision-explorer-dock"]'),
      text: document.body?.innerText ?? "",
    }));
    await captureTpe(harness, evidence, "line_player_explorer");
    await harness.clickByTestId("v2-vision-line-close", { afterMs: 180 });
    harness.mark("line_player_practice_and_explorer", "pass");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
