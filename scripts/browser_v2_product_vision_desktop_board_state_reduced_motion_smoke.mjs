#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_reduced_motion_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await harness.browserClient.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await harness.browserClient.send("Page.reload", { ignoreCache: true });
    await harness.waitForPagePredicate("V2 reduced motion ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);

    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    const result = await harness.evalPage(() => {
      const shell = document.querySelector('[data-testid="v2-vision-lab-board-shell"]');
      const breath = shell?.querySelector(".v2-board-state-breath");
      const reveal = shell?.querySelector(".v2-board-feedback-reveal");
      const memory = shell?.querySelector(".v2-board-memory-preview-layer");
      const values = [breath, reveal, memory].filter(Boolean).map((element) => {
        const style = window.getComputedStyle(element);
        return {
          className: element.className,
          animationName: style.animationName,
          animationDuration: style.animationDuration,
        };
      });
      return {
        ok:
          Boolean(shell) &&
          shell.getAttribute("data-board-state") === "learn" &&
          values.every((item) => item.animationName === "none" || item.animationDuration === "0s"),
        boardState: shell?.getAttribute("data-board-state") ?? "",
        values,
      };
    });
    if (!result.ok) {
      harness.fail("board_state_reduced_motion_static", JSON.stringify(result));
    }
    harness.mark("board_state_reduced_motion_static", "pass", JSON.stringify(result));
    await assertSafeDesktopLanguage(harness, "board_state_reduced_motion_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
