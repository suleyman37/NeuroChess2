#!/usr/bin/env node
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  fetchJson,
} from "./browser_test_helpers.mjs";

const INVALID_PGN = "not a pgn at all";
const ILLEGAL_PGN = `[Event "Broken"]
[Site "?"]
[Date "2026.05.05"]
[White "Bad"]
[Black "Parser"]
[Result "*"]

1. e5 *
`;

const evidence = createEvidence(
  "P1.DEGRADED-STATES-ANTI-TILT-V1",
  "browser_degraded_states_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + Vite + Edge CDP + visible degraded-state recovery copy";
evidence.state_ids_encountered = [];
evidence.coverage = {
  covered: [
    "IMPORT_INVALID_PGN",
    "IMPORT_ILLEGAL_MOVES",
    "DAILY_PLAN_EMPTY",
    "BACKEND_UNAVAILABLE",
    "EXPORT_FAILED/DELETE_CONFIRMATION_REQUIRED safety via API",
  ],
  deferred_to_existing_or_static: [
    "ENGINE_STALLED_RESUMABLE covered by browser_analysis_stall_recovery_smoke.mjs",
    "ANTI_TILT_REPEATED_WRONG covered statically in backend/tests/test_degraded_states_v1.py",
    "Practice real move flows covered by browser_core_board_interaction_smoke.mjs",
  ],
};

let harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function openImportPanel(activeHarness = harness) {
  await activeHarness.clickByTestId("nav-games", { afterMs: 500 });
  await activeHarness.clickByText("Importer PGN", { afterMs: 500 });
  await activeHarness.assertPageContains("import_panel_visible", [
    "Import PGN",
    "Coller PGN",
    "Prévisualiser",
    "Importer",
  ]);
}

async function fillPgn(pgn, activeHarness = harness) {
  const result = await activeHarness.evalPage((value) => {
    const textarea = document.querySelector('[data-testid="pgn-textarea"]');
    if (!textarea) {
      return { ok: false, reason: "missing pgn textarea" };
    }
    const setTextarea = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setTextarea?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, length: textarea.value.length };
  }, pgn);
  if (!result?.ok) {
    fail("fill_pgn", JSON.stringify(result));
  }
}

async function waitForNotice(stateId, labels, activeHarness = harness) {
  const result = await activeHarness.waitForPagePredicate(
    `notice_${stateId}`,
    (expected) => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const text = document.body?.innerText ?? "";
      const normalized = normalize(text);
      const missing = expected.filter((label) => !normalized.includes(normalize(label)));
      return { ok: missing.length === 0, missing, text };
    },
    15_000,
    labels,
  );
  evidence.state_ids_encountered.push(stateId);
  mark(`notice_${stateId}`, "pass", labels.join(" / "));
  return result;
}

async function assertNoUnexpectedBrowserFailures(stage, activeHarness = harness, options = {}) {
  const { allowConnectionRefused = false } = options;
  const network500 = evidence.browser_errors.network_500 ?? [];
  const pageErrors = evidence.browser_errors.page ?? [];
  const severeConsole = (evidence.browser_errors.console ?? []).filter(
    (entry) =>
      !String(entry).includes("404") &&
      !String(entry).includes("favicon") &&
      !(allowConnectionRefused && String(entry).includes("ERR_CONNECTION_REFUSED")),
  );
  if (network500.length || pageErrors.length || severeConsole.length) {
    await activeHarness.captureScreenshot(`${stage}_failure`);
    fail(
      stage,
      JSON.stringify({
        network500,
        pageErrors,
        severeConsole,
      }),
    );
  }
  mark(stage, "pass", "no page error, no unexpected console error, no network 500");
}

async function runOnlineFlows() {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser();
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_initial");

  await openImportPanel();
  await fillPgn(INVALID_PGN);
  await harness.clickByText("Prévisualiser", { exact: true, afterMs: 500 });
  await waitForNotice("IMPORT_INVALID_PGN", ["PGN non reconnu", "Corriger le PGN"]);

  await fillPgn(ILLEGAL_PGN);
  await harness.clickByText("Prévisualiser", { exact: true, afterMs: 500 });
  await waitForNotice("IMPORT_ILLEGAL_MOVES", ["Un coup n’est pas légal", "Corriger le PGN"]);

  await harness.clickByTestId("nav-training", { afterMs: 700 });
  await waitForNotice("DAILY_PLAN_EMPTY", ["Plan en construction", "Importer une partie"]);

  const exportPayload = await fetchJson(`${harness.backendBaseUrl}/api/export`);
  if (!exportPayload?.metadata?.schema_version) {
    fail("export_empty_safe", JSON.stringify(exportPayload));
  }
  mark("export_empty_safe", "pass", exportPayload.metadata.schema_version);

  const deleteWithoutConfirmation = await fetch(`${harness.backendBaseUrl}/api/user-data?confirm=NOPE`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });
  if (deleteWithoutConfirmation.status !== 400) {
    fail("delete_confirmation_required", `HTTP ${deleteWithoutConfirmation.status}`);
  }
  evidence.state_ids_encountered.push("DELETE_CONFIRMATION_REQUIRED");
  mark("delete_confirmation_required", "pass", "HTTP 400 confirmation_required");

  const deletePayload = await fetchJson(`${harness.backendBaseUrl}/api/user-data?confirm=SUPPRIMER`, {
    method: "DELETE",
  });
  mark("delete_temp_db_safe", "pass", JSON.stringify(deletePayload));

  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_after_degraded_states");
  await assertNoUnexpectedBrowserFailures("online_browser_errors");
}

async function runOfflineFrontendFlow() {
  await harness.cleanupProcesses();
  harness = new BrowserSmokeHarness(evidence);
  harness.backendBaseUrl = "http://127.0.0.1:59999";
  await harness.startFrontendVite();
  await harness.startBrowser();
  await harness.loadApp();
  await harness.clickByTestId("nav-training", { afterMs: 900 });
  await waitForNotice("BACKEND_UNAVAILABLE", ["NeuroChess local ne répond pas", "Réessayer"], harness);
  await assertNoUnexpectedBrowserFailures("offline_browser_errors", harness, {
    allowConnectionRefused: true,
  });
}

async function main() {
  try {
    await runOnlineFlows();
    await runOfflineFrontendFlow();
    evidence.finished_at = new Date().toISOString();
    evidence.result = "pass";
    harness.writeEvidence();
    console.log("BROWSER_DEGRADED_STATES_SMOKE PASS");
    console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
  } catch (error) {
    await harness.captureScreenshot("browser_degraded_states_smoke_failure");
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? String(error);
    harness.writeEvidence();
    console.error("BROWSER_DEGRADED_STATES_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  } finally {
    await delay(100);
    await harness.cleanupProcesses();
  }
}

await main();
