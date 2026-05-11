#!/usr/bin/env node
import {
  assertNoForbiddenModeText,
  captureModeDecisionLab,
  createModeHarness,
  getModeSnapshot,
  openModeDecisionLab,
} from "./browser_v2_product_vision_decision_lab_mode_experience_helpers.mjs";

const { evidence, harness } = createModeHarness("browser_v2_product_vision_decision_lab_learn_signature_smoke");

async function main() {
  try {
    await openModeDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 220 });
    const result = await harness.evalPage(() => {
      const tags = [...document.querySelectorAll('[data-testid="v2-vision-left-learn"] .v2-vision-tag-list span')]
        .map((tag) => tag.textContent?.trim() ?? "")
        .filter(Boolean);
      const checklist = [...document.querySelectorAll('[data-testid="v2-vision-learn-checklist"] strong')]
        .map((item) => item.textContent?.trim() ?? "")
        .filter(Boolean);
      const text = document.body?.innerText ?? "";
      return {
        ok:
          tags.length >= 3 &&
          tags.length <= 5 &&
          tags.every((tag) => tag.length <= 28) &&
          checklist.length >= 3 &&
          text.includes("Mini-ligne") &&
          text.includes("Mini-leçon"),
        tags,
        checklist,
        text,
      };
    });
    if (!result.ok) {
      harness.fail("learn_signature_contract", JSON.stringify(result));
    }
    const snapshot = await getModeSnapshot(harness);
    if (snapshot.boardMood !== "learn" || !snapshot.cue.includes("Flèche pédagogique")) {
      harness.fail("learn_visual_signature", JSON.stringify(snapshot));
    }
    harness.mark("learn_signature_contract", "pass", `${result.tags.join(" / ")} | ${result.checklist.join(" / ")}`);
    await captureModeDecisionLab(harness, evidence, "decision_lab_learn_signature");
    await assertNoForbiddenModeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
