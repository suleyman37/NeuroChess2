#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_visual_accessibility_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const result = await harness.evalPage(() => {
      const visual = document.querySelector('[data-testid="v2-hero-visual"]');
      const focusables = visual ? [...visual.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')] : [];
      const title = document.querySelector('[data-testid="v2-vision-today-hero"] h2');
      const cta = document.querySelector('[data-testid="v2-vision-today-start"]');
      return {
        ok:
          Boolean(visual) &&
          visual?.getAttribute("aria-hidden") === "true" &&
          !visual?.hasAttribute("role") &&
          focusables.length === 0 &&
          Boolean(title) &&
          Boolean(cta),
        ariaHidden: visual?.getAttribute("aria-hidden") ?? "",
        role: visual?.getAttribute("role") ?? "",
        focusableCount: focusables.length,
        titleText: title?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        ctaText: cta?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("today_hero_visual_accessibility", JSON.stringify(result));
    }
    harness.mark("today_hero_visual_accessibility", "pass", JSON.stringify(result));
    await assertSafeDesktopLanguage(harness, "today_hero_visual_accessibility_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
