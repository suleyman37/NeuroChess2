#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R2E1.TRUTH-CHAIN-INSTRUMENTIZATION-AND-VISUAL-EXPLANATION-PASS-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R2E1_TRUTH_CHAIN_INSTRUMENTIZATION_AND_VISUAL_EXPLANATION_PASS_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const FORBIDDEN_VISIBLE_TEXT = [
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction elo",
  "prédiction elo",
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
];

const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const HISTORY_ROUTE = "/games/history?limit=50&offset=0&scope=mine";

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_parties_loaded_fixture_smoke.json");
evidence.strategy = "REX Parties loaded Truth Chain instrumentization via browser network fixture, GET-only, no backend writes";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_parties_loaded_fixture_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.route_sources = [
  "frontend/src/api/client.ts:getGameHistory -> request(`/games/history?...`)",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/history\")",
];
evidence.fixture_summary = {
  route: `GET ${HISTORY_ROUTE}`,
  totalGames: 3,
  latestGame: {
    white: "bahij",
    black: "ClubRival",
    result: "0-1",
    openingName: "Sicilian Defense: Najdorf",
    reviewStatus: "review_available",
  },
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

async function installLoadedFixture() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const fixtureGames = [
          {
            game_id: 9001,
            import_id: 7001,
            source: "r2c-browser-fixture",
            source_game_id: "r2c-loaded-001",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2c-fixture-v1",
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
            source: "r2c-browser-fixture",
            source_game_id: "r2c-loaded-002",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2c-fixture-v1",
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
            source: "r2c-browser-fixture",
            source_game_id: "r2c-loaded-003",
            import_status: "imported",
            import_warnings: [],
            import_error: null,
            import_schema_version: "r2c-fixture-v1",
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
        const calls = [];
        Object.defineProperty(window, "__rexNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        window.__rexPartiesFixtureMode = "loaded";
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
          calls.push({ transport: "fetch", method, url, mocked: isHistory, fixtureMode: window.__rexPartiesFixtureMode });
          if (isHistory && method === "GET") {
            if (window.__rexPartiesFixtureMode === "degraded") {
              return Promise.reject(new TypeError("R2C mocked backend unavailable"));
            }
            return Promise.resolve(
              new Response(JSON.stringify(fixtureGames), {
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
  harness.mark(stage, "pass", "no forbidden Parties text visible");
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
  const splineCalls = calls.filter((call) => /spline|splinetool|scene\\.splinecode/i.test(String(call.url)));
  if (splineCalls.length > 0) {
    harness.fail("rex_parties_loaded_no_spline_network", JSON.stringify(splineCalls));
  }
  const historyCall = calls.find((call) => call.mocked && String(call.url).includes("/games/history"));
  if (!historyCall) {
    harness.fail("rex_parties_loaded_history_mock_used", JSON.stringify(calls));
  }
  harness.mark(stage, "pass", JSON.stringify(calls));
}

async function assertLoadedState() {
  const loadedState = await harness.evalPage(() => {
    const normalize = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const text = normalize(document.body?.innerText ?? "");
    const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
    const truthChain = document.querySelector('[data-testid="rex-artifact-truth-chain"]');
    const statuses = [...(truthChain?.querySelectorAll("[data-rex-step-status]") ?? [])].map((step) => ({
      label: normalize(step.querySelector(".rex-flow-rail__step")?.textContent),
      status: step.getAttribute("data-rex-step-status"),
      note: normalize(step.querySelector(".rex-flow-rail__status")?.textContent),
    }));
    return {
      ok:
        panel?.getAttribute("data-backend-status") === "ready" &&
        statuses.length === 4 &&
        statuses[0]?.status === "available" &&
        statuses[1]?.status === "available" &&
        statuses[2]?.status === "available" &&
        statuses[3]?.status === "unavailable" &&
        text.includes("clubrival") &&
        text.includes("sicilian defense: najdorf") &&
        text.includes("matiere brute") &&
        text.includes("pgn lu") &&
        text.includes("ouverture detectee") &&
        text.includes("review prete") &&
        text.includes("a brancher") &&
        text.includes("plan post-ouverture") &&
        text.includes("lecture seule") &&
        text.includes("aucune"),
      backendStatus: panel?.getAttribute("data-backend-status"),
      statuses,
      hasClubRival: text.includes("clubrival"),
      hasNajdorf: text.includes("sicilian defense: najdorf"),
      hasRawMatter: text.includes("matiere brute"),
      hasOpeningSignal: text.includes("ouverture detectee"),
      hasReviewProof: text.includes("review prete"),
      hasReadOnly: text.includes("lecture seule"),
      text: text.slice(0, 900),
    };
  });
  if (!loadedState.ok) {
    harness.fail("rex_parties_loaded_state_visible", JSON.stringify(loadedState));
  }
  harness.mark("rex_parties_loaded_state_visible", "pass", JSON.stringify(loadedState));
}

async function assertDegradedStillOk() {
  await harness.evalPage(() => {
    window.__rexPartiesFixtureMode = "degraded";
  });
  await harness.clickByTestId("rex-nav-qg", { afterMs: 220 });
  await harness.clickByTestId("rex-nav-parties", { afterMs: 220 });
  await harness.waitForPagePredicate("Parties degraded state ready", () => {
    const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
    const state = panel?.getAttribute("data-backend-status");
    const text = document.body?.innerText ?? "";
    return {
      ok: state === "unavailable",
      state,
      text: text.slice(0, 500),
    };
  }, 30_000);
  harness.mark("rex_parties_degraded_still_ok", "pass", "backend unavailable fallback visible");
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:65535";
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await installLoadedFixture();

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX shell ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        Boolean(document.querySelector('[data-testid="rex-nav"]')),
    }), 30_000);
    harness.mark("rex_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.clickByTestId("rex-nav-parties", { afterMs: 260 });
    await harness.waitForPagePredicate("Parties loaded state ready", () => {
      const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
      const state = panel?.getAttribute("data-backend-status");
      const text = document.body?.innerText ?? "";
      return {
        ok: state === "ready" && text.includes("ClubRival"),
        state,
        text: text.slice(0, 500),
      };
    }, 30_000);

    await assertLoadedState();
    await assertForbiddenTextAbsent("rex_parties_loaded_forbidden_text_absent");
    await assertReadOnlyNetwork("rex_parties_loaded_get_only_network");
    await captureScreenshot("rex_parties_r2e1_loaded_instrument.png");

    await assertDegradedStillOk();
    await captureScreenshot("rex_parties_r2e1_degraded_still_ok.png");

    await assertForbiddenTextAbsent("rex_parties_degraded_forbidden_text_absent");
    await assertReadOnlyNetwork("rex_parties_degraded_get_only_network");

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&designLab=1` });
    await harness.waitForPagePredicate("Design Lab still accessible", () => ({
      ok: Boolean(document.querySelector('[data-testid="rex-design-lab"]')),
    }), 30_000);
    harness.mark("rex_design_lab_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
    await harness.waitForPagePredicate("V1 route still accessible", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          !document.querySelector('[data-testid="rex-shell"]') &&
          !document.querySelector('[data-testid="rex-design-lab"]') &&
          (text.includes("Aujourd") || text.includes("Mes parties") || text.includes("NeuroChess")),
        text: text.slice(0, 300),
      };
    }, 30_000);
    harness.mark("v1_route_without_rex_accessible", "pass", `${harness.frontendBaseUrl}/app`);

    if (evidence.browser_errors.page.length > 0) {
      harness.fail("rex_parties_loaded_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("rex_parties_loaded_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_parties_loaded_fixture_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
