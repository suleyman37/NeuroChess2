#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_hero_visual_reduced_motion_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await harness.browserClient.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await harness.browserClient.send("Page.reload", { ignoreCache: true });
    await harness.waitForPagePredicate("V2 Product Vision reduced motion ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-hero-visual"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);

    const result = await harness.evalPage(() => {
      const visual = document.querySelector('[data-testid="v2-hero-visual"]');
      const poster = document.querySelector('[data-testid="v2-hero-visual-poster"]');
      const canvas = visual?.querySelector("canvas");
      const title = document.querySelector('[data-testid="v2-vision-today-hero"] h2')?.getBoundingClientRect();
      const cta = document.querySelector('[data-testid="v2-vision-today-start"]')?.getBoundingClientRect();
      return {
        ok:
          Boolean(visual) &&
          visual?.getAttribute("data-renderer") === "poster" &&
          visual?.getAttribute("data-motion") === "reduced" &&
          Boolean(poster) &&
          !canvas &&
          Boolean(title) &&
          title.width > 0 &&
          Boolean(cta) &&
          cta.width > 0,
        renderer: visual?.getAttribute("data-renderer") ?? "",
        motion: visual?.getAttribute("data-motion") ?? "",
        hasPoster: Boolean(poster),
        hasCanvas: Boolean(canvas),
      };
    });
    if (!result.ok) {
      harness.fail("today_hero_visual_reduced_motion", JSON.stringify(result));
    }
    harness.mark("today_hero_visual_reduced_motion", "pass", JSON.stringify(result));
    await captureDesktopComposition(harness, evidence, "today_hero_visual_reduced_motion", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_hero_visual_reduced_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
