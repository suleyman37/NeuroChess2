#!/usr/bin/env node
import {
  captureQaScreenshot,
  createReadabilityHarness,
  finishHarness,
  playExplorationMove,
  setupReviewExplorer,
} from "./browser_explorer_cockpit_readability_helpers.mjs";

const SCRIPT_NAME = "browser_eval_bar_stability_smoke";
const { harness, evidence } = createReadabilityHarness(SCRIPT_NAME);

async function evalBarSnapshot() {
  return harness.evalPage(() => {
    const wrap = document.querySelector(".eval-wrap");
    const track = document.querySelector(".eval-bar-track");
    const label = document.querySelector(".eval-label");
    const wrapRect = wrap?.getBoundingClientRect();
    const trackRect = track?.getBoundingClientRect();
    return {
      ok: Boolean(wrap) && Boolean(track) && Boolean(label),
      className: wrap?.className ?? "",
      label: label?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      disabled: wrap?.classList.contains("eval-disabled") ?? false,
      hidden: wrap?.classList.contains("eval-hidden") ?? false,
      wrapHeight: Math.round(wrapRect?.height ?? 0),
      trackHeight: Math.round(trackRect?.height ?? 0),
      opacity: wrap ? window.getComputedStyle(wrap).opacity : "",
    };
  });
}

async function main() {
  await setupReviewExplorer(harness, evidence);
  const before = await evalBarSnapshot();
  if (!before.ok || before.disabled || before.hidden) {
    throw new Error(`eval bar not stable before move: ${JSON.stringify(before)}`);
  }
  await captureQaScreenshot(harness, "eval_bar_before_explorer_move");
  const move = await playExplorationMove(harness);
  const after = await evalBarSnapshot();
  const heightDelta = Math.abs(after.trackHeight - before.trackHeight);
  if (!after.ok || after.disabled || after.hidden || heightDelta > 2) {
    throw new Error(`eval bar changed to disabled/unstable after ${move}: ${JSON.stringify({ before, after })}`);
  }
  evidence.contract_checks.eval_bar_stability = { move, before, after, heightDelta };
  harness.mark("eval_bar_stays_visually_stable_after_explorer_move", "pass", JSON.stringify({ heightDelta, after }));
  await captureQaScreenshot(harness, "eval_bar_after_explorer_move");
  await finishHarness(harness, evidence, SCRIPT_NAME);
  console.log("BROWSER_EVAL_BAR_STABILITY_SMOKE PASS");
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureQaScreenshot(harness, "eval_bar_failure");
    } catch {
      // best effort only
    }
    harness.writeEvidence();
    console.error("BROWSER_EVAL_BAR_STABILITY_SMOKE FAIL");
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
