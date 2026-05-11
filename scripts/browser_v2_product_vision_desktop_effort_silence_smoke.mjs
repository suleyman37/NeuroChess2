#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_effort_silence_smoke");

async function assertEffortSilence(stage, rootSelector) {
  const result = await harness.evalPage((rootSelector) => {
    const root = document.querySelector(rootSelector);
    const dimmed = [...(root?.querySelectorAll(".v2-context-dimmed") ?? [])];
    const dimStyles = dimmed.map((element) => {
      const style = window.getComputedStyle(element);
      return { opacity: Number(style.opacity), filter: style.filter };
    });
    const primary = [...(root?.querySelectorAll(".v2-vision-action-dock .v2-vision-primary") ?? [])].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const secondaryPrimary = [...(root?.querySelectorAll(".v2-vision-action-dock .v2-vision-secondary.v2-vision-primary, .v2-vision-action-dock .v2-vision-compact-button.v2-vision-primary") ?? [])];
    const stage = root?.querySelector('.v2-vision-board-stage[data-board-state="effort"]');
    return {
      ok:
        Boolean(root) &&
        Boolean(stage) &&
        dimStyles.length >= 1 &&
        dimStyles.every((item) => item.opacity <= 0.65 && item.filter !== "none") &&
        primary.length === 1 &&
        secondaryPrimary.length === 0,
      dimStyles,
      primaryLabels: primary.map((button) => button.textContent?.replace(/\s+/g, " ").trim()),
      secondaryPrimaryCount: secondaryPrimary.length,
      boardState: stage?.getAttribute("data-board-state") ?? "",
    };
  }, rootSelector);
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `primary=${result.primaryLabels.join(" / ")} dim=${JSON.stringify(result.dimStyles)}`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertEffortSilence("decision_replay_effort_silence", '[data-testid="v2-vision-decision-lab"]');
    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertEffortSilence("practice_attempting_effort_silence", '[data-testid="v2-vision-practice"]');
    await assertSafeDesktopLanguage(harness, "effort_silence_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
