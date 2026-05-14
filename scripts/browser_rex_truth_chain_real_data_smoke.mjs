#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R2H1.TRUTH-CHAIN-NODE-FOCUS-MINI-BOARD-LENS-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R2H1_TRUTH_CHAIN_NODE_FOCUS_MINI_BOARD_LENS_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const FORBIDDEN_VISIBLE_TEXT = [
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction elo",
  "prediction elo",
  "raw wdl",
  "criticality_score",
  "diagnostic_gap",
  "etv",
  "fsrs",
  "skilltrace mastery",
  "neurochess garantit",
  "tu es nul",
  "xp gagne",
  "transfer score",
  "centipawn",
];

const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const HISTORY_ROUTE = "/games/history?limit=50&offset=0&scope=mine";
const MOVES_ROUTE = "/games/9001/moves";

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_truth_chain_real_data_smoke.json");
evidence.strategy = "REX Parties Truth Chain moves-only prototype via GET browser fixtures, no Review route";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_truth_chain_real_data_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.route_sources = [
  "frontend/src/api/client.ts:getGameHistory -> request(`/games/history?...`)",
  "frontend/src/api/client.ts:getGameMoves -> request(`/games/${gameId}/moves`)",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/history\")",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/{game_id}/moves\")",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/{game_id}/review\") is not used because it calls ensure_training_items_for_game",
];
evidence.fixture_summary = {
  historyRoute: `GET ${HISTORY_ROUTE}`,
  movesRoute: `GET ${MOVES_ROUTE}`,
  totalGames: 3,
  latestGame: {
    white: "bahij",
    black: "ClubRival",
    result: "0-1",
    openingName: "Sicilian Defense: Najdorf",
    reviewStatus: "review_available",
  },
  moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4"],
};

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name) {
  await harness.browserClient.send("Page.bringToFront");
  await harness.evalPage(async () => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
  const metrics = await harness.evalPage(() => ({
    width: Math.max(1, Math.round(window.innerWidth)),
    height: Math.max(1, Math.round(window.innerHeight)),
  }));
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 },
  });
  const screenshotPath = path.join(SCREENSHOT_DIR, name);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

