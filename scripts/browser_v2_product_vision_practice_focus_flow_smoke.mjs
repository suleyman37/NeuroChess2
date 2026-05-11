#!/usr/bin/env node
import {
  assertNoForbidden,
  assertOnePrimary,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_practice_focus_flow_smoke");

async function main() {
  try {
    await openVision(harness);
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-training-start", { afterMs: 260 });
    await harness.waitForPagePredicate("practice ready", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          Boolean(document.querySelector('[data-testid="v2-vision-practice"]')) &&
          text.includes("Rejoue cette décision") &&
          text.includes("Commencer"),
        text,
      };
    });
    await assertOnePrimary(harness, "practice_ready_one_primary");
    await captureTpe(harness, evidence, "practice_ready");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("practice attempting", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("À toi de jouer") && text.includes("Valider le coup"), text };
    });
    await assertOnePrimary(harness, "practice_attempting_one_primary");
    await captureTpe(harness, evidence, "practice_attempting");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("practice feedback success", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Bien joué") && text.includes("Position suivante"), text };
    });
    await assertOnePrimary(harness, "practice_feedback_one_primary");
    await captureTpe(harness, evidence, "practice_feedback");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("practice next position", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Position 2 /") && text.includes("Rejoue cette décision"), text };
    });
    harness.mark("practice_position_next", "pass");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
