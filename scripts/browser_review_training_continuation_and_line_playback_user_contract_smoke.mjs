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
  openReviewFromPersistedState,
  prepareReviewFixture,
} from "./browser_test_helpers.mjs";

const MISSION =
  "P1.REVIEW-TRAINING-CONTINUATION-AND-LINE-PLAYBACK-USER-CONTRACT-V1";
const MISSION_ID =
  "P1_REVIEW_TRAINING_CONTINUATION_AND_LINE_PLAYBACK_USER_CONTRACT_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_RAW_DIR = path.join(QA_DIR, "screenshots_raw");
const BROWSER_EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");
const API_DIR = path.join(QA_DIR, "api_snapshots");
const DB_DIR = path.join(QA_DIR, "db_snapshots");
const CONSOLE_DIR = path.join(QA_DIR, "console_logs");
const NETWORK_DIR = path.join(QA_DIR, "network_logs");
for (const dir of [
  QA_DIR,
  SCREENSHOT_RAW_DIR,
  BROWSER_EVIDENCE_DIR,
  API_DIR,
  DB_DIR,
  CONSOLE_DIR,
  NETWORK_DIR,
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(
  MISSION,
  "browser_review_training_continuation_and_line_playback_user_contract_evidence.json",
);
evidence.output_path = path.join(
  BROWSER_EVIDENCE_DIR,
  "browser_review_training_continuation_and_line_playback_user_contract_evidence.json",
);
evidence.strategy =
  "temp backend DB + two seeded Review Practice items + real board attempts + Review/Lesson intercepted line-comparison payload";
evidence.screenshots = [];
evidence.contract_checks = {};

const manifest = {
  mission: MISSION,
  generated_at: new Date().toISOString(),
  artifacts: [],
  screenshots: [],
};
const screenshotTimeline = [];
let screenshotIndex = 0;

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

function safeFileToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 88)
    .toUpperCase();
}

