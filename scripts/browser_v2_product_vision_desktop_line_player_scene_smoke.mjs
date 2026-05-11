#!/usr/bin/env node
import {
  assertNoVisibleSolution,
  assertSignatureSafeText,
  captureSignature,
  createSignaturePolishHarness,
  openSignatureDecisionLab,
  openSignaturePractice,
  openSignatureVision,
} from "./browser_v2_product_vision_signature_polish_helpers.mjs";

const { evidence, harness } = createSignaturePolishHarness("browser_v2_product_vision_desktop_line_player_scene_smoke");

async function assertLinePlayerScene(stage) {
  const result = await harness.evalPage(() => {
    const line = document.querySelector('[data-testid="v2-vision-line-player"]');
    const board = document.querySelector('[data-board-kind="vision-main-board"]');
    if (!line || !board) {
      return { ok: false, reason: "missing line player or board" };
    }
    const lineRect = line.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const style = window.getComputedStyle(line);
    const bg = style.backgroundColor + " " + style.backgroundImage;
    return {
      ok:
        line.getAttribute("data-line-scene") === "board-stage" &&
        lineRect.top >= boardRect.top &&
        Math.abs(lineRect.left - boardRect.left) < 180 &&
        !/rgb\(255,\s*255,\s*255\)|#fff|white/i.test(bg),
      line: {
        top: Math.round(lineRect.top),
        left: Math.round(lineRect.left),
        width: Math.round(lineRect.width),
        height: Math.round(lineRect.height),
      },
      board: {
        top: Math.round(boardRect.top),
        left: Math.round(boardRect.left),
        width: Math.round(boardRect.width),
        height: Math.round(boardRect.height),
      },
      bg,
      scene: line.getAttribute("data-line-scene"),
    };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", JSON.stringify(result.line));
}

async function main() {
  try {
    await openSignatureVision(harness);
    await openSignaturePractice(harness);
    await assertNoVisibleSolution(harness, "practice_ready_line_player_absent", "v2-vision-practice-board-shell");
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 200 });
    await assertNoVisibleSolution(harness, "practice_attempting_line_player_absent", "v2-vision-practice-board-shell");
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await harness.clickByTestId("v2-vision-practice-open-line", { afterMs: 220 });
    await assertLinePlayerScene("practice_line_player_integrated");
    await captureSignature(harness, evidence, "line_player_practice_after_feedback", "1366x768");

    await harness.clickByTestId("v2-vision-line-close", { afterMs: 160 });
    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openSignatureDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertNoVisibleSolution(harness, "decision_replay_ready_line_absent", "v2-vision-lab-board-shell");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 200 });
    await assertNoVisibleSolution(harness, "decision_replay_attempting_line_absent", "v2-vision-lab-board-shell");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await harness.clickByText("Revoir la ligne", { exact: true, afterMs: 220 });
    await assertLinePlayerScene("decision_replay_line_player_integrated");
    await captureSignature(harness, evidence, "line_player_decision_replay_after_feedback", "1366x768");
    await assertSignatureSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
