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

const MISSION = "P1.REVIEW-CORRECTION-IMPACT-SEMANTICS-PLAYER-POV-V1";
const QA_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P1_REVIEW_CORRECTION_IMPACT_SEMANTICS_PLAYER_POV_V1",
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
  "browser_review_correction_player_pov_impact_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_correction_player_pov_impact_evidence.json",
);
evidence.strategy =
  "temp backend DB + intercepted Review payload where Black played/best are both Nxe4 and historical win_loss=11 + Correction impact semantics assertions";
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
    reason: "player_pov_impact_semantics_fixture",
    win_loss: 11,
    move_accuracy: 58,
    lichess_like_move_accuracy: 58,
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
    impact_label: "important",
    move_quality_label: "Moyenne",
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
    "Review lesson challenge for Black Nxe4 impact fixture",
    "Fixture has Black to move, played/best Nxe4, and a historical win_loss of 11 points",
    ["Nxe4 visible", "lesson challenge visible", "historical impact fixture loaded"],
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

async function assertCorrectionHasSafeImpactSemantics() {
  const result = await harness.waitForPagePredicate("correction player-POV impact semantics", () => {
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
    const hasNegativeHistoricalPercent =
      text.includes("-11 %") ||
      text.includes("-11%") ||
      text.includes("--11 %") ||
      text.includes("--11%");
    const hasDuplicateImportant = compactCorrection.includes("important important");
    const hasMediocreQuality = compactCorrection.includes("qualite moyenne");
    const hasHistoricalContext = compactCorrection.includes("dans la partie cette idee avait ete manquee");
    const hasRecoveredGain = compactCorrection.includes("gain recupere 11 pts par rapport au coup joue");
    const hasSafeImpact = compactCorrection.includes("impact important");
    return {
      ok:
        compactCorrection.includes("bien joue") &&
        compactCorrection.includes("nxe4") &&
        hasHistoricalContext &&
        hasRecoveredGain &&
        hasSafeImpact &&
        !compactCorrection.includes("ton coup probleme") &&
        !compactCorrection.includes("le meilleur coup etait") &&
        !compactPage.includes("opportunite manquee") &&
        !compactPage.includes("ouvre la correction pour comparer") &&
        !hasNegativeHistoricalPercent &&
        !hasDuplicateImportant &&
        !hasMediocreQuality,
      hasSuccess: compactCorrection.includes("bien joue"),
      hasMove: compactCorrection.includes("nxe4"),
      hasHistoricalContext,
      hasRecoveredGain,
      hasSafeImpact,
      hasProblem: compactCorrection.includes("ton coup probleme"),
      hasMissedBest: compactCorrection.includes("le meilleur coup etait"),
      hasMissedOpportunity: compactPage.includes("opportunite manquee"),
      hasOpenCorrectionPrompt: compactPage.includes("ouvre la correction pour comparer"),
      hasNegativeHistoricalPercent,
      hasDuplicateImportant,
      hasMediocreQuality,
      correctionText: text,
      fullText,
    };
  }, 20_000);
  evidence.ui.correction_player_pov_impact = result;
  mark("correction_player_pov_impact_safe", "pass", JSON.stringify({
    hasSuccess: result.hasSuccess,
    hasMove: result.hasMove,
    hasHistoricalContext: result.hasHistoricalContext,
    hasRecoveredGain: result.hasRecoveredGain,
    hasSafeImpact: result.hasSafeImpact,
    hasProblem: result.hasProblem,
    hasMissedBest: result.hasMissedBest,
    hasMissedOpportunity: result.hasMissedOpportunity,
    hasOpenCorrectionPrompt: result.hasOpenCorrectionPrompt,
    hasNegativeHistoricalPercent: result.hasNegativeHistoricalPercent,
    hasDuplicateImportant: result.hasDuplicateImportant,
    hasMediocreQuality: result.hasMediocreQuality,
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
  await assertCorrectionHasSafeImpactSemantics();
  await captureQaScreenshot(
    "02_success_state_no_negative_delta",
    "Correction tab after exact-best Nxe4",
    "Accepted Black move does not show -11% as the current attempt impact",
    ["no -11 %", "no Ton coup - Probleme", "Nxe4 visible", "success feedback visible"],
  );
  await captureQaScreenshot(
    "03_success_state_clear_impact_copy",
    "Correction impact copy after exact-best Nxe4",
    "Impact is framed as recovered historical gain rather than current failed quality",
    ["Gain recupere visible", "Impact : important visible", "no Qualite : Moyenne"],
  );
  await captureQaScreenshot(
    "04_success_feedback_in_correction_tab",
    "Correction success feedback",
    "The visible feedback is success/accepted and the impact block is player-POV-safe",
    ["Bien joue visible", "no Le meilleur coup etait", "no important important"],
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
  console.log("BROWSER_REVIEW_CORRECTION_PLAYER_POV_IMPACT_SMOKE PASS");
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
          "failure_review_correction_player_pov_impact",
          "Failure screenshot",
          "Captured at smoke failure",
          ["failure diagnostics"],
        );
      } catch {
        await harness.captureScreenshot("browser_review_correction_player_pov_impact_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_CORRECTION_PLAYER_POV_IMPACT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
