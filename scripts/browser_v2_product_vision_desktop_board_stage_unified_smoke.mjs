#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  getBox,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_stage_unified_smoke");

async function assertUnifiedStage(stage, selector, minWidth = 480, minHeight = 400) {
  const box = await getBox(harness, selector);
  if (!box.ok || box.width < minWidth || box.height < minHeight || box.boxShadow === "none") {
    harness.fail(stage, JSON.stringify({ box, minWidth, minHeight }));
  }
  if (!box.tone) {
    harness.fail(`${stage}_tone`, JSON.stringify(box));
  }
  harness.mark(stage, "pass", `${box.width}x${box.height} tone=${box.tone}`);
  return box;
}

async function assertBoardShellTone(stage, testId, expectedTone) {
  const result = await harness.evalPage(({ id, tone }) => {
    const shell = document.querySelector(`[data-testid="${id}-shell"]`);
    return {
      ok: Boolean(shell) && shell.getAttribute("data-tone") === tone,
      actual: shell?.getAttribute("data-tone") ?? "",
      id,
      tone,
    };
  }, { id: testId, tone: expectedTone });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${testId} tone=${result.actual}`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await assertUnifiedStage("today_stage_unified", '[data-testid="v2-board-stage"]', 500, 420);
    await captureDesktopComposition(harness, evidence, "today_stage_unified", "1366x768");
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await assertUnifiedStage("today_stage_unified_1536", '[data-testid="v2-board-stage"]', 500, 430);
    await captureDesktopComposition(harness, evidence, "today_stage_unified", "1536x864");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });

    await openCompositionDecisionLab(harness);
    await assertUnifiedStage("decision_lab_stage_unified", '[data-testid="v2-vision-board-stage"]', 520, 430);
    await assertBoardShellTone("decision_lab_shell_tone", "v2-vision-lab-board", "calm");
    await captureDesktopComposition(harness, evidence, "decision_lab_stage_summary", "1366x768");

    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await captureDesktopComposition(harness, evidence, "decision_lab_stage_summary", "1536x864");
    await assertUnifiedStage("decision_lab_stage_unified_1536", '[data-testid="v2-vision-board-stage"]', 560, 450);

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await openCompositionPractice(harness);
    await assertUnifiedStage("practice_stage_unified", ".v2-vision-practice-stage", 500, 420);
    await assertBoardShellTone("practice_shell_tone", "v2-vision-practice-board", "active");
    await captureDesktopComposition(harness, evidence, "practice_stage_ready", "1366x768");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 200 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 240 });
    await assertUnifiedStage("explorer_stage_unified", ".v2-vision-explorer-stage", 500, 420);
    await assertBoardShellTone("explorer_shell_tone", "v2-vision-explorer-board", "explore");
    await captureDesktopComposition(harness, evidence, "explorer_stage", "1366x768");
    await assertSafeDesktopLanguage(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
