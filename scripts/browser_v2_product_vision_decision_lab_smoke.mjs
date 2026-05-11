#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_decision_lab_smoke");

async function visiblePrimaryLabels() {
  return harness.evalPage(() =>
    [...document.querySelectorAll(".v2-vision-primary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
  );
}

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 250 });

    for (const mode of ["summary", "learn", "replay", "explore"]) {
      await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 200 });
      const result = await harness.evalPage((expectedMode) => {
        const left = document.querySelector('[data-testid="v2-vision-lab-left"]')?.textContent ?? "";
        const right = document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent ?? "";
        const board = document.querySelector('[data-testid="v2-vision-lab-board"]')?.getBoundingClientRect();
        return {
          ok: Boolean(board && board.width >= 360 && left && right),
          expectedMode,
          left,
          right,
          boardWidth: board?.width ?? 0,
        };
      }, mode);
      if (!result.ok) {
        harness.fail(`decision_lab_mode_${mode}`, JSON.stringify(result));
      }
      const primaryLabels = await visiblePrimaryLabels();
      if (primaryLabels.length !== 1) {
        harness.fail(`decision_lab_one_primary_${mode}`, JSON.stringify(primaryLabels));
      }
      harness.mark(`decision_lab_mode_${mode}`, "pass", primaryLabels[0]);
    }

    await harness.clickByTestId("v2-vision-mode-summary", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-details-open", { afterMs: 150 });
    await harness.waitForPagePredicate("details drawer opened", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-details-drawer"]')),
      text: document.body?.innerText ?? "",
    }));
    await harness.clickByTestId("v2-vision-details-close", { afterMs: 150 });
    harness.mark("decision_lab_details_drawer", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
