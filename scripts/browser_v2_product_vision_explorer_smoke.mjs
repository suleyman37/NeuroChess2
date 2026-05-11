#!/usr/bin/env node
import {
  assertProductVisionForbiddenAbsent,
  createProductVisionHarness,
  openProductVision,
} from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_explorer_smoke");

async function main() {
  try {
    await openProductVision(harness);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 150 });
    await harness.clickByTestId("v2-vision-open-review", { afterMs: 200 });
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 200 });
    await harness.waitForPagePredicate("decision lab explorer ready", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return {
        ok:
          normalized.includes("branche locale") &&
          normalized.includes("local") &&
          normalized.includes("analyser la ligne"),
        text,
      };
    });
    await harness.clickByTestId("v2-vision-analyze-line", { afterMs: 250 });
    await harness.waitForPagePredicate("decision lab explorer analyzed", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Ligne analysée") && text.includes("Jouable"), text };
    });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 250 });
    await harness.waitForPagePredicate("standalone explorer ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-explorer"]')),
      text: document.body?.innerText ?? "",
    }));
    const result = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const primaryLabels = [...document.querySelectorAll(".v2-vision-primary")]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
      return {
        ok: text.includes("Ligne jouable") && text.includes("Modifier la branche") && text.includes("Rejouer la branche") && primaryLabels.length === 1,
        primaryLabels,
        text,
      };
    });
    if (!result.ok) {
      harness.fail("standalone_explorer_analyzed_state", JSON.stringify(result));
    }
    harness.mark("explorer_mock_flow", "pass");
    await assertProductVisionForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
