#!/usr/bin/env node
import {
  assertBoardTone,
  assertNoVisibleSolution,
  assertSignatureSafeText,
  captureSignature,
  createSignaturePolishHarness,
  openSignatureDecisionLab,
  openSignatureVision,
} from "./browser_v2_product_vision_signature_polish_helpers.mjs";

const { evidence, harness } = createSignaturePolishHarness("browser_v2_product_vision_desktop_decision_lab_mode_signature_smoke");

async function assertMode(stage, mode, expectedTone, expectedCopy) {
  if (mode !== "summary") {
    await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 220 });
  }
  const result = await harness.evalPage(({ expectedMode, copy }) => {
    const lab = document.querySelector('[data-testid="v2-vision-decision-lab"]');
    const stage = document.querySelector('[data-testid="v2-vision-board-stage"]');
    const cue = document.querySelector('[data-testid="v2-vision-mode-cue"]')?.textContent ?? "";
    const left = document.querySelector('[data-testid="v2-vision-lab-left"]')?.textContent ?? "";
    const card = document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent ?? "";
    const dock = document.querySelector('[data-testid="v2-vision-action-dock"]')?.textContent ?? "";
    return {
      ok:
        lab?.getAttribute("data-active-mode") === expectedMode &&
        stage?.getAttribute("data-tone") &&
        cue.includes(copy) &&
        left.length > 20 &&
        card.length > 20 &&
        dock.length > 10,
      activeMode: lab?.getAttribute("data-active-mode") ?? "",
      stageTone: stage?.getAttribute("data-tone") ?? "",
      cue,
      left,
      card,
      dock,
    };
  }, { expectedMode: mode, copy: expectedCopy });
  if (!result.ok || result.stageTone !== expectedTone) {
    harness.fail(stage, JSON.stringify({ ...result, expectedTone }));
  }
  await assertBoardTone(harness, `${stage}_board_tone`, "v2-vision-lab-board-shell", expectedTone);
  harness.mark(stage, "pass", `${mode} tone=${result.stageTone}`);
}

async function main() {
  try {
    await openSignatureVision(harness);
    await openSignatureDecisionLab(harness);

    await assertMode("summary_signature", "summary", "calm", "Observe la bascule");
    await captureSignature(harness, evidence, "decision_lab_summary_signature", "1366x768");
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await captureSignature(harness, evidence, "decision_lab_summary_signature", "1536x864");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });

    await assertMode("learn_signature", "learn", "learn", "Lis les repères");
    await harness.assertPageContains("learn_signature_content", ["Repères", "Checklist", "Voir la ligne"]);
    await captureSignature(harness, evidence, "decision_lab_learn_signature", "1366x768");

    await assertMode("replay_ready_signature", "replay", "active", "sans aide visible");
    await assertNoVisibleSolution(harness, "replay_ready_no_spoiler", "v2-vision-lab-board-shell");
    await captureSignature(harness, evidence, "decision_lab_replay_before_attempt", "1366x768");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await assertBoardTone(harness, "replay_attempting_tone", "v2-vision-lab-board-shell", "active");
    await assertNoVisibleSolution(harness, "replay_attempting_no_spoiler", "v2-vision-lab-board-shell");
    await captureSignature(harness, evidence, "decision_lab_replay_attempting", "1366x768");

    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 220 });
    await assertBoardTone(harness, "replay_feedback_tone", "v2-vision-lab-board-shell", "success");
    await captureSignature(harness, evidence, "decision_lab_replay_feedback", "1366x768");

    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 220 });
    await assertMode("explorer_signature", "explore", "explore", "Teste une branche");
    await harness.assertPageContains("explorer_signature_content", ["Local", "Tester une alternative", "Analyser la ligne"]);
    await captureSignature(harness, evidence, "decision_lab_explorer_signature", "1366x768");
    await assertSignatureSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
