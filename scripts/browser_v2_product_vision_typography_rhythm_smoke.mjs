#!/usr/bin/env node
import {
  captureButtonVision,
  createButtonHarness,
  openButtonVision,
} from "./browser_v2_product_vision_button_helpers.mjs";

const { evidence, harness } = createButtonHarness("browser_v2_product_vision_typography_rhythm_smoke");

async function main() {
  try {
    await openButtonVision(harness);
    const result = await harness.evalPage(() => {
      const app = document.querySelector(".v2-vision-app");
      const heroTitle = document.querySelector(".v2-vision-hero h2");
      const stat = document.querySelector(".v2-vision-hero-grid span");
      const appStyle = app ? getComputedStyle(app) : null;
      const heroStyle = heroTitle ? getComputedStyle(heroTitle) : null;
      const statStyle = stat ? getComputedStyle(stat) : null;
      return {
        ok:
          Boolean(appStyle?.getPropertyValue("--pv-font-display").includes("Fraunces")) &&
          Boolean(heroStyle?.fontFamily.includes("Fraunces") || heroStyle?.fontFamily.includes("Georgia")) &&
          Boolean(statStyle?.fontVariantNumeric.includes("tabular-nums")) &&
          Boolean(heroTitle?.textContent?.includes("Consolide")),
        displayToken: appStyle?.getPropertyValue("--pv-font-display") ?? "",
        heroFont: heroStyle?.fontFamily ?? "",
        statNumerals: statStyle?.fontVariantNumeric ?? "",
        heroText: heroTitle?.textContent ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("typography_rhythm_contract", JSON.stringify(result));
    }
    harness.mark("typography_rhythm_contract", "pass", `${result.heroFont} / ${result.statNumerals}`);
    await captureButtonVision(harness, evidence, "typography_today");

    await harness.clickByTestId("v2-vision-open-progression", { afterMs: 200 });
    await captureButtonVision(harness, evidence, "progression_typography");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
