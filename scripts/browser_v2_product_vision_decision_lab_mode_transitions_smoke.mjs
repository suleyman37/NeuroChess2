#!/usr/bin/env node
import {
  assertNoForbiddenModeText,
  captureModeDecisionLab,
  createModeHarness,
  getModeSnapshot,
  openModeDecisionLab,
} from "./browser_v2_product_vision_decision_lab_mode_experience_helpers.mjs";

const { evidence, harness } = createModeHarness("browser_v2_product_vision_decision_lab_mode_transitions_smoke");

async function main() {
  try {
    await openModeDecisionLab(harness);
    for (const mode of ["learn", "replay", "explore", "summary"]) {
      await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 180 });
      const snapshot = await getModeSnapshot(harness);
      if (snapshot.activeMode !== mode || !snapshot.boardMood || !snapshot.dock) {
        harness.fail(`transition_${mode}_keeps_board_and_dock`, JSON.stringify(snapshot));
      }
      harness.mark(`transition_${mode}_keeps_board_and_dock`, "pass", snapshot.boardMood);
    }

    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await harness.clickByText("Voir la ligne", { exact: true, afterMs: 220 });
    const lineOpen = await harness.evalPage(() => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-line-player"]')) &&
        !document.querySelector('[data-testid="v2-vision-action-dock"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!lineOpen.ok) {
      harness.fail("line_player_replaces_dock_after_mode_change", JSON.stringify(lineOpen));
    }
    harness.mark("line_player_replaces_dock_after_mode_change", "pass");
    await captureModeDecisionLab(harness, evidence, "decision_lab_line_player");

    await harness.clickByTestId("v2-vision-line-close", { afterMs: 220 });
    const restored = await getModeSnapshot(harness);
    if (restored.activeMode !== "learn" || !restored.dock.includes("Voir la ligne")) {
      harness.fail("line_player_close_restores_learn_dock", JSON.stringify(restored));
    }
    harness.mark("line_player_close_restores_learn_dock", "pass");

    await harness.setViewport({ width: 390, height: 844, mobile: true });
    await harness.evalPage(() => window.scrollTo(0, 0));
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 220 });
    const mobile = await harness.evalPage(() => {
      const board = document.querySelector('[data-testid="v2-vision-lab-board-shell"]')?.getBoundingClientRect();
      const dock = document.querySelector('[data-testid="v2-vision-action-dock"]')?.getBoundingClientRect();
      return {
        ok:
          document.documentElement.scrollWidth <= window.innerWidth + 1 &&
          Boolean(board && board.width > 240 && board.top < window.innerHeight) &&
          Boolean(dock && dock.top < window.innerHeight + 220),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        board: board ? { top: board.top, width: board.width, height: board.height } : null,
        dock: dock ? { top: dock.top, width: dock.width, height: dock.height } : null,
      };
    });
    if (!mobile.ok) {
      harness.fail("mobile_decision_lab_mode_minimum", JSON.stringify(mobile));
    }
    harness.mark("mobile_decision_lab_mode_minimum", "pass", JSON.stringify(mobile));
    await captureModeDecisionLab(harness, evidence, "mobile_decision_lab", "390x844");
    await assertNoForbiddenModeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
