#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R2L1.TRUTH-CHAIN-STATE-CLARITY-MICRO-POLISH-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R2L1_TRUTH_CHAIN_STATE_CLARITY_MICRO_POLISH_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const FORBIDDEN_VISIBLE_TEXT = [
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction elo",
  "raw wdl",
  "criticality_score",
  "diagnostic_gap",
  "etv",
  "raw engine eval",
  "neurochess garantit",
  "tu es nul",
  "xp reel",
  "xp gagne",
  "transfer score",
  "centipawn",
];
const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const HISTORY_ROUTE = "/games/history?limit=50&offset=0&scope=mine";
const MOMENTS_ROUTE = "/games/9001/truth-chain/moments";
const MOVES_ROUTE = "/games/9001/moves";

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_truth_chain_moments_integration_smoke.json");
evidence.strategy = "REX Parties consumes GET truth-chain moments, preserves moves-only and degraded fallbacks";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_truth_chain_moments_integration_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.route_sources = [
  "frontend/src/api/client.ts:getGameHistory -> GET /games/history?...",
  "frontend/src/api/client.ts:getGameMoves -> GET /games/{game_id}/moves",
  "frontend/src/api/client.ts:getTruthChainMoments -> GET /games/{game_id}/truth-chain/moments",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/{game_id}/truth-chain/moments\")",
  "GET /games/{game_id}/review is forbidden in this smoke, including GET",
];
evidence.fixture_summary = {
  historyRoute: `GET ${HISTORY_ROUTE}`,
  momentsRoute: `GET ${MOMENTS_ROUTE}`,
  movesRoute: `GET ${MOVES_ROUTE}`,
  latestGame: "bahij vs ClubRival, 0-1, Sicilian Defense: Najdorf",
  momentCount: 4,
};

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name, { preserveFocus = false } = {}) {
  await harness.browserClient.send("Page.bringToFront");
  await harness.evalPage(async (keepFocus) => {
    if (!keepFocus && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }, preserveFocus);
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

async function installTruthChainMomentsFixture() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const fixtureGames = [
          {
            game_id: 9001,
            import_id: 7001,
            source: "r2l-browser-fixture",
            source_game_id: "r2l-truth-chain-001",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2l-fixture-v1",
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
          }
        ];
        const fixtureMoves = {
          game_id: 9001,
          initial_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          current_fen: "rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4",
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
            }
          ]
        };
        const fixtureMoments = {
          game: {
            id: "9001",
            white: "bahij",
            black: "ClubRival",
            result: "0-1",
            openingName: "Sicilian Defense: Najdorf",
            eco: "B90",
            moveCount: 42,
            reviewStatus: "done"
          },
          moments: [
            {
              id: "rm-9001-1",
              gameId: "9001",
              ply: 1,
              moveNumber: 1,
              san: "e4",
              uci: "e2e4",
              fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
              label: "Review moment",
              momentKind: "opening_exit",
              visualSeverity: "low",
              reviewAvailable: true,
              exerciseAvailable: false,
              source: "persisted_review_moment",
              limitations: ["no persisted exercise"]
            },
            {
              id: "rm-9001-2",
              gameId: "9001",
              ply: 2,
              moveNumber: 1,
              san: "c5",
              uci: "c7c5",
              fenBefore: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
              fenAfter: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
              label: "Review moment",
              momentKind: "strategic",
              visualSeverity: "medium",
              reviewAvailable: true,
              exerciseAvailable: false,
              source: "persisted_review_moment",
              limitations: ["no persisted exercise"]
            },
            {
              id: "rm-9001-3",
              gameId: "9001",
              ply: 3,
              moveNumber: 2,
              san: "Nf3",
              uci: "g1f3",
              fenBefore: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
              fenAfter: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
              label: "Review moment",
              momentKind: "tactical",
              visualSeverity: "high",
              reviewAvailable: true,
              exerciseAvailable: true,
              source: "persisted_review_moment",
              limitations: []
            },
            {
              id: "rm-9001-4",
              gameId: "9001",
              ply: 4,
              moveNumber: 2,
              san: "d6",
              uci: "d7d6",
              fenBefore: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
              fenAfter: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
              label: "Review moment",
              momentKind: "defense",
              visualSeverity: "unknown",
              reviewAvailable: true,
              exerciseAvailable: false,
              source: "persisted_review_moment",
              limitations: ["visual severity unavailable", "no persisted exercise"]
            }
          ],
          limitations: [],
          readOnlyProof: {
            route: "/games/{game_id}/truth-chain/moments",
            methodsAllowed: ["GET"],
            writesPerformed: false,
            trainingItemsCreated: false,
            dailyPlanTouched: false,
            dueAtTouched: false,
            engineInvoked: false
          }
        };
        const emptyMoments = {
          game: fixtureMoments.game,
          moments: [],
          limitations: ["no persisted review moments"],
          readOnlyProof: fixtureMoments.readOnlyProof
        };
        const calls = [];
        Object.defineProperty(window, "__rexNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        window.__rexTruthChainMomentsMode = "moments";
        window.__rexResetNetworkCalls = () => calls.splice(0, calls.length);
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const requestMethod = input instanceof Request ? input.method : undefined;
          const method = String((init && init.method) || requestMethod || "GET").toUpperCase();
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          const parsed = new URL(url, window.location.href);
          const mode = window.__rexTruthChainMomentsMode || "moments";
          const isHistory =
            parsed.pathname === "/games/history" &&
            parsed.searchParams.get("limit") === "50" &&
            parsed.searchParams.get("offset") === "0" &&
            parsed.searchParams.get("scope") === "mine";
          const isMoments = parsed.pathname === "/games/9001/truth-chain/moments";
          const isMoves = parsed.pathname === "/games/9001/moves";
          calls.push({
            transport: "fetch",
            method,
            url,
            pathname: parsed.pathname,
            mocked: isHistory || isMoments || isMoves,
            fixtureMode: mode,
          });
          if (method === "GET" && isHistory) {
            if (mode === "history-error") {
              return Promise.reject(new TypeError("R2L mocked history unavailable"));
            }
            return Promise.resolve(
              new Response(JSON.stringify(fixtureGames), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              })
            );
          }
          if (method === "GET" && isMoments) {
            if (mode === "moments") {
              return Promise.resolve(
                new Response(JSON.stringify(fixtureMoments), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                })
              );
            }
            if (mode === "empty" || mode === "history-error") {
              return Promise.resolve(
                new Response(JSON.stringify(emptyMoments), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                })
              );
            }
            return Promise.reject(new TypeError("R2L mocked truth-chain moments unavailable"));
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

