#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_accessibility_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionPractice(harness);
    const result = await harness.evalPage(() => {
      const stage = document.querySelector(".v2-vision-practice-stage");
      const shell = document.querySelector('[data-testid="v2-vision-practice-board-shell"]');
      const layers = [...document.querySelectorAll(
        ".v2-board-state-aura, .v2-board-state-breath, .v2-board-effort-silence, .v2-board-feedback-reveal, .v2-board-explore-branch-layer, .v2-board-memory-preview-layer",
      )];
      const focusables = layers.flatMap((layer) => [...layer.querySelectorAll("a, button, input, select, textarea, [tabindex]")]);
      const cta = document.querySelector('[data-testid="v2-vision-practice-primary"]');
      const ctaRect = cta?.getBoundingClientRect();
      return {
        ok:
          Boolean(stage) &&
          Boolean(shell) &&
          layers.length >= 6 &&
          layers.every((layer) => layer.getAttribute("aria-hidden") === "true") &&
          focusables.length === 0 &&
          Boolean(cta) &&
          ctaRect.width > 0 &&
          ctaRect.height > 0,
        stage: Boolean(stage),
        shell: Boolean(shell),
        layerCount: layers.length,
        hiddenCount: layers.filter((layer) => layer.getAttribute("aria-hidden") === "true").length,
        focusableCount: focusables.length,
        ctaText: cta?.textContent?.trim() ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("board_state_accessibility_layers", JSON.stringify(result));
    }
    harness.mark("board_state_accessibility_layers", "pass", JSON.stringify(result));
    await assertSafeDesktopLanguage(harness, "board_state_accessibility_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