function localIso(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function localStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function pageMeta() {
  return harness.evalPage(() => ({
    url: window.location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scroll_y: Math.round(window.scrollY),
    focused_element:
      document.activeElement?.getAttribute("data-testid") ||
      document.activeElement?.textContent?.trim().slice(0, 80) ||
      null,
  }));
}

async function captureContractScreenshot({
  scenario,
  state,
  action,
  expected,
  observed,
  pass,
  primaryTestId,
  dbCheck = null,
  notes = "",
}) {
  screenshotIndex += 1;
  const now = new Date();
  const resultLabel = pass ? "PASS" : "FAIL";
  const filename = `${localStamp(now)}_LOCAL__${String(screenshotIndex).padStart(
    2,
    "0",
  )}__${safeFileToken(scenario)}__${safeFileToken(state)}__${safeFileToken(
    action,
  )}__EXPECT_${safeFileToken(expected)}__${resultLabel}.png`;
  const screenshotPath = path.join(SCREENSHOT_RAW_DIR, filename);
  const shot = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  const meta = await pageMeta();
  const entry = {
    mission_id: MISSION_ID,
    created_at_local: localIso(now),
    created_at_utc: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local",
    branch: "road-to-V2",
    commit: evidence.api.head_commit ?? null,
    screenshot_index: screenshotIndex,
    scenario,
    state,
    action_just_performed: action,
    expected_user_contract: expected,
    observed_result: observed,
    pass,
    route_or_url: meta.url,
    viewport: meta.viewport,
    scroll_y: meta.scroll_y,
    focused_element: meta.focused_element,
    primary_data_testid_checked: primaryTestId,
    related_bug: "manual QA found blocked Review Training continuation and dead internal line buttons",
    previous_screenshot: screenshotTimeline.at(-1)?.path ? path.basename(screenshotTimeline.at(-1).path) : null,
    next_screenshot: null,
    console_errors_count: evidence.browser_errors.console.length + evidence.browser_errors.page.length,
    network_500_count: evidence.browser_errors.network_500.length,
    db_check: dbCheck,
    notes,
    path: screenshotPath,
    type: "screenshot",
  };
  if (screenshotTimeline.length) {
    screenshotTimeline[screenshotTimeline.length - 1].next_screenshot = filename;
  }
  screenshotTimeline.push(entry);
  writeJson(screenshotPath.replace(/\.png$/i, ".json"), entry);
  manifest.screenshots = screenshotTimeline;
  manifest.artifacts.push({
    id: `screenshot_${String(screenshotIndex).padStart(2, "0")}`,
    path: screenshotPath,
    type: "screenshot",
    related_golden_flow: "GF-004/GF-005b",
    expected_observation: expected,
    assertions_checked: [primaryTestId, observed].filter(Boolean),
    pass,
  });
  evidence.screenshots = screenshotTimeline;
  writeScreenshotIndex();
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  harness.writeEvidence();
  return screenshotPath;
}

function writeScreenshotIndex() {
  const lines = [
    "# Screenshots Index",
    "",
    "| # | Local time | File | Scenario | Action | Expected | Observed | PASS/FAIL |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const shot of screenshotTimeline) {
    lines.push(
      `| ${shot.screenshot_index} | ${shot.created_at_local} | \`${path.basename(
        shot.path,
      )}\` | ${shot.scenario} | ${shot.action_just_performed} | ${shot.expected_user_contract} | ${shot.observed_result} | ${
        shot.pass ? "PASS" : "FAIL"
      } |`,
    );
  }
  writeFileSync(path.join(QA_DIR, "screenshots_index.md"), `${lines.join("\n")}\n`, "utf8");
  writeJson(path.join(QA_DIR, "screenshots_timeline.json"), screenshotTimeline);
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
    "review_practice_sessions",
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

function seedTwoEligibleMoments(gameId) {
  const dbPath = path.join(harness.evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
rows = [
    {
        "ply": 1,
        "played_by": "white",
        "side": "white",
        "fen_before": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "fen_after": "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
        "played_uci": "d2d4",
        "played_san": "d4",
        "best_uci": "e2e4",
        "best_san": "e4",
        "eval_before": 85,
        "eval_after": -120,
        "top_moves": [
            {"uci": "e2e4", "san": "e4", "rank": 1, "eval_cp": 85, "pv": [{"uci": "e2e4", "san": "e4"}, {"uci": "e7e5", "san": "e5"}]},
            {"uci": "d2d4", "san": "d4", "rank": 2, "eval_cp": -120, "pv": [{"uci": "d2d4", "san": "d4"}, {"uci": "d7d5", "san": "d5"}]},
        ],
    },
    {
        "ply": 2,
        "played_by": "black",
        "side": "black",
        "fen_before": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        "fen_after": "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        "played_uci": "e7e6",
        "played_san": "e6",
        "best_uci": "e7e5",
        "best_san": "e5",
        "eval_before": -80,
        "eval_after": 95,
        "top_moves": [
            {"uci": "e7e5", "san": "e5", "rank": 1, "eval_cp": -80, "pv": [{"uci": "e7e5", "san": "e5"}, {"uci": "g1f3", "san": "Nf3"}]},
            {"uci": "e7e6", "san": "e6", "rank": 2, "eval_cp": 95, "pv": [{"uci": "e7e6", "san": "e6"}, {"uci": "d2d4", "san": "d4"}]},
        ],
    },
]
with sqlite3.connect(db_path) as connection:
    connection.row_factory = sqlite3.Row
    review = connection.execute(
        "SELECT id FROM game_reviews WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        (game_id,),
    ).fetchone()
    if review is None:
        raise SystemExit("missing game_review")
    review_id = int(review["id"])
    connection.execute("DELETE FROM review_moments WHERE game_id = ?", (game_id,))
    connection.execute("DELETE FROM training_items WHERE source_game_id = ?", (game_id,))
    connection.execute("DELETE FROM daily_plan_items")
    for row in rows:
        connection.execute(
            """
            INSERT INTO review_moments (
                review_id, game_id, move_id, ply, played_by, side_to_move_before,
                fen_before, fen_after, played_uci, played_san, best_move_uci,
                best_move_san, eval_before_cp, eval_after_cp, mate_before,
                mate_after, cp_loss, cp_loss_label, importance_score,
                reliability_score, reliability_label, top_moves_json, review_type,
                created_at
            )
            VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL,
                    205, 'large', 99.0, 1.0, 'stable', ?, 'player_loss',
                    datetime('now'))
            """,
            (
                review_id,
                game_id,
                row["ply"],
                row["played_by"],
                row["side"],
                row["fen_before"],
                row["fen_after"],
                row["played_uci"],
                row["played_san"],
                row["best_uci"],
                row["best_san"],
                row["eval_before"],
                row["eval_after"],
                json.dumps(row["top_moves"], ensure_ascii=False),
            ),
        )
    connection.commit()
print(json.dumps({"seeded": len(rows), "game_id": game_id, "review_id": review_id}))
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: harness.evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("seed_two_review_practice_items", `${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout);
  evidence.api.seed_two_review_practice_items = payload;
  writeJson(path.join(API_DIR, "seed_two_review_practice_items.json"), payload);
  mark("seed_two_review_practice_items", "pass", JSON.stringify(payload));
}

async function latestSessionForGame(gameId) {
  const payload = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const latest = sessions[0] ?? null;
  if (!latest?.session_id) {
    fail("latest_practice_session", JSON.stringify(payload));
  }
  return fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${latest.session_id}`);
}

async function openPracticeFromReview(gameId) {
  await harness.waitForPagePredicate("review practice entry ready", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(document.querySelector('[data-testid="review-practice-button"]')) ||
        Boolean(document.querySelector('[data-testid="review-focus-practice"]')) ||
        text.includes("S'entraîner"),
      text,
    };
  }, 30_000);
  try {
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  } catch {
    await harness.clickByTestId("review-focus-practice", { afterMs: 700 });
    await harness.clickByTestId("review-practice-button", { afterMs: 1000 });
  }
  await harness.waitForPagePredicate("practice panel visible", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
      Boolean(document.querySelector('[data-testid="practice-board"]')) &&
      Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  const session = await latestSessionForGame(gameId);
  if (!Array.isArray(session.items) || session.items.length < 1) {
    fail("practice_items_available", JSON.stringify(session));
  }
  evidence.api.practice_session_id = session.session_id;
  evidence.api.practice_item_count = session.items.length;
  writeJson(path.join(API_DIR, "practice_session_initial.json"), session);
  mark("review_practice_opened", "pass", `session_id=${session.session_id}; items=${session.items.length}`);
  return session;
}

async function submitPracticeMoveWithFallback(uci) {
  await harness.tryMoveByClickClick(uci, "practice-board");
  try {
    await harness.waitForPagePredicate("practice feedback visible after click-click", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="practice-feedback"]')) ||
        Boolean(document.querySelector('[data-testid="review-training-feedback"]')),
    }), 5_000);
  } catch {
    await harness.tryMoveByDragDrop(uci, "practice-board");
  }
}

