#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_primary_action_smoke.json");
evidence.output_path = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  MISSION_ID,
  "browser_evidence",
  "browser_v2_decision_lab_primary_action_smoke.json",
);

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function expectPrimary(stage, label) {
  const result = await harness.evalPage((expectedLabel) => {
    const primary = document.querySelector('[data-testid="decision-lab-primary-action"]');
    const visiblePrimaries = [...document.querySelectorAll('[data-testid="decision-lab-primary-action"]')]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none";
      });
    return {
      ok: visiblePrimaries.length === 1 && primary?.textContent?.trim() === expectedLabel,
      label: primary?.textContent?.trim() ?? null,
      visiblePrimaries: visiblePrimaries.length,
    };
  }, label);
  if (!result.ok) fail(stage, JSON.stringify(result));
  mark(stage, "pass", label);
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

    await expectPrimary("summary_replay_primary", "Rejouer ce moment");

    await harness.clickByTestId("decision-lab-filter-good", { afterMs: 200 });
    await harness.clickByTestId("decision-lab-moment-item", { afterMs: 200 });
    await expectPrimary("summary_non_replay_primary", "Explorer depuis ici");

    await harness.clickByTestId("decision-lab-mode-learn", { afterMs: 200 });
    await expectPrimary("learn_primary", "Voir la ligne");

    await harness.clickByTestId("decision-lab-mode-replay", { afterMs: 200 });
    await expectPrimary("replay_unavailable_primary", "Pas de reprise");

    await harness.clickByTestId("decision-lab-mode-summary", { afterMs: 200 });
    await harness.clickByTestId("decision-lab-filter-priority", { afterMs: 200 });
    await harness.clickByTestId("decision-lab-moment-item", { afterMs: 200 });
    await harness.clickByTestId("decision-lab-mode-replay", { afterMs: 200 });
    await expectPrimary("replay_ready_primary", "Commencer la tentative");
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await expectPrimary("replay_attempting_primary", "Valider");
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    await expectPrimary("replay_feedback_primary", "Position suivante");

    await harness.clickByTestId("decision-lab-mode-explore", { afterMs: 200 });
    await expectPrimary("explore_primary", "Analyser la ligne");

    await harness.clickByTestId("decision-lab-mode-learn", { afterMs: 200 });
    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 200 });
    const linePlayer = await harness.evalPage(() => ({
      ok:
        Boolean(document.querySelector('[data-testid="decision-lab-line-player"]')) &&
        !document.querySelector('[data-testid="decision-lab-primary-action"]'),
    }));
    if (!linePlayer.ok) fail("line_player_no_normal_primary", JSON.stringify(linePlayer));
    mark("line_player_no_normal_primary", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
