#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_readability_smoke");

async function assertBoardReadable(stage, shellSelector) {
  const result = await harness.evalPage((shellSelector) => {
    const shell = document.querySelector(shellSelector);
    const board = shell?.querySelector(".board-panel");
    const boardRect = board?.getBoundingClientRect();
    const sampleTargets = [];
    if (boardRect) {
      const points = [
        [boardRect.left + boardRect.width * 0.82, boardRect.top + boardRect.height * 0.82],
        [boardRect.left + boardRect.width * 0.92, boardRect.top + boardRect.height * 0.82],
        [boardRect.left + boardRect.width * 0.82, boardRect.top + boardRect.height * 0.92],
        [boardRect.left + boardRect.width * 0.92, boardRect.top + boardRect.height * 0.92],
      ];
      for (const [x, y] of points) {
        const element = document.elementFromPoint(x, y);
        sampleTargets.push({
          tag: element?.tagName ?? "",
          className: String(element?.className ?? ""),
          text: element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
          badOverlay: Boolean(element?.closest(".v2-board-state-copy, .v2-stage__state-pill, .v2-stage__state-copy")),
        });
      }
    }
    const shellTextOverlay = shell ? Boolean(shell.querySelector(".v2-board-state-copy")) : false;
    const badStageLabelInShell = shell
      ? Boolean(shell.querySelector(".v2-stage__state-pill, .v2-stage__state-copy"))
      : false;
    const pseudoAfter = shell ? window.getComputedStyle(shell, "::after").content : "";
    const opaqueTextOverlay = sampleTargets.some((item) => item.badOverlay);
    return {
      ok:
        Boolean(shell) &&
        Boolean(board) &&
        boardRect.width >= 360 &&
        boardRect.height >= 360 &&
        !shellTextOverlay &&
        !badStageLabelInShell &&
        !opaqueTextOverlay &&
        !/a toi|atelier|observation|reperes|consolide|correction|memoire/i.test(pseudoAfter),
      shell: Boolean(shell),
      board: Boolean(board),
      width: Math.round(boardRect?.width ?? 0),
      height: Math.round(boardRect?.height ?? 0),
      shellTextOverlay,
      badStageLabelInShell,
      pseudoAfter,
      sampleTargets,
    };
  }, shellSelector);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellSelector} ${result.width}x${result.height} bottom-right clear`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionDecisionLab(harness);
    await assertBoardReadable("decision_summary_board_readable", '[data-testid="v2-vision-lab-board-shell"]');
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertBoardReadable("decision_effort_board_readable", '[data-testid="v2-vision-lab-board-shell"]');
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertBoardReadable("decision_feedback_board_readable", '[data-testid="v2-vision-lab-board-shell"]');

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertBoardReadable("practice_effort_board_readable", '[data-testid="v2-vision-practice-board-shell"]');

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await assertBoardReadable("explorer_board_readable", '[data-testid="v2-vision-explorer-board-shell"]');
    await assertSafeDesktopLanguage(harness, "board_readability_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
