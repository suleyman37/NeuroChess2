#!/usr/bin/env node
import {
  assertNoForbiddenModeText,
  captureModeDecisionLab,
  createModeHarness,
  getModeSnapshot,
  openModeDecisionLab,
} from "./browser_v2_product_vision_decision_lab_mode_experience_helpers.mjs";

const { evidence, harness } = createModeHarness("browser_v2_product_vision_decision_lab_replay_no_spoiler_smoke");

async function main() {
  try {
    await openModeDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 220 });
    const snapshot = await getModeSnapshot(harness);
    const beforeOk =
      snapshot.activeMode === "replay" &&
      snapshot.boardMood === "active" &&
      snapshot.solutionVisible === "false" &&
      snapshot.text.includes("Commencer la tentative") &&
      snapshot.text.includes("Indice") &&
      snapshot.text.includes("Correction") &&
      !snapshot.text.includes("Solution");
    if (!beforeOk) {
      harness.fail("replay_before_attempt_no_spoiler", JSON.stringify(snapshot));
    }
    harness.mark("replay_before_attempt_no_spoiler", "pass");
    await captureModeDecisionLab(harness, evidence, "decision_lab_replay_no_spoiler");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    const active = await getModeSnapshot(harness);
    if (active.solutionVisible !== "false" || !active.text.includes("À toi de jouer")) {
      harness.fail("replay_attempting_no_guides", JSON.stringify(active));
    }
    harness.mark("replay_attempting_no_guides", "pass");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    const feedback = await getModeSnapshot(harness);
    if (feedback.solutionVisible !== "true" || !feedback.text.includes("Position suivante")) {
      harness.fail("replay_feedback_guides_return", JSON.stringify(feedback));
    }
    harness.mark("replay_feedback_guides_return", "pass");
    await captureModeDecisionLab(harness, evidence, "decision_lab_replay_feedback");
    await assertNoForbiddenModeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
