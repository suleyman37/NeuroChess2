#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  fetchJson,
  findPython,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "P0.REVIEW-CORRECTION-CONTRADICTION-REGRESSION-NXE4-V1";
const QA_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P0_REVIEW_CORRECTION_CONTRADICTION_REGRESSION_NXE4_V1",
);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
const API_DIR = path.join(QA_DIR, "api_snapshots");
const DB_DIR = path.join(QA_DIR, "db_snapshots");
for (const dir of [QA_DIR, SCREENSHOT_DIR, BROWSER_EVIDENCE_DIR, API_DIR, DB_DIR]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_review_correction_no_contradiction_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_correction_no_contradiction_evidence.json",
);
evidence.strategy =
  "temp backend DB + intercepted legacy Review payload where played SAN/Best SAN are both Nxe4 + Correction tab assertions";
evidence.screenshots = [];

const manifest = {
  mission: MISSION,
  generated_at: new Date().toISOString(),
  screenshots: [],
};

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function captureQaScreenshot(id, flow, expectedObservation, assertionsChecked) {
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const screenshotPath = path.join(SCREENSHOT_DIR, `${id}.png`);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  const entry = {
    id,
    path: screenshotPath,
    viewport: "default headless Edge viewport",
    flow,
    expected_observation: expectedObservation,
    assertions_checked: assertionsChecked,
    pass: true,
  };
  manifest.screenshots.push(entry);
  evidence.screenshots.push(entry);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  harness.writeEvidence();
  return screenshotPath;
}

