#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_choreography_smoke");

async function assertBoardState(stage, selector, expectedState) {
  const result = await harness.evalPage(({ selector, expectedState }) => {
    const element = document.querySelector(selector);
    return {
      ok: Boolean(element) && element.getAttribute("data-board-state") === expectedState,
      actual: element?.getAttribute("data-board-state") ?? "",
      tone: element?.getAttribute("data-board-tone") ?? element?.getAttribute("data-tone") ?? "",
      selector,
      expectedState,
    };
  }, { selector, expectedState });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${selector} state=${result.actual} tone=${result.tone}`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await assertBoardState("today_memory_state", '[data-testid="v2-board-stage"]', "memory");

    await openCompositionDecisionLab(harness);
    await assertBoardState("decision_summary_stage_observe", '[data-testid="v2-vision-board-stage"]', "observe");
    await assertBoardState("decision_summary_shell_observe", '[data-testid="v2-vision-lab-board-shell"]', "observe");

    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await assertBoardState("decision_learn_state", '[data-testid="v2-vision-lab-board-shell"]', "learn");

    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertBoardState("decision_replay_before_effort", '[data-testid="v2-vision-lab-board-shell"]', "effort");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertBoardState("decision_replay_attempting_effort", '[data-testid="v2-vision-lab-board-shell"]', "effort");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertBoardState("decision_replay_feedback_success", '[data-testid="v2-vision-lab-board-shell"]', "feedback-success");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await assertBoardState("practice_ready_effort", '[data-testid="v2-vision-practice-board-shell"]', "effort");
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertBoardState("practice_attempting_effort", '[data-testid="v2-vision-practice-board-shell"]', "effort");
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertBoardState("practice_feedback_success", '[data-testid="v2-vision-practice-board-shell"]', "feedback-success");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await assertBoardState("explorer_state", '[data-testid="v2-vision-explorer-board-shell"]', "explore");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await harness.clickByTestId("v2-vision-nav-training", { afterMs: 180 });
    const training = await harness.evalPage(() => {
      const preview = document.querySelector('[data-testid="v2-vision-training-memory-preview"]');
      return {
        ok: Boolean(preview) && preview.getAttribute("data-board-state") === "memory",
        actual: preview?.getAttribute("data-board-state") ?? "",
      };
    });
    if (!training.ok) {
      harness.fail("training_memory_preview_state", JSON.stringify(training));
    }
    harness.mark("training_memory_preview_state", "pass", `state=${training.actual}`);
    await assertSafeDesktopLanguage(harness, "board_state_choreography_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
