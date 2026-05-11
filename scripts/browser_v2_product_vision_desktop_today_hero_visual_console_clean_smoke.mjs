#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_visual_console_clean_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await harness.waitForPagePredicate("hero visual console settle", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-hero-visual"]')),
      text: document.body?.innerText ?? "",
    }), 5_000);
    const criticalConsole = harness.evidence.browser_errors.console.filter((message) => {
      const text = String(message).toLowerCase();
      const knownBrowser404 = text.includes("failed to load resource") && text.includes("404");
      return !knownBrowser404 && (
        text.includes("webgl") ||
        text.includes("context lost") ||
        text.includes("failed to load") ||
        text.includes("error")
      );
    });
    const result = {
      ok:
        criticalConsole.length === 0 &&
        harness.evidence.browser_errors.page.length === 0 &&
        harness.evidence.browser_errors.network_500.length === 0,
      criticalConsole,
      pageErrors: harness.evidence.browser_errors.page,
      network500: harness.evidence.browser_errors.network_500,
    };
    if (!result.ok) {
      harness.fail("today_hero_visual_console_clean", JSON.stringify(result));
    }
    harness.mark("today_hero_visual_console_clean", "pass", "no critical browser errors");
    await assertSafeDesktopLanguage(harness, "today_hero_visual_console_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