async function setFixtureMode(mode) {
  await harness.evalPage((nextMode) => {
    window.__rexTruthChainMomentsMode = nextMode;
    window.__rexResetNetworkCalls?.();
  }, mode);
}

async function remountParties() {
  await harness.clickByTestId("rex-nav-qg", { afterMs: 180 });
  await harness.clickByTestId("rex-nav-parties", { afterMs: 260 });
}

async function networkCalls() {
  const calls = await harness.evalPage(() => window.__rexNetworkCalls ?? []);
  evidence.network_calls = calls;
  harness.writeEvidence();
  return calls;
}

function unsafeReviewCall(call) {
  const pathname = String(call.pathname || (() => {
    try {
      return new URL(String(call.url), "http://local").pathname;
    } catch {
      return String(call.url);
    }
  })());
  return /^\/games\/[^/]+\/review(?:$|\/|\?)/i.test(pathname);
}

async function assertNetworkSafe(stage, { requireMoments = false, requireMoves = false } = {}) {
  const calls = await networkCalls();
  const forbiddenWrites = calls.filter((call) => FORBIDDEN_METHODS.has(String(call.method).toUpperCase()));
  if (forbiddenWrites.length > 0) {
    harness.fail(`${stage}_no_write_methods`, JSON.stringify(forbiddenWrites));
  }
  const reviewCalls = calls.filter(unsafeReviewCall);
  if (reviewCalls.length > 0) {
    harness.fail(`${stage}_no_unsafe_review_route`, JSON.stringify(reviewCalls));
  }
  const blockedRoutes = calls.filter((call) =>
    /daily-plan|practice\/attempts|import-pgn|review\/generate|review\/rebuild|live-analysis/i.test(String(call.url)),
  );
  if (blockedRoutes.length > 0) {
    harness.fail(`${stage}_no_side_effect_routes`, JSON.stringify(blockedRoutes));
  }
  const historyCall = calls.find((call) => String(call.url).includes("/games/history"));
  const momentsCall = calls.find((call) => String(call.url).includes("/games/9001/truth-chain/moments"));
  const movesCall = calls.find((call) => String(call.url).includes("/games/9001/moves"));
  if (!historyCall) {
    harness.fail(`${stage}_history_called`, JSON.stringify(calls));
  }
  if (requireMoments && !momentsCall) {
    harness.fail(`${stage}_moments_called`, JSON.stringify(calls));
  }
  if (requireMoves && !movesCall) {
    harness.fail(`${stage}_moves_called`, JSON.stringify(calls));
  }
  harness.mark(stage, "pass", JSON.stringify(calls));
}

