#!/usr/bin/env node
import { fetchJson } from "./browser_test_helpers.mjs";
import {
  captureQaScreenshot,
  createReadabilityHarness,
  finishHarness,
  setupReviewContext,
} from "./browser_explorer_cockpit_readability_helpers.mjs";

const SCRIPT_NAME = "browser_today_start_context_smoke";
const { harness, evidence } = createReadabilityHarness(SCRIPT_NAME);

async function main() {
  await setupReviewContext(harness, evidence, {}, { seedEligibleMoment: false });
  const plan = await fetchJson(`${harness.backendBaseUrl}/api/training/daily-plan`, {
    method: "POST",
    body: JSON.stringify({ max_items: 6 }),
  });
  evidence.api.daily_plan = {
    status: plan.status,
    item_count: plan.item_count,
    first_item: plan.items?.[0]?.item_id ?? null,
  };
  await harness.clickByTestId("nav-training", { afterMs: 900 });
  await harness.waitForPagePredicate("training start cta ready", () => {
    const buttons = [...document.querySelectorAll("button")];
    const cta = buttons.find(
      (button) =>
        button.textContent?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() ===
          "commencer" && !button.disabled,
    );
    return { ok: Boolean(cta), text: document.body?.innerText ?? "" };
  }, 20_000);
  await harness.clickByText("Commencer", { exact: true, afterMs: 1600 });
  const practice = await harness.waitForPagePredicate("daily plan practice context", () => {
    const text = document.body?.innerText ?? "";
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const historicalRow = document.querySelector('[data-testid="review-decision-card-historical-row"]');
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        !normalized.includes("coup indisponible") &&
        !normalized.includes("coup joue dans la partie : coup indisponible") &&
        Boolean(historicalRow),
      text,
      historicalRow: historicalRow?.textContent ?? "",
    };
  }, 30_000);
  evidence.contract_checks.today_start_context = practice;
  harness.mark("today_start_context_no_raw_unavailable_move", "pass", practice.historicalRow);
  await captureQaScreenshot(harness, "today_start_context_practice");
  await finishHarness(harness, evidence, SCRIPT_NAME);
  console.log("BROWSER_TODAY_START_CONTEXT_SMOKE PASS");
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureQaScreenshot(harness, "today_context_failure");
    } catch {
      // best effort only
    }
    harness.writeEvidence();
    console.error("BROWSER_TODAY_START_CONTEXT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
