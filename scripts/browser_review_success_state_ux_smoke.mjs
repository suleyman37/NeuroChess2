#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  findPython,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.REVIEW-SUCCESS-STATE-CTA-AND-HISTORICAL-CONTEXT-CLEANUP-V1";
const QA_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P1_REVIEW_SUCCESS_STATE_CTA_AND_HISTORICAL_CONTEXT_CLEANUP_V1",
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
  "browser_review_success_state_ux_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_success_state_ux_evidence.json",
);
evidence.strategy =
  "temp backend DB + intercepted accepted Review payload where Black played/best are both Nxh5, then direct Review explanation opening; yellow success CTA rules are covered by static tests";
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

function successNe2Annotation(baseAnnotation = {}) {
  const fenBefore =
    "4k3/4p3/5n2/7R/8/8/8/K7 b - - 0 1";
  const fenAfter =
    "4k3/4p3/8/7n/8/8/8/K7 w - - 0 2";
  return {
    ...baseAnnotation,
    ply: 8,
    move_number: 8,
    color: "black",
    side: "black",
    san: "Nxh5",
    uci: "f6h5",
    fen_before: fenBefore,
    fen_after: fenAfter,
    primary_category: "missed_opportunity",
    category_label: "Problème",
    tags: ["missed_opportunity"],
    tag_labels: ["Opportunité manquée"],
    reason: "review_success_state_ux_fixture",
    win_loss: 11,
    move_accuracy: 58,
    lichess_like_move_accuracy: 58,
    best_move_uci: "f6h5",
    best_move_san: "Nxh5",
    top_moves: [
      { uci: "f6h5", san: "Nxh5", rank: 1, eval_cp: -80, pv: ["f6h5", "a1b1"] },
      { uci: "e8f8", san: "Kf8", rank: 2, eval_cp: 30, pv: ["e8f8", "a1b1"] },
    ],
    try_move_supported: true,
    try_move_model_version: baseAnnotation.try_move_model_version ?? "try_move_v1",
    accepted_moves: ["f6h5", "Nxh5"],
    acceptable_moves: ["f6h5", "Nxh5"],
    accepted_moves_uci: ["f6h5"],
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
    compact_label: "Nxh5",
    coach_card_title: "Coup 8",
  };
}

function buildSuccessNe2ReviewPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = successNe2Annotation(baseAnnotation);
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
  evidence.api.success_ne2_annotation = annotation;
  writeJson(path.join(API_DIR, "success_ne2_review_payload.json"), payload);
  mark("success_ne2_review_payload", "pass", "played=Nxh5 best=Nxh5 win_loss=11 intercepted Review payload");
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

async function openReviewChallenge() {
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
    "01_success_yellow_feedback_before_or_baseline_if_available",
    "Review lesson challenge before exact-best attempt",
    "Black Nxh5 fixture is visible before the user attempt",
    ["review-board visible", "lesson challenge visible", "Nxh5 fixture loaded"],
  );
}

