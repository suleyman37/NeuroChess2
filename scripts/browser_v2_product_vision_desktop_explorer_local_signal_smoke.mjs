#!/usr/bin/env node
import {
  assertDesktopSafetyText,
  captureDesktopNorthStar,
  createDesktopNorthStarHarness,
  openDesktopDecisionLab,
  openDesktopVision,
} from "./browser_v2_product_vision_desktop_north_star_helpers.mjs";

const { evidence, harness } = createDesktopNorthStarHarness("browser_v2_product_vision_desktop_explorer_local_signal_smoke");

async function main() {
  try {
    await openDesktopVision(harness);
    await openDesktopDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-explore", { afterMs: 220 });
    const lab = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const horsCount = (normalized.match(/hors entrainement/g) ?? []).length;
      return {
        text,
        hasLocalSignal: normalized.includes("local") && normalized.includes("hors entrainement"),
        horsCount,
        hasExploreMood: document.querySelector('[data-testid="v2-vision-lab-board-shell"]')?.getAttribute("data-board-mood") === "explore",
      };
    });
    if (!lab.hasLocalSignal || lab.horsCount > 1 || !lab.hasExploreMood) {
      harness.fail("decision_lab_explorer_local_signal_compact", JSON.stringify(lab));
    }
    harness.mark("decision_lab_explorer_local_signal_compact", "pass", `${lab.horsCount} hors entraînement mention`);

    await harness.clickByTestId("v2-vision-open-explorer", { afterMs: 240 });
    const standalone = await harness.evalPage(() => {
      const text = document.body?.innerText ?? "";
      const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const horsCount = (normalized.match(/hors entrainement/g) ?? []).length;
      const forbidden = ["due_at", "exercice", "révision"].filter((label) => text.toLowerCase().includes(label));
      return {
        ok:
          Boolean(document.querySelector('[data-testid="v2-vision-explorer"]')) &&
          normalized.includes("local") &&
          normalized.includes("hors entrainement") &&
          horsCount <= 1 &&
          text.includes("Tester une ligne sans modifier la session") &&
          forbidden.length === 0,
        horsCount,
        forbidden,
        text,
      };
    });
    if (!standalone.ok) {
      harness.fail("standalone_explorer_local_signal_compact", JSON.stringify(standalone));
    }
    harness.mark("standalone_explorer_local_signal_compact", "pass", `${standalone.horsCount} hors entraînement mention`);
    await captureDesktopNorthStar(harness, evidence, "explorer_local_signal_desktop");
    await assertDesktopSafetyText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
