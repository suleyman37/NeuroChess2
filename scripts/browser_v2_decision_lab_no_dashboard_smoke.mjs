#!/usr/bin/env node
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_no_dashboard_smoke.json");
evidence.output_path = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  MISSION_ID,
  "browser_evidence",
  "browser_v2_decision_lab_no_dashboard_smoke.json",
);

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

    for (const mode of ["summary", "learn", "replay", "explore"]) {
      await harness.clickByTestId(`decision-lab-mode-${mode}`, { afterMs: 150 });
      const result = await harness.evalPage((expectedMode) => {
        const text = document.body?.innerText ?? "";
        const normalized = String(text)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        const forbidden = [
          "review coach",
          "score coach",
          "resume review",
          "exploration locale",
          "moments analyses",
          "bonnes decisions",
          "comprendre les symboles",
          "criticality_score",
          "diagnostic_gap",
          "stockfish wdl",
          "candidate trainer",
          "llm coach",
          "fsrs",
          "etv",
          "skilltrace",
        ].filter((label) => normalized.includes(label));
        const card = document.querySelector('[data-testid="decision-lab-card"]');
        const board = document.querySelector('[data-testid="decision-lab-board"]')?.getBoundingClientRect();
        const primaryCount = document.querySelectorAll('[data-testid="decision-lab-primary-action"]').length;
        return {
          ok:
            forbidden.length === 0 &&
            card?.getAttribute("data-mode") === expectedMode &&
            primaryCount <= 1 &&
            Boolean(board && board.width >= 360),
          forbidden,
          mode: card?.getAttribute("data-mode"),
          primaryCount,
          boardWidth: board?.width ?? 0,
          text,
        };
      }, mode);
      if (!result.ok) fail(`no_dashboard_${mode}`, JSON.stringify(result));
      mark(`no_dashboard_${mode}`, "pass");
    }

    await harness.assertForbiddenV1LabelsAbsent("shared_forbidden_labels_absent");
    const text = await harness.visibleText();
    if (normalizeText(text).includes("dashboard")) {
      fail("dashboard_word_absent", "dashboard label visible");
    }
    mark("dashboard_word_absent", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
