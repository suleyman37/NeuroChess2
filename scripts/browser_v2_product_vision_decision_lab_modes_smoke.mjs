#!/usr/bin/env node
import {
  assertDecisionLabForbiddenAbsent,
  assertOnePrimary,
  captureDecisionLab,
  createDecisionLabHarness,
  openDecisionLab,
} from "./browser_v2_product_vision_decision_lab_helpers.mjs";

const { evidence, harness } = createDecisionLabHarness("browser_v2_product_vision_decision_lab_modes_smoke");

const expected = {
  summary: { left: "Moments clés", right: "Décision du moment", primary: "Rejouer ce moment" },
  learn: { left: "Repères", right: "Apprendre l'idée", primary: "Voir la ligne" },
  replay: { left: "File de reprise", right: "Rejouer la décision", primary: "Commencer la tentative" },
  explore: { left: "Branche locale", right: "Tester une alternative", primary: "Analyser la ligne" },
};

async function main() {
  try {
    await openDecisionLab(harness);

    for (const [mode, contract] of Object.entries(expected)) {
      await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 220 });
      const result = await harness.evalPage((wanted) => {
        const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
        const left = normalize(document.querySelector('[data-testid="v2-vision-lab-left"]')?.textContent);
        const right = normalize(document.querySelector('[data-testid="v2-vision-decision-card"]')?.textContent);
        const dock = normalize(document.querySelector('[data-testid="v2-vision-action-dock"]')?.textContent);
        const labels = [...document.querySelectorAll("button")]
          .filter((button) => {
            const rect = button.getBoundingClientRect();
            const style = window.getComputedStyle(button);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          })
          .map((button) => normalize(button.textContent))
          .filter(Boolean);
        const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
        return {
          ok: left.includes(wanted.left) && right.includes(wanted.right) && dock.includes(wanted.primary),
          left,
          right,
          dock,
          duplicates,
        };
      }, contract);
      if (!result.ok) {
        harness.fail(`decision_lab_mode_${mode}_contract`, JSON.stringify(result));
      }
      const primary = await assertOnePrimary(harness, `decision_lab_mode_${mode}_one_primary`);
      if (primary !== contract.primary) {
        harness.fail(`decision_lab_mode_${mode}_primary_label`, `expected ${contract.primary}, got ${primary}`);
      }
      harness.mark(`decision_lab_mode_${mode}_changes_screen`, "pass");
      if (mode === "learn") {
        await captureDecisionLab(harness, evidence, "decision_lab_learn");
      }
    }

    await assertDecisionLabForbiddenAbsent(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
