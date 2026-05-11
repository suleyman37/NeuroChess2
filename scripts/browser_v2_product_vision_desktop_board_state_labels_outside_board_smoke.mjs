#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openCompositionPractice,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_board_state_labels_outside_board_smoke");

const STATE_TEXTS = [
  "observation",
  "reperes",
  "a toi",
  "consolide",
  "correction",
  "atelier",
  "atelier local",
  "memoire",
  "observe la decision",
  "les indices utiles sont visibles",
  "trouve le coup sans aide visible",
  "la decision tient",
  "on ralentit et on corrige",
  "teste une branche",
  "cette position reviendra",
];

async function assertStateTextOutsideBoard(stage, { shellSelector, boardSelector, expectedState, requiresMeta = true }) {
  const result = await harness.evalPage(({ shellSelector, boardSelector, expectedState, requiresMeta, stateTexts }) => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01;
    };
    const ownText = (element) =>
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    const shell = document.querySelector(shellSelector);
    const board = document.querySelector(boardSelector) ?? shell?.querySelector(".board-panel, .v2-stage__board");
    const boardRect = board ? rect(board) : null;
    const stageState = shell?.getAttribute("data-board-state") ?? "";
    const stageAfter = shell ? window.getComputedStyle(shell, "::after").content : "";
    const stageBefore = shell ? window.getComputedStyle(shell, "::before").content : "";
    const pseudoText = normalize(`${stageAfter} ${stageBefore}`);
    const pseudoStateLabels = stateTexts.filter((label) => pseudoText.includes(label) && !["none", "normal", "\"\""].includes(pseudoText));

    const textOverlaps = boardRect
      ? [...document.querySelectorAll("span, em, strong, p, h2, h3, h4, button, div")]
          .filter(isVisible)
          .map((element) => ({ element, text: normalize(ownText(element)), rect: rect(element) }))
          .filter((item) => item.text && stateTexts.some((label) => item.text.includes(label)))
          .filter((item) => overlaps(item.rect, boardRect))
          .map((item) => item.text)
      : [];

    const metaElements = [...document.querySelectorAll(".v2-stage__state-pill, .v2-stage__state-copy")]
      .filter(isVisible)
      .map((element) => ({ text: normalize(element.textContent), rect: rect(element) }));
    const metaOverlaps = boardRect ? metaElements.filter((item) => overlaps(item.rect, boardRect)).map((item) => item.text) : [];
    const shellTextOverlay = shell ? Boolean(shell.querySelector(".v2-board-state-copy")) : false;

    return {
      ok:
        Boolean(shell) &&
        Boolean(board) &&
        (!expectedState || stageState === expectedState) &&
        textOverlaps.length === 0 &&
        metaOverlaps.length === 0 &&
        pseudoStateLabels.length === 0 &&
        !shellTextOverlay &&
        (!requiresMeta || metaElements.length > 0),
      shell: Boolean(shell),
      board: Boolean(board),
      expectedState,
      actualState: stageState,
      textOverlaps,
      metaOverlaps,
      pseudoStateLabels,
      shellTextOverlay,
      metaCount: metaElements.length,
      boardRect,
    };
  }, { shellSelector, boardSelector, expectedState, requiresMeta, stateTexts: STATE_TEXTS });

  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `${shellSelector} state=${result.actualState} labels outside board`);
}

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await assertStateTextOutsideBoard("today_memory_labels_outside_board", {
      shellSelector: '[data-testid="v2-board-stage"]',
      boardSelector: '[data-testid="v2-board-stage"] .v2-stage__board',
      expectedState: "memory",
      requiresMeta: false,
    });

    await openCompositionDecisionLab(harness);
    await assertStateTextOutsideBoard("decision_summary_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      expectedState: "observe",
    });
    await harness.clickByTestId("v2-vision-mode-learn", { afterMs: 180 });
    await assertStateTextOutsideBoard("decision_learn_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      expectedState: "learn",
    });
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await assertStateTextOutsideBoard("decision_replay_effort_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      expectedState: "effort",
    });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await assertStateTextOutsideBoard("decision_feedback_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-lab-board-shell"]',
      boardSelector: '[data-testid="v2-vision-lab-board-shell"] .board-panel',
      expectedState: "feedback-success",
    });

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionPractice(harness);
    await assertStateTextOutsideBoard("practice_ready_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-practice-board-shell"]',
      boardSelector: '[data-testid="v2-vision-practice-board-shell"] .board-panel',
      expectedState: "effort",
    });
    await harness.clickByTestId("v2-vision-practice-primary", { afterMs: 180 });
    await assertStateTextOutsideBoard("practice_attempting_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-practice-board-shell"]',
      boardSelector: '[data-testid="v2-vision-practice-board-shell"] .board-panel',
      expectedState: "effort",
    });
    await harness.clickByText("Passer", { exact: true, afterMs: 180 });
    await assertStateTextOutsideBoard("practice_miss_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-practice-board-shell"]',
      boardSelector: '[data-testid="v2-vision-practice-board-shell"] .board-panel',
      expectedState: "feedback-miss",
    });

    await harness.clickByText("Retour", { exact: true, afterMs: 180 });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 220 });
    await assertStateTextOutsideBoard("explorer_labels_outside_board", {
      shellSelector: '[data-testid="v2-vision-explorer-board-shell"]',
      boardSelector: '[data-testid="v2-vision-explorer-board-shell"] .board-panel',
      expectedState: "explore",
    });

    await assertSafeDesktopLanguage(harness, "board_state_labels_outside_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
