#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_explorer_clean_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_explorer_clean_smoke.json");

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

    await harness.clickByTestId("decision-lab-mode-explore", { afterMs: 200 });
    const initial = await harness.evalPage(() => {
      const visibleButtonTexts = [...document.querySelectorAll("button")]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim());
      const analyzeLineCount = visibleButtonTexts.filter((text) => text === "Analyser la ligne").length;
      const branchItems = [...document.querySelectorAll('[data-testid="decision-lab-branch-item"]')];
      const actionsText = document.querySelector('[data-testid="decision-lab-actions"]')?.textContent ?? "";
      const cardText = document.querySelector('[data-testid="decision-lab-card"]')?.textContent ?? "";
      return {
        ok:
          branchItems.length >= 2 &&
          analyzeLineCount === 1 &&
          actionsText.includes("Branche ·") &&
          actionsText.includes("Actif ·") &&
          cardText.includes("Local") &&
          cardText.includes("hors entraînement"),
        analyzeLineCount,
        branchItems: branchItems.length,
        actionsText,
        cardText,
      };
    });
    if (!initial.ok) fail("explorer_initial_clean", JSON.stringify(initial));
    mark("explorer_initial_clean", "pass");

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    const analyzed = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const branchText = [...document.querySelectorAll('[data-testid="decision-lab-branch-item"]')]
        .map((item) => item.textContent ?? "");
      const onlyPendingBadges = branchText.every((item) => item.includes("◌"));
      const actionsText = document.querySelector('[data-testid="decision-lab-actions"]')?.textContent ?? "";
      const cardText = document.querySelector('[data-testid="decision-lab-card"]')?.textContent ?? "";
      return {
        ok:
          text.includes("Ligne analysée") &&
          !onlyPendingBadges &&
          actionsText.includes("Résultat à droite") &&
          cardText.includes("Jouable") &&
          cardText.includes("défendable"),
        branchText,
        actionsText,
        cardText,
      };
    });
    if (!analyzed.ok) fail("explorer_after_line_analysis_clean", JSON.stringify(analyzed));
    mark("explorer_after_line_analysis_clean", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
