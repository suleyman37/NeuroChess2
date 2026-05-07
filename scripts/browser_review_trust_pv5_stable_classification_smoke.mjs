#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  fetchJson,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-TRUST-PV5-STABLE-CLASSIFICATION-AND-OPENING-GATE-V1";
const MISSION_ID = "P1_REVIEW_TRUST_PV5_STABLE_CLASSIFICATION_AND_OPENING_GATE_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

for (const dir of [
  QA_DIR,
  SCREENSHOT_RAW_DIR,
  path.join(QA_DIR, "screenshots_annotated"),
  path.join(QA_DIR, "contact_sheets"),
  BROWSER_EVIDENCE_DIR,
  path.join(QA_DIR, "console_logs"),
  path.join(QA_DIR, "network_logs"),
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_review_trust_pv5_stable_classification_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_trust_pv5_stable_classification_evidence.json",
);
evidence.strategy =
  "temp backend DB + frontend browser sanity + Review try-move HTTP classification contract";
evidence.contract_checks = {};
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function evaluateAttempt(body) {
  return fetchJson(`${harness.backendBaseUrl}/review/try-move/evaluate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function captureScreenshot(id, notes) {
  const shot = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const screenshotPath = path.join(SCREENSHOT_RAW_DIR, `${id}.png`);
  writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  const entry = {
    id,
    path: screenshotPath,
    notes,
    pass: true,
    created_at: new Date().toISOString(),
  };
  evidence.screenshots.push(entry);
  harness.writeEvidence();
}

async function main() {
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  await harness.startBrowser("/app");
  await harness.loadApp();

  const overlayPreAttempt = await harness.evalPage(() => ({
    ok: !document.querySelector('[data-testid="board-move-outcome-overlay"]'),
    body: document.body?.innerText?.slice(0, 500) ?? "",
  }));
  if (!overlayPreAttempt.ok) {
    fail("no_pre_attempt_board_overlay", JSON.stringify(overlayPreAttempt));
  }
  mark("no_pre_attempt_board_overlay", "pass");
  await captureScreenshot(
    "REVIEW_TRUST_INITIAL_APP_EXPECT_NO_PRE_ATTEMPT_OVERLAY_PASS",
    "Initial app load has no board move outcome overlay before a user attempt.",
  );

  const base = {
    fen_before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    move_played: "a2a3",
    best_move_uci: "e2e4",
    top_moves: [
      { uci: "e2e4", san: "e4", eval_cp: 100, mate_in: null },
      { uci: "d2d4", san: "d4", eval_cp: 90, mate_in: null },
      { uci: "g1f3", san: "Nf3", eval_cp: 50, mate_in: null },
      { uci: "c2c4", san: "c4", eval_cp: 20, mate_in: null },
      { uci: "b1c3", san: "Nc3", eval_cp: -20, mate_in: null },
    ],
    acceptable_moves: [{ uci: "e2e4", san: "e4", quality: "best" }],
    candidate_moves: [],
    source_context: "review_try_move_smoke",
  };

  const playable = await evaluateAttempt({
    ...base,
    stable_attempt_evaluation: {
      uci: "a2a3",
      eval_cp: 20,
      mate_in: null,
      source_kind: "smoke_stable_eval",
    },
  });
  if (playable.result !== "playable" || playable.show_best_move !== false) {
    fail("stable_out_of_list_playable", JSON.stringify(playable));
  }
  mark("stable_out_of_list_playable", "pass", JSON.stringify(playable));

  const imprecise = await evaluateAttempt({
    ...base,
    stable_attempt_evaluation: {
      uci: "a2a3",
      eval_cp: -20,
      mate_in: null,
      source_kind: "smoke_stable_eval",
    },
  });
  if (imprecise.result !== "imprecise" || imprecise.show_best_move !== true) {
    fail("stable_out_of_list_imprecise", JSON.stringify(imprecise));
  }
  mark("stable_out_of_list_imprecise", "pass", JSON.stringify(imprecise));

  const wrong = await evaluateAttempt({
    ...base,
    stable_attempt_evaluation: {
      uci: "a2a3",
      eval_cp: -80,
      mate_in: null,
      source_kind: "smoke_stable_eval",
    },
  });
  if (wrong.result !== "wrong" || wrong.show_best_move !== true) {
    fail("stable_out_of_list_wrong", JSON.stringify(wrong));
  }
  mark("stable_out_of_list_wrong", "pass", JSON.stringify(wrong));

  const autoEvaluated = await evaluateAttempt(base);
  if (autoEvaluated.result === "wrong") {
    fail("out_of_list_without_client_stable_not_auto_wrong", JSON.stringify(autoEvaluated));
  }
  if (
    autoEvaluated.reason_code !== "stable_attempt_eval_loss_band" &&
    autoEvaluated.reason_code !== "stable_evaluation_required_for_legal_out_of_list"
  ) {
    fail("out_of_list_without_client_stable_uses_stable_contract", JSON.stringify(autoEvaluated));
  }
  mark(
    "out_of_list_without_client_stable_not_auto_wrong",
    "pass",
    JSON.stringify(autoEvaluated),
  );

  const candidatePlayable = await evaluateAttempt({
    ...base,
    move_played: "c2c4",
  });
  if (candidatePlayable.result !== "playable") {
    fail("pv5_candidate_playable", JSON.stringify(candidatePlayable));
  }
  mark("pv5_candidate_playable", "pass", JSON.stringify(candidatePlayable));

  const candidateImprecise = await evaluateAttempt({
    ...base,
    move_played: "b1c3",
  });
  if (candidateImprecise.result !== "imprecise") {
    fail("pv5_candidate_imprecise", JSON.stringify(candidateImprecise));
  }
  mark("pv5_candidate_imprecise", "pass", JSON.stringify(candidateImprecise));

  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_errors_clean", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_errors_clean", "pass", JSON.stringify(evidence.browser_errors));
}

main()
  .then(() => {
    harness.writeEvidence();
    console.log("BROWSER_REVIEW_TRUST_PV5_STABLE_CLASSIFICATION_SMOKE PASS");
  })
  .catch((error) => {
    console.error("BROWSER_REVIEW_TRUST_PV5_STABLE_CLASSIFICATION_SMOKE FAIL");
    console.error(error?.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
