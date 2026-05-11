#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_header_compact_smoke");

async function assertHeaderStateBadge(stage, testId, expectedLabel) {
  const result = await harness.evalPage(({ testId, expectedLabel }) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    const meta = element?.closest(".v2-stage__meta");
    const visibleText = element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const metaText = meta?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const dataCopy = meta?.getAttribute("data-state-copy") ?? "";
    const aria = meta?.getAttribute("aria-label") ?? "";
    return {
      ok:
        Boolean(element) &&
        Boolean(meta) &&
        visibleText === expectedLabel &&
        metaText === expectedLabel &&
        dataCopy.length > 0 &&
        aria.includes(expectedLabel) &&
        !metaText.includes("...") &&
        !metaText.includes("…") &&
        !document.querySelector(".v2-stage__meta .v2-stage__state-copy"),
      visibleText,
      metaText,
      dataCopy,
      aria,
      expectedLabel,
      hasVisibleCopyNode: Boolean(document.querySelector(".v2-stage__meta .v2-stage__state-copy")),
    };
  }, { testId, expectedLabel });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${expectedLabel} compact header`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const memory = await harness.evalPage(() => {
      const token = document.querySelector(".v2-board-memory-token");
      return {
        ok: token?.textContent?.trim() === "Mémoire" && !token.textContent.includes("...") && !token.textContent.includes("…"),
        text: token?.textContent?.trim() ?? "",
      };
    });
    if (!memory.ok) {
      harness.fail("today_memory_badge_compact", JSON.stringify(memory));
    }
    harness.mark("today_memory_badge_compact", "pass", memory.text);

    await openCompositionDecisionLab(harness);
    await assertHeaderStateBadge("decision_observe_header_compact", "v2-vision-mode-cue", "Observation");
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await assertHeaderStateBadge("decision_learn_header_compact", "v2-vision-mode-cue", "Repères");
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertHeaderStateBadge("decision_effort_header_compact", "v2-vision-mode-cue", "À toi");
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertHeaderStateBadge("decision_success_header_compact", "v2-vision-mode-cue", "Consolidé");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await harness.clickByText("Passer", { exact: true, afterMs: 180 });
    await assertHeaderStateBadge("practice_miss_header_compact", "v2-vision-practice-cue", "Correction");

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await assertHeaderStateBadge("explorer_header_compact", "v2-vision-explorer-cue", "Atelier local");
    await assertSafeDesktopLanguage(harness, "board_state_header_compact_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
