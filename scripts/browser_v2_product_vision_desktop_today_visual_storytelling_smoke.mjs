#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  assertStageBox,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_visual_storytelling_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await harness.assertPageContains("today_visual_storytelling_copy", [
      "Mission du jour",
      "Consolide ce qui revient vraiment dans tes parties.",
      "Commencer",
      "Décision du jour",
      "Partie",
      "Tentative",
      "Régularité",
    ]);

    await assertStageBox(harness, "today_storytelling_board_stage", '[data-testid="v2-board-stage"]', 500, 420);

    const storytelling = await harness.evalPage(() => {
      const hero = document.querySelector('[data-testid="v2-vision-today-hero"]');
      const primary = [...(hero?.querySelectorAll(".v2-vision-primary") ?? [])].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const loop = document.querySelector('[data-testid="v2-vision-today-decision-loop"]');
      const memory = document.querySelector('[data-testid="v2-vision-today-memory-signal"]');
      const rail = document.querySelector('[data-testid="v2-vision-today-focus-rail"]');
      const paragraphs = [...(hero?.querySelectorAll("p") ?? [])].map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
      return {
        ok:
          Boolean(loop) &&
          Boolean(memory) &&
          Boolean(rail) &&
          primary.length === 1 &&
          paragraphs.every((text) => text.length <= 110),
        primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
        loopLabels: [...(loop?.querySelectorAll(".v2-vision-loop-node") ?? [])].map((node) => node.textContent?.trim()),
        memoryText: memory?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        railText: rail?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        maxParagraphLength: Math.max(0, ...paragraphs.map((text) => text.length)),
      };
    });

    if (!storytelling.ok) {
      harness.fail("today_visual_storytelling_contract", JSON.stringify(storytelling));
    }
    harness.mark("today_visual_storytelling_contract", "pass", JSON.stringify({
      primary: storytelling.primaryLabels,
      loop: storytelling.loopLabels,
      maxParagraphLength: storytelling.maxParagraphLength,
    }));

    await captureDesktopComposition(harness, evidence, "today_visual_storytelling", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_visual_storytelling_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
