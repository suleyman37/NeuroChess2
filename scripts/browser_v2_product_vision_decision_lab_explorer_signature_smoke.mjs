#!/usr/bin/env node
import {
  assertNoForbiddenModeText,
  captureModeDecisionLab,
  createModeHarness,
  getModeSnapshot,
  openModeDecisionLab,
} from "./browser_v2_product_vision_decision_lab_mode_experience_helpers.mjs";

const { evidence, harness } = createModeHarness("browser_v2_product_vision_decision_lab_explorer_signature_smoke");

async function main() {
  try {
    await openModeDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 220 });
    const before = await getModeSnapshot(harness);
    const normalized = before.text.toLocaleLowerCase("fr-FR");
    const beforeOk =
      before.activeMode === "explore" &&
      before.boardMood === "explore" &&
      normalized.includes("local · hors entraînement") &&
      before.text.includes("Branche locale") &&
      before.text.includes("Analyser la ligne") &&
      !normalized.includes("due_at") &&
      !normalized.includes("exercice") &&
      !normalized.includes("révision");
    if (!beforeOk) {
      harness.fail("explorer_signature_before", JSON.stringify(before));
    }
    harness.mark("explorer_signature_before", "pass");
    await captureModeDecisionLab(harness, evidence, "decision_lab_explorer_signature_before");

    await harness.clickByTestId("v2-vision-analyze-line", { afterMs: 240 });
    const after = await getModeSnapshot(harness);
    if (!after.text.includes("Ligne analysée") || !after.text.includes("Jouable")) {
      harness.fail("explorer_signature_after_analysis", JSON.stringify(after));
    }
    harness.mark("explorer_signature_after_analysis", "pass");
    await captureModeDecisionLab(harness, evidence, "decision_lab_explorer_after_analysis");
    await assertNoForbiddenModeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
