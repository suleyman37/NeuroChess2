#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_board_visual_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_board_visual_smoke.json");

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app#/v2-review-lab");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.waitForPagePredicate("Decision Lab ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="decision-lab-shell"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);

    const result = await harness.evalPage(() => {
      const board = document.querySelector('[data-testid="decision-lab-board"]');
      const boardRect = board?.getBoundingClientRect();
      const stageRect = document.querySelector('[data-testid="decision-lab-stage"]')?.getBoundingClientRect();
      const rawText = board?.textContent?.trim() ?? "";
      const imagePieces = board?.querySelectorAll("img, svg").length ?? 0;
      const highlighted = board?.querySelectorAll('[style*="255, 217, 102"], [style*="box-shadow"]').length ?? 0;
      const centerDelta = boardRect && stageRect
        ? Math.abs((boardRect.left + boardRect.width / 2) - (stageRect.left + stageRect.width / 2))
        : 999;
      return {
        ok:
          Boolean(boardRect) &&
          boardRect.width >= 360 &&
          imagePieces >= 10 &&
          !/[RNBQKP]/.test(rawText) &&
          !document.querySelector(".decision-lab-piece") &&
          highlighted >= 1 &&
          centerDelta <= 90,
        boardWidth: boardRect?.width ?? 0,
        imagePieces,
        rawText,
        highlighted,
        centerDelta,
      };
    });
    if (!result.ok) fail("board_visual_product_grade", JSON.stringify(result));
    mark("board_visual_product_grade", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