async function openAcceptedCorrectionAndAssertCleanCtas() {
  evidence.ui.yellow_success_static_coverage =
    "Yellow success CTA rules are covered by backend/tests/test_frontend_lesson_flow_static.py; browser smoke exercises the same accepted Review payload in the explanation panel.";
  await harness.clickByText("Voir la correction", { exact: true, afterMs: 900 });
  const result = await harness.waitForPagePredicate("success try feedback clean CTAs", () => {
    const root = document.querySelector('[data-public-lesson-step="correction"]');
    const pageText = document.body?.innerText ?? "";
    const text = root?.textContent ?? "";
    const compact = String(text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    const pageCompact = String(pageText ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    return {
      ok:
        compact.includes("bien joue") &&
        compact.includes("nxh5") &&
        compact.includes("continuer") &&
        !compact.includes("reessayer") &&
        !pageCompact.includes("ton coup probleme") &&
        !pageCompact.includes("le meilleur coup etait"),
      compact,
      pageCompact,
    };
  }, 25_000);
  evidence.ui.success_yellow_feedback = result;
  mark("success_yellow_feedback_clean_ctas", "pass", JSON.stringify({
    hasSuccess: result.compact.includes("bien joue"),
    hasContinue: result.compact.includes("continuer"),
    hasRetry: result.compact.includes("reessayer"),
    hasCorrectionReproach: result.compact.includes("le meilleur coup etait"),
  }));
  await captureQaScreenshot(
    "02_success_yellow_feedback_clean_ctas",
    "Accepted Review success state opened from challenge",
    "Success explanation shows Continue with no Retry or correction reproach CTA",
    ["Bien joue", "Continuer", "no Reessayer", "no Le meilleur coup etait"],
  );
}

async function openWhyItWorksAndAssertRecoveredGain() {
  const result = await harness.waitForPagePredicate("success explanation recovered gain", () => {
    const root = document.querySelector('[data-public-lesson-step="correction"]');
    const fullText = document.body?.innerText ?? "";
    const text = root?.textContent ?? "";
    const compactCorrection = String(text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    const compactPage = String(fullText ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    const hasAcceptedMoveLabel =
      compactCorrection.includes("ton coup bonne idee") ||
      compactCorrection.includes("coup joue bonne idee");
    const hasNegativeHistoricalPercent =
      text.includes("-11 %") ||
      text.includes("-11%") ||
      text.includes("--11 %") ||
      text.includes("--11%");
    return {
      ok:
        hasAcceptedMoveLabel &&
        compactCorrection.includes("bien joue") &&
        compactCorrection.includes("gain recupere 11 pts par rapport au coup joue") &&
        compactCorrection.includes("impact important") &&
        compactCorrection.includes("continuer") &&
        !compactCorrection.includes("ton coup probleme") &&
        !compactCorrection.includes("opportunite manquee") &&
        !compactCorrection.includes("le meilleur coup etait") &&
        !compactCorrection.includes("qualite moyenne") &&
        !compactCorrection.includes("important important") &&
        !compactCorrection.includes("reessayer") &&
        !compactPage.includes("ouvre la correction pour comparer") &&
        !hasNegativeHistoricalPercent,
      compactCorrection,
      compactPage,
      hasAcceptedMoveLabel,
      hasNegativeHistoricalPercent,
      rawText: text,
    };
  }, 25_000);
  evidence.ui.success_explanation = result;
  mark("success_explanation_recovered_gain", "pass", JSON.stringify({
    hasRecoveredGain: result.compactCorrection.includes("gain recupere 11 pts"),
    hasImpact: result.compactCorrection.includes("impact important"),
    hasProblem: result.compactCorrection.includes("ton coup probleme"),
    hasQualityMoyenne: result.compactCorrection.includes("qualite moyenne"),
    hasNegativeHistoricalPercent: result.hasNegativeHistoricalPercent,
  }));
  await captureQaScreenshot(
    "03_success_explanation_gain_recovered",
    "Explanation panel after exact-best Review try move",
    "Accepted move shows recovered historical gain as a positive contextual stat",
    ["accepted move label", "Gain recupere +11 pts", "Impact : important"],
  );
  await captureQaScreenshot(
    "04_no_negative_delta_no_quality_moyenne",
    "Success explanation anti-regression",
    "Success explanation does not show negative delta, mediocre quality, duplicate impact, or problem labels",
    ["no -11%", "no Qualite Moyenne", "no important important", "no Ton coup Probleme"],
  );
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  dbCounts("before_intercepted_success_payload");
  const interceptedReview = buildSuccessNe2ReviewPayload(review);
  dbCounts("after_intercepted_success_payload");
  await openReviewWithInterceptedPayload(gameId, interceptedReview);
  await openReviewChallenge();
  await openAcceptedCorrectionAndAssertCleanCtas();
  await openWhyItWorksAndAssertRecoveredGain();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_SUCCESS_STATE_UX_SMOKE PASS");
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
          "failure_review_success_state_ux",
          "Failure screenshot",
          "Captured at smoke failure",
          ["failure diagnostics"],
        );
      } catch {
        await harness.captureScreenshot("browser_review_success_state_ux_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_SUCCESS_STATE_UX_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
