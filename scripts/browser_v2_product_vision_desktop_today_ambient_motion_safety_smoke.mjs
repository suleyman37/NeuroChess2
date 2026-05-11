#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  assertStageBox,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_today_ambient_motion_safety_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const motion = await harness.evalPage(() => {
      const ambient = document.querySelector('[data-testid="v2-hero-visual"]');
      const animated = ambient ? [...ambient.querySelectorAll(".v2-hero-visual-constellation, .v2-constellation-rings, .v2-constellation-signal path")] : [];
      const durations = animated.map((element) => {
        const duration = window.getComputedStyle(element).animationDuration;
        return duration
          .split(",")
          .map((part) => part.trim())
          .map((part) => part.endsWith("ms") ? Number.parseFloat(part) / 1000 : Number.parseFloat(part))
          .filter((value) => Number.isFinite(value));
      }).flat();
      const hasReducedMotionRule = [...document.styleSheets].some((sheet) => {
        try {
          return [...sheet.cssRules].some((rule) => rule.cssText.includes("prefers-reduced-motion") && rule.cssText.includes("v2-hero-visual"));
        } catch {
          return false;
        }
      });
      const stage = document.querySelector('[data-testid="v2-board-stage"]');
      const stageBox = stage?.getBoundingClientRect();
      return {
        ok:
          Boolean(ambient) &&
          ambient?.getAttribute("aria-hidden") === "true" &&
          ["full", "paused", "reduced"].includes(ambient?.getAttribute("data-motion") ?? "") &&
          ambient?.getAttribute("data-hero-visual-theme") === "decision-constellation" &&
          animated.length > 0 &&
          durations.every((duration) => duration === 0 || duration >= 7) &&
          hasReducedMotionRule &&
          Boolean(stageBox) &&
          stageBox.width >= 500 &&
          stageBox.height >= 420,
        animatedCount: animated.length,
        durations,
        hasReducedMotionRule,
        stageBox: stageBox ? { width: Math.round(stageBox.width), height: Math.round(stageBox.height) } : null,
      };
    });

    if (!motion.ok) {
      harness.fail("today_ambient_motion_safety", JSON.stringify(motion));
    }
    harness.mark("today_ambient_motion_safety", "pass", JSON.stringify(motion));

    await assertStageBox(harness, "today_ambient_board_still_central", '[data-testid="v2-board-stage"]', 500, 420);
    await captureDesktopComposition(harness, evidence, "today_ambient_motion", "1366x768");
    await assertSafeDesktopLanguage(harness, "today_ambient_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
