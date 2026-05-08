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

const MISSION = "P1.REVIEW-ATTEMPT-SPECIFIC-FEEDBACK-AND-LINE-ACTION-V1";
const QA_DIR = path.join(
  PROJECT_ROOT,
  "qa_artifacts",
  "P1_REVIEW_ATTEMPT_SPECIFIC_FEEDBACK_AND_LINE_ACTION_V1",
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
  "browser_review_attempt_specific_feedback_and_line_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_attempt_specific_feedback_and_line_evidence.json",
);
evidence.strategy =
  "temp backend DB + intercepted Review payload with stale historical exd5 commentary + real Review try-move clicks for Na6/Nc6";
evidence.screenshots = [];

const ATTEMPT_SPECIFIC_FEN_BEFORE =
  "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";

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

function attemptSpecificAnnotation(baseAnnotation = {}) {
  const fenBefore = ATTEMPT_SPECIFIC_FEN_BEFORE;
  const historicalFenAfter =
    "r1bqkbnr/pppnpppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 3";
  const playedLine = [
    { uci: "b8d7", san: "Nd7" },
    { uci: "e4d5", san: "exd5" },
  ];
  const solutionLine = [
    { uci: "b8c6", san: "Nc6" },
    { uci: "g1f3", san: "Nf3" },
  ];
  return {
    ...baseAnnotation,
    ply: 8,
    move_number: 8,
    color: "black",
    side: "black",
    san: "Nd7",
    uci: "b8d7",
    fen_before: fenBefore,
    fen_after: historicalFenAfter,
    primary_category: "missed_opportunity",
    category_label: "Problème",
    tags: ["missed_opportunity"],
    tag_labels: ["Opportunité manquée"],
    reason: "attempt_specific_feedback_fixture",
    win_loss: 11,
    move_accuracy: 58,
    lichess_like_move_accuracy: 58,
    best_move_uci: "b8c6",
    best_move_san: "Nc6",
    top_moves: [
      { uci: "b8c6", san: "Nc6", rank: 1, eval_cp: -80, pv: solutionLine },
      { uci: "b8a6", san: "Na6", rank: 2, eval_cp: 30, pv: [{ uci: "b8a6", san: "Na6" }] },
      { uci: "b8d7", san: "Nd7", rank: 3, eval_cp: 50, pv: playedLine },
    ],
    try_move_supported: true,
    try_move_model_version: "try_move_v1",
    acceptable_moves: [{ uci: "b8c6", san: "Nc6", quality: "best" }],
    accepted_moves: [{ uci: "b8c6", san: "Nc6", quality: "best" }],
    accepted_moves_uci: ["b8c6"],
    pv_line: solutionLine,
    pv_line_available: true,
    pv_line_message: "Ligne proposée par le moteur.",
    pv_contrast_evidence: {
      available: true,
      played_branch: {
        pv: playedLine,
        opponent_best_reply_san: "exd5",
        opponent_best_reply_uci: "e4d5",
      },
      best_branch: {
        pv: solutionLine,
      },
    },
    pedagogical_explanation: {
      ...(baseAnnotation.pedagogical_explanation ?? {}),
      available: true,
      error_type: "tactical",
      why_played_move_bad:
        "Dans la partie, le coup joué avait permis exd5.",
      why_best_move_good:
        "La solution développe une pièce et répond à l'idée clé.",
      training_takeaway: "Distinguer la tentative actuelle du coup joué dans la partie.",
    },
    contrast_coach_explanation: {
      ...(baseAnnotation.contrast_coach_explanation ?? {}),
      available: true,
      what_happened_after_played:
        "Après le coup joué, l'adversaire peut répondre activement par exd5.",
      why_solution_is_better:
        "La solution limite mieux les réponses adverses.",
      played_line_preview: "Nd7 exd5",
      best_line_preview: "Nc6 Nf3",
      main_difference_type: "initiative",
      main_difference: "La solution garde plus d'initiative.",
    },
    impact_label: "important",
    move_quality_label: "Moyenne",
    compact_label: "Nc6",
    coach_card_title: "Coup 8",
  };
}

function buildAttemptSpecificReviewPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = attemptSpecificAnnotation(baseAnnotation);
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
  evidence.api.attempt_specific_annotation = annotation;
  writeJson(path.join(API_DIR, "attempt_specific_review_payload.json"), payload);
  mark(
    "attempt_specific_review_payload",
    "pass",
    "historical played=Nd7 stale reply=exd5; best=Nc6; wrong current attempt=Na6",
  );
  return payload;
}

