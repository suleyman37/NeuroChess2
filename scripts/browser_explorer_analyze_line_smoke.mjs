#!/usr/bin/env node
import {
  assertNoSideEffects,
  captureQaScreenshot,
  createReadabilityHarness,
  dbCounts,
  finishHarness,
  playExplorationMove,
  setupReviewExplorer,
} from "./browser_explorer_cockpit_readability_helpers.mjs";

const SCRIPT_NAME = "browser_explorer_analyze_line_smoke";
const { harness, evidence } = createReadabilityHarness(SCRIPT_NAME);

async function main() {
  await setupReviewExplorer(harness, evidence, { FAKE_ENGINE_DELAY_MS: "350" });
  const beforeCounts = dbCounts(harness);
  const firstMove = await playExplorationMove(harness, ["e2e4", "d2d4"]);
  const secondMove = await playExplorationMove(harness);
  evidence.api.branch_moves = [firstMove, secondMove];
  await captureQaScreenshot(harness, "explorer_line_before_analysis");

  await harness.clickByTestId("review-explorer-analyze-line", { afterMs: 10 });
  await harness.waitForPagePredicate("line analysis progress visible", () => {
    const state = document.querySelector('[data-testid="review-explorer-analysis-state"]');
    const text = String(state?.textContent ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return { ok: text.includes("evaluation de la ligne"), text: state?.textContent ?? "" };
  }, 8_000);
  harness.mark("explorer_line_analysis_loading_visible", "pass");
  await captureQaScreenshot(harness, "explorer_line_analysis_loading");

  const result = await harness.waitForPagePredicate("line stable result visible", () => {
    const line = document.querySelector('[data-testid="review-explorer-line-result"]');
    const badge = document.querySelector('[data-testid="review-explorer-line-quality-badge"]');
    const dock = document.querySelector('[data-testid="review-explorer-cockpit-actions"]');
    return {
      ok: Boolean(line) && Boolean(badge) && Boolean(dock),
      text: line?.textContent ?? "",
      badge: badge?.textContent ?? "",
    };
  }, 60_000);
  evidence.contract_checks.line_result = result;
  harness.mark("explorer_line_stable_result_visible", "pass", JSON.stringify(result));
  await captureQaScreenshot(harness, "explorer_line_stable_result");

  const afterCounts = dbCounts(harness);
  assertNoSideEffects(beforeCounts, afterCounts);
  evidence.contract_checks.no_side_effects = { beforeCounts, afterCounts };
  harness.mark("explorer_line_no_practice_daily_side_effects", "pass", JSON.stringify(afterCounts));
  await finishHarness(harness, evidence, SCRIPT_NAME);
  console.log("BROWSER_EXPLORER_ANALYZE_LINE_SMOKE PASS");
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureQaScreenshot(harness, "explorer_line_failure");
    } catch {
      // best effort only
    }
    harness.writeEvidence();
    console.error("BROWSER_EXPLORER_ANALYZE_LINE_SMOKE FAIL");
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
