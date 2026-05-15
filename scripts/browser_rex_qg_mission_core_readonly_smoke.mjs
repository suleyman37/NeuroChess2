#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R3B1.QG-COPY-CONSISTENCY-AND-PRIMARY-ACTION-MICRO-POLISH";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R3B1_QG_COPY_CONSISTENCY_AND_PRIMARY_ACTION_MICRO_POLISH",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const HISTORY_ROUTE = "/games/history?limit=50&offset=0&scope=mine";
const MOMENTS_ROUTE = "/games/9001/truth-chain/moments";
const MOVES_ROUTE = "/games/9001/moves";
const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const FORBIDDEN_VISIBLE_TEXT = [
  "Daily Plan genere",
  "XP gagne",
  "Rang",
  "Transfer Score",
  "plan optimal",
  "mission parfaite",
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction Elo",
  "raw WDL",
  "criticality_score",
  "diagnostic_gap",
  "ETV",
  "FSRS",
  "SkillTrace mastery",
  "tu es nul",
  ["zero", "donnee", "reelle"].join(" "),
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_qg_mission_core_readonly_smoke.json");
evidence.strategy = "REX QG Mission Core from read-only Truth Chain fixtures, no Daily Plan/Practice/Review route";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_qg_mission_core_readonly_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.fixture_summary = {
  historyRoute: `GET ${HISTORY_ROUTE}`,
  momentsRoute: `GET ${MOMENTS_ROUTE}`,
  movesRoute: `GET ${MOVES_ROUTE}`,
  scenarios: ["moments", "moves-only", "empty", "degraded"],
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

async function installQGFixtures() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const fixtureGames = [
          {
            game_id: 9001,
            import_id: 7001,
            source: "r3b-browser-fixture",
            source_game_id: "r3b-qg-001",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r3b-fixture-v1",
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
              limitations: []
            },
            {
              id: "rm-9001-2",
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
              id: "rm-9001-3",
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
              limitations: []
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
          ...fixtureMoments,
          moments: [],
          limitations: ["no persisted review moments"],
        };
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
        const calls = [];
        Object.defineProperty(window, "__rexQGNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const requestMethod = input instanceof Request ? input.method : undefined;
          const method = String((init && init.method) || requestMethod || "GET").toUpperCase();
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          const parsed = new URL(url, window.location.origin);
          const scenario = new URL(window.location.href).searchParams.get("qgScenario") || "moments";
          calls.push({ transport: "fetch", method, url: parsed.href, pathname: parsed.pathname });

          if (parsed.pathname === "/games/history") {
            if (scenario === "degraded") {
              return Promise.resolve(new Response(JSON.stringify({ detail: "offline" }), {
                status: 503,
                headers: { "content-type": "application/json" }
              }));
            }
            const payload = scenario === "empty" ? [] : fixtureGames;
            return Promise.resolve(new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "content-type": "application/json" }
            }));
          }
          if (parsed.pathname === "/games/9001/truth-chain/moments") {
            const payload = scenario === "moves-only" ? emptyMoments : fixtureMoments;
            return Promise.resolve(new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "content-type": "application/json" }
            }));
          }
          if (parsed.pathname === "/games/9001/moves") {
            return Promise.resolve(new Response(JSON.stringify(fixtureMoves), {
              status: 200,
              headers: { "content-type": "application/json" }
            }));
          }
          return originalFetch.apply(this, arguments);
        };
      })();
    `,
  });
}

async function goToQGScenario(scenario, expectedSource) {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?rex=1&qgScenario=${encodeURIComponent(scenario)}`,
  });
  await harness.waitForPagePredicate(`QG scenario ${scenario}`, (source) => {
    const core = document.querySelector('[data-testid="rex-qg-mission-core"]');
    const text = document.body?.innerText ?? "";
    return {
      ok:
        Boolean(core) &&
        core?.getAttribute("data-qg-source") === source &&
        text.includes("Mission proposée depuis données existantes"),
      source: core?.getAttribute("data-qg-source"),
      text: text.slice(0, 600),
    };
  }, 30_000, expectedSource);
  harness.mark(`qg_${scenario}_state_visible`, "pass", expectedSource);
}

async function networkCalls() {
  const calls = await harness.evalPage(() => window.__rexQGNetworkCalls ?? []);
  evidence.network_calls = calls;
  harness.writeEvidence();
  return calls;
}