function buildAcceptedReviewPayload(reviewPayload) {
  const solutionLine = [
    { uci: "b8c6", san: "Nc6" },
    { uci: "g1f3", san: "Nf3" },
  ];
  const annotation = {
    ...reviewPayload.move_annotations[0],
    san: "Nc6",
    uci: "b8c6",
    fen_after:
      "r1bqkbnr/ppp1pppp/2n5/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 3",
    reason: "attempt_specific_feedback_accepted_simulation",
    pv_line: solutionLine,
    pv_contrast_evidence: {
      ...reviewPayload.move_annotations[0].pv_contrast_evidence,
      played_branch: {
        pv: solutionLine,
      },
      best_branch: {
        pv: solutionLine,
      },
    },
    contrast_coach_explanation: {
      ...reviewPayload.move_annotations[0].contrast_coach_explanation,
      what_happened_after_played:
        "Dans la partie, le coup joué correspondait à l'idée clé.",
      played_line_preview: "Nc6 Nf3",
      best_line_preview: "Nc6 Nf3",
    },
  };
  const payload = {
    ...reviewPayload,
    move_annotations: [annotation],
    review_sections: {
      to_review: [annotation],
      strong_moves: [],
      missed_opportunities: [annotation],
      all: [annotation],
    },
  };
  evidence.api.accepted_review_payload = payload;
  writeJson(path.join(API_DIR, "accepted_review_payload.json"), payload);
  mark("accepted_review_payload", "pass", "simulated best/accepted Review display with played=Nc6 best=Nc6");
  return payload;
}

async function installReviewPayloadIntercept(gameId, reviewPayload) {
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
}

