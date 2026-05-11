#!/usr/bin/env node
import path from "node:path";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-DECISION-LAB-V2-PRODUCT-GRADE-POLISH-V1";
const MISSION_ID = "P1_REVIEW_DECISION_LAB_V2_PRODUCT_GRADE_POLISH_V1";
const evidence = createEvidence(MISSION, "browser_v2_decision_lab_explorer_information_smoke.json");
evidence.output_path = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID, "browser_evidence", "browser_v2_decision_lab_explorer_information_smoke.json");

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
    const before = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLocaleLowerCase("fr-FR");
      const buttonTexts = [...document.querySelectorAll("button")]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim());
      return {
        ok:
          normalized.includes("local · hors entraînement") &&
          normalized.includes("branche") &&
          normalized.includes("dernier coup") &&
          normalized.includes("non analysé") &&
          buttonTexts.filter((textValue) => textValue === "Analyser la ligne").length === 1,
        text,
        buttonTexts,
      };
    });
    if (!before.ok) fail("explorer_before_information", JSON.stringify(before));
    mark("explorer_before_information", "pass");

    await harness.clickByTestId("decision-lab-primary-action", { afterMs: 250 });
    const after = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLocaleLowerCase("fr-FR");
      const leftText = document.querySelector('[data-testid="decision-lab-path"]')?.textContent ?? "";
      return {
        ok:
          normalized.includes("ligne analysée") &&
          normalized.includes("jouable") &&
          normalized.includes("ne crée pas d'exercice") &&
          leftText.includes("Qxc3") &&
          !leftText.includes("◌Qxc3"),
        text,
        leftText,
      };
    });
    if (!after.ok) fail("explorer_after_information", JSON.stringify(after));
    mark("explorer_after_information", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
