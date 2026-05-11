#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_text_density_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const density = await harness.evalPage(() => {
      const hero = document.querySelector('[data-testid="v2-vision-today-hero"]');
      const paragraphs = [...(hero?.querySelectorAll("p") ?? [])].map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
      const longParagraphs = paragraphs.filter((text) => text.length > 110);
      const storytellingNodes = [
        '[data-testid="v2-vision-today-decision-loop"]',
        '[data-testid="v2-vision-today-memory-signal"]',
        '[data-testid="v2-vision-today-focus-rail"]',
      ].filter((selector) => Boolean(document.querySelector(selector)));
      const primary = [...(hero?.querySelectorAll(".v2-vision-primary") ?? [])].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const totalWords = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
      return {
        ok: Boolean(hero) && longParagraphs.length === 0 && storytellingNodes.length === 3 && primary.length === 1 && totalWords <= 48,
        paragraphs,
        longParagraphs,
        storytellingNodes,
        primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
        totalWords,
      };
    });

    if (!density.ok) {
      harness.fail("today_text_density_contract", JSON.stringify(density));
    }
    harness.mark("today_text_density_contract", "pass", JSON.stringify({
      storytellingNodes: density.storytellingNodes.length,
      totalWords: density.totalWords,
      primary: density.primaryLabels,
    }));

    await captureDesktopComposition(harness, evidence, "today_text_density", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_text_density_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
