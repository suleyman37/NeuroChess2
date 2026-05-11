#!/usr/bin/env node
import {
  assertBoardTone,
  assertSignatureSafeText,
  captureSignature,
  createSignaturePolishHarness,
  openSignatureExplorer,
  openSignatureVision,
} from "./browser_v2_product_vision_signature_polish_helpers.mjs";

const { evidence, harness } = createSignaturePolishHarness("browser_v2_product_vision_desktop_explorer_local_minimal_copy_smoke");

async function assertExplorerCopy(stage) {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const localCount = (normalized.match(/\blocal\b/g) ?? []).length;
    const horsCount = (normalized.match(/hors entrainement/g) ?? []).length;
    const forbidden = ["due_at", "daily plan", "exercice cree", "exercice créé", "revision"].filter((label) =>
      normalized.includes(label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()),
    );
    return {
      ok:
        Boolean(document.querySelector('[data-testid="v2-vision-explorer"]')) &&
        localCount === 1 &&
        horsCount <= 1 &&
        forbidden.length === 0 &&
        document.querySelector(".v2-vision-explorer-stage")?.getAttribute("data-tone") === "explore",
      localCount,
      horsCount,
      forbidden,
      text,
    };
  });
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", `local=${result.localCount}, hors=${result.horsCount}`);
}

async function main() {
  try {
    await openSignatureVision(harness);
    await openSignatureExplorer(harness);
    await assertExplorerCopy("explorer_empty_local_copy_minimal");
    await assertBoardTone(harness, "explorer_empty_board_tone", "v2-vision-explorer-board-shell", "explore");
    await captureSignature(harness, evidence, "explorer_empty_local", "1366x768");

    await harness.clickByTestId("v2-vision-explorer-create-branch", { afterMs: 220 });
    await harness.assertPageContains("explorer_tools_visible", ["Rapide", "Standard", "Précise", "Analyser la ligne", "Annuler", "Tourner", "Retour à la partie"]);
    await assertExplorerCopy("explorer_branch_local_copy_minimal");
    await captureSignature(harness, evidence, "explorer_branch_local", "1366x768");

    await harness.clickByTestId("v2-vision-explorer-analyze-line", { afterMs: 700 });
    await harness.assertPageContains("explorer_analyzed_visible", ["Ligne jouable", "Rejouer la branche"]);
    await assertExplorerCopy("explorer_analyzed_local_copy_minimal");
    await captureSignature(harness, evidence, "explorer_analyzed_local", "1366x768");
    await harness.setViewport({ width: 1536, height: 864, mobile: false });
    await captureSignature(harness, evidence, "explorer_analyzed_local", "1536x864");
    await assertSignatureSafeText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