async function assertSuccessNextCtaAndAdvance(gameId, session) {
  const first = session.items[0];
  const countsBefore = dbCounts("before_first_success_attempt");
  const beforeState = await harness.evalPage(() => ({
    label: document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "",
    feedback: document.querySelector('[data-testid="review-training-feedback"]')?.textContent?.trim() ?? null,
  }));
  evidence.contract_checks.before_first_success = beforeState;
  await submitPracticeMoveWithFallback(first.best_move_uci);
  const success = await harness.waitForPagePredicate("success continuation CTA visible", () => {
    const panel = document.querySelector('[data-testid="practice-panel"]');
    const text = panel?.textContent ?? "";
    const hasNext = Boolean(document.querySelector('[data-testid="review-training-next-button"]'));
    const hasFinish = Boolean(document.querySelector('[data-testid="review-training-finish-button"]'));
    return {
      ok:
        Boolean(panel) &&
        (hasNext || hasFinish) &&
        Boolean(document.querySelector('[data-testid="review-training-feedback"]')) &&
        !text.includes("Voir la correction"),
      hasNext,
      hasFinish,
      positionLabel:
        document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "",
      text,
    };
  }, 25_000);
  evidence.contract_checks.success_continuation_cta_visible = success;
  const countsAfterAttempt = dbCounts("after_first_success_attempt");
  if (!success.hasNext && success.hasFinish) {
    await captureContractScreenshot({
      scenario: "REVIEW_TRAINING_FINISH_ACTION",
      state: `AFTER_SUCCESS_MOVE_${first.best_move_san ?? first.best_move_uci}`,
      action: `played ${first.best_move_uci}`,
      expected: "finish session CTA visible when only one priority item remains",
      observed: "Terminer la session visible near success feedback",
      pass: true,
      primaryTestId: "review-training-finish-button",
      dbCheck: `attempts ${countsBefore.review_practice_attempts}->${countsAfterAttempt.review_practice_attempts}`,
    });
    await harness.clickByTestId("review-training-finish-button", { afterMs: 1200 });
    const complete = await harness.waitForPagePredicate("training complete state visible after single item", () => ({
      ok: Boolean(document.querySelector('[data-testid="review-training-complete-state"]')),
      text: document.body?.innerText ?? "",
    }), 20_000);
    evidence.contract_checks.training_complete_state = complete;
    await captureContractScreenshot({
      scenario: "REVIEW_TRAINING_FINISH_ACTION",
      state: "AFTER_CLICK_TERMINER_SESSION_SINGLE_ITEM",
      action: "clicked Terminer la session",
      expected: "session complete state visible",
      observed: "Session terminÃ©e panel visible",
      pass: true,
      primaryTestId: "review-training-complete-state",
    });
    return { countsAfterNext: dbCounts("after_finish_single_item"), completed: true };
  }
  await captureContractScreenshot({
    scenario: "REVIEW_TRAINING_NEXT_ACTION",
    state: `AFTER_SUCCESS_MOVE_${first.best_move_san ?? first.best_move_uci}`,
    action: `played ${first.best_move_uci}`,
    expected: "next position CTA visible in Review Training panel",
    observed: "Position suivante visible near success feedback",
    pass: true,
    primaryTestId: "review-training-next-button",
    dbCheck: `attempts ${countsBefore.review_practice_attempts}->${countsAfterAttempt.review_practice_attempts}`,
  });
  await harness.clickByTestId("review-training-next-button", { afterMs: 900 });
  const firstMoveLabel = first.best_move_san ?? first.best_move_uci;
  const afterNext = await harness.waitForPagePredicate("next item state reset", (previousMoveLabel) => {
    const positionLabel =
      document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "";
    const feedback = document.querySelector('[data-testid="review-training-feedback"]');
    const userMove = document.querySelector('[data-testid="review-training-user-move"]');
    const result = document.querySelector('[data-testid="practice-result"]');
    const text = document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "";
    return {
      ok:
        /Position\s+2\s*\/\s*\d+/.test(positionLabel) &&
        !feedback &&
        !userMove &&
        !result &&
        !text.includes(previousMoveLabel),
      positionLabel,
      hasFeedback: Boolean(feedback),
      hasUserMove: Boolean(userMove),
      hasResult: Boolean(result),
      text,
    };
  }, 20_000, firstMoveLabel);
  evidence.contract_checks.after_next_item_reset = afterNext;
  const countsAfterNext = dbCounts("after_click_next_no_duplicate_attempt");
  if (countsAfterNext.review_practice_attempts !== countsAfterAttempt.review_practice_attempts) {
    fail(
      "next_click_created_duplicate_attempt",
      JSON.stringify({ countsAfterAttempt, countsAfterNext }),
    );
  }
  await captureContractScreenshot({
    scenario: "REVIEW_TRAINING_NEXT_ACTION",
    state: "AFTER_CLICK_POSITION_SUIVANTE",
    action: "clicked Position suivante",
    expected: "position label advances and feedback resets",
    observed: afterNext.positionLabel,
    pass: true,
    primaryTestId: "review-training-position-label",
    dbCheck: `attempts unchanged at ${countsAfterNext.review_practice_attempts}`,
  });
  return { countsAfterNext, completed: false };
}