async function assertForbiddenTextAbsent(stage) {
  const text = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => text.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail(stage, visible.join(", "));
  }
  harness.mark(stage, "pass", "no forbidden R2L text visible");
}

async function assertMomentsLoaded() {
  const state = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const text = normalize(document.body?.innerText ?? "");
    const chain = document.querySelector('[data-testid="rex-truth-chain-real"]');
    const nodes = [...document.querySelectorAll('[data-testid="rex-truth-chain-node"]')];
    return {
      ok:
        chain?.getAttribute("data-chain-source") === "moments-review" &&
        nodes.length >= 3 &&
        nodes.length <= 5 &&
        text.includes("moments review") &&
        text.includes("moments review lus") &&
        text.includes("bahij vs clubrival") &&
        text.includes("sicilian defense: najdorf") &&
        text.includes("1.e4") &&
        text.includes("1...c5") &&
        text.includes("2.nf3") &&
        text.includes("review lue") &&
        text.includes("source review") &&
        text.includes("lecture seule"),
      source: chain?.getAttribute("data-chain-source"),
      nodeCount: nodes.length,
      text: text.slice(0, 1100),
    };
  });
  if (!state.ok) {
    harness.fail("rex_truth_chain_moments_loaded_visible", JSON.stringify(state));
  }
  harness.mark("rex_truth_chain_moments_loaded_visible", "pass", JSON.stringify(state));
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
    const lens = document.querySelector('[data-testid="rex-position-lens"]');
    return {
      ok:
        document.activeElement === target &&
        Boolean(board) &&
        Boolean(lens) &&
        String(lens?.textContent ?? "").includes("2.Nf3"),
      activeText: target.textContent,
      lensText: lens?.textContent,
      boardText: board?.textContent,
    };
  });
  if (!focusState.ok) {
    harness.fail("rex_truth_chain_moments_node_focus_lens", JSON.stringify(focusState));
  }
  harness.mark("rex_truth_chain_moments_node_focus_lens", "pass", JSON.stringify(focusState));
}

async function assertMovesOnlyFallback(stage) {
  const state = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const text = normalize(document.body?.innerText ?? "");
    const chain = document.querySelector('[data-testid="rex-truth-chain-real"]');
    const nodes = [...document.querySelectorAll('[data-testid="rex-truth-chain-node"]')];
    return {
      ok:
        chain?.getAttribute("data-chain-source") === "moves-only" &&
        nodes.length > 0 &&
        nodes.length <= 5 &&
        text.includes("moves-only") &&
        text.includes("historique lu") &&
        text.includes("moments absents") &&
        text.includes("coup lu") &&
        text.includes("source moves") &&
        text.includes("gravite non branchee") &&
        !text.includes("moments review lus"),
      source: chain?.getAttribute("data-chain-source"),
      nodeCount: nodes.length,
      text: text.slice(0, 1000),
    };
  });
  if (!state.ok) {
    harness.fail(stage, JSON.stringify(state));
  }
  harness.mark(stage, "pass", JSON.stringify(state));
}