function dbCounts(label) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
tables = [
    "review_jobs",
    "game_reviews",
    "review_moments",
    "training_items",
    "review_practice_attempts",
]
with sqlite3.connect(db_path) as connection:
    counts = {}
    for table in tables:
        counts[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
print(json.dumps(counts, sort_keys=True))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`db_counts_${label}`, `${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout);
  writeJson(path.join(DB_DIR, `${label}.json`), payload);
  evidence.api[`db_counts_${label}`] = payload;
  return payload;
}

function legacyNxe4Annotation(baseAnnotation = {}) {
  const fenBefore =
    "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 3";
  const fenAfter =
    "rnbqkb1r/pppp1ppp/8/4p3/4n3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4";
  return {
    ...baseAnnotation,
    ply: 8,
    move_number: 8,
    color: "black",
    side: "black",
    san: "Nxe4",
    uci: "f6e4",
    fen_before: fenBefore,
    fen_after: fenAfter,
    primary_category: "missed_opportunity",
    category_label: "Problème",
    tags: ["missed_opportunity"],
    tag_labels: ["Opportunité manquée"],
    reason: "legacy_exact_best_regression_fixture",
    win_loss: -20,
    move_accuracy: 35,
    lichess_like_move_accuracy: 35,
    best_move_uci: "f6e4",
    best_move_san: "Nxe4",
    top_moves: [
      { uci: "f6e4", san: "Nxe4", rank: 1, eval_cp: -80, pv: ["f6e4", "d2d4"] },
      { uci: "d7d6", san: "d6", rank: 2, eval_cp: 30, pv: ["d7d6", "d2d4"] },
    ],
    try_move_supported: true,
    try_move_model_version: baseAnnotation.try_move_model_version ?? "try_move_v1",
    accepted_moves: ["f6e4", "Nxe4"],
    acceptable_moves: ["f6e4", "Nxe4"],
    accepted_moves_uci: ["f6e4"],
    pedagogical_explanation: {
      ...(baseAnnotation.pedagogical_explanation ?? {}),
      available: true,
      error_type: "tactical",
      why_played_move_bad: "Ancien libellé négatif conservé pour le test.",
      why_best_move_good: "Ancienne correction indiquant le même coup.",
      training_takeaway: "Vérifier la cohérence entre ton coup et la correction.",
    },
    contrast_coach_explanation: {
      ...(baseAnnotation.contrast_coach_explanation ?? {}),
      available: true,
      what_happened_after_played: "Ancien état contradictoire à neutraliser.",
      why_solution_is_better: "La meilleure idée affichée est le même coup.",
    },
    impact_label: "Jouable",
    move_quality_label: "Jouable",
    compact_label: "Nxe4",
    coach_card_title: "Coup 8",
  };
}

function buildLegacyNxe4ReviewPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = legacyNxe4Annotation(baseAnnotation);
  const payload = {
    ...review,
    status: review?.status ?? "done",
    user_color: "black",
    move_annotations: [annotation],
    review_sections: {
      to_review: [annotation],
      strong_moves: [],
      missed_opportunities: [annotation],
      all: [annotation],
    },
  };
  evidence.api.legacy_nxe4_annotation = annotation;
  writeJson(path.join(API_DIR, "legacy_nxe4_intercepted_review_payload.json"), payload);
  mark("legacy_nxe4_review_payload", "pass", "played=Nxe4 best=Nxe4 via intercepted Review API payload");
  return payload;
}

async function openReviewWithInterceptedPayload(gameId, reviewPayload) {
  await harness.startBrowser("/app");
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
(() => {
  const gameId = ${JSON.stringify(String(gameId))};
  const reviewPayload = ${JSON.stringify(reviewPayload)};
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const rawUrl = typeof input === "string" ? input : String(input && input.url ? input.url : "");
    if (rawUrl.includes("/games/" + gameId + "/review")) {
      return new Response(JSON.stringify(reviewPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
})();
`,
  });
  await harness.evalPage(
    ({ gameId: nextGameId }) => {
      window.localStorage.setItem(
        "neurochess.appState.v5_3a4d",
        JSON.stringify({
          gameId: nextGameId,
          activeTab: "review",
          displayedPositionPly: 0,
          activeReviewJobId: null,
          reviewAnalysisProfile: "standard",
          updatedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(`neurochess.reviewPov.${nextGameId}`, "both");
      return { ok: true };
    },
    { gameId },
  );
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app`,
  });
  await harness.waitForPagePredicate("review board restored", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-board"]')) ||
        text.includes("Review") ||
        text.includes("Analyse"),
      text,
    };
  }, 30_000);
}

async function openCorrectionTab(gameId) {
  await harness.waitForPagePredicate("review board visible", () => {
    return { ok: Boolean(document.querySelector('[data-testid="review-board"]')) };
  }, 30_000);
  await harness.clickByTestId("review-focus-learn", { afterMs: 700 });
  await harness.waitForPagePredicate("lesson challenge visible", () => {
    return {
      ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
  await captureQaScreenshot(
    "01_reproduction_or_fixture_before_fix_if_available",
    "Review lesson challenge for legacy Nxe4 fixture",
    "Fixture has the same displayed played move and best move that previously produced a contradiction",
    ["Nxe4 visible", "lesson challenge visible"],
  );
  await harness.clickByText("Voir la correction", { exact: true, afterMs: 900 });
  await harness.waitForPagePredicate("correction tab visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-public-lesson-step="correction"]')) &&
        (document.body?.innerText ?? "").includes("Nxe4"),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
}

async function assertCorrectionHasNoContradiction() {
  const result = await harness.waitForPagePredicate("correction no contradiction", () => {
    const root = document.querySelector('[data-public-lesson-step="correction"]');
    const fullText = document.body?.innerText ?? "";
    const text = root?.textContent ?? "";
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const compactCorrection = normalize(text).replace(/[^\p{L}\p{N}]+/gu, " ");
    const compactPage = normalize(fullText).replace(/[^\p{L}\p{N}]+/gu, " ");
    return {
      ok:
        compactCorrection.includes("bien joue") &&
        compactCorrection.includes("nxe4") &&
        !compactCorrection.includes("ton coup probleme") &&
        !compactCorrection.includes("le meilleur coup etait") &&
        !compactPage.includes("opportunite manquee") &&
        !compactPage.includes("ouvre la correction pour comparer"),
      hasSuccess: compactCorrection.includes("bien joue"),
      hasMove: compactCorrection.includes("nxe4"),
      hasProblem: compactCorrection.includes("ton coup probleme"),
      hasMissedBest: compactCorrection.includes("le meilleur coup etait"),
      hasMissedOpportunity: compactPage.includes("opportunite manquee"),
      hasOpenCorrectionPrompt: compactPage.includes("ouvre la correction pour comparer"),
      correctionText: text,
      fullText,
    };
  }, 20_000);
  evidence.ui.correction_no_contradiction = result;
  mark("correction_best_move_no_problem", "pass", JSON.stringify({
    hasSuccess: result.hasSuccess,
    hasMove: result.hasMove,
    hasProblem: result.hasProblem,
    hasMissedBest: result.hasMissedBest,
    hasMissedOpportunity: result.hasMissedOpportunity,
    hasOpenCorrectionPrompt: result.hasOpenCorrectionPrompt,
  }));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  dbCounts("before_intercepted_legacy_payload");
  const interceptedReview = buildLegacyNxe4ReviewPayload(review);
  dbCounts("after_intercepted_legacy_payload");
  await openReviewWithInterceptedPayload(gameId, interceptedReview);
  await openCorrectionTab(gameId);
  await assertCorrectionHasNoContradiction();
  await captureQaScreenshot(
    "02_correction_tab_best_move_no_problem",
    "Correction tab after exact-best Nxe4",
    "Correction tab does not mark the played best move as a problem",
    ["no Ton coup - Probleme", "Nxe4 visible", "success feedback visible"],
  );
  await captureQaScreenshot(
    "03_no_missed_opportunity_for_best_move",
    "Correction tags after exact-best Nxe4",
    "Missed-opportunity tag is not shown for exact best/accepted correction display",
    ["no Opportunite manquee visible"],
  );
  await captureQaScreenshot(
    "04_success_feedback_in_correction_tab",
    "Correction success feedback",
    "The visible feedback is success/accepted rather than a missed-best reproach",
    ["Bien joue visible", "no Le meilleur coup etait"],
  );
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_CORRECTION_NO_CONTRADICTION_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      try {
        await captureQaScreenshot(
          "failure_review_correction_no_contradiction",
          "Failure screenshot",
          "Captured at smoke failure",
          ["failure diagnostics"],
        );
      } catch {
        await harness.captureScreenshot("browser_review_correction_no_contradiction_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_CORRECTION_NO_CONTRADICTION_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
