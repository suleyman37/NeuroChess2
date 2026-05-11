#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  assertOnePrimary,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_line_player_smoke");

async function main() {
  try {
    await openDecisionLab(harness);
    await harness.clickByText("Voir la ligne", { exact: true, afterMs: 220 });
    const opened = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const linePlayer = document.querySelector('[data-testid="v2-vision-line-player"]');
      const dock = document.querySelector('[data-testid="v2-vision-action-dock"]');
      return {
        ok: Boolean(linePlayer) && !dock && text.includes("Ligne jouée") && text.includes("Solution") && text.includes("Fermer"),
        text,
      };
    });
    if (!opened.ok) {
      harness.fail("line_player_replaces_dock", JSON.stringify(opened));
    }
    harness.mark("line_player_replaces_dock", "pass");
    await captureDecisionLab(harness, evidence, "decision_lab_line_player");

    await harness.clickByTestId("v2-vision-line-close", { afterMs: 220 });
    await harness.waitForPagePredicate("dock restored", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-action-dock"]')) &&
        !document.querySelector('[data-testid="v2-vision-line-player"]'),
      text: document.body?.innerText ?? "",
    }));
    await assertOnePrimary(harness, "line_player_close_restores_one_primary");
    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
