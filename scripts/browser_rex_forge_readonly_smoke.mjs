#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R3E.FORGE-READONLY-PREVIEW-INTEGRATION-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\suley",
  "Documents",
  "Dev",
  "NeuroChess_QA_Artifacts",
  "R3E_FORGE_READONLY_PREVIEW_INTEGRATION_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const HISTORY_ROUTE = "/games/history?limit=50&offset=0&scope=mine";
const MOMENTS_ROUTE = "/games/9001/truth-chain/moments";
const MOVES_ROUTE = "/games/9001/moves";
const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const FORBIDDEN_VISIBLE_TEXT = [
  "Exercice cree",
  "Drill pret",
  "S'entrainer maintenant",
  "S'entraîner maintenant",
  "XP a gagner",
  "XP à gagner",
  "Rang",
  "Transfer Score",
  "Daily Plan",
  "due_at",
  "plan genere",
  "plan généré",
  "competence maitrisee",
  "compétence maîtrisée",
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction Elo",
  "prédiction Elo",
  "raw WDL",
  "criticality_score",
  "diagnostic_gap",
  "ETV",
  "FSRS",
  "SkillTrace mastery",
  "tu es nul",
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_forge_readonly_smoke.json");
evidence.strategy = "REX Forge reads only history/truth-chain/moves fixtures and never calls Practice/Daily/Review";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_forge_readonly_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.fixture_summary = {
  historyRoute: `GET ${HISTORY_ROUTE}`,
  momentsRoute: `GET ${MOMENTS_ROUTE}`,
  movesRoute: `GET ${MOVES_ROUTE}`,
  scenarios: ["truth-no-exercise", "truth-existing-exercise", "moves-only", "empty", "degraded"],
};

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name) {
  await harness.browserClient.send("Page.bringToFront");
  await harness.evalPage(async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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

async function installForgeFixtures() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const fixtureGames = [
          {
            game_id: 9001,
            import_id: 7001,
            source: "r3e-forge-fixture",
            source_game_id: "r3e-forge-001",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r3e-fixture-v1",
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
        const baseMoments = [
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
            exerciseAvailable: false,
            source: "persisted_review_moment",
            limitations: ["no persisted exercise"]
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
            visualSeverity: "medium",
            reviewAvailable: true,
            exerciseAvailable: false,
            source: "persisted_review_moment",
            limitations: ["no persisted exercise"]
          }
        ];
        const readOnlyProof = {
          route: "/games/{game_id}/truth-chain/moments",
          methodsAllowed: ["GET"],
          writesPerformed: false,
          trainingItemsCreated: false,
          dailyPlanTouched: false,
          dueAtTouched: false,
          engineInvoked: false
        };
        const fixtureMoments = (withExercise) => ({
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
          moments: baseMoments.map((moment, index) => ({
            ...moment,
            exerciseAvailable: withExercise && index === 0
          })),
          limitations: [],
          readOnlyProof
        });
        const emptyMoments = {
          game: fixtureMoments(false).game,
          moments: [],
          limitations: ["no persisted review moments"],
          readOnlyProof
        };
        const calls = [];
        Object.defineProperty(window, "__rexForgeNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        window.__rexForgeResetNetworkCalls = () => calls.splice(0, calls.length);
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const requestMethod = input instanceof Request ? input.method : undefined;
          const method = String((init && init.method) || requestMethod || "GET").toUpperCase();
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          const parsed = new URL(url, window.location.href);
          const scenario = new URL(window.location.href).searchParams.get("forgeScenario") || "truth-no-exercise";
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
            url: parsed.href,
            pathname: parsed.pathname,
            mocked: isHistory || isMoments || isMoves,
            fixtureScenario: scenario,
          });
          if (method === "GET" && isHistory) {
            if (scenario === "degraded") {
              return Promise.resolve(new Response(JSON.stringify({ detail: "offline" }), {
                status: 503,
                headers: { "content-type": "application/json" }
              }));
            }
            return Promise.resolve(new Response(JSON.stringify(scenario === "empty" ? [] : fixtureGames), {
              status: 200,
              headers: { "content-type": "application/json" }
            }));
          }
          if (method === "GET" && isMoments) {
            if (scenario === "truth-no-exercise") {
              return Promise.resolve(new Response(JSON.stringify(fixtureMoments(false)), {
                status: 200,
                headers: { "content-type": "application/json" }
              }));
            }
            if (scenario === "truth-existing-exercise") {
              return Promise.resolve(new Response(JSON.stringify(fixtureMoments(true)), {
                status: 200,
                headers: { "content-type": "application/json" }
              }));
            }
            if (scenario === "moves-only" || scenario === "empty" || scenario === "degraded") {
              return Promise.resolve(new Response(JSON.stringify(emptyMoments), {
                status: 200,
                headers: { "content-type": "application/json" }
              }));
            }
          }
          if (method === "GET" && isMoves) {
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

async function resetNetworkCalls() {
  await harness.evalPage(() => {
    window.__rexForgeResetNetworkCalls?.();
  });
}

async function networkCalls() {
  const calls = await harness.evalPage(() => window.__rexForgeNetworkCalls ?? []);
  evidence.network_calls = calls;
  harness.writeEvidence();
  return calls;
}

function isUnsafeReviewCall(call) {
  const pathname = String(call.pathname ?? "");
  return /^\/games\/[^/]+\/review(?:$|\/|\?)/i.test(pathname);
}

async function assertNetworkSafe(stage, { requireMoments = false, requireMoves = false } = {}) {
  const calls = await networkCalls();
  const forbiddenWrites = calls.filter((call) => FORBIDDEN_METHODS.has(String(call.method).toUpperCase()));
  if (forbiddenWrites.length > 0) {
    harness.fail(`${stage}_no_write_methods`, JSON.stringify(forbiddenWrites));
  }
  const reviewCalls = calls.filter(isUnsafeReviewCall);
  if (reviewCalls.length > 0) {
    harness.fail(`${stage}_no_review_route`, JSON.stringify(reviewCalls));
  }
  const blockedRoutes = calls.filter((call) =>
    /daily-plan|practice|import-pgn|review\/generate|review\/rebuild|analy[sz]e|live-analysis|training/i.test(
      String(call.pathname ?? call.url ?? ""),
    ),
  );
  if (blockedRoutes.length > 0) {
    harness.fail(`${stage}_no_side_effect_routes`, JSON.stringify(blockedRoutes));
  }
  const historyCall = calls.find((call) => String(call.pathname).includes("/games/history"));
  const momentsCall = calls.find((call) => String(call.pathname).includes("/games/9001/truth-chain/moments"));
  const movesCall = calls.find((call) => String(call.pathname).includes("/games/9001/moves"));
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
  harness.mark(stage, "pass", "no forbidden Forge text visible");
}

async function assertOpportunityLimit(stage) {
  const state = await harness.evalPage(() => {
    const opportunities = [...document.querySelectorAll('[data-testid="rex-forge-opportunity"]')];
    return {
      ok: opportunities.length <= 3,
      count: opportunities.length,
      labels: opportunities.map((node) => node.textContent?.replace(/\s+/g, " ").trim()),
    };
  });
  if (!state.ok) {
    harness.fail(stage, JSON.stringify(state));
  }
  harness.mark(stage, "pass", JSON.stringify(state));
}

async function openForgeScenario(scenario, expectedSource) {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}/app?rex=1&forgeScenario=${encodeURIComponent(scenario)}`,
  });
  await harness.waitForPagePredicate(`REX shell ready ${scenario}`, () => ({
    ok:
      Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
      Boolean(document.querySelector('[data-testid="rex-nav-forge"]')),
  }), 30_000);
  await delay(350);
  await resetNetworkCalls();
  await harness.clickByTestId("rex-nav-forge", { afterMs: 300 });
  await harness.waitForPagePredicate(`Forge scenario ${scenario}`, (source) => {
    const core = document.querySelector('[data-testid="rex-forge-core"]');
    const title = document.querySelector('[data-testid="rex-forge-title"]');
    return {
      ok:
        Boolean(core) &&
        core?.getAttribute("data-forge-source") === source &&
        core?.getAttribute("data-backend-status") !== "loading" &&
        Boolean(title?.textContent?.trim()),
      source: core?.getAttribute("data-forge-source"),
      status: core?.getAttribute("data-backend-status"),
      title: title?.textContent,
    };
  }, 30_000, expectedSource);
  harness.mark(`forge_${scenario}_visible`, "pass", expectedSource);
}

async function assertForgeText(stage, labels) {
  await harness.assertPageContains(stage, labels);
  await assertForbiddenTextAbsent(`${stage}_forbidden_text_absent`);
  await assertOpportunityLimit(`${stage}_max_three_opportunities`);
}

async function assertAccessRoutes() {
  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate("V1 app accessible", () => {
    const text = document.body?.innerText ?? "";
    return {
      ok: !document.querySelector('[data-testid="rex-shell"]') && text.includes("Mes parties"),
      text: text.slice(0, 400),
    };
  }, 30_000);
  harness.mark("v1_route_accessible", "pass", `${harness.frontendBaseUrl}/app`);

  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
  await harness.waitForPagePredicate("REX app accessible", () => ({
    ok: Boolean(document.querySelector('[data-testid="rex-shell"]')),
  }), 30_000);
  harness.mark("rex_route_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

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
    await installForgeFixtures();

    await openForgeScenario("truth-no-exercise", "truth_chain_moments");
    await assertForgeText("forge_truth_moment_preview_copy", [
      "Transformer un moment en entraînement",
      "Moment à transformer",
      "Preview read-only",
      "Préparer la Forge",
    ]);
    await assertNetworkSafe("forge_truth_moment_preview_network", { requireMoments: true });
    await captureScreenshot("rex_forge_r3e_truth_moment_preview.png");

    await openForgeScenario("truth-existing-exercise", "truth_chain_moments");
    await assertForgeText("forge_existing_exercise_detected_copy", [
      "Exercice existant détecté",
      "Voir la position",
      "Preview read-only",
    ]);
    await assertNetworkSafe("forge_existing_exercise_detected_network", { requireMoments: true });
    await captureScreenshot("rex_forge_r3e_existing_exercise_detected.png");

    await openForgeScenario("moves-only", "moves_only");
    await assertForgeText("forge_moves_only_fallback_copy", [
      "Partie lue · Forge non disponible",
      "Les coups sont disponibles",
      "Voir la Truth Chain",
    ]);
    await assertNetworkSafe("forge_moves_only_fallback_network", { requireMoments: true, requireMoves: true });
    await captureScreenshot("rex_forge_r3e_moves_only_fallback.png");

    await openForgeScenario("empty", "empty");
    await assertForgeText("forge_empty_copy", [
      "Importer une partie",
      "Prototype non-mutating",
      "Aucune création",
    ]);
    await assertNetworkSafe("forge_empty_network");
    await captureScreenshot("rex_forge_r3e_empty.png");

    await openForgeScenario("degraded", "unavailable");
    await assertForgeText("forge_degraded_copy", [
      "Lecture indisponible",
      "Aucune création",
      "Indisponible",
    ]);
    await assertNetworkSafe("forge_degraded_network");
    await captureScreenshot("rex_forge_r3e_degraded.png");

    await assertAccessRoutes();

    const criticalConsole = harness.evidence.browser_errors.console.filter(
      (message) => !/failed to load resource/i.test(String(message)),
    );
    if (criticalConsole.length || harness.evidence.browser_errors.page.length) {
      harness.fail("forge_no_page_crash", JSON.stringify({
        ...harness.evidence.browser_errors,
        console: criticalConsole,
      }));
    }
    harness.mark("forge_no_page_crash", "pass", "no runtime page exception");
    harness.mark("smoke_complete", "pass", "R3E Forge read-only preview scenarios passed");
    harness.writeEvidence();
    console.log(`PASS browser_rex_forge_readonly_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