async function assertRouteErrorFallback() {
  const state = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const text = normalize(document.body?.innerText ?? "");
    return {
      ok:
        text.includes("moves-only") &&
        text.includes("route truth chain moments indisponible") &&
        text.includes("fallback moves-only conserve"),
      text: text.slice(0, 1000),
    };
  });
  if (!state.ok) {
    harness.fail("rex_truth_chain_moments_error_fallback", JSON.stringify(state));
  }
  harness.mark("rex_truth_chain_moments_error_fallback", "pass", JSON.stringify(state));
}

async function assertHistoryDegraded() {
  const state = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
    return {
      ok: panel?.getAttribute("data-backend-status") === "unavailable" && text.includes("Lecture backend indisponible"),
      status: panel?.getAttribute("data-backend-status"),
      text: text.slice(0, 700),
    };
  });
  if (!state.ok) {
    harness.fail("rex_truth_chain_history_degraded_visible", JSON.stringify(state));
  }
  harness.mark("rex_truth_chain_history_degraded_visible", "pass", JSON.stringify(state));
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:65535";
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await installTruthChainMomentsFixture();

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX shell ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        Boolean(document.querySelector('[data-testid="rex-nav"]')),
    }), 30_000);
    harness.mark("rex_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.clickByTestId("rex-nav-parties", { afterMs: 320 });
    await harness.waitForPagePredicate("Truth Chain persisted moments ready", () => {
      const chain = document.querySelector('[data-testid="rex-truth-chain-real"]');
      const nodes = document.querySelectorAll('[data-testid="rex-truth-chain-node"]');
      return {
        ok: chain?.getAttribute("data-chain-source") === "moments-review" && nodes.length >= 3,
        source: chain?.getAttribute("data-chain-source"),
        nodes: nodes.length,
      };
    }, 30_000);
    await assertMomentsLoaded();
    await assertNodeFocus();
    await assertForbiddenTextAbsent("rex_truth_chain_moments_forbidden_text_absent");
    await assertNetworkSafe("rex_truth_chain_moments_get_only_network", { requireMoments: true });
    await captureScreenshot("rex_parties_r2l1_moments_loaded.png");
    await captureScreenshot("rex_parties_r2l1_node_focus_mini_board.png", { preserveFocus: true });

    await setFixtureMode("empty");
    await remountParties();
    await harness.waitForPagePredicate("Moves-only fallback ready", () => {
      const chain = document.querySelector('[data-testid="rex-truth-chain-real"]');
      return {
        ok: chain?.getAttribute("data-chain-source") === "moves-only",
        source: chain?.getAttribute("data-chain-source"),
      };
    }, 30_000);
    await assertMovesOnlyFallback("rex_truth_chain_empty_moments_moves_only_fallback");
    await assertNetworkSafe("rex_truth_chain_empty_moments_get_only_network", { requireMoments: true, requireMoves: true });
    await captureScreenshot("rex_parties_r2l1_moves_only_fallback.png");

    await setFixtureMode("error");
    await remountParties();
    await harness.waitForPagePredicate("Moments route error fallback ready", () => {
      const text = document.body?.innerText ?? "";
      const chain = document.querySelector('[data-testid="rex-truth-chain-real"]');
      return {
        ok: chain?.getAttribute("data-chain-source") === "moves-only" && text.includes("Route Truth Chain moments indisponible"),
        source: chain?.getAttribute("data-chain-source"),
        text: text.slice(0, 700),
      };
    }, 30_000);
    await assertRouteErrorFallback();
    await assertNetworkSafe("rex_truth_chain_route_error_get_only_network", { requireMoments: true, requireMoves: true });

    await setFixtureMode("history-error");
    await remountParties();
    await harness.waitForPagePredicate("Backend unavailable degraded ready", () => {
      const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
      return {
        ok: panel?.getAttribute("data-backend-status") === "unavailable",
        status: panel?.getAttribute("data-backend-status"),
      };
    }, 30_000);
    await assertHistoryDegraded();
    await assertNetworkSafe("rex_truth_chain_degraded_get_only_network");
    await captureScreenshot("rex_parties_r2l1_degraded.png");

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
      harness.fail("rex_truth_chain_moments_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("rex_truth_chain_moments_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_truth_chain_moments_integration_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
