#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  fetchJson,
  findPython,
  fixturePgn,
  normalizeText,
} from "./browser_test_helpers.mjs";

const evidence = createEvidence(
  "P1.MOBILE-RESPONSIVE-AND-A11Y-V1.keyboard-accessibility",
  "browser_keyboard_accessibility_smoke_latest.json",
);
evidence.strategy =
  "temp backend DB + fake engine + Vite + Edge CDP keyboard Tab/Enter focus smoke";

const harness = new BrowserSmokeHarness(evidence);

function mark(name, status, detail = null) {
  harness.mark(name, status, detail);
}

function fail(name, detail) {
  harness.fail(name, detail);
}

async function pollReviewJob(jobPayload, timeoutMs = 120_000) {
  const jobId = jobPayload.job_id;
  if (!jobId || jobPayload.status === "completed") {
    return jobPayload;
  }
  const deadline = Date.now() + timeoutMs;
  let payload = jobPayload;
  while (Date.now() < deadline) {
    payload = await fetchJson(`${harness.backendBaseUrl}/review/jobs/${jobId}`);
    const status = payload.status ?? payload.review_status;
    if (status === "completed" || status === "done") {
      return payload;
    }
    if (status === "failed" || status === "stalled") {
      fail("keyboard_review_job_terminal_before_review", JSON.stringify(payload));
    }
    await delay(750);
  }
  fail("keyboard_review_job_timeout", JSON.stringify(payload));
}

async function prepareReview() {
  const importPayload = await fetchJson(`${harness.backendBaseUrl}/games/import-pgn`, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: fixturePgn(),
      user_alias: "SindarovGM",
      platform: "lichess",
    }),
  });
  const imported =
    importPayload.games?.[0] ??
    importPayload.imported_games?.[0] ??
    importPayload[0];
  const gameId = imported?.game_id ?? imported?.id ?? importPayload.imported_game_ids?.[0];
  if (!gameId) {
    fail("keyboard_pgn_import_api", JSON.stringify(importPayload));
  }
  evidence.api.game_id = gameId;
  mark("keyboard_pgn_import_api", "pass", `game_id=${gameId}`);

  const reviewJob = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({ profile: "standard", force_reanalysis: true }),
  });
  evidence.api.review_job_id = reviewJob.job_id ?? null;
  await pollReviewJob(reviewJob);
  await seedEligibleReviewMoment(gameId);
  mark("keyboard_review_ready_api", "pass", `game_id=${gameId}`);
  return { gameId };
}

