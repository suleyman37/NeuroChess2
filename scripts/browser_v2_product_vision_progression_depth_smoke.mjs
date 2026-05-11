#!/usr/bin/env node
import {
  captureProgressionProfile,
  createProgressionProfileHarness,
  openProgression,
  openProgressionProfileVision,
} from "./browser_v2_product_vision_progression_profile_helpers.mjs";

const { evidence, harness } = createProgressionProfileHarness("browser_v2_product_vision_progression_depth_smoke");

async function main() {
  try {
    await openProgressionProfileVision(harness);
    await openProgression(harness);
    await harness.assertPageContains("progression_depth_labels", [
      "Cette semaine, tu as revu 18 décisions issues de 4 parties",
      "Régularité 30 jours",
      "Effort cette semaine",
      "Décisions consolidées",
      "Domaines à consolider",
      "Plan 30 jours",
    ]);
    const result = await harness.evalPage(() => {
      const heatmapCells = document.querySelectorAll('[data-testid="v2-vision-progress-heatmap"] span').length;
      const weeklyBars = document.querySelectorAll('[data-testid="v2-vision-weekly-effort"] .v2-vision-weekly-bar').length;
      const reviewedDecisions = document.querySelectorAll(".v2-vision-reviewed-decision").length;
      const domains = document.querySelectorAll(".v2-vision-domain-row").length;
      const planItems = document.querySelectorAll(".v2-vision-plan30-grid span").length;
      return {
        ok: heatmapCells === 30 && weeklyBars === 7 && reviewedDecisions >= 5 && domains >= 3 && planItems === 3,
        heatmapCells,
        weeklyBars,
        reviewedDecisions,
        domains,
        planItems,
      };
    });
    if (!result.ok) {
      harness.fail("progression_depth_structure", JSON.stringify(result));
    }
    harness.mark("progression_depth_structure", "pass", JSON.stringify(result));
    await captureProgressionProfile(harness, evidence, "progression_full");
    await captureProgressionProfile(harness, evidence, "progression_heatmap_focus", "1366x768", '[data-testid="v2-vision-progress-heatmap"]');
    await captureProgressionProfile(harness, evidence, "progression_decisions_focus", "1366x768", '[data-testid="v2-vision-consolidated-decisions"]');
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
