#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  assertOnePrimary,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_replay_flow_smoke");

async function main() {
  try {
    await openDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 220 });
    await assertOnePrimary(harness, "replay_idle_one_primary");
    await captureDecisionLab(harness, evidence, "decision_lab_replay_before");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("replay active", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("À toi de jouer") && text.includes("Valider"), text };
    });
    const activePrimary = await assertOnePrimary(harness, "replay_active_one_primary");
    if (activePrimary !== "Valider") {
      harness.fail("replay_active_primary_label", activePrimary);
    }

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await harness.waitForPagePredicate("replay feedback", () => {
      const text = document.body?.innerText ?? "";
      return { ok: text.includes("Feedback") && text.includes("Position suivante"), text };
    });
    const feedbackPrimary = await assertOnePrimary(harness, "replay_feedback_one_primary");
    if (feedbackPrimary !== "Position suivante") {
      harness.fail("replay_feedback_primary_label", feedbackPrimary);
    }
    await captureDecisionLab(harness, evidence, "decision_lab_replay_feedback");

    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
