#!/usr/bin/env node
import {
  assertBoardTone,
  assertNoVisibleSolution,
  assertSignatureSafeText,
  captureSignature,
  createSignaturePolishHarness,
  openSignaturePractice,
  openSignatureVision,
} from "./browser_v2_product_vision_signature_polish_helpers.mjs";

const { evidence, harness } = createSignaturePolishHarness("browser_v2_product_vision_desktop_practice_effort_dramaturgy_smoke");

async function assertPracticeState(stage, expectedPhase, expectedTone) {
  const result = await harness.evalPage(({ phase, tone }) => {
    const root = document.querySelector('[data-testid="v2-vision-practice"]');
    const stage = document.querySelector(".v2-vision-practice-stage");
    const primary = [...document.querySelectorAll('[data-testid="v2-vision-practice-dock"] .v2-vision-primary')]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    return {
      ok:
        root?.getAttribute("data-practice-phase") === phase &&
        stage?.getAttribute("data-tone") === tone &&
        primary.length === 1,
      phase: root?.getAttribute("data-practice-phase") ?? "",
      tone: stage?.getAttribute("data-tone") ?? "",
      primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
    };
  }, { phase: expectedPhase, tone: expectedTone });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${result.phase} tone=${result.tone} primary=${result.primaryLabels[0]}`);
}

async function main() {
  try {
    await openSignatureVision(harness);
    await openSignaturePractice(harness);

    await assertPracticeState("practice_ready_active_stage", "ready", "active");
    await assertBoardTone(harness, "practice_ready_board_tone", "v2-vision-practice-board-shell", "active");
    await assertNoVisibleSolution(harness, "practice_ready_no_spoiler", "v2-vision-practice-board-shell");
    await captureSignature(harness, evidence, "practice_ready_signature", "1366x768");

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await assertPracticeState("practice_attempting_active_stage", "attempting", "active");
    await assertNoVisibleSolution(harness, "practice_attempting_no_spoiler", "v2-vision-practice-board-shell");
    await captureSignature(harness, evidence, "practice_attempting_signature", "1366x768");
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await captureSignature(harness, evidence, "practice_attempting_signature", "1536x864");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });

    const secondaryWeight = await harness.evalPage(() => {
      const primaryCount = document.querySelectorAll('[data-testid="v2-vision-practice-dock"] .v2-vision-primary').length;
      const correction = [...document.querySelectorAll('[data-testid="v2-vision-practice-dock"] button')]
        .find((button) => button.textContent?.includes("Voir correction"));
      return {
        ok: primaryCount === 1 && Boolean(correction) && !correction?.classList.contains("v2-vision-primary"),
        primaryCount,
        correctionClass: correction?.className ?? "",
      };
    });
    if (!secondaryWeight.ok) {
      harness.fail("practice_secondary_actions_not_primary", JSON.stringify(secondaryWeight));
    }
    harness.mark("practice_secondary_actions_not_primary", "pass", secondaryWeight.correctionClass);

    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 220 });
    await assertPracticeState("practice_feedback_success_stage", "feedback_success", "success");
    await assertBoardTone(harness, "practice_feedback_board_tone", "v2-vision-practice-board-shell", "success");
    await captureSignature(harness, evidence, "practice_feedback_signature", "1366x768");
    await assertSignatureSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
