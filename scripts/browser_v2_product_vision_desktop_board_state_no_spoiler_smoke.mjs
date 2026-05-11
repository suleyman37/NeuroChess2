#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_no_spoiler_smoke");

async function assertEffortNoSpoiler(stage, shellTestId) {
  const result = await harness.evalPage((shellTestId) => {
    const shell = document.querySelector(`[data-testid="${shellTestId}"]`);
    const text = document.body?.innerText ?? "";
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const forbiddenText = [
      "coup recommande",
      "mini-ligne",
      "solution",
      "meilleure idee",
    ].filter((label) => normalized.includes(label));
    return {
      ok:
        Boolean(shell) &&
        shell.getAttribute("data-board-state") === "effort" &&
        shell.getAttribute("data-guides-visible") === "false" &&
        shell.getAttribute("data-solution-visible") === "false" &&
        !document.querySelector(".v2-solution-arrow") &&
        !document.querySelector('[data-testid="v2-vision-line-player"]') &&
        forbiddenText.length === 0,
      boardState: shell?.getAttribute("data-board-state") ?? "",
      guides: shell?.getAttribute("data-guides-visible") ?? "",
      solution: shell?.getAttribute("data-solution-visible") ?? "",
      hasLinePlayer: Boolean(document.querySelector('[data-testid="v2-vision-line-player"]')),
      forbiddenText,
    };
  }, shellTestId);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellTestId} effort no-spoiler`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertEffortNoSpoiler("decision_replay_before_effort_no_spoiler", "v2-vision-lab-board-shell");
    await harness.assertPageContains("decision_replay_before_cta_visible", ["Commencer la tentative"]);
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertEffortNoSpoiler("decision_replay_attempting_effort_no_spoiler", "v2-vision-lab-board-shell");
    await harness.assertPageContains("decision_replay_attempting_cta_visible", ["Valider le coup"]);

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await assertEffortNoSpoiler("practice_ready_effort_no_spoiler", "v2-vision-practice-board-shell");
    await harness.assertPageContains("practice_ready_cta_visible", ["Commencer"]);
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertEffortNoSpoiler("practice_attempting_effort_no_spoiler", "v2-vision-practice-board-shell");
    await harness.assertPageContains("practice_attempting_cta_visible", ["Valider le coup"]);
    await assertSafeDesktopLanguage(harness, "board_state_no_spoiler_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