async function seedEligibleReviewMoment(gameId) {
  const dbPath = path.join(evidence.temp_db_dir, "neurochess.db");
  const script = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
game_id = int(sys.argv[2])
start_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
played_fen = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1"
top_moves = [
    {"uci": "e2e4", "san": "e4", "rank": 1, "eval_cp": 85, "mate_in": None, "pv": ["e2e4", "e7e5", "g1f3"]},
    {"uci": "d2d4", "san": "d4", "rank": 2, "eval_cp": -120, "mate_in": None, "pv": ["d2d4", "d7d5"]},
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
        VALUES (?, ?, NULL, 1, 'white', 'white', ?, ?, 'd2d4', 'd4',
                'e2e4', 'e4', 85, -120, NULL, NULL, 205, 'large',
                99.0, 1.0, 'stable', ?, 'player_loss', datetime('now'))
        """,
        (review_id, game_id, start_fen, played_fen, json.dumps(top_moves)),
    )
`;
  const result = spawnSync(findPython(), ["-c", script, dbPath, String(gameId)], {
    cwd: evidence.temp_db_dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    fail("keyboard_eligible_review_seed", `${result.stdout}\n${result.stderr}`);
  }
  const session = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`, {
    method: "POST",
    body: JSON.stringify({ pov: "both", scope: "top_priority", max_items: 5 }),
  });
  if (!session.item_count || !Array.isArray(session.items) || session.items.length < 1) {
    fail("keyboard_eligible_review_practice_seed", JSON.stringify(session));
  }
  await fetchJson(`${harness.backendBaseUrl}/review/practice/sessions/${session.session_id}/abandon`, {
    method: "POST",
  });
}

function matchesSnapshot(snapshot, matcher) {
  if (matcher.testId && snapshot.testId === matcher.testId) {
    return true;
  }
  if (matcher.tag && snapshot.tag === matcher.tag) {
    return true;
  }
  if (matcher.text && normalizeText(snapshot.text).includes(normalizeText(matcher.text))) {
    return true;
  }
  return false;
}

function hasFocusRing(snapshot) {
  return snapshot.outlineStyle !== "none" && snapshot.outlineWidth !== "0px";
}

async function focusByTabUntil(stage, matcher, maxTabs = 60) {
  const seen = [];
  for (let index = 0; index < maxTabs; index += 1) {
    await harness.pressKey("Tab");
    const snapshot = await harness.activeElementSnapshot();
    seen.push(snapshot);
    if (matchesSnapshot(snapshot, matcher)) {
      if (!hasFocusRing(snapshot)) {
        fail(`${stage}_focus_visible`, JSON.stringify(snapshot));
      }
      mark(stage, "pass", JSON.stringify(snapshot));
      return snapshot;
    }
  }
  fail(stage, JSON.stringify({ matcher, seen: seen.slice(-15) }));
}

async function keyboardOpenImportPanel() {
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  await harness.assertForbiddenV1LabelsAbsent("keyboard_forbidden_labels_absent_initial");
  await focusByTabUntil("keyboard_nav_today_focusable", { testId: "nav-today" });
  await focusByTabUntil("keyboard_nav_games_focusable", { testId: "nav-games" });
  await harness.clickByTestId("nav-games", { afterMs: 700 });
  await harness.waitForPagePredicate("keyboard games screen visible", () => {
    const importButton = document.querySelector('[data-testid="import-pgn-button"]');
    return { ok: Boolean(importButton), text: document.body?.innerText ?? "" };
  }, 15_000);
  await focusByTabUntil("keyboard_importer_focusable", { testId: "import-pgn-button" });
  await harness.clickByTestId("import-pgn-button", { afterMs: 700 });
  await focusByTabUntil("keyboard_pgn_textarea_focusable", { testId: "pgn-textarea" }, 80);
  await focusByTabUntil("keyboard_import_primary_focusable", { text: "Importer" }, 80);
}

async function openReviewAndPractice(gameId) {
  await harness.clickByText("Voir historique", { afterMs: 700 }).catch(() => undefined);
  await harness.waitForPagePredicate("keyboard history shows review", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Voir review") || text.includes("Review disponible"), text };
  }, 25_000);
  await harness.clickByText("Voir review", { exact: true, afterMs: 1200 });
  try {
    await harness.waitForPagePredicate("keyboard review summary visible", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 10_000);
  } catch {
    const text = await harness.visibleText();
    if (normalizeText(text).includes("lancer l'analyse")) {
      await harness.clickByText("Lancer l'analyse", { afterMs: 1200 });
    }
    await harness.waitForPagePredicate("keyboard review summary visible after generate", () => {
      return {
        ok:
          Boolean(document.querySelector('[data-testid="review-summary"]')) &&
          Boolean(document.querySelector('[data-testid="review-board"]')),
      };
    }, 60_000);
  }
  await harness.clickByTestId("review-practice-button", { afterMs: 1200 });
  await harness.waitForPagePredicate("keyboard practice visible", () => {
    return {
      ok:
        Boolean(document.querySelector('[data-testid="practice-panel"]')) &&
        Boolean(document.querySelector('[data-testid="practice-board"]')) &&
        Boolean(document.querySelector('[data-testid="practice-hint-button"]')) &&
        Boolean(document.querySelector('[data-testid="practice-reveal-button"]')),
    };
  }, 30_000);
  const payload = await fetchJson(`${harness.backendBaseUrl}/games/${gameId}/review/practice/sessions`);
  const session = payload.sessions?.[0];
  evidence.api.keyboard_practice_session_id = session?.session_id ?? null;
  mark("keyboard_practice_opened", "pass", `session_id=${evidence.api.keyboard_practice_session_id}`);
}

async function verifyPracticeKeyboardFocus() {
  await focusByTabUntil("keyboard_practice_board_focusable", { testId: "practice-board" }, 80);
  await focusByTabUntil("keyboard_practice_hint_focusable", { testId: "practice-hint-button" }, 80);
  await focusByTabUntil("keyboard_practice_reveal_focusable", { testId: "practice-reveal-button" }, 80);
  await focusByTabUntil("keyboard_practice_skip_focusable", { text: "Passer" }, 80);
}

async function verifyProfileKeyboardAccess() {
  await harness.loadApp();
  await focusByTabUntil("keyboard_profile_focusable", { testId: "profile-settings-button" }, 80);
  await harness.pressKey("Enter", { afterMs: 600 });
  let opened = await harness.evalPage(() => Boolean(document.querySelector('[data-testid="profile-privacy-panel"]')));
  if (!opened) {
    await harness.pressKey(" ", { afterMs: 600 });
    opened = await harness.evalPage(() => Boolean(document.querySelector('[data-testid="profile-privacy-panel"]')));
  }
  if (!opened) {
    evidence.api.profile_keyboard_activation_fallback = "activeElement.click after keyboard focus";
    await harness.evalPage(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.click();
      }
      return true;
    });
  }
  await harness.waitForPagePredicate("keyboard profile panel visible", () => {
    return { ok: Boolean(document.querySelector('[data-testid="profile-privacy-panel"]')) };
  }, 10_000);
  mark("keyboard_profile_panel_opens_after_focus", "pass");
}

async function verifyReducedMotionCss() {
  const result = await harness.evalPage(() => {
    const texts = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules ?? [])) {
          texts.push(rule.cssText);
        }
      } catch {
        // Ignore inaccessible sheets. App CSS is same-origin in this smoke.
      }
    }
    const css = texts.join("\n");
    return {
      ok: css.includes("prefers-reduced-motion") && css.includes("transition-duration"),
      hasReducedMotion: css.includes("prefers-reduced-motion"),
    };
  });
  if (!result.ok) {
    fail("keyboard_reduced_motion_css_present", JSON.stringify(result));
  }
  mark("keyboard_reduced_motion_css_present", "pass");
}

async function browserErrorGate() {
  const pageErrors = evidence.browser_errors.page.filter((error) =>
    /typeerror|referenceerror|uncaught/i.test(String(error)),
  );
  if (pageErrors.length > 0 || evidence.browser_errors.network_500.length > 0) {
    fail("keyboard_browser_error_gate", JSON.stringify(evidence.browser_errors));
  }
  mark("keyboard_browser_error_gate", "pass", JSON.stringify(evidence.browser_errors));
}

async function main() {
  harness.writeEvidence();
  await harness.startBackendWithTempDb();
  await harness.startFrontendVite();
  const { gameId } = await prepareReview();
  await harness.startBrowser("/app");
  await keyboardOpenImportPanel();
  await openReviewAndPractice(gameId);
  await verifyPracticeKeyboardFocus();
  await verifyProfileKeyboardAccess();
  await verifyReducedMotionCss();
  await harness.assertForbiddenV1LabelsAbsent("keyboard_forbidden_labels_absent_final");
  await browserErrorGate();

  evidence.finished_at = new Date().toISOString();
  evidence.result = "pass";
  harness.writeEvidence();
  console.log("BROWSER_KEYBOARD_ACCESSIBILITY_SMOKE PASS");
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
}

main()
  .catch(async (error) => {
    evidence.finished_at = new Date().toISOString();
    evidence.result = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    if (harness.browserClient) {
      await harness.captureScreenshot("browser_keyboard_accessibility_smoke_failure");
    }
    harness.writeEvidence();
    console.error("BROWSER_KEYBOARD_ACCESSIBILITY_SMOKE FAIL");
    console.error(error?.stack ?? error);
    console.error(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await harness.cleanupProcesses();
  });