async function assertFinishAtEnd(gameId) {
  const detail = await latestSessionForGame(gameId);
  const items = Array.isArray(detail.items) ? detail.items : [];
  if (items.length < 2) {
    fail("practice_items_for_finish_flow", JSON.stringify(detail));
  }
  for (let index = 1; index < items.length; index += 1) {
    const item = items[index];
    await harness.waitForPagePredicate("expected practice item visible before finish loop attempt", (expectedIndex) => {
      const positionLabel =
        document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "";
      return {
        ok: positionLabel.includes(`Position ${expectedIndex + 1} /`),
        positionLabel,
      };
    }, 20_000, index);
    await harness.evalPage(() => {
      document.querySelector('[data-testid="practice-board"]')?.scrollIntoView({
        block: "center",
        inline: "center",
      });
      return { ok: true };
    });
    await submitPracticeMoveWithFallback(item.best_move_uci);
    const isLast = index === items.length - 1;
    await harness.waitForPagePredicate("success continuation CTA visible in finish loop", (last) => {
      const panel = document.querySelector('[data-testid="practice-panel"]');
      const target = last
        ? document.querySelector('[data-testid="review-training-finish-button"]')
        : document.querySelector('[data-testid="review-training-next-button"]');
      return {
        ok: Boolean(panel) && Boolean(target),
        text: panel?.textContent ?? "",
      };
    }, 25_000, isLast);
    if (!isLast) {
      await harness.clickByTestId("review-training-next-button", { afterMs: 700 });
      await harness.waitForPagePredicate("finish loop next reset", (nextIndex) => {
        const positionLabel =
          document.querySelector('[data-testid="review-training-position-label"]')?.textContent?.trim() ?? "";
        return {
          ok:
            positionLabel.includes(`Position ${nextIndex + 2} /`) &&
            !document.querySelector('[data-testid="review-training-feedback"]'),
          positionLabel,
        };
      }, 20_000, index);
      continue;
    }
  }
  const last = items[items.length - 1];
  const finishVisible = {
    ok: true,
    text: await harness.evalPage(() =>
      document.querySelector('[data-testid="practice-panel"]')?.textContent ?? "",
    ),
  };
  evidence.contract_checks.finish_cta_visible = finishVisible;
  await captureContractScreenshot({
    scenario: "REVIEW_TRAINING_FINISH_ACTION",
    state: `AFTER_LAST_SUCCESS_MOVE_${last.best_move_san ?? last.best_move_uci}`,
    action: `played ${last.best_move_uci}`,
    expected: "finish session CTA visible on last item",
    observed: "Terminer la session visible",
    pass: true,
    primaryTestId: "review-training-finish-button",
  });
  await harness.clickByTestId("review-training-finish-button", { afterMs: 1200 });
  const complete = await harness.waitForPagePredicate("training complete state visible", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-training-complete-state"]')),
    text: document.body?.innerText ?? "",
  }), 20_000);
  evidence.contract_checks.training_complete_state = complete;
  await captureContractScreenshot({
    scenario: "REVIEW_TRAINING_FINISH_ACTION",
    state: "AFTER_CLICK_TERMINER_SESSION",
    action: "clicked Terminer la session",
    expected: "session complete state visible",
    observed: "Session terminée panel visible",
    pass: true,
    primaryTestId: "review-training-complete-state",
  });
}

