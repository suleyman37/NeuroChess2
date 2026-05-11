#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_effort_fit_1366_smoke");

async function assertEffortFit(stage, { ctaSelector, boardSelector, shellSelector }) {
  const result = await harness.evalPage(({ ctaSelector, boardSelector, shellSelector }) => {
    window.scrollTo(0, 0);
    const rect = (element) => {
      const box = element?.getBoundingClientRect();
      return box
        ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
        : null;
    };
    const cta = document.querySelector(ctaSelector);
    const board = document.querySelector(boardSelector);
    const shell = document.querySelector(shellSelector);
    const text = document.body?.innerText ?? "";
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const forbidden = ["coup recommande", "mini-ligne", "solution", "meilleure idee"].filter((label) =>
      normalized.includes(label),
    );
    const ctaBox = rect(cta);
    const boardBox = rect(board);
    return {
      ok:
        Boolean(cta) &&
        Boolean(board) &&
        Boolean(shell) &&
        shell.getAttribute("data-board-state") === "effort" &&
        ctaBox.top >= 0 &&
        ctaBox.bottom <= window.innerHeight &&
        boardBox.width >= 440 &&
        boardBox.height >= 440 &&
        boardBox.top >= 0 &&
        boardBox.bottom <= window.innerHeight &&
        shell.getAttribute("data-guides-visible") === "false" &&
        forbidden.length === 0,
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY },
      boardState: shell?.getAttribute("data-board-state") ?? "",
      guidesVisible: shell?.getAttribute("data-guides-visible") ?? "",
      cta: ctaBox,
      board: boardBox,
      ctaText: cta?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      forbidden,
    };
  }, { ctaSelector, boardSelector, shellSelector });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${result.ctaText} visible at ${Math.round(result.cta.bottom)}/${result.viewport.height}`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertEffortFit("replay_before_effort_fit", {
      ctaSelector: '[data-testid="v2-vision-replay-primary"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
    });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertEffortFit("replay_attempting_effort_fit", {
      ctaSelector: '[data-testid="v2-vision-replay-primary"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
    });

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertEffortFit("practice_attempting_effort_fit", {
      ctaSelector: '[data-testid="v2-vision-practice-primary"]',
      boardSelector: '[data-testid="v2-vision-practice-board-shell"] .board-panel',
      shellSelector: '[data-testid="v2-vision-practice-board-shell"]',
    });
    await assertSafeDesktopLanguage(harness, "effort_fit_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
