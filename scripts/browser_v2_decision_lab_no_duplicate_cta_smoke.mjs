#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_no_duplicate_cta_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_no_duplicate_cta_smoke.json");

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function assertNoDuplicateActionLabels(stage, rootTestId) {
  const result = await harness.evalPage((testId) => {
    const root = document.querySelector(`[data-testid="${testId}"]`);
    const labels = [...(root?.querySelectorAll("button") ?? [])]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((button) => button.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    const primaries = [...document.querySelectorAll('[data-testid="decision-lab-primary-action"]')]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
    return { ok: duplicates.length === 0 && primaries <= 1, labels, duplicates, primaries };
  }, rootTestId);
  if (!result.ok) fail(stage, JSON.stringify(result));
  mark(stage, "pass", result.labels.join(" | "));
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
      await harness.clickByTestId(`decision-lab-mode-${mode}`, { afterMs: 200 });
      await assertNoDuplicateActionLabels(`no_duplicate_${mode}`, "decision-lab-actions");
    }

    await harness.clickByTestId("decision-lab-mode-replay", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 150 });
    await assertNoDuplicateActionLabels("no_duplicate_replay_attempting", "decision-lab-actions");
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 150 });
    await assertNoDuplicateActionLabels("no_duplicate_replay_feedback", "decision-lab-actions");

    await harness.clickByTestId("decision-lab-mode-learn", { afterMs: 150 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await assertNoDuplicateActionLabels("no_duplicate_line_player", "decision-lab-line-player");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