function linePlaybackAnnotation(baseAnnotation = {}) {
  const fenBefore = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const playedLine = [
    { uci: "d2d4", san: "d4" },
    { uci: "d7d5", san: "d5" },
  ];
  const solutionLine = [
    { uci: "e2e4", san: "e4" },
    { uci: "e7e5", san: "e5" },
    { uci: "g1f3", san: "Nf3" },
  ];
  return {
    ...baseAnnotation,
    ply: 1,
    move_number: 1,
    color: "white",
    side: "white",
    san: "d4",
    uci: "d2d4",
    fen_before: fenBefore,
    fen_after: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
    primary_category: "missed_opportunity",
    category_label: "Problème",
    tags: ["missed_opportunity"],
    tag_labels: ["Opportunité manquée"],
    reason: "review_training_line_playback_fixture",
    win_loss: 11,
    move_accuracy: 58,
    best_move_uci: "e2e4",
    best_move_san: "e4",
    top_moves: [
      { uci: "e2e4", san: "e4", rank: 1, eval_cp: 85, pv: solutionLine },
      { uci: "d2d4", san: "d4", rank: 2, eval_cp: -120, pv: playedLine },
    ],
    try_move_supported: true,
    accepted_moves: ["e2e4", "e4"],
    acceptable_moves: ["e2e4", "e4"],
    accepted_moves_uci: ["e2e4"],
    pv_line: solutionLine,
    pv_contrast_evidence: {
      available: true,
      played_branch: { pv: playedLine },
      best_branch: { pv: solutionLine },
    },
    pedagogical_explanation: {
      available: true,
      error_type: "opening",
      why_played_move_bad: "Dans la partie, le coup joué avait laissé moins de marge.",
      why_best_move_good: "La solution prend plus d'espace sans figer le centre.",
      training_takeaway: "Comparer les lignes sans confondre tentative et partie.",
    },
    contrast_coach_explanation: {
      available: true,
      what_happened_after_played: "Dans la partie, la ligne jouée continue par d5.",
      why_solution_is_better: "La solution obtient une ligne plus directe.",
      played_line_preview: "d4 d5",
      best_line_preview: "e4 e5 Nf3",
      main_difference_type: "initiative",
      main_difference: "La solution lance la position plus clairement.",
    },
    impact_label: "important",
    move_quality_label: "Moyenne",
  };
}

