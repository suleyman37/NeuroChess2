#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_board_quality_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_board_quality_smoke.json");

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
      ok: Boolean(document.querySelector('[data-testid="decision-lab-board"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);

    const result = await harness.evalPage(() => {
      const board = document.querySelector('[data-testid="decision-lab-board"]');
      const boardRect = board?.getBoundingClientRect();
      const stageRect = document.querySelector('[data-testid="decision-lab-stage"]')?.getBoundingClientRect();
      const boardText = board?.textContent?.replace(/\s+/g, "") ?? "";
      const pieceImages = board?.querySelectorAll("img, svg").length ?? 0;
      const fen = board?.getAttribute("data-board-fen") ?? "";
      const centerDelta = boardRect && stageRect
        ? Math.abs((boardRect.left + boardRect.width / 2) - (stageRect.left + stageRect.width / 2))
        : 999;
      return {
        ok:
          Boolean(boardRect) &&
          boardRect.width >= 360 &&
          pieceImages >= 10 &&
          !/[RNBQKP]/.test(boardText) &&
          !document.querySelector(".decision-lab-piece") &&
          fen.includes("/") &&
          centerDelta <= 90,
        boardWidth: boardRect?.width ?? 0,
        pieceImages,
        boardText,
        fen,
        centerDelta,
      };
    });
    if (!result.ok) fail("board_quality", JSON.stringify(result));
    mark("board_quality", "pass", "V1 ChessBoardPanel adapter visible, centered, no raw piece letters");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