async function openReviewWithInterceptedPayload(gameId, reviewPayload) {
  await harness.startBrowser("/app");
  await installReviewPayloadIntercept(gameId, reviewPayload);
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
    url: `${harness.frontendBaseUrl}/app?reviewAttemptSpecific=${Date.now()}`,
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

async function replaceReviewPayloadAndReload(gameId, reviewPayload) {
  await installReviewPayloadIntercept(gameId, reviewPayload);
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?reviewAttemptSpecific=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review board restored with replaced payload", () => {
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

async function openLessonChallenge() {
  await harness.waitForPagePredicate("review board visible", () => {
    return { ok: Boolean(document.querySelector('[data-testid="review-board"]')) };
  }, 30_000);
  await harness.clickByTestId("review-focus-learn", { afterMs: 700 });
  try {
    await harness.waitForPagePredicate("lesson challenge visible after focus click", () => {
      return {
        ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
        text: document.body?.innerText ?? "",
      };
    }, 5_000);
    return;
  } catch {
    await harness.evalPage(() => {
      const firstMomentButton = document.querySelector('[data-testid="review-moment-card"] button');
      if (firstMomentButton instanceof HTMLElement) {
        firstMomentButton.click();
        return { ok: true, source: "summary_moment_card" };
      }
      const visibleReviewButtons = [...document.querySelectorAll("button")].filter((button) =>
        (button.textContent ?? "").trim() === "Voir",
      );
      const fallback = visibleReviewButtons[0];
      if (fallback instanceof HTMLElement) {
        fallback.click();
        return { ok: true, source: "visible_voir_button" };
      }
      return { ok: false, source: "none" };
    });
  }
  await harness.waitForPagePredicate("lesson challenge visible", () => {
    return {
      ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
      text: document.body?.innerText ?? "",
    };
  }, 30_000);
}

async function playWrongAttemptAndAssertNoStaleComment() {
  await harness.clickByText("Essayer", { exact: true, afterMs: 700 });
  await harness.tryMoveByClickClick("b8a6", "review-board");
  const result = await harness.waitForPagePredicate("wrong attempt no stale historical comment", () => {
    const root = document.querySelector('[data-public-lesson-step="correction"]');
    const text = root?.textContent ?? "";
    const pageText = document.body?.innerText ?? "";
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
        compact.includes("na6") &&
        compact.includes("pas encore ce coup ne repond pas a l idee cle de la position") &&
        compact.includes("le meilleur coup etait nc6") &&
        !compact.includes("exd5") &&
        !compact.includes("apres le coup joue") &&
        !compact.includes("qualite moyenne") &&
        !pageCompact.includes("voir la ligne"),
      compact,
      pageCompact,
      rawText: text,
    };
  }, 30_000);
  evidence.ui.wrong_attempt = result;
  mark("wrong_attempt_no_stale_historical_comment", "pass", JSON.stringify({
    hasNa6: result.compact.includes("na6"),
    hasGenericWrong: result.compact.includes("pas encore ce coup ne repond pas"),
    hasStaleExd5: result.compact.includes("exd5"),
    hasLineAction: result.pageCompact.includes("voir la ligne"),
  }));
  await captureQaScreenshot(
    "01_wrong_attempt_no_stale_historical_comment",
    "Review try-move wrong attempt Na6",
    "Correction panel shows the current attempt and generic attempt-safe feedback, not the stale historical exd5 reply",
    ["Na6 visible", "generic wrong feedback visible", "no exd5", "no Voir la ligne"],
  );
}

async function simulateBestAttemptAndAssertClean() {
  await openLessonChallenge();
  await harness.clickByText("Essayer", { exact: true, afterMs: 300 });
  await harness.waitForPagePredicate("best attempt board ready", (expectedFen) => {
    const board = document.querySelector('[data-testid="review-board"]');
    const fen = board?.getAttribute("data-board-fen") ?? "";
    const disabled = board?.getAttribute("aria-disabled");
    const challengeText = document.querySelector('[data-public-lesson-step="challenge"]')?.textContent ?? "";
    return {
      ok: Boolean(board) && disabled !== "true" && fen === expectedFen,
      fen,
      disabled,
      orientation: board?.getAttribute("data-board-orientation"),
      challengeText,
    };
  }, 10_000, ATTEMPT_SPECIFIC_FEN_BEFORE);
  await harness.tryMoveByClickClick("b8c6", "review-board");
  const result = await harness.waitForPagePredicate("best attempt success clean", () => {
    const root =
      document.querySelector('[data-public-lesson-step="challenge"]') ??
      document.querySelector('[data-public-lesson-step="correction"]');
    const qualityBadge = root?.querySelector('[data-testid="review-attempt-quality-badge"]');
    const text = root?.textContent ?? "";
    const compact = String(text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    return {
      ok:
        qualityBadge?.getAttribute("data-quality-id") === "critical_best" &&
        compact.includes("bien joue") &&
        compact.includes("nc6") &&
        (compact.includes("ton coup nc6") || compact.includes("coup joue nc6")) &&
        compact.includes("tentative reussie") &&
        !compact.includes("coup joue probleme") &&
        !compact.includes("le meilleur coup etait") &&
        !compact.includes("exd5") &&
        !compact.includes("qualite moyenne"),
      qualityId: qualityBadge?.getAttribute("data-quality-id"),
      compact,
      rawText: text,
    };
  }, 30_000);
  evidence.ui.best_attempt = result;
  mark("best_attempt_success_clean", "pass", JSON.stringify({
    hasSuccess: result.compact.includes("bien joue"),
    hasNc6: result.compact.includes("nc6"),
    qualityId: result.qualityId,
    hasProblem: result.compact.includes("coup joue probleme"),
    hasStaleExd5: result.compact.includes("exd5"),
  }));
  await captureQaScreenshot(
    "02_best_attempt_success_clean",
    "Review real try-move Nc6",
    "Success correction state shows the current attempt without stale historical commentary",
    ["critical_best badge", "Bien joue", "Nc6", "no Coup joue Probleme", "no exd5"],
  );
  await captureQaScreenshot(
    "04_success_current_attempt_not_historical",
    "Review success current attempt scope",
    "Current-attempt success is separate from historical move diagnostics",
    ["Tentative reussie", "review-attempt-quality-badge", "no Qualite Moyenne"],
  );
}

async function clickLineAndAssertVisiblePanel() {
  await harness.clickByText("Voir la ligne", { exact: true, afterMs: 800 });
  const result = await harness.waitForPagePredicate("line action visible panel", () => {
    const root = document.querySelector('[data-public-lesson-step="correction"]');
    const details = root?.querySelector(".review-line-comparison-disclosure");
    const text = root?.textContent ?? "";
    const compact = String(text ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ");
    return {
      ok:
        Boolean(details?.open) &&
        compact.includes("comparer les lignes") &&
        compact.includes("dans la partie") &&
        compact.includes("coup joue dans la partie nc6") &&
        compact.includes("ligne de la solution nc6 nf3") &&
        !compact.includes("exd5"),
      detailsOpen: Boolean(details?.open),
      compact,
      rawText: text,
    };
  }, 20_000);
  evidence.ui.line_action = result;
  mark("line_action_visible_state_change", "pass", JSON.stringify({
    detailsOpen: result.detailsOpen,
    hasLinePanel: result.compact.includes("comparer les lignes"),
    hasHistoricalLabel: result.compact.includes("dans la partie"),
  }));
  await captureQaScreenshot(
    "03_line_action_visible_state_change",
    "Review line action after success",
    "Voir la ligne opens an already-expanded line comparison panel with historical context labelled",
    ["details open", "Comparer les lignes", "Dans la partie", "Ligne de la solution"],
  );
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId, review } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  dbCounts("before_intercepted_payload");
  const interceptedReview = buildAttemptSpecificReviewPayload(review);
  dbCounts("after_intercepted_payload");
  await openReviewWithInterceptedPayload(gameId, interceptedReview);
  await openLessonChallenge();
  await playWrongAttemptAndAssertNoStaleComment();
  dbCounts("after_wrong_try_move_evaluation");
  const acceptedReview = buildAcceptedReviewPayload(interceptedReview);
  await replaceReviewPayloadAndReload(gameId, acceptedReview);
  await simulateBestAttemptAndAssertClean();
  dbCounts("after_best_simulation");
  await clickLineAndAssertVisiblePanel();
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_ATTEMPT_SPECIFIC_FEEDBACK_AND_LINE_SMOKE PASS");
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
          "failure_review_attempt_specific_feedback_and_line",
          "Failure screenshot",
          "Captured at smoke failure",
          ["failure diagnostics"],
        );
      } catch {
        await harness.captureScreenshot("browser_review_attempt_specific_feedback_and_line_failure");
      }
    }
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_ATTEMPT_SPECIFIC_FEEDBACK_AND_LINE_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