function buildLinePlaybackReviewPayload(review) {
  const baseAnnotation =
    review?.move_annotations?.[0] ??
    review?.review_sections?.to_review?.[0] ??
    review?.review_sections?.all?.[0] ??
    {};
  const annotation = linePlaybackAnnotation(baseAnnotation);
  const payload = {
    ...review,
    status: review?.status ?? "done",
    user_color: "white",
    move_annotations: [annotation],
    review_sections: {
      to_review: [annotation],
      strong_moves: [],
      missed_opportunities: [annotation],
      all: [annotation],
    },
  };
  evidence.api.line_playback_review_payload = payload;
  writeJson(path.join(API_DIR, "line_playback_review_payload.json"), payload);
  mark("line_playback_review_payload", "pass", "played line d4 d5, solution line e4 e5 Nf3");
  return payload;
}

async function openReviewWithInterceptedPayload(gameId, reviewPayload) {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
(() => {
  const gameId = ${JSON.stringify(Number(gameId))};
  const reviewPayload = ${JSON.stringify(reviewPayload)};
  window.localStorage.setItem(
    "neurochess.appState.v5_3a4d",
    JSON.stringify({
      gameId,
      activeTab: "review",
      displayedPositionPly: 0,
      activeReviewJobId: null,
      reviewAnalysisProfile: "standard",
      updatedAt: Date.now(),
    }),
  );
  window.localStorage.setItem("neurochess.reviewPov." + gameId, "both");
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
  await harness.evalPage(({ nextGameId, nextUrl }) => {
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
    window.location.assign(nextUrl);
    return { ok: true };
  }, {
    nextGameId: Number(gameId),
    nextUrl: `${harness.frontendBaseUrl}/app?linePlaybackContract=${Date.now()}`,
  });
  await harness.waitForPagePredicate("review lesson focus restored for line playback", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-board"]')) &&
      Boolean(document.querySelector('[data-testid="review-focus-learn"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function assertLinePlaybackContract(gameId, review) {
  const payload = buildLinePlaybackReviewPayload(review);
  await openReviewWithInterceptedPayload(gameId, payload);
  await harness.clickByTestId("review-focus-learn", { afterMs: 700 });
  await harness.waitForPagePredicate("lesson challenge visible for line playback", () => ({
    ok: Boolean(document.querySelector('[data-public-lesson-step="challenge"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  await harness.clickByText("Voir la correction", { exact: true, afterMs: 900 });
  await harness.waitForPagePredicate("line comparison entry CTA visible", () => ({
    ok: document.body.innerText.includes("Voir la ligne"),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await harness.clickByText("Voir la ligne", { exact: true, afterMs: 900 });
  await harness.waitForPagePredicate("line comparison buttons visible", () => ({
    ok:
      Boolean(document.querySelector('[data-testid="review-line-game-play-button"]')) &&
      Boolean(document.querySelector('[data-testid="review-line-solution-play-button"]')) &&
      (document.querySelector('[data-testid="review-line-game-play-button"]')?.textContent ?? "").includes("Lire la ligne jouée") &&
      (document.querySelector('[data-testid="review-line-solution-play-button"]')?.textContent ?? "").includes("Lire la ligne solution"),
    text: document.body?.innerText ?? "",
  }), 20_000);
  await captureContractScreenshot({
    scenario: "LINE_PLAYBACK_COMPARISON_PANEL",
    state: "BEFORE_INTERNAL_LINE_CLICK",
    action: "opened Review correction comparison",
    expected: "contextual line buttons visible",
    observed: "Lire la ligne jouée and Lire la ligne solution visible",
    pass: true,
    primaryTestId: "review-line-game-play-button",
  });
  await harness.clickByTestId("review-line-game-play-button", { afterMs: 900 });
  const playerOpened = await harness.waitForPagePredicate("played line player opened", () => {
    const player = document.querySelector('[data-testid="review-line-player"]');
    const context = document.querySelector('[data-testid="review-line-player-context"]')?.textContent ?? "";
    return {
      ok:
        Boolean(player) &&
        context.includes("Lecture : dans la partie") &&
        (document.querySelector('[data-testid="review-line-player-current-move"]')?.textContent ?? "").includes("Position de départ"),
      context,
      currentFen: player?.getAttribute("data-current-fen") ?? null,
      currentIndex: player?.getAttribute("data-current-index") ?? null,
    };
  }, 20_000);
  evidence.contract_checks.played_line_player_opened = playerOpened;
  await captureContractScreenshot({
    scenario: "LINE_PLAYBACK_GAME_LINE",
    state: "AFTER_CLICK_LIRE_LIGNE_JOUEE",
    action: "clicked Lire la ligne jouée",
    expected: "line player context visible at start position",
    observed: playerOpened.context,
    pass: true,
    primaryTestId: "review-line-player",
  });
  await harness.clickByTestId("review-line-player-next", { afterMs: 900 });
  const afterStep = await harness.waitForPagePredicate("played line step advanced", (beforeFen) => {
    const player = document.querySelector('[data-testid="review-line-player"]');
    const currentMove =
      document.querySelector('[data-testid="review-line-player-current-move"]')?.textContent ?? "";
    const step =
      document.querySelector('[data-testid="review-line-player-step-label"]')?.textContent ?? "";
    const currentFen = player?.getAttribute("data-current-fen") ?? null;
    return {
      ok: Boolean(player) && step.includes("Coup 1") && currentMove.includes("d4") && currentFen && currentFen !== beforeFen,
      step,
      currentMove,
      beforeFen,
      currentFen,
    };
  }, 20_000, playerOpened.currentFen);
  evidence.contract_checks.played_line_step_advanced = afterStep;
  await captureContractScreenshot({
    scenario: "LINE_PLAYBACK_GAME_LINE",
    state: "AFTER_CLICK_SUIVANT",
    action: "clicked Suivant",
    expected: "active move and board FEN change",
    observed: `${afterStep.step} ${afterStep.currentMove}`,
    pass: true,
    primaryTestId: "review-line-player-next",
    dbCheck: "line playback is frontend-only; no attempt endpoint called",
  });
  await harness.clickByTestId("review-line-solution-play-button", { afterMs: 900 });
  const solutionPlayer = await harness.waitForPagePredicate("solution line player selected", () => {
    const player = document.querySelector('[data-testid="review-line-player"]');
    const context = document.querySelector('[data-testid="review-line-player-context"]')?.textContent ?? "";
    const step = document.querySelector('[data-testid="review-line-player-step-label"]')?.textContent ?? "";
    return {
      ok:
        Boolean(player) &&
        context.includes("Lecture : solution") &&
        step.includes("Départ") &&
        player?.getAttribute("data-active-line") === "solution",
      context,
      step,
      activeLine: player?.getAttribute("data-active-line") ?? null,
    };
  }, 20_000);
  evidence.contract_checks.solution_line_selected = solutionPlayer;
  await captureContractScreenshot({
    scenario: "LINE_PLAYBACK_SOLUTION_LINE",
    state: "AFTER_CLICK_LIRE_LIGNE_SOLUTION",
    action: "clicked Lire la ligne solution",
    expected: "context switches to solution and step resets",
    observed: `${solutionPlayer.context} ${solutionPlayer.step}`,
    pass: true,
    primaryTestId: "review-line-solution-play-button",
  });
}

async function main() {
  harness.writeEvidence();
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  evidence.api.head_commit = head.stdout.trim();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReviewFixture(harness, { seedEligibleMoment: false });
  evidence.api.game_id = gameId;
  seedTwoEligibleMoments(gameId);
  dbCounts("after_seed_two_items");
  const review = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review?profile=standard`);
  writeJson(path.join(API_DIR, "review_after_two_item_seed.json"), review);
  await openReviewFromPersistedState(harness, gameId, { reviewPov: "both" });
  await harness.evalPage(({ nextGameId }) => {
    window.localStorage.setItem(`neurochess.reviewPov.${nextGameId}`, "both");
    return { ok: true };
  }, { nextGameId: gameId });
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app`,
  });
  await harness.waitForPagePredicate("review board visible", () => ({
    ok: Boolean(document.querySelector('[data-testid="review-board"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
  const session = await openPracticeFromReview(gameId);
  await captureContractScreenshot({
    scenario: "REVIEW_TRAINING_BASELINE",
    state: "BEFORE_FIRST_ATTEMPT",
    action: "opened Review Training",
    expected: "position 1 of multi-item session visible",
    observed: "Review Training panel open",
    pass: true,
    primaryTestId: "practice-panel",
  });
  const continuation = await assertSuccessNextCtaAndAdvance(gameId, session);
  if (!continuation.completed) {
    await assertFinishAtEnd(gameId);
  }
  await assertLinePlaybackContract(gameId, review);
  const finalCounts = dbCounts("final_after_line_playback");
  evidence.contract_checks.final_counts = finalCounts;
  await harness.assertForbiddenV1LabelsAbsent("forbidden_labels_absent_final");
  if (evidence.browser_errors.page.length || evidence.browser_errors.network_500.length) {
    fail("browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
  writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
    console: evidence.browser_errors.console,
    page: evidence.browser_errors.page,
  });
  writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
  writeJson(path.join(QA_DIR, "manifest.json"), manifest);
  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_REVIEW_TRAINING_CONTINUATION_AND_LINE_PLAYBACK_USER_CONTRACT_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      try {
        await captureContractScreenshot({
          scenario: "RED_OR_FAILURE_CAPTURE",
          state: "SMOKE_FAILURE",
          action: "captured failure state",
          expected: "diagnostic screenshot",
          observed: error?.message ?? String(error),
          pass: false,
          primaryTestId: "failure",
          notes: "This failure screenshot is retained as red evidence if the current bug reproduces.",
        });
      } catch {
        await harness.captureScreenshot("browser_review_training_continuation_and_line_playback_failure");
      }
    }
    writeJson(path.join(CONSOLE_DIR, "browser_console_errors.json"), {
      console: evidence.browser_errors.console,
      page: evidence.browser_errors.page,
    });
    writeJson(path.join(NETWORK_DIR, "browser_network_500.json"), evidence.browser_errors.network_500);
    harness.writeEvidence();
    console.error("BROWSER_REVIEW_TRAINING_CONTINUATION_AND_LINE_PLAYBACK_USER_CONTRACT_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
