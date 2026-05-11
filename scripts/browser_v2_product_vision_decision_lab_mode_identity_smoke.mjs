#!/usr/bin/env node
import {
  assertNoForbiddenModeText,
  captureModeDecisionLab,
  createModeHarness,
  getModeSnapshot,
  openModeDecisionLab,
} from "./browser_v2_product_vision_decision_lab_mode_experience_helpers.mjs";

const { evidence, harness } = createModeHarness("browser_v2_product_vision_decision_lab_mode_identity_smoke");

const expected = {
  summary: { mood: "calm", left: "Moments clés", right: "Diagnostic narratif", dock: "Rejouer ce moment", cue: "Décision critique" },
  learn: { mood: "learn", left: "Repères", right: "Mini-leçon", dock: "Voir la ligne", cue: "Flèche pédagogique" },
  replay: { mood: "active", left: "File de reprise", right: "Effort actif", dock: "Commencer la tentative", cue: "Guides masqués" },
  explore: { mood: "explore", left: "Branche locale", right: "Atelier local", dock: "Analyser la ligne", cue: "LOCAL" },
};

async function main() {
  try {
    await openModeDecisionLab(harness);

    for (const [mode, contract] of Object.entries(expected)) {
      await harness.clickByTestId(`v2-vision-mode-${mode}`, { afterMs: 220 });
      const snapshot = await getModeSnapshot(harness);
      const ok =
        snapshot.activeMode === mode &&
        snapshot.rootClass.includes(`is-${mode}`) &&
        snapshot.activeButtonMode === mode &&
        snapshot.boardMood === contract.mood &&
        snapshot.left.includes(contract.left) &&
        snapshot.right.includes(contract.right) &&
        snapshot.dock.includes(contract.dock) &&
        snapshot.cue.includes(contract.cue);
      if (!ok) {
        harness.fail(`decision_lab_${mode}_identity`, JSON.stringify(snapshot));
      }
      harness.mark(`decision_lab_${mode}_identity`, "pass", `${mode}/${contract.mood}`);
      if (mode === "summary") await captureModeDecisionLab(harness, evidence, "decision_lab_summary");
      if (mode === "learn") await captureModeDecisionLab(harness, evidence, "decision_lab_learn");
      if (mode === "replay") await captureModeDecisionLab(harness, evidence, "decision_lab_replay_before_attempt");
      if (mode === "explore") await captureModeDecisionLab(harness, evidence, "decision_lab_explorer_before_analysis");
    }

    await assertNoForbiddenModeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
