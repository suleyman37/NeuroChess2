#!/usr/bin/env node
import {
  captureQaScreenshot,
  createReadabilityHarness,
  finishHarness,
  setupReviewExplorer,
} from "./browser_explorer_cockpit_readability_helpers.mjs";

const SCRIPT_NAME = "browser_line_player_readability_smoke";
const { harness, evidence } = createReadabilityHarness(SCRIPT_NAME);

function rgbToLuminance(rgb) {
  const channels = String(rgb ?? "").match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const [r, g, b] = channels.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function main() {
  await setupReviewExplorer(harness, evidence);
  await harness.clickByTestId("review-exploration-exit", { afterMs: 500 });
  await harness.clickByTestId("review-focus-learn", { afterMs: 800 });
  await harness.waitForPagePredicate("lesson challenge visible", () => ({
    ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByText("Voir la correction", { exact: true, afterMs: 900 });
  await harness.waitForPagePredicate("correction visible", () => ({
    ok: Boolean(document.querySelector('[data-public-lesson-step="correction"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByText("Voir la ligne", { exact: true, afterMs: 600 });
  await harness.clickByTestId("review-line-solution-play-button", { afterMs: 800 });
  const result = await harness.waitForPagePredicate("line player dark readable", () => {
    const player = document.querySelector('[data-testid="review-line-player"]');
    const dock = document.querySelector('[data-testid="review-line-player-dock"]');
    const context = document.querySelector('[data-testid="review-line-player-context"]');
    const step = document.querySelector('[data-testid="review-line-player-step-label"]');
    const move = document.querySelector('[data-testid="review-line-player-current-move"]');
    const style = player ? window.getComputedStyle(player) : null;
    const contextStyle = context ? window.getComputedStyle(context) : null;
    const moveStyle = move ? window.getComputedStyle(move) : null;
    return {
      ok: Boolean(player) && Boolean(dock) && Boolean(context) && Boolean(step) && Boolean(move),
      background: style?.backgroundColor ?? "",
      color: style?.color ?? "",
      contextColor: contextStyle?.color ?? "",
      moveColor: moveStyle?.color ?? "",
      text: player?.textContent ?? "",
    };
  }, 20_000);
  const backgroundLuminance = rgbToLuminance(result.background);
  const textLuminance = rgbToLuminance(result.color);
  const contrastDirection = Math.abs(textLuminance - backgroundLuminance);
  if (backgroundLuminance > 0.2 || contrastDirection < 0.35) {
    throw new Error(`line player contrast/theme failed: ${JSON.stringify({ result, backgroundLuminance, textLuminance })}`);
  }
  evidence.contract_checks.line_player_readability = {
    ...result,
    backgroundLuminance,
    textLuminance,
    contrastDirection,
  };
  harness.mark("line_player_dark_readable_theme", "pass", JSON.stringify(evidence.contract_checks.line_player_readability));
  await captureQaScreenshot(harness, "line_player_readable_dark_theme");
  await finishHarness(harness, evidence, SCRIPT_NAME);
  console.log("BROWSER_LINE_PLAYER_READABILITY_SMOKE PASS");
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureQaScreenshot(harness, "line_player_failure");
    } catch {
      // best effort only
    }
    harness.writeEvidence();
    console.error("BROWSER_LINE_PLAYER_READABILITY_SMOKE FAIL");
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
