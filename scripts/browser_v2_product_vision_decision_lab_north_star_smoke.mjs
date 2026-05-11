#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  assertOnePrimary,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_north_star_smoke");

async function main() {
  try {
    await openDecisionLab(harness);
    const result = await harness.evalPage(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      };
      const left = box('[data-testid="v2-vision-lab-left"]');
      const board = box('[data-testid="v2-vision-lab-board"]');
      const dock = box('[data-testid="v2-vision-action-dock"]');
      const right = box('[data-testid="v2-vision-decision-card"]');
      const text = document.body?.innerText ?? "";
      const normalizedText = text.toLocaleLowerCase("fr-FR");
      return {
        ok:
          Boolean(left && board && dock && right) &&
          board.width >= 380 &&
          left.right < board.x &&
          board.right < right.x &&
          dock.bottom <= window.innerHeight &&
          normalizedText.includes("décision du moment") &&
          normalizedText.includes("pourquoi") &&
          normalizedText.includes("impact pratique") &&
          normalizedText.includes("meilleure idée"),
        left,
        board,
        dock,
        right,
        text,
      };
    });
    if (!result.ok) {
      harness.fail("decision_lab_north_star_layout", JSON.stringify(result));
    }
    harness.mark("decision_lab_north_star_layout", "pass", `board=${Math.round(result.board.width)}px`);
    await assertOnePrimary(harness, "decision_lab_summary_one_primary");
    await captureDecisionLab(harness, evidence, "decision_lab_summary");
    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