async function installTruthChainFixture() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const fixtureGames = [
          {
            game_id: 9001,
            import_id: 7001,
            source: "r2h-browser-fixture",
            source_game_id: "r2h-truth-chain-001",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2h-fixture-v1",
            is_special_position: false,
            date_played: "2026-05-10T19:30:00Z",
            white_name: "bahij",
            black_name: "ClubRival",
            display_title: "bahij vs ClubRival",
            display_subtitle: "Sicilian Defense: Najdorf",
            user_color: "white",
            opponent_name: "ClubRival",
            result: "0-1",
            result_from_user_pov: "loss",
            white_elo: 1820,
            black_elo: 1855,
            time_control: "10+0",
            time_control_category: "rapid",
            move_count: 42,
            opening_name: "Sicilian Defense: Najdorf",
            eco_code: "B90",
            classification_status: "matched",
            review_status: "completed",
            review_summary_status: "review_available",
            is_reviewable: true,
            metadata_quality: "complete"
          },
          {
            game_id: 9002,
            import_id: 7001,
            source: "r2h-browser-fixture",
            source_game_id: "r2h-truth-chain-002",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2h-fixture-v1",
            is_special_position: false,
            date_played: "2026-05-08T18:10:00Z",
            white_name: "ClubRival",
            black_name: "bahij",
            display_title: "ClubRival vs bahij",
            display_subtitle: "Queen's Gambit Declined",
            user_color: "black",
            opponent_name: "ClubRival",
            result: "1-0",
            result_from_user_pov: "loss",
            white_elo: 1841,
            black_elo: 1812,
            time_control: "5+3",
            time_control_category: "blitz",
            move_count: 37,
            opening_name: "Queen's Gambit Declined",
            eco_code: "D30",
            classification_status: "matched",
            review_status: "completed",
            review_summary_status: "review_available",
            is_reviewable: true,
            metadata_quality: "complete"
          },
          {
            game_id: 9003,
            import_id: 7001,
            source: "r2h-browser-fixture",
            source_game_id: "r2h-truth-chain-003",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2h-fixture-v1",
            is_special_position: false,
            date_played: "2026-05-04T20:05:00Z",
            white_name: "bahij",
            black_name: "TrainingPartner",
            display_title: "bahij vs TrainingPartner",
            display_subtitle: "Caro-Kann Defense",
            user_color: "white",
            opponent_name: "TrainingPartner",
            result: "1-0",
            result_from_user_pov: "win",
            white_elo: 1815,
            black_elo: 1784,
            time_control: "15+10",
            time_control_category: "classical",
            move_count: 51,
            opening_name: "Caro-Kann Defense",
            eco_code: "B12",
            classification_status: "matched",
            review_status: "not_started",
            review_summary_status: "not_analyzed",
            is_reviewable: true,
            metadata_quality: "complete"
          }
        ];
        const fixtureMoves = {
          game_id: 9001,
          initial_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          current_fen: "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5",
          status: "imported",
          moves: [
            {
              ply: 1,
              side_to_move_before: "white",
              played_uci: "e2e4",
              played_san: "e4",
              fen_before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              fen_after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
            },
            {
              ply: 2,
              side_to_move_before: "black",
              played_uci: "c7c5",
              played_san: "c5",
              fen_before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
              fen_after: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2"
            },
            {
              ply: 3,
              side_to_move_before: "white",
              played_uci: "g1f3",
              played_san: "Nf3",
              fen_before: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
              fen_after: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"
            },
            {
              ply: 4,
              side_to_move_before: "black",
              played_uci: "d7d6",
              played_san: "d6",
              fen_before: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
              fen_after: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"
            },
            {
              ply: 5,
              side_to_move_before: "white",
              played_uci: "d2d4",
              played_san: "d4",
              fen_before: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
              fen_after: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3"
            },
            {
              ply: 6,
              side_to_move_before: "black",
              played_uci: "c5d4",
              played_san: "cxd4",
              fen_before: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3",
              fen_after: "rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4"
            }
          ]
        };
        const calls = [];
        Object.defineProperty(window, "__rexNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        window.__rexTruthChainFixtureMode = "loaded";
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const requestMethod = input instanceof Request ? input.method : undefined;
          const method = String((init && init.method) || requestMethod || "GET").toUpperCase();
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          const parsed = new URL(url, window.location.href);
          const isHistory =
            parsed.pathname === "/games/history" &&
            parsed.searchParams.get("limit") === "50" &&
            parsed.searchParams.get("offset") === "0" &&
            parsed.searchParams.get("scope") === "mine";
          const isMoves = parsed.pathname === "/games/9001/moves";
          calls.push({
            transport: "fetch",
            method,
            url,
            mocked: isHistory || isMoves,
            fixtureMode: window.__rexTruthChainFixtureMode,
          });
          if (method === "GET" && isHistory) {
            if (window.__rexTruthChainFixtureMode === "degraded") {
              return Promise.reject(new TypeError("R2H mocked backend unavailable"));
            }
            return Promise.resolve(
              new Response(JSON.stringify(fixtureGames), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              })
            );
          }
          if (method === "GET" && isMoves) {
            return Promise.resolve(
              new Response(JSON.stringify(fixtureMoves), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              })
            );
          }
          return originalFetch.apply(this, arguments);
        };
        const originalOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
        if (originalOpen) {
          window.XMLHttpRequest.prototype.open = function(method, url) {
            calls.push({ transport: "xhr", method: String(method || "GET").toUpperCase(), url: String(url), mocked: false });
            return originalOpen.apply(this, arguments);
          };
        }
      })();
    `,
  });
}

async function assertForbiddenTextAbsent(stage) {
  const text = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => text.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail(stage, visible.join(", "));
  }
  harness.mark(stage, "pass", "no forbidden Truth Chain text visible");
}

async function networkCalls() {
  const calls = await harness.evalPage(() => window.__rexNetworkCalls ?? []);
  evidence.network_calls = calls;
  harness.writeEvidence();
  return calls;
}

async function assertReadOnlyNetwork(stage) {
  const calls = await networkCalls();
  const forbidden = calls.filter((call) => FORBIDDEN_METHODS.has(String(call.method).toUpperCase()));
  if (forbidden.length > 0) {
    harness.fail(stage, JSON.stringify(forbidden));
  }
  const reviewCalls = calls.filter((call) => /\/review|review\/jobs|training|daily-plan|import-pgn|opening\/classify/i.test(String(call.url)));
  if (reviewCalls.length > 0) {
    harness.fail("rex_truth_chain_no_review_or_write_routes", JSON.stringify(reviewCalls));
  }
  const splineCalls = calls.filter((call) => /spline|splinetool|scene\\.splinecode/i.test(String(call.url)));
  if (splineCalls.length > 0) {
    harness.fail("rex_truth_chain_no_spline_network", JSON.stringify(splineCalls));
  }
  const historyCall = calls.find((call) => call.mocked && String(call.url).includes("/games/history"));
  const movesCall = calls.find((call) => call.mocked && String(call.url).includes("/games/9001/moves"));
  if (!historyCall || !movesCall) {
    harness.fail("rex_truth_chain_required_gets_called", JSON.stringify(calls));
  }
  harness.mark(stage, "pass", JSON.stringify(calls));
}

async function assertTruthChainLoaded() {
  const loadedState = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const text = normalize(document.body?.innerText ?? "");
    const nodes = [...document.querySelectorAll('[data-testid="rex-truth-chain-node"]')];
    const board = document.querySelector('[data-testid="rex-mini-board"]');
    const realChain = document.querySelector('[data-testid="rex-truth-chain-real"]');
    return {
      ok:
        Boolean(realChain) &&
        nodes.length > 0 &&
        nodes.length <= 5 &&
        Boolean(board) &&
        Boolean(document.querySelector('[data-testid="rex-position-lens"]')) &&
        text.includes("bahij vs clubrival") &&
        text.includes("sicilian defense: najdorf") &&
        text.includes("1.e4") &&
        text.includes("2.nf3") &&
        text.includes("e4") &&
        text.includes("nf3") &&
        text.includes("statut lu") &&
        text.includes("gravite a brancher") &&
        text.includes("source moves") &&
        text.includes("lecture seule") &&
        text.includes("review non appelee"),
      nodeCount: nodes.length,
      hasBoard: Boolean(board),
      text: text.slice(0, 1100),
    };
  });
  if (!loadedState.ok) {
    harness.fail("rex_truth_chain_loaded_nodes_visible", JSON.stringify(loadedState));
  }
  harness.mark("rex_truth_chain_loaded_nodes_visible", "pass", JSON.stringify(loadedState));
}

async function assertNodeFocus() {
  const focusState = await harness.evalPage(async () => {
    const nodes = [...document.querySelectorAll('[data-testid="rex-truth-chain-node"]')];
    const target = nodes[2] || nodes[0];
    if (!(target instanceof HTMLElement)) {
      return { ok: false, reason: "missing node" };
    }
    target.focus();
    target.click();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const board = document.querySelector('[data-testid="rex-mini-board"]');
    const focusPanel = document.querySelector('[data-testid="rex-position-lens"]');
    return {
      ok:
        document.activeElement === target &&
        Boolean(board) &&
        Boolean(focusPanel) &&
        String(focusPanel?.textContent ?? "").includes("2.Nf3"),
      activeText: target.textContent,
      focusText: focusPanel?.textContent,
      boardText: board?.textContent,
    };
  });
  if (!focusState.ok) {
    harness.fail("rex_truth_chain_node_focus_board_visible", JSON.stringify(focusState));
  }
  harness.mark("rex_truth_chain_node_focus_board_visible", "pass", JSON.stringify(focusState));
}

async function assertDegradedStillOk() {
  await harness.evalPage(() => {
    window.__rexTruthChainFixtureMode = "degraded";
  });
  await harness.clickByTestId("rex-nav-qg", { afterMs: 220 });
  await harness.clickByTestId("rex-nav-parties", { afterMs: 260 });
  await harness.waitForPagePredicate("Parties degraded state ready", () => {
    const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
    const state = panel?.getAttribute("data-backend-status");
    const text = document.body?.innerText ?? "";
    return {
      ok: state === "unavailable" && text.includes("Lecture backend indisponible"),
      state,
      text: text.slice(0, 650),
    };
  }, 30_000);
  harness.mark("rex_truth_chain_degraded_still_ok", "pass", "backend unavailable fallback visible");
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:65535";
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await installTruthChainFixture();

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX shell ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        Boolean(document.querySelector('[data-testid="rex-nav"]')),
    }), 30_000);
    harness.mark("rex_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.clickByTestId("rex-nav-parties", { afterMs: 280 });
    await harness.waitForPagePredicate("Parties real Truth Chain ready", () => {
      const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
      const realChain = document.querySelector('[data-testid="rex-truth-chain-real"]');
      const nodes = document.querySelectorAll('[data-testid="rex-truth-chain-node"]');
      return {
        ok: panel?.getAttribute("data-backend-status") === "ready" && Boolean(realChain) && nodes.length > 0,
        state: panel?.getAttribute("data-backend-status"),
        nodes: nodes.length,
      };
    }, 30_000);

    await assertTruthChainLoaded();
    await assertNodeFocus();
    await assertForbiddenTextAbsent("rex_truth_chain_forbidden_text_absent");
    await assertReadOnlyNetwork("rex_truth_chain_get_only_network");
    await captureScreenshot("rex_parties_r2h1_truth_chain.png");
    await captureScreenshot("rex_parties_r2h1_node_focus_lens.png");

    await assertDegradedStillOk();
    await captureScreenshot("rex_parties_r2h1_degraded_still_ok.png");
    await assertForbiddenTextAbsent("rex_truth_chain_degraded_forbidden_text_absent");

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
    await harness.waitForPagePredicate("V1 route still accessible", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          !document.querySelector('[data-testid="rex-shell"]') &&
          (text.includes("Aujourd") || text.includes("Mes parties") || text.includes("NeuroChess")),
        text: text.slice(0, 300),
      };
    }, 30_000);
    harness.mark("v1_route_without_rex_accessible", "pass", `${harness.frontendBaseUrl}/app`);

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&designLab=1` });
    await harness.waitForPagePredicate("Design Lab still accessible", () => ({
      ok: Boolean(document.querySelector('[data-testid="rex-design-lab"]')),
    }), 30_000);
    harness.mark("rex_design_lab_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&fxLab=1` });
    await harness.waitForPagePredicate("FX Lab still accessible", () => ({
      ok: Boolean(document.querySelector('[data-testid="rex-fx-lab"]')),
    }), 30_000);
    harness.mark("rex_fx_lab_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&fxLab=1`);

    if (evidence.browser_errors.page.length > 0) {
      harness.fail("rex_truth_chain_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("rex_truth_chain_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_truth_chain_real_data_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
