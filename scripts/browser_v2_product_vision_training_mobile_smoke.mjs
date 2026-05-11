#!/usr/bin/env node
import {
  assertNoForbidden,
  captureTpe,
  createTpeHarness,
  openVision,
} from "./browser_v2_product_vision_tpe_helpers.mjs";

const { evidence, harness } = createTpeHarness("browser_v2_product_vision_training_mobile_smoke");

async function main() {
  try {
    await openVision(harness, { viewport: { width: 390, height: 844, mobile: true } });
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 260 });
    const result = await harness.evalPage(() => {
      const cta = [...document.querySelectorAll("button")].find((button) =>
        (button.textContent ?? "").includes("Commencer la session"),
      );
      const ctaRect = cta?.getBoundingClientRect();
      return {
        ok:
          Boolean(ctaRect && ctaRect.top >= 0 && ctaRect.bottom <= window.innerHeight) &&
          document.documentElement.scrollWidth <= window.innerWidth + 1 &&
          Boolean(document.querySelector('[data-testid="v2-vision-training-queue"]')),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        ctaRect,
        text: document.body?.innerText ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("training_mobile_contract", JSON.stringify(result));
    }
    harness.mark("training_mobile_contract", "pass", `${result.innerWidth}px`);
    await captureTpe(harness, evidence, "training_mobile", "390x844");
    await assertNoForbidden(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
