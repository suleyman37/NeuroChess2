#!/usr/bin/env node
import {
  captureQaScreenshot,
  createReadabilityHarness,
  finishHarness,
  playExplorationMove,
  setupReviewExplorer,
} from "./browser_explorer_cockpit_readability_helpers.mjs";

const SCRIPT_NAME = "browser_explorer_cockpit_actions_near_board_smoke";
const { harness, evidence } = createReadabilityHarness(SCRIPT_NAME);

async function main() {
  await setupReviewExplorer(harness, evidence);
  await captureQaScreenshot(harness, "explorer_before_new_move");
  const move = await playExplorationMove(harness);
  const layout = await harness.evalPage(() => {
    const board = document.querySelector('[data-testid="review-board"]');
    const dock = document.querySelector('[data-testid="review-explorer-cockpit-actions"]');
    const moveButton = document.querySelector('[data-testid="review-explorer-analyze-move"]');
    const lineButton = document.querySelector('[data-testid="review-explorer-analyze-line"]');
    const viewportHeight = window.innerHeight;
    const boardRect = board?.getBoundingClientRect();
    const dockRect = dock?.getBoundingClientRect();
    const moveRect = moveButton?.getBoundingClientRect();
    const lineRect = lineButton?.getBoundingClientRect();
    const visible = (rect) =>
      Boolean(rect) && rect.top >= -2 && rect.left >= -2 && rect.bottom <= viewportHeight + 2;
    const intersectsViewport = (rect) =>
      Boolean(rect) && rect.bottom > 16 && rect.top < viewportHeight - 16;
    return {
      ok:
        Boolean(boardRect) &&
        Boolean(dockRect) &&
        intersectsViewport(boardRect) &&
        visible(moveRect) &&
        visible(lineRect) &&
        Math.abs((dockRect?.top ?? 9999) - (boardRect?.bottom ?? 0)) < 260,
      scrollY: Math.round(window.scrollY),
      boardBottom: Math.round(boardRect?.bottom ?? 0),
      dockTop: Math.round(dockRect?.top ?? 0),
      boardVisible: intersectsViewport(boardRect),
      moveVisible: visible(moveRect),
      lineVisible: visible(lineRect),
      dockText: dock?.textContent ?? "",
    };
  });
  if (!layout.ok) {
    throw new Error(`Explorer cockpit actions are not near-board: ${JSON.stringify(layout)}`);
  }
  evidence.contract_checks.actions_near_board = { move, layout };
  harness.mark("explorer_actions_near_board", "pass", JSON.stringify(layout));
  await captureQaScreenshot(harness, "explorer_actions_near_board");
  await harness.assertNoHorizontalOverflow("explorer_actions_no_horizontal_overflow", [
    "html",
    "body",
    ".board-column",
    '[data-testid="review-explorer-cockpit-actions"]',
  ]);
  await finishHarness(harness, evidence, SCRIPT_NAME);
  console.log("BROWSER_EXPLORER_COCKPIT_ACTIONS_NEAR_BOARD_SMOKE PASS");
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureQaScreenshot(harness, "explorer_actions_failure");
    } catch {
      // best effort only
    }
    harness.writeEvidence();
    console.error("BROWSER_EXPLORER_COCKPIT_ACTIONS_NEAR_BOARD_SMOKE FAIL");
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
