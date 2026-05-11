#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_dynamic_left_widget_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_dynamic_left_widget_smoke.json");

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

    for (const [mode, title, requiredSelector] of [
      ["summary", "Moments clés", '[data-testid="decision-lab-filter-priority"]'],
      ["learn", "Repères", '[data-testid="decision-lab-learn-cues"]'],
      ["replay", "File de reprise", '[data-testid="decision-lab-replay-queue"]'],
      ["explore", "Branche locale", '[data-testid="decision-lab-branch-list"]'],
    ]) {
      await harness.clickByTestId(`decision-lab-mode-${mode}`, { afterMs: 200 });
      const result = await harness.evalPage((expected) => {
        const leftTitle = document.querySelector('[data-testid="decision-lab-left-title"]')?.textContent?.trim();
        const path = document.querySelector('[data-testid="decision-lab-path"]');
        return {
          ok:
            leftTitle === expected.title &&
            path?.getAttribute("data-mode") === expected.mode &&
            Boolean(document.querySelector(expected.selector)),
          leftTitle,
          mode: path?.getAttribute("data-mode"),
          text: path?.textContent ?? "",
        };
      }, { mode, title, selector: requiredSelector });
      if (!result.ok) fail(`left_widget_${mode}`, JSON.stringify(result));
      mark(`left_widget_${mode}`, "pass", title);
    }
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