async function assertReadOnlyNetwork(stage) {
  const calls = await networkCalls();
  const forbiddenMethods = calls.filter((call) => FORBIDDEN_METHODS.has(String(call.method).toUpperCase()));
  if (forbiddenMethods.length > 0) {
    harness.fail(`${stage}_no_write_methods`, JSON.stringify(forbiddenMethods));
  }
  const forbiddenRoutes = calls.filter((call) => {
    const pathValue = String(call.pathname ?? call.url ?? "").toLowerCase();
    return (
      /^\/games\/[^/]+\/review(?:$|\/|\?)/.test(pathValue) ||
      pathValue.includes("/practice") ||
      pathValue.includes("daily-plan") ||
      pathValue.includes("import-pgn") ||
      pathValue.includes("analyze") ||
      pathValue.includes("training")
    );
  });
  if (forbiddenRoutes.length > 0) {
    harness.fail(`${stage}_forbidden_routes_absent`, JSON.stringify(forbiddenRoutes));
  }
  harness.mark(`${stage}_readonly_network`, "pass", JSON.stringify(calls));
}

async function assertForbiddenTextAbsent(stage) {
  const normalized = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => normalized.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail(stage, visible.join(", "));
  }
  harness.mark(stage, "pass", "no forbidden QG text visible");
}

async function assertQGText(stage, labels) {
  await harness.assertPageContains(stage, labels);
  await assertForbiddenTextAbsent(`${stage}_forbidden_text_absent`);
  await assertReadOnlyNetwork(stage);
}

async function assertShellAccess() {
  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate("V1 app accessible", () => {
    const text = document.body?.innerText ?? "";
    return { ok: text.includes("Aujourd") && text.includes("Mes parties") && text.includes("Entra") };
  }, 30_000);
  harness.mark("v1_route_accessible", "pass", `${harness.frontendBaseUrl}/app`);

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&qgScenario=moments` });
  await harness.waitForPagePredicate("REX shell accessible", () => ({
    ok: Boolean(document.querySelector('[data-testid="rex-shell"]')),
  }), 30_000);
  harness.mark("rex_route_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

  await harness.clickByTestId("rex-nav-parties", { afterMs: 500 });
  await harness.waitForPagePredicate("Parties still accessible", () => ({
    ok: Boolean(document.querySelector('[data-testid="rex-surface-parties"]')),
  }), 30_000);
  harness.mark("parties_surface_still_accessible", "pass", "Parties visible from REX shell");

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&designLab=1` });
  await harness.waitForPagePredicate("Design Lab accessible", () => ({
    ok: Boolean(document.querySelector('[data-testid="rex-design-lab"]')),
  }), 30_000);
  harness.mark("design_lab_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&fxLab=1` });
  await harness.waitForPagePredicate("FX Lab accessible", () => ({
    ok: Boolean(document.querySelector('[data-testid="rex-fx-lab"]')),
  }), 30_000);
  harness.mark("fx_lab_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&fxLab=1`);
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:65535";
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await installQGFixtures();

    await goToQGScenario("moments", "truth_chain_moments");
    await assertQGText("qg_truth_moments_copy", [
      "Revoir les moments détectés",
      "Mission proposée depuis données existantes",
      "Lecture seule",
      "Truth Chain moments",
      "Moments Review lus",
    ]);
    await captureScreenshot("rex_qg_r3b1_truth_moments.png");

    await goToQGScenario("moves-only", "moves_only");
    await assertQGText("qg_moves_only_copy", [
      "Explorer la dernière partie lue",
      "Moves-only",
      "Historique lu · moments absents",
      "Mission proposée depuis données existantes",
    ]);
    await captureScreenshot("rex_qg_r3b1_moves_only.png");

    await goToQGScenario("empty", "empty");
    await assertQGText("qg_empty_copy", [
      "Importer une partie",
      "Prototype non-mutating",
      "Mission proposée depuis données existantes",
    ]);
    await captureScreenshot("rex_qg_r3b1_empty.png");

    await goToQGScenario("degraded", "unavailable");
    await assertQGText("qg_degraded_copy", [
      "Lecture indisponible",
      "Mission proposée depuis données existantes",
      "Lecture backend indisponible",
    ]);
    await captureScreenshot("rex_qg_r3b1_degraded.png");

    await assertShellAccess();

    const criticalConsole = harness.evidence.browser_errors.console.filter(
      (message) => !/failed to load resource: the server responded with a status of 404/i.test(String(message)),
    );
    if (criticalConsole.length || harness.evidence.browser_errors.page.length) {
      harness.fail("browser_console_clean", JSON.stringify({
        ...harness.evidence.browser_errors,
        console: criticalConsole,
      }));
    }
    harness.mark("browser_console_clean", "pass", "no critical console/page errors");
    harness.mark("smoke_complete", "pass", "R3B QG Mission Core read-only scenarios passed");
  } finally {
    harness.writeEvidence();
    await harness.cleanupProcesses();
  }
}

main().catch(async (error) => {
  harness.fail("smoke_failed", error?.stack ?? String(error));
});
